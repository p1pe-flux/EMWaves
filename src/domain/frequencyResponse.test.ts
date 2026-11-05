import { describe, expect, it } from 'vitest';
import { createFrequencyResponse, frequencyResponseSampleCount, sampleFrequencyResponse, type FrequencyResponseDesign } from './frequencyResponse';
import { evaluateSingleStub, solveSingleStub, type SingleStubInput, type StubTermination } from './singleStub';
import { evaluateSeriesStub, solveSeriesStub } from './seriesStub';
import { evaluateQuarterWave, solveQuarterWave } from './quarterWave';
import { evaluateDoubleStub, solveDoubleStub, type DoubleStubInput } from './doubleStub';
import { evaluateLumpedMatching, solveLumpedMatching, type LumpedMatchingInput } from './lumpedMatching';

const input: SingleStubInput = { z0: 50, stubZ0: 75, load: { kind: 'impedance', resistance: 100, reactance: 50 } };
const lumped: LumpedMatchingInput = { z0: 50, frequencyHz: 1e9, load: input.load, elements: [{ component: 'L', connection: 'series' }, { component: 'C', connection: 'parallel' }] };
const double: DoubleStubInput = { z0: 50, load: input.load, stub1Z0: 35, stub2Z0: 90, distance: 0.125, separation: 0.125 };
const ratios = [0.05, 0.7, 1, 1.3, 2, 3.75];

