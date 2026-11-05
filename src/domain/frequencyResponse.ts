import { solveSingleStub, type SingleStubInput, type SingleStubSolution, type StubTermination } from './singleStub';
import { solveSeriesStub, type SeriesStubInput, type SeriesStubSolution } from './seriesStub';
import { solveQuarterWave, type QuarterWaveInput, type QuarterWaveSolution } from './quarterWave';
import { solveDoubleStub, type DoubleStubInput, type DoubleStubSolution } from './doubleStub';
import { evaluateLumpedMatching, solveLumpedMatching, type LumpedMatchingInput, type LumpedMatchingSolution } from './lumpedMatching';
import { solveLine, type ComplexValue, type LineInput } from './transmission';

/** Networks are synthesized once at f0, then their physical dimensions stay fixed.
 * Loads and characteristic impedances are constant; lines are lossless and
 * nondispersive. Each length uses its own guided wavelength at f0, so scaling
 * its electrical angle by f/f0 does not assume equal propagation velocities.
 */
export type FrequencyResponseDesign =
  | { kind: 'single-stub'; input: SingleStubInput; solution?: SingleStubSolution; termination: StubTermination }
  | { kind: 'series-stub'; input: SeriesStubInput; solution?: SeriesStubSolution; termination: StubTermination }
  | { kind: 'quarter-wave'; input: QuarterWaveInput; solution?: QuarterWaveSolution }
  | { kind: 'double-stub'; input: DoubleStubInput; solution?: DoubleStubSolution; termination1: StubTermination; termination2: StubTermination }
  | { kind: 'lumped'; input: LumpedMatchingInput; solution?: LumpedMatchingSolution }
  | { kind: 'line'; input: LineInput };

export type FrequencyResponseBranch = {
  id: string;
  /** One-based matching branch; zero denotes the bare load. */
  labelIndex: number;
  /** Sum of one-way line and stub lengths, in their own wavelengths at f0.
   * Used to bound oscillations when choosing a frequency-sweep resolution.
   * Zero for the bare-load magnitude and concentrated-element networks.
   */
  maxElectricalLength?: number;
  /** Evaluate |Γin| at the dimensionless frequency f/f0. */
  evaluate: (ratio: number) => number;
};

export type FrequencyResponseSample = { frequencyHz: number; magnitude: number };
export type FrequencySweepRange = { designFrequencyHz: number; startHz: number; stopHz: number };

// Homogeneous voltage/current coordinates represent exact opens and shorts
// without converting a stub pole into a huge finite reactance. Current is
// normalized as Z0 I; consequently z = v/i and Γ = (v-i)/(v+i).
type Port = { v: ComplexValue; i: ComplexValue };

