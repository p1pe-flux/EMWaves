import { describe, expect, it } from 'vitest';
import { impedanceToReflection, solveLine, type ComplexValue } from './transmission';
import { doubleStubLocus, doubleStubMaxConductance, evaluateDoubleStub, solveDoubleStub, type DoubleStubInput } from './doubleStub';

const example: DoubleStubInput = { z0: 50, load: { kind: 'impedance', resistance: 100, reactance: 50 }, distance: 0.125, separation: 0.125, stub1Z0: 50, stub2Z0: 50 };

function expectComplex(actual: ComplexValue | null, re: number, im: number, digits = 10): void {
  expect(actual).not.toBeNull();
  expect(actual!.re).toBeCloseTo(re, digits);
  expect(actual!.im).toBeCloseTo(im, digits);
}

function normalizedAdmittance(z: ComplexValue): ComplexValue {
  const denominator = z.re * z.re + z.im * z.im;
  return { re: z.re / denominator, im: -z.im / denominator };
}

describe('double shunt-stub synthesis, numbered from generator to load', () => {
  it('adds the right stub 2 first, then traverses the separation and cancels with left stub 1', () => {
    const result = solveDoubleStub(example);
    expect(result.status).toBe('solved');
    expectComplex(result.normalizedLoad, 2, 1);
    expectComplex(result.loadAdmittance, 0.4, -0.2);
    expectComplex(result.loadReflection, 0.4, 0.2);
    expectComplex(result.rightAdmittance, 0.5, 0.5);
    expect(result.maxConductance).toBeCloseTo(2, 12);
    expect(result.locus).toEqual({ center: { re: 0, im: 0.5 }, radius: 0.5 });
    expect(result.branches).toHaveLength(2);
    const [lower, upper] = result.branches;
    expectComplex(lower.rightAfter, 0.5, 1 - Math.sqrt(3) / 2);
    expectComplex(upper.rightAfter, 0.5, 1 + Math.sqrt(3) / 2);
    expect(lower.stub2.susceptance).toBeCloseTo(0.5 - Math.sqrt(3) / 2, 12);
    expect(upper.stub2.susceptance).toBeCloseTo(0.5 + Math.sqrt(3) / 2, 12);
    expectComplex(lower.leftBefore, 1, Math.sqrt(3) - 1);
    expectComplex(upper.leftBefore, 1, -Math.sqrt(3) - 1);
    expect(lower.stub1.susceptance).toBeCloseTo(1 - Math.sqrt(3), 12);
    expect(upper.stub1.susceptance).toBeCloseTo(1 + Math.sqrt(3), 12);
    for (const branch of result.branches) expect(branch.residual).toBeLessThan(1e-12);
  });

  it('matches both branches for all four terminations and unequal characteristic impedances', () => {
    const input = { ...example, stub1Z0: 75, stub2Z0: 30 };
    const result = solveDoubleStub(input);
    for (const branch of result.branches) {
      for (const termination1 of ['open', 'short'] as const) {
        for (const termination2 of ['open', 'short'] as const) {
          const evaluation = evaluateDoubleStub({ ...input, termination1, termination2,
            length1: termination1 === 'open' ? branch.stub1.openLength : branch.stub1.shortLength,
            length2: termination2 === 'open' ? branch.stub2.openLength : branch.stub2.shortLength });
          expectComplex(evaluation.rightAfter, branch.rightAfter.re, branch.rightAfter.im);
          expectComplex(evaluation.leftBefore, 1, branch.leftBefore.im);
          expectComplex(evaluation.totalAdmittance, 1, 0);
          expectComplex(evaluation.inputImpedance, 50, 0);
          expectComplex(evaluation.reflection, 0, 0);
          expect(evaluation.reflectionMagnitude).toBeLessThan(1e-11);
          expect(evaluation.vswr).toBeCloseTo(1, 11);
        }
      }
      for (const stub of [branch.stub1, branch.stub2]) {
        expect(stub.openLength).toBeGreaterThanOrEqual(0);
        expect(stub.openLength).toBeLessThan(0.5);
        expect(stub.shortLength).toBeGreaterThanOrEqual(0);
        expect(stub.shortLength).toBeLessThan(0.5);
        expect(Math.abs(stub.openLength - stub.shortLength)).toBeCloseTo(0.25, 12);
      }
    }
    const same = solveDoubleStub(example);
    expect(result.branches.map((branch) => branch.rightAfter)).toEqual(same.branches.map((branch) => branch.rightAfter));
    expect(result.branches[0].stub1.shortLength).not.toBeCloseTo(same.branches[0].stub1.shortLength, 8);
    expect(result.branches[0].stub2.shortLength).not.toBeCloseTo(same.branches[0].stub2.shortLength, 8);
  });

  it('reconstructs feasible branches over a deterministic sweep of passive loads and spacings', () => {
    let solved = 0, forbidden = 0;
    for (let i = 0; i < 80; i += 1) {
      const input: DoubleStubInput = { z0: [25, 50, 80][i % 3], load: { kind: 'impedance', resistance: 3 + i * 43 % 251, reactance: -100 + i * 31 % 201 },
        distance: (i % 7) * 0.037, separation: [0.09, 0.125, 0.21, 0.25, 0.375][i % 5], stub1Z0: 30 + i % 4 * 25, stub2Z0: 35 + i % 3 * 40 };
      const result = solveDoubleStub(input);
      if (result.status === 'forbidden') { forbidden += 1; expect(result.rightAdmittance!.re).toBeGreaterThan(result.maxConductance); continue; }
      expect(result.status).toBe('solved');
      solved += 1;
      for (const branch of result.branches) {
        expectComplex(branch.leftBefore, 1, -branch.stub1.susceptance, 8);
        expect(branch.residual).toBeLessThan(1e-9);
        const printed = impedanceToReflection(branch.rightAfter);
        expect(Math.hypot(printed.re - result.locus.center.re, printed.im - result.locus.center.im)).toBeCloseTo(0.5, 10);
      }
    }
    expect(solved).toBeGreaterThan(40);
    expect(forbidden).toBeGreaterThan(0);
  });

  it('returns one distinct branch at tangency and rejects conductance beyond the limit', () => {
    const tangent = solveDoubleStub({ ...example, distance: 0, load: { kind: 'impedance', resistance: 25, reactance: 0 } });
    expect(tangent.status).toBe('solved');
    expect(tangent.branches).toHaveLength(1);
    expectComplex(tangent.branches[0].rightAfter, 2, 1);
    expectComplex(tangent.branches[0].leftBefore, 1, -1);
    expect(tangent.branches[0].stub1.susceptance).toBeCloseTo(1, 12);
    const forbidden = solveDoubleStub({ ...example, distance: 0, load: { kind: 'impedance', resistance: 10, reactance: 0 } });
    expect(forbidden.status).toBe('forbidden');
    expect(forbidden.branches).toEqual([]);
    expect(forbidden.rightAdmittance!.re).toBeCloseTo(5, 12);
    const justInside = solveDoubleStub({ ...example, distance: 0, load: { kind: 'impedance', resistance: 25 * (1 + 1e-7), reactance: 0 } });
    const justOutside = solveDoubleStub({ ...example, distance: 0, load: { kind: 'impedance', resistance: 25 * (1 - 1e-7), reactance: 0 } });
    expect(justInside.branches).toHaveLength(2);
    expect(justOutside.status).toBe('forbidden');
  });

  it('handles quarter-wave spacing without tangent or cotangent singularities', () => {
    const result = solveDoubleStub({ ...example, separation: 0.25 });
    expect(result.status).toBe('solved');
    expect(result.maxConductance).toBe(1);
    expect(result.branches).toHaveLength(2);
    expect(result.locus).toEqual({ center: { re: -0.5, im: 0 }, radius: 0.5 });
    for (const branch of result.branches) expectComplex(branch.leftBefore, 1, -branch.stub1.susceptance);
    const tangent = solveDoubleStub({ ...example, distance: 0, separation: 0.25, load: { kind: 'impedance', resistance: 50, reactance: 0 } });
    expect(tangent.branches).toHaveLength(1);
    expect(tangent.branches[0].stub1.susceptance).toBe(0);
    expect(tangent.branches[0].stub2.susceptance).toBe(0);
  });

  it.each([0, 0.5, 1.5])('returns a continuous family for unity conductance at half-wave separation %s', (separation) => {
    const input: DoubleStubInput = { ...example, distance: 0, separation, load: { kind: 'impedance', resistance: 25, reactance: 25 } };
    const result = solveDoubleStub(input);
    expect(result.status).toBe('continuous');
    expect(result.branches).toEqual([]);
    expect(result.maxConductance).toBe(Infinity);
    expectComplex(result.rightAdmittance, 1, -1);
    expect(result.family?.totalSusceptance).toBeCloseTo(1, 12);
    for (const b2 of [-2, 0, 1, 3]) {
      const b1 = result.family!.totalSusceptance - b2;
      const length = (b: number) => ((Math.atan(b) + Math.PI) % Math.PI) / (2 * Math.PI);
      const final = evaluateDoubleStub({ ...input, termination1: 'open', termination2: 'open', length1: length(b1), length2: length(b2) });
      expectComplex(final.inputImpedance, 50, 0);
      expect(final.reflectionMagnitude).toBeLessThan(1e-11);
    }
  });

  it('rejects a nonunity conductance at half-wave spacing rather than inventing branches', () => {
    const result = solveDoubleStub({ ...example, distance: 0, separation: 0.5 });
    expect(result.status).toBe('forbidden');
    expect(result.branches).toEqual([]);
    expect(result.maxConductance).toBe(Infinity);
    expect(result.message).toMatch(/conductance/);
  });

  it('retains two ordinary branches even if the original load is already matched', () => {
    const input: DoubleStubInput = { ...example, load: { kind: 'impedance', resistance: 50, reactance: 0 } };
    const result = solveDoubleStub(input);
    expect(result.status).toBe('solved');
    expect(result.branches).toHaveLength(2);
    expect(result.branches[0].stub1.susceptance).toBeCloseTo(0, 12);
    expect(result.branches[0].stub2.susceptance).toBeCloseTo(0, 12);
    expect(result.branches[1].stub1.susceptance).toBeCloseTo(2, 12);
    expect(result.branches[1].stub2.susceptance).toBeCloseTo(2, 12);
  });

  it('preserves all four independent half-wave repetitions', () => {
    for (const branch of solveDoubleStub(example).branches) {
      const final = evaluateDoubleStub({ ...example, distance: example.distance + 1, separation: example.separation + 1.5,
        termination1: 'short', termination2: 'open', length1: branch.stub1.shortLength + 2, length2: branch.stub2.openLength + 0.5 });
      expectComplex(final.inputImpedance, 50, 0);
      expect(final.reflectionMagnitude).toBeLessThan(1e-10);
    }
  });

  it.each([{ kind: 'open' as const }, { kind: 'short' as const }, { kind: 'impedance' as const, resistance: 0, reactance: 50 }])('explains zero-real-power loads without fabricated matches: %j', (load) => {
    const result = solveDoubleStub({ ...example, load });
    expect(result.status).toBe('unmatchable');
    expect(result.branches).toEqual([]);
    expect(result.message).toMatch(/real power/);
  });
});