describe('frozen matching-network frequency response', () => {
  it.each<StubTermination>(['short', 'open'])('keeps both shunt and series designs fixed with %s stubs', termination => {
    for (const kind of ['single-stub', 'series-stub'] as const) {
      const solution = kind === 'single-stub' ? solveSingleStub(input) : solveSeriesStub(input);
      const responses = createFrequencyResponse({ kind, input, termination });
      expect(responses).toHaveLength(2);
      responses.forEach((response, index) => {
        expect(response.labelIndex).toBe(index + 1);
        expect(response.evaluate(1)).toBeLessThan(1e-12);
        expect(response.evaluate(0.7)).toBeGreaterThan(0.02);
        const branch = solution.branches[index];
        const length = termination === 'open' ? branch.openLength : branch.shortLength;
        for (const ratio of ratios) {
          const evaluator = kind === 'single-stub' ? evaluateSingleStub : evaluateSeriesStub;
          const independent = evaluator({ ...input, termination, distance: branch.distance * ratio, stubLength: length * ratio });
          expect(response.evaluate(ratio)).toBeCloseTo(independent.reflectionMagnitude, 12);
        }
      });
    }
  });

  it('scales the main line and quarter-wave transformer using their own wavelengths', () => {
    const solution = solveQuarterWave(input);
    const responses = createFrequencyResponse({ kind: 'quarter-wave', input, solution });
    responses.forEach((response, index) => {
      const branch = solution.branches[index];
      for (const ratio of ratios) {
        const independent = evaluateQuarterWave({ ...input, distance: branch.distance * ratio, transformerZ0: branch.transformerZ0, transformerLength: branch.transformerLength * ratio });
        expect(response.evaluate(ratio)).toBeCloseTo(independent.reflectionMagnitude, 12);
      }
      expect(response.evaluate(1)).toBeLessThan(1e-12);
      expect(response.evaluate(0.7)).toBeGreaterThan(0.02);
    });
  });

  it('evaluates both double-stub branches and all four terminations in physical order', () => {
    const solution = solveDoubleStub(double);
    for (const termination1 of ['short', 'open'] as const) for (const termination2 of ['short', 'open'] as const) {
      const responses = createFrequencyResponse({ kind: 'double-stub', input: double, solution, termination1, termination2 });
      expect(responses).toHaveLength(2);
      responses.forEach((response, index) => {
        const branch = solution.branches[index];
        expect(response.evaluate(1)).toBeLessThan(1e-12);
        for (const ratio of ratios) {
          const length1 = (termination1 === 'open' ? branch.stub1.openLength : branch.stub1.shortLength) * ratio;
          const length2 = (termination2 === 'open' ? branch.stub2.openLength : branch.stub2.shortLength) * ratio;
          const independent = evaluateDoubleStub({ ...double, distance: double.distance * ratio, separation: double.separation * ratio, termination1, termination2, length1, length2 });
          expect(response.evaluate(ratio)).toBeCloseTo(independent.reflectionMagnitude, 11);
        }
      });
    }
  });

  it('retains physical L/C values while changing frequency, for all solved topologies', () => {
    let checked = 0;
    for (const component1 of ['L', 'C'] as const) for (const component2 of ['L', 'C'] as const) {
      for (const connection1 of ['series', 'parallel'] as const) for (const connection2 of ['series', 'parallel'] as const) {
        for (const load of [{ kind: 'impedance' as const, resistance: 100, reactance: 50 }, { kind: 'impedance' as const, resistance: 25, reactance: -75 }]) {
          const design: LumpedMatchingInput = { ...lumped, load, elements: [{ component: component1, connection: connection1 }, { component: component2, connection: connection2 }] };
          const solution = solveLumpedMatching(design);
          const responses = createFrequencyResponse({ kind: 'lumped', input: design, solution });
          if (solution.status !== 'solved') continue;
          checked++;
          responses.forEach((response, index) => {
            const branch = solution.branches[index];
            expect(response.evaluate(1)).toBeLessThan(1e-12);
            for (const ratio of ratios) {
              const independent = evaluateLumpedMatching({ ...design, frequencyHz: design.frequencyHz * ratio, values: [branch.elements[0].value, branch.elements[1].value] });
              expect(response.evaluate(ratio)).toBeCloseTo(independent.reflectionMagnitude, 12);
            }
          });
        }
      }
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('does not keep mutable geometry, load or topology references', () => {
    const copy = structuredClone(input);
    const solution = solveSingleStub(copy);
    const response = createFrequencyResponse({ kind: 'single-stub', input: copy, solution, termination: 'short' })[0];
    const before = response.evaluate(0.8);
    const electricalLength = response.maxElectricalLength;
    if (copy.load.kind === 'impedance') copy.load.reactance = 999;
    copy.stubZ0 = 1;
    solution.branches[0].distance = 0;
    solution.branches[0].shortLength = 0;
    expect(response.evaluate(0.8)).toBe(before);
    expect(response.maxElectricalLength).toBe(electricalLength);
  });

  it('snapshots the physical path lengths for selecting a sweep resolution', () => {
    const single = solveSingleStub(input), series = solveSeriesStub(input), quarter = solveQuarterWave(input), two = solveDoubleStub(double);
    for (const termination of ['short', 'open'] as const) {
      for (const [kind, solution] of [['single-stub', single], ['series-stub', series]] as const) {
        const responses = kind === 'single-stub'
          ? createFrequencyResponse({ kind, input, solution: single, termination })
          : createFrequencyResponse({ kind, input, solution: series, termination });
        responses.forEach((response, index) => {
          const branch = solution.branches[index];
          expect(response.maxElectricalLength).toBe(branch.distance + (termination === 'short' ? branch.shortLength : branch.openLength));
        });
      }
    }
    createFrequencyResponse({ kind: 'quarter-wave', input, solution: quarter }).forEach((response, index) => {
      const branch = quarter.branches[index];
      expect(response.maxElectricalLength).toBe(branch.distance + branch.transformerLength);
    });
    createFrequencyResponse({ kind: 'double-stub', input: double, solution: two, termination1: 'short', termination2: 'open' }).forEach((response, index) => {
      const branch = two.branches[index];
      expect(response.maxElectricalLength).toBe(double.distance + double.separation + branch.stub1.shortLength + branch.stub2.openLength);
    });
    expect(createFrequencyResponse({ kind: 'lumped', input: lumped })[0].maxElectricalLength).toBe(0);
    expect(createFrequencyResponse({ kind: 'line', input: { ...input, lengthInWavelengths: 10000 } })[0].maxElectricalLength).toBe(0);
  });

  it('handles exact shunt/series poles and neighboring frequencies without nonfinite substitutes', () => {
    const canonical = { ...input, stubZ0: 50 };
    for (const kind of ['single-stub', 'series-stub'] as const) {
      const solution = kind === 'single-stub' ? solveSingleStub(canonical) : solveSeriesStub(canonical);
      for (const termination of ['short', 'open'] as const) {
        const responses = createFrequencyResponse({ kind, input: canonical, termination });
        responses.forEach((response, index) => {
          const branch = solution.branches[index];
          const length = termination === 'short' ? branch.shortLength : branch.openLength;
          const target = (kind === 'single-stub') === (termination === 'short') ? 0.5 : 0.25;
          const poleRatio = target / length;
          expect(response.evaluate(poleRatio)).toBeCloseTo(1, 14);
          for (const ratio of [poleRatio - 1e-10, poleRatio + 1e-10, 1e-100, 1e100]) {
            const result = response.evaluate(ratio);
            expect(Number.isFinite(result)).toBe(true);
            expect(result).toBeGreaterThanOrEqual(0);
            expect(result).toBeLessThanOrEqual(1);
          }
        });
      }
    }
  });

  it('leaves a uniform line magnitude constant and treats ideal loads correctly', () => {
    for (const load of [input.load, { kind: 'open' as const }, { kind: 'short' as const }, { kind: 'impedance' as const, resistance: 0, reactance: 20 }]) {
      const response = createFrequencyResponse({ kind: 'line', input: { z0: 50, load, lengthInWavelengths: 0.4 } })[0];
      expect(response.labelIndex).toBe(0);
      for (const ratio of ratios) expect(response.evaluate(ratio)).toBe(response.evaluate(1));
      if (load.kind !== 'impedance' || load.resistance === 0) expect(response.evaluate(1)).toBe(1);
    }
  });

  it('does not invent a realization for a continuous or impossible solution', () => {
    const continuous = { ...double, separation: 0, distance: 0, load: { kind: 'impedance' as const, resistance: 25, reactance: 25 } };
    expect(solveDoubleStub(continuous).status).toBe('continuous');
    expect(createFrequencyResponse({ kind: 'double-stub', input: continuous, termination1: 'short', termination2: 'open' })).toEqual([]);
    const unmatchable = { ...input, load: { kind: 'open' as const } };
    expect(createFrequencyResponse({ kind: 'single-stub', input: unmatchable, termination: 'short' })).toEqual([]);
    const family: LumpedMatchingInput = { ...lumped, load: { kind: 'impedance', resistance: 50, reactance: -10 }, elements: [{ component: 'L', connection: 'series' }, { component: 'L', connection: 'series' }] };
    expect(solveLumpedMatching(family).status).toBe('continuous');
    expect(createFrequencyResponse({ kind: 'lumped', input: family })).toEqual([]);
  });

  it('shows the bare matched load when no matching network is required', () => {
    const matched = { ...input, load: { kind: 'impedance' as const, resistance: 50, reactance: 0 } };
    const designs: FrequencyResponseDesign[] = [
      { kind: 'single-stub', input: matched, termination: 'short' },
      { kind: 'series-stub', input: matched, termination: 'open' },
      { kind: 'lumped', input: { ...lumped, load: matched.load } },
    ];
    designs.forEach(design => {
      const responses = createFrequencyResponse(design);
      expect(responses).toHaveLength(1);
      expect(responses[0].labelIndex).toBe(0);
      expect(responses[0].evaluate(0.01)).toBe(0);
      expect(responses[0].evaluate(10)).toBe(0);
    });
  });
});

describe('frequency sweep sampling', () => {
  const range = { designFrequencyHz: 1000, startHz: 500, stopHz: 1700 };
  const notch = (ratio: number) => Math.min(1, Math.abs(ratio - 1));

  it('resolves broad-sweep resonances against a denser independent network evaluator', () => {
    const canonical = { ...input, stubZ0: 50 };
    const solution = solveSingleStub(canonical);
    const responses = createFrequencyResponse({ kind: 'single-stub', input: canonical, solution, termination: 'short' });
    const sweep = { designFrequencyHz: 1e6, startHz: .5e6, stopHz: 100e6 };
    const points = frequencyResponseSampleCount(responses, sweep);
    expect(points).toBeGreaterThan(9000);
    expect(points).toBeLessThanOrEqual(16385);
    const samples = sampleFrequencyResponse(responses[1].evaluate, { ...sweep, points });
    const branch = solution.branches[1];
    let largestError = 0;
    // The oracle checks four times the chart's sampling density, using the
    // existing independent shunt-stub evaluator rather than the plotted model.
    for (let index = 0; index < samples.length - 1; index++) {
      const a = samples[index], b = samples[index + 1];
      for (const fraction of [.25, .5, .75]) {
        const frequencyHz = a.frequencyHz + (b.frequencyHz - a.frequencyHz) * fraction;
        const ratio = frequencyHz / sweep.designFrequencyHz;
        const actual = evaluateSingleStub({ ...canonical, termination: 'short', distance: branch.distance * ratio, stubLength: branch.shortLength * ratio }).reflectionMagnitude;
        const drawn = a.magnitude + (b.magnitude - a.magnitude) * fraction;
        largestError = Math.max(largestError, Math.abs(actual - drawn));
      }
    }
    expect(largestError).toBeLessThan(.01);
    expect(() => frequencyResponseSampleCount(responses, { ...sweep, stopHz: 1000e6 })).toThrow(/narrower interval/);
  });

  it('keeps ordinary sweeps compact and validates adaptive resolution inputs', () => {
    const responses = createFrequencyResponse({ kind: 'single-stub', input, termination: 'short' });
    expect(frequencyResponseSampleCount(responses, range)).toBe(801);
    const bare = createFrequencyResponse({ kind: 'line', input: { ...input, lengthInWavelengths: 1e9 } });
    expect(frequencyResponseSampleCount(bare, { ...range, stopHz: 1e100 })).toBe(801);
    expect(frequencyResponseSampleCount([{ id: 'custom', labelIndex: 0, evaluate: notch }], range)).toBe(801);
    for (const maxElectricalLength of [-1, Infinity, NaN]) {
      expect(() => frequencyResponseSampleCount([{ ...responses[0], maxElectricalLength }], range)).toThrow(RangeError);
    }
    expect(() => frequencyResponseSampleCount(responses, { ...range, startHz: 0 })).toThrow(RangeError);
  });

  it('inserts the exact design frequency and includes both sweep endpoints', () => {
    const samples = sampleFrequencyResponse(notch, { ...range, points: 8 });
    expect(samples).toHaveLength(9);
    expect(samples[0].frequencyHz).toBe(range.startHz);
    expect(samples.at(-1)!.frequencyHz).toBe(range.stopHz);
    expect(samples.find(sample => sample.frequencyHz === 1000)).toEqual({ frequencyHz: 1000, magnitude: 0 });
    expect(samples.map(sample => sample.frequencyHz)).toEqual(samples.map(sample => sample.frequencyHz).sort((a, b) => a - b));
  });

  it('does not duplicate an existing f0 or insert it outside the range', () => {
    expect(sampleFrequencyResponse(notch, { ...range, stopHz: 1500, points: 3 })).toHaveLength(3);
    expect(sampleFrequencyResponse(notch, { ...range, designFrequencyHz: 2000, points: 3 })).toHaveLength(3);
  });

  it('rejects invalid frequencies, ranges and sample counts', () => {
    for (const change of [{ designFrequencyHz: 0 }, { designFrequencyHz: Infinity }, { startHz: -1 }, { stopHz: NaN }, { stopHz: 200 }]) {
      expect(() => sampleFrequencyResponse(notch, { ...range, ...change })).toThrow(RangeError);
      expect(() => frequencyResponseSampleCount([], { ...range, ...change })).toThrow(RangeError);
    }
    for (const points of [1, 2.2, Infinity, 16386]) expect(() => sampleFrequencyResponse(notch, { ...range, points })).toThrow(RangeError);
    const response = createFrequencyResponse({ kind: 'lumped', input: lumped })[0];
    for (const ratio of [0, -1, NaN, Infinity]) expect(() => response.evaluate(ratio)).toThrow(RangeError);
  });
});