function positive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive and finite.`);
}

function normalize({ v, i }: Port): Port {
  const scale = Math.max(Math.abs(v.re), Math.abs(v.im), Math.abs(i.re), Math.abs(i.im));
  if (!Number.isFinite(scale) || scale === 0) throw new RangeError('The frequency response is outside the numeric range.');
  return { v: { re: v.re / scale, im: v.im / scale }, i: { re: i.re / scale, im: i.im / scale } };
}

function portAtLoad(normalizedLoad: ComplexValue | null): Port {
  return normalizedLoad === null ? { v: { re: 1, im: 0 }, i: { re: 0, im: 0 } }
    : normalize({ v: { ...normalizedLoad }, i: { re: 1, im: 0 } });
}

function trig(length: number): { sin: number; cos: number } {
  if (!Number.isFinite(length) || length < 0) throw new RangeError('The electrical length is outside the numeric range.');
  const reduced = length % 0.5;
  if (reduced === 0) return { sin: 0, cos: 1 };
  if (reduced === 0.25) return { sin: 1, cos: 0 };
  if (reduced === 0.125) return { sin: Math.SQRT1_2, cos: Math.SQRT1_2 };
  if (reduced === 0.375) return { sin: Math.SQRT1_2, cos: -Math.SQRT1_2 };
  const angle = 2 * Math.PI * reduced;
  return { sin: Math.sin(angle), cos: Math.cos(angle) };
}

function line(port: Port, length: number, characteristicRatio = 1): Port {
  const { sin, cos } = trig(length);
  const scale = Math.max(1, characteristicRatio, 1 / characteristicRatio);
  const c = cos / scale, a = sin * (characteristicRatio / scale), b = sin * ((1 / characteristicRatio) / scale);
  const { v, i } = port;
  return normalize({
    v: { re: c * v.re - a * i.im, im: c * v.im + a * i.re },
    i: { re: c * i.re - b * v.im, im: c * i.im + b * v.re },
  });
}

function reactance(port: Port, connection: 'series' | 'parallel', numerator: number, denominator: number): Port {
  if (denominator === 0) return connection === 'series'
    ? { v: { re: 1, im: 0 }, i: { re: 0, im: 0 } }
    : { v: { re: 0, im: 0 }, i: { re: 1, im: 0 } };
  const scale = Math.max(Math.abs(numerator), Math.abs(denominator));
  const n = numerator / scale, d = denominator / scale;
  const { v, i } = port;
  return connection === 'series'
    ? normalize({ v: { re: d * v.re - n * i.im, im: d * v.im + n * i.re }, i: { re: d * i.re, im: d * i.im } })
    : normalize({ v: { re: d * v.re, im: d * v.im }, i: { re: d * i.re - n * v.im, im: d * i.im + n * v.re } });
}

function stub(port: Port, connection: 'series' | 'parallel', termination: StubTermination, length: number, ratio: number): Port {
  const { sin, cos } = trig(length);
  const tangent = (connection === 'series') === (termination === 'short');
  return reactance(port, connection, ratio * (tangent ? sin : -cos), tangent ? cos : sin);
}

function magnitude({ v, i }: Port): number {
  const plus = Math.hypot(v.re + i.re, v.im + i.im);
  if (plus === 0) throw new RangeError('The frequency response is outside the numeric range.');
  return Math.min(1, Math.hypot(v.re - i.re, v.im - i.im) / plus);
}

function response(index: number, evaluate: (ratio: number) => number, maxElectricalLength = 0): FrequencyResponseBranch {
  return { id: index === 0 ? 'load' : `branch-${index}`, labelIndex: index, maxElectricalLength, evaluate: ratio => {
    positive(ratio, 'Frequency ratio');
    const result = evaluate(ratio);
    if (!Number.isFinite(result) || result < 0 || result > 1) throw new RangeError('The frequency response is outside the numeric range.');
    return result;
  } };
}

function termination(value: StubTermination): void {
  if (value !== 'open' && value !== 'short') throw new RangeError('Choose an open or short stub termination.');
}

/** Snapshot the solved geometry and component values; never solve again while sweeping. */
export function createFrequencyResponse(design: FrequencyResponseDesign): FrequencyResponseBranch[] {
  const { input } = design;
  const base = solveLine({ z0: input.z0, load: input.load, lengthInWavelengths: 0 });
  const load = portAtLoad(base.normalizedLoad);
  const bare = () => [response(0, () => base.reflectionMagnitude)];
  switch (design.kind) {
    case 'line':
      // A uniform lossless line changes phase, never |Γ|.
      solveLine(design.input);
      return bare();
    case 'single-stub':
    case 'series-stub': {
      termination(design.termination);
      positive(design.input.stubZ0, 'Stub impedance');
      const series = design.kind === 'series-stub';
      const ratio = series ? design.input.stubZ0 / input.z0 : input.z0 / design.input.stubZ0;
      positive(ratio, 'Stub impedance ratio');
      const solution = design.solution ?? (design.kind === 'single-stub' ? solveSingleStub(design.input) : solveSeriesStub(design.input));
      if (solution.status === 'already-matched') return bare();
      return solution.branches.map((branch, index) => {
        const distance = branch.distance;
        const length = design.termination === 'open' ? branch.openLength : branch.shortLength;
        const end = design.termination;
        return response(index + 1, f => magnitude(stub(line(load, distance * f), series ? 'series' : 'parallel', end, length * f, ratio)), distance + length);
      });
    }
    case 'quarter-wave': {
      const solution = design.solution ?? solveQuarterWave(design.input);
      return solution.branches.map((branch, index) => {
        const distance = branch.distance, length = branch.transformerLength, ratio = branch.transformerZ0 / input.z0;
        positive(ratio, 'Transformer impedance ratio');
        return response(index + 1, f => magnitude(line(line(load, distance * f), length * f, ratio)), distance + length);
      });
    }
    case 'double-stub': {
      termination(design.termination1); termination(design.termination2);
      positive(design.input.stub1Z0, 'Stub 1 impedance'); positive(design.input.stub2Z0, 'Stub 2 impedance');
      const ratio1 = input.z0 / design.input.stub1Z0, ratio2 = input.z0 / design.input.stub2Z0;
      positive(ratio1, 'Stub 1 impedance ratio'); positive(ratio2, 'Stub 2 impedance ratio');
      const solution = design.solution ?? solveDoubleStub(design.input);
      const distance = design.input.distance, separation = design.input.separation;
      const end1 = design.termination1, end2 = design.termination2;
      return solution.branches.map((branch, index) => {
        const length1 = end1 === 'open' ? branch.stub1.openLength : branch.stub1.shortLength;
        const length2 = end2 === 'open' ? branch.stub2.openLength : branch.stub2.shortLength;
        return response(index + 1, f => {
          const at2 = stub(line(load, distance * f), 'parallel', end2, length2 * f, ratio2);
          return magnitude(stub(line(at2, separation * f), 'parallel', end1, length1 * f, ratio1));
        }, distance + separation + length1 + length2);
      });
    }
    case 'lumped': {
      const solution = design.solution ?? solveLumpedMatching(design.input);
      if (solution.status === 'already-matched') return bare();
      return solution.branches.map((branch, index) => {
        // Compute the contributions from the returned physical L/C values once,
        // including their rounding, rather than idealizing the synthesized pair.
        const values: [number, number] = [branch.elements[0].value, branch.elements[1].value];
        const stages = evaluateLumpedMatching({ ...design.input, values }).stages.map(stage => ({ ...stage }));
        return response(index + 1, f => {
          let port = load;
          for (const stage of stages) {
            const proportional = (stage.component === 'L') === (stage.connection === 'series');
            const scale = Math.max(1, f);
            // Keep the signed rational value homogeneous even for very small f.
            port = reactance(port, stage.connection, stage.normalizedValue * (proportional ? f / scale : 1 / scale), proportional ? 1 / scale : f / scale);
          }
          return magnitude(port);
        });
      });
    }
  }
}

function validateRange(range: FrequencySweepRange): void {
  positive(range.designFrequencyHz, 'Design frequency');
  positive(range.startHz, 'Start frequency');
  positive(range.stopHz, 'Stop frequency');
  if (range.stopHz <= range.startHz) throw new RangeError('The stop frequency must be greater than the start frequency.');
  positive(range.startHz / range.designFrequencyHz, 'Start frequency ratio');
  positive(range.stopHz / range.designFrequencyHz, 'Stop frequency ratio');
}

/** Choose a bounded sweep resolution from the fastest electrical path.
 * At least 128 samples per summed guided wavelength (64 per reflection cycle)
 * prevent ordinary line/stub resonances from aliasing on broad sweeps. Refuse
 * intervals beyond the resolution cap rather than silently plotting an
 * under-resolved curve. The exact design frequency is inserted separately.
 */
export function frequencyResponseSampleCount(branches: FrequencyResponseBranch[], range: FrequencySweepRange): number {
  validateRange(range);
  let maximumLength = 0;
  for (const branch of branches) {
    const length = branch.maxElectricalLength ?? 0;
    if (!Number.isFinite(length) || length < 0) throw new RangeError('The network electrical length is outside the numeric range.');
    maximumLength = Math.max(maximumLength, length);
  }
  const spanRatio = (range.stopHz - range.startHz) / range.designFrequencyHz;
  const points = Math.max(801, Math.ceil(128 * maximumLength * spanRatio) + 1);
  if (!Number.isFinite(points) || points > 16385) throw new RangeError('This frequency sweep needs too many samples. Choose a narrower interval.');
  return points;
}

export function sampleFrequencyResponse(evaluate: (ratio: number) => number, range: FrequencySweepRange & { points?: number }): FrequencyResponseSample[] {
  validateRange(range);
  const points = range.points ?? 801;
  if (!Number.isInteger(points) || points < 2 || points > 16385) throw new RangeError('Use between 2 and 16385 frequency samples.');
  const { designFrequencyHz: f0, startHz, stopHz } = range;
  const frequencies = Array.from({ length: points }, (_, index) => index === points - 1 ? stopHz : startHz + (stopHz - startHz) * (index / (points - 1)));
  if (f0 >= startHz && f0 <= stopHz && !frequencies.includes(f0)) frequencies.push(f0);
  return frequencies.sort((a, b) => a - b).map(frequencyHz => ({ frequencyHz, magnitude: evaluate(frequencyHz / f0) }));
}
