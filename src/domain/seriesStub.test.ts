import { describe, expect, it } from 'vitest';
import { evaluateSeriesStub, solveSeriesStub, type SeriesStubInput } from './seriesStub';
import { impedanceToReflection, solveLine, type ComplexValue } from './transmission';

const example: SeriesStubInput = { z0: 50, stubZ0: 50, load: { kind: 'impedance', resistance: 100, reactance: 50 } };

function expectComplex(actual: ComplexValue | null, re: number, im: number, digits = 10): void {
  expect(actual).not.toBeNull();
  expect(actual!.re).toBeCloseTo(re, digits);
  expect(actual!.im).toBeCloseTo(im, digits);
}

describe('single series-stub synthesis', () => {
  it('solves the 100+j50 Ω teaching example on the physical impedance grid', () => {
    const solution = solveSeriesStub(example);
    expect(solution.status).toBe('solved');
    expectComplex(solution.normalizedLoad, 2, 1);
    expectComplex(solution.loadReflection, 0.4, 0.2);
    expect(solution.branches).toHaveLength(2);
    const [first, second] = solution.branches;
    expect(first.distance).toBeCloseTo(0.125, 13);
    expect(second.distance).toBeCloseTo(0.44879180882521663, 13);
    expectComplex(first.lineImpedance, 1, -1);
    expectComplex(second.lineImpedance, 1, 1);
    expectComplex(first.reflection, 0.2, -0.4);
    expectComplex(second.reflection, 0.2, 0.4);
    expect(first.requiredReactance).toBeCloseTo(1, 12);
    expect(second.requiredReactance).toBeCloseTo(-1, 12);
    expect(first.shortLength).toBeCloseTo(0.125, 12);
    expect(first.openLength).toBeCloseTo(0.375, 12);
    expect(second.shortLength).toBeCloseTo(0.375, 12);
    expect(second.openLength).toBeCloseTo(0.125, 12);
  });

  it('reconstructs both branches and terminations for varied passive loads and stub impedances', () => {
    for (const z0 of [25, 50, 75]) {
      for (const stubZ0 of [15, 50, 120]) {
        for (const resistance of [5, 25, 50, 100, 240]) {
          for (const reactance of [-130, -25, 0, 50, 160]) {
            const input: SeriesStubInput = { z0, stubZ0, load: { kind: 'impedance', resistance, reactance } };
            const solution = solveSeriesStub(input);
            if (resistance === z0 && reactance === 0) continue;
            expect(solution.status).toBe('solved');
            expect(solution.branches).toHaveLength(2);
            expect(solution.branches[0].distance).toBeLessThan(solution.branches[1].distance);
            for (const branch of solution.branches) {
              expect(branch.distance).toBeGreaterThanOrEqual(0);
              expect(branch.distance).toBeLessThan(0.5);
              expectComplex(branch.lineImpedance, 1, -branch.requiredReactance, 9);
              expectComplex(branch.reflection, ...Object.values(impedanceToReflection(branch.lineImpedance)) as [number, number]);
              const line = solveLine({ z0, load: input.load, lengthInWavelengths: branch.distance });
              expectComplex(branch.lineImpedance, line.inputImpedance!.re / z0, line.inputImpedance!.im / z0, 9);
              for (const termination of ['open', 'short'] as const) {
                const stubLength = termination === 'open' ? branch.openLength : branch.shortLength;
                expect(stubLength).toBeGreaterThanOrEqual(0);
                expect(stubLength).toBeLessThan(0.5);
                const final = evaluateSeriesStub({ ...input, termination, distance: branch.distance, stubLength });
                expectComplex(final.totalNormalizedImpedance, 1, 0, 9);
                expectComplex(final.totalImpedance, z0, 0, 8);
                expect(final.reflectionMagnitude).toBeLessThan(1e-10);
                expect(final.vswr).toBeCloseTo(1, 9);
              }
            }
          }
        }
      }
    }
  });

  it('retains a quarter-wave attachment without using a finite tangent-root approximation', () => {
    const solution = solveSeriesStub({ ...example, load: { kind: 'impedance', resistance: 25, reactance: 25 } });
    expect(solution.branches[1].distance).toBeCloseTo(0.25, 13);
    expectComplex(solution.branches[1].lineImpedance, 1, -1);
  });

  it('retains a valid attachment directly at the load', () => {
    const solution = solveSeriesStub({ ...example, load: { kind: 'impedance', resistance: 50, reactance: 50 } });
    expect(solution.branches[0].distance).toBe(0);
    expectComplex(solution.branches[0].lineImpedance, 1, 1);
    expect(solution.branches[0].requiredReactance).toBe(-1);
  });

  it('changes the stub lengths while retaining the physical attachment positions for unequal Z0s', () => {
    const same = solveSeriesStub(example);
    const different = solveSeriesStub({ ...example, stubZ0: 75 });
    for (let index = 0; index < 2; index += 1) {
      const first = same.branches[index];
      const second = different.branches[index];
      expect(second.distance).toBe(first.distance);
      expect(second.lineImpedance).toEqual(first.lineImpedance);
      expect(second.requiredReactance).toBe(first.requiredReactance);
      expect(second.shortLength).not.toBeCloseTo(first.shortLength, 8);
      expect(Math.abs(second.openLength - second.shortLength)).toBeCloseTo(0.25, 12);
      const ratio = 75 / 50;
      expect(ratio * Math.tan(2 * Math.PI * second.shortLength)).toBeCloseTo(second.requiredReactance, 10);
      expect(-ratio / Math.tan(2 * Math.PI * second.openLength)).toBeCloseTo(second.requiredReactance, 10);
    }
  });

  it('identifies the already-matched family and uses a short zero-length or open quarter-wave stub', () => {
    const input: SeriesStubInput = { ...example, stubZ0: 90, load: { kind: 'impedance', resistance: 50, reactance: 0 } };
    const solution = solveSeriesStub(input);
    expect(solution.status).toBe('already-matched');
    expect(solution.branches).toEqual([]);
    expect(solution.vswr).toBe(1);
    for (const distance of [0, 0.137, 0.25, 0.5, 1.2]) {
      expectComplex(evaluateSeriesStub({ ...input, distance, termination: 'short', stubLength: 0 }).totalImpedance, 50, 0);
      expectComplex(evaluateSeriesStub({ ...input, distance, termination: 'open', stubLength: 0.25 }).totalImpedance, 50, 0);
    }
  });

  it('keeps genuinely nonzero small mismatch distinct from an exact match', () => {
    for (const reactance of [1e-8, 1e-17]) {
      const solution = solveSeriesStub({ ...example, load: { kind: 'impedance', resistance: 50, reactance } });
      expect(solution.status).toBe('solved');
      expect(solution.branches).toHaveLength(2);
      expect(solution.branches[0].distance).toBeLessThan(solution.branches[1].distance);
    }
  });

  it.each([
    { kind: 'open' as const },
    { kind: 'short' as const },
    { kind: 'impedance' as const, resistance: 0, reactance: 0 },
    { kind: 'impedance' as const, resistance: 0, reactance: 50 },
    { kind: 'impedance' as const, resistance: 0, reactance: -75 },
  ])('identifies a zero-real-power load as unmatchable: %j', (load) => {
    const solution = solveSeriesStub({ ...example, load });
    expect(solution.status).toBe('unmatchable');
    expect(solution.branches).toEqual([]);
    expect(solution.vswr).toBe(Infinity);
    expect(solution.message).toMatch(/real power/);
  });

  it.each([
    { ...example, z0: 0 },
    { ...example, z0: -50 },
    { ...example, z0: NaN },
    { ...example, z0: Infinity },
    { ...example, stubZ0: 0 },
    { ...example, stubZ0: -25 },
    { ...example, stubZ0: Infinity },
    { ...example, stubZ0: Number.MIN_VALUE },
    { ...example, load: { kind: 'impedance' as const, resistance: -1, reactance: 0 } },
    { ...example, load: { kind: 'impedance' as const, resistance: 1, reactance: NaN } },
  ])('rejects invalid or unrepresentable synthesis inputs: %j', (input) => {
    expect(() => solveSeriesStub(input)).toThrow(RangeError);
  });
});