describe('double-stub evaluation and chart loci', () => {
  it('agrees with the main-line model when both open stubs have zero length', () => {
    const result = evaluateDoubleStub({ ...example, termination1: 'open', termination2: 'open', length1: 0, length2: 0 });
    const line = solveLine({ z0: example.z0, load: example.load, lengthInWavelengths: example.distance + example.separation });
    expectComplex(result.inputImpedance, line.inputImpedance!.re, line.inputImpedance!.im);
    const right = solveLine({ z0: example.z0, load: example.load, lengthInWavelengths: example.distance }).inputImpedance!;
    const expectedY = normalizedAdmittance({ re: right.re / example.z0, im: right.im / example.z0 });
    expectComplex(result.rightAdmittance, expectedY.re, expectedY.im);
  });

  it('distinguishes the right-stub pole before propagation from a left-stub pole at the input', () => {
    const rightPole = evaluateDoubleStub({ ...example, separation: 0.25, termination1: 'open', termination2: 'short', length1: 0, length2: 0 });
    expect(rightPole.stub2Susceptance).toBe(Infinity);
    expect(rightPole.rightAfter).toBeNull();
    expectComplex(rightPole.leftBefore, 0, 0);
    expect(rightPole.inputImpedance).toBeNull();
    expectComplex(rightPole.reflection, 1, 0);
    const leftPole = evaluateDoubleStub({ ...example, termination1: 'open', termination2: 'open', length1: 0.25, length2: 0.1 });
    expect(leftPole.stub1Susceptance).toBe(Infinity);
    expect(leftPole.totalAdmittance).toBeNull();
    expectComplex(leftPole.inputImpedance, 0, 0);
    expectComplex(leftPole.reflection, -1, 0);
    expect(leftPole.vswr).toBe(Infinity);
  });

  it('retains finite susceptance near exact poles instead of clipping to arbitrary large values', () => {
    const input = { ...example, termination1: 'open' as const, termination2: 'short' as const, length1: 0, length2: 1e-16 };
    const result = evaluateDoubleStub(input);
    expect(Number.isFinite(result.stub2Susceptance)).toBe(true);
    expect(result.stub2Susceptance).toBeLessThan(-1e15);
    expect(result.rightAfter).not.toBeNull();
    expect(Number.isFinite(result.reflection.re)).toBe(true);
    expect(Number.isFinite(result.reflection.im)).toBe(true);
  });

  it('keeps a finite reactive line beside the right-stub admittance pole', () => {
    const config = { ...example, load: { kind: 'impedance' as const, resistance: 0, reactance: -50 },
      separation: 0, termination1: 'open' as const, termination2: 'open' as const, length1: 0, length2: 0 };
    const exact = evaluateDoubleStub({ ...config, distance: 0.125 });
    expect(exact.rightAdmittance).toBeNull();
    for (const distance of [0.125 - Number.EPSILON / 16, 0.125 + Number.EPSILON / 8]) {
      const result = evaluateDoubleStub({ ...config, distance });
      expect(result.rightAdmittance).not.toBeNull();
      expect(result.totalAdmittance).not.toBeNull();
      expect(Number.isFinite(result.rightAdmittance!.im)).toBe(true);
      expect(Math.abs(result.rightAdmittance!.im)).toBeGreaterThan(1e15);
    }
  });

  it('transports the unity circle counterclockwise to the right-hand plane', () => {
    expect(doubleStubLocus(0)).toEqual({ center: { re: 0.5, im: 0 }, radius: 0.5 });
    expect(doubleStubLocus(0.125)).toEqual({ center: { re: 0, im: 0.5 }, radius: 0.5 });
    expect(doubleStubLocus(0.25)).toEqual({ center: { re: -0.5, im: 0 }, radius: 0.5 });
    expect(doubleStubLocus(0.375)).toEqual({ center: { re: 0, im: -0.5 }, radius: 0.5 });
    for (const s of [0.037, 0.125, 0.25, 0.375, 0.5]) {
      const locus = doubleStubLocus(s);
      expect(Math.hypot(locus.center.re, locus.center.im)).toBeCloseTo(0.5, 12);
      expect(doubleStubLocus(s + 1).center.re).toBeCloseTo(locus.center.re, 12);
      expect(doubleStubLocus(s + 1).center.im).toBeCloseTo(locus.center.im, 12);
    }
    expect(doubleStubMaxConductance(0.25)).toBe(1);
    expect(doubleStubMaxConductance(0.125)).toBeCloseTo(2, 12);
    expect(doubleStubMaxConductance(0.5)).toBe(Infinity);
  });

  it.each([
    { ...example, z0: 0 }, { ...example, z0: NaN }, { ...example, stub1Z0: 0 }, { ...example, stub2Z0: Infinity },
    { ...example, distance: -0.1 }, { ...example, separation: -0.1 }, { ...example, distance: Infinity }, { ...example, separation: NaN },
    { ...example, load: { kind: 'impedance' as const, resistance: -1, reactance: 0 } },
    { ...example, load: { kind: 'impedance' as const, resistance: 1, reactance: NaN } },
  ])('rejects invalid synthesis parameters: %j', (input) => {
    expect(() => solveDoubleStub(input)).toThrow(RangeError);
  });

  it.each([{ length1: -1, length2: 0 }, { length1: 0, length2: Infinity }, { length1: NaN, length2: 0 }])('rejects invalid evaluation lengths: %j', (lengths) => {
    expect(() => evaluateDoubleStub({ ...example, ...lengths, termination1: 'short', termination2: 'open' })).toThrow(RangeError);
  });
});