describe('single series-stub evaluation', () => {
  it('agrees with the shared line model for a zero-reactance short stub', () => {
    for (const distance of [0, 0.01, 0.125, 0.25, 0.499, 0.5, 1.3]) {
      const evaluated = evaluateSeriesStub({ ...example, distance, stubLength: 0, termination: 'short' });
      const line = solveLine({ z0: example.z0, load: example.load, lengthInWavelengths: distance });
      expectComplex(evaluated.totalImpedance, line.inputImpedance!.re, line.inputImpedance!.im, 9);
      expectComplex(evaluated.reflection, line.inputReflection.re, line.inputReflection.im, 12);
    }
  });

  it('preserves independent half-wave repeats of the main line and stub', () => {
    for (const branch of solveSeriesStub(example).branches) {
      for (const termination of ['open', 'short'] as const) {
        const length = termination === 'open' ? branch.openLength : branch.shortLength;
        for (const lineRepeats of [0, 1, 4]) {
          for (const stubRepeats of [0, 1, 3]) {
            const final = evaluateSeriesStub({ ...example, termination, distance: branch.distance + lineRepeats * 0.5, stubLength: length + stubRepeats * 0.5 });
            expectComplex(final.totalImpedance, 50, 0, 9);
            expect(final.reflectionMagnitude).toBeLessThan(1e-10);
          }
        }
      }
    }
  });

  it.each([
    { termination: 'short' as const, stubLength: 0.25 },
    { termination: 'short' as const, stubLength: 0.75 },
    { termination: 'open' as const, stubLength: 0 },
    { termination: 'open' as const, stubLength: 0.5 },
  ])('represents an ideal stub pole as an open series junction: %j', (stub) => {
    const result = evaluateSeriesStub({ ...example, distance: 0.173, ...stub });
    expect(result.stubReactance).toBe(Infinity);
    expect(result.totalNormalizedImpedance).toBeNull();
    expect(result.totalImpedance).toBeNull();
    expectComplex(result.reflection, 1, 0);
    expect(result.reflectionMagnitude).toBe(1);
    expect(result.vswr).toBe(Infinity);
  });

  it('keeps finite values immediately beside quarter-wave poles', () => {
    const offset = Number.EPSILON / 8;
    const before = evaluateSeriesStub({ ...example, distance: 0.1, termination: 'short', stubLength: 0.25 - offset });
    const after = evaluateSeriesStub({ ...example, distance: 0.1, termination: 'short', stubLength: 0.25 + Number.EPSILON / 4 });
    expect(Number.isFinite(before.stubReactance)).toBe(true);
    expect(Number.isFinite(after.stubReactance)).toBe(true);
    expect(before.stubReactance).toBeGreaterThan(1e15);
    expect(after.stubReactance).toBeLessThan(-1e15);
    expect(before.totalImpedance).not.toBeNull();
    expect(after.totalImpedance).not.toBeNull();
  });

  it('preserves a finite 1e-17 length on either side of a zero-length boundary', () => {
    const short = evaluateSeriesStub({ ...example, distance: 0, termination: 'short', stubLength: 1e-17 });
    expect(short.stubReactance).toBeGreaterThan(0);
    expect(short.stubReactance / (2 * Math.PI * 1e-17)).toBeCloseTo(1, 14);
    const open = evaluateSeriesStub({ ...example, distance: 0, termination: 'open', stubLength: 1e-17 });
    expect(Number.isFinite(open.stubReactance)).toBe(true);
    expect(open.stubReactance).toBeLessThan(-1e16);
    expect(open.totalNormalizedImpedance).not.toBeNull();
    const openLine = evaluateSeriesStub({ ...example, load: { kind: 'open' }, distance: 1e-17, termination: 'short', stubLength: 0 });
    expect(openLine.lineImpedance).not.toBeNull();
    expect(Number.isFinite(openLine.lineImpedance!.im)).toBe(true);
    expect(openLine.lineImpedance!.im).toBeLessThan(-1e16);
  });

  it('keeps ideal open, short, and reactive line boundaries meaningful', () => {
    const neutral = { termination: 'short' as const, stubLength: 0 };
    const open = evaluateSeriesStub({ ...example, ...neutral, load: { kind: 'open' }, distance: 0 });
    expect(open.lineImpedance).toBeNull();
    expect(open.totalImpedance).toBeNull();
    expectComplex(open.reflection, 1, 0);
    const short = evaluateSeriesStub({ ...example, ...neutral, load: { kind: 'short' }, distance: 0 });
    expectComplex(short.lineImpedance, 0, 0);
    expectComplex(short.totalImpedance, 0, 0);
    expectComplex(short.reflection, -1, 0);
    const quarter = evaluateSeriesStub({ ...example, ...neutral, load: { kind: 'short' }, distance: 0.25 });
    expect(quarter.lineImpedance).toBeNull();
    expect(quarter.totalImpedance).toBeNull();
    const transformedOpen = evaluateSeriesStub({ ...example, ...neutral, load: { kind: 'open' }, distance: 0.25 });
    expectComplex(transformedOpen.totalImpedance, 0, 0);
    const reactivePole = evaluateSeriesStub({ ...example, ...neutral, load: { kind: 'impedance', resistance: 0, reactance: 50 }, distance: 0.125 });
    expect(reactivePole.lineImpedance).toBeNull();
    expect(reactivePole.totalImpedance).toBeNull();
    const nearReactivePole = evaluateSeriesStub({ ...example, ...neutral, load: { kind: 'impedance', resistance: 0, reactance: 50 }, distance: 0.125 - Number.EPSILON / 16 });
    expect(nearReactivePole.lineImpedance).not.toBeNull();
    expect(Number.isFinite(nearReactivePole.lineImpedance!.im)).toBe(true);
  });

  it('scales normalized series reactance to actual ohms', () => {
    const result = evaluateSeriesStub({ ...example, stubZ0: 100, distance: 0, termination: 'short', stubLength: 0.125 });
    expect(result.stubReactance).toBe(2);
    expectComplex(result.totalNormalizedImpedance, 2, 3);
    expectComplex(result.totalImpedance, 100, 150);
  });

  it.each([
    { distance: -0.1, stubLength: 0.1 },
    { distance: 0.1, stubLength: -0.1 },
    { distance: NaN, stubLength: 0.1 },
    { distance: 0.1, stubLength: Infinity },
  ])('rejects invalid evaluation lengths: %j', (lengths) => {
    expect(() => evaluateSeriesStub({ ...example, termination: 'open', ...lengths })).toThrow(RangeError);
  });

  it('rejects unsupported terminations', () => {
    expect(() => evaluateSeriesStub({ ...example, distance: 0, stubLength: 0.1, termination: 'invalid' as 'open' })).toThrow(RangeError);
  });
});
