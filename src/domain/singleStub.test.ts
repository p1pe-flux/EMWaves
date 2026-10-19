import { describe, expect, it } from 'vitest';
import { evaluateSingleStub, solveSingleStub, type SingleStubInput } from './singleStub';
import { solveLine, type ComplexValue } from './transmission';

const example: SingleStubInput = { z0: 50, stubZ0: 50, load: { kind: 'impedance', resistance: 100, reactance: 50 } };

function expectComplex(actual: ComplexValue | null, re: number, im: number, digits = 10): void {
  expect(actual).not.toBeNull();
  expect(actual!.re).toBeCloseTo(re, digits);
  expect(actual!.im).toBeCloseTo(im, digits);
}

describe('single shunt-stub synthesis', () => {
  it('solves the exact 100+j50 Ω teaching example and uses physical Γ coordinates', () => {
    const solution = solveSingleStub(example);
    expect(solution.status).toBe('solved');
    expectComplex(solution.normalizedLoad, 2, 1);
    expectComplex(solution.loadAdmittance, 0.4, -0.2);
    expectComplex(solution.loadReflection, 0.4, 0.2);
    expect(solution.branches).toHaveLength(2);
    const [first, second] = solution.branches;
    expect(first.distance).toBeCloseTo(0.19879180882521663, 13);
    expect(second.distance).toBeCloseTo(0.375, 13);
    expectComplex(first.lineAdmittance, 1, 1);
    expectComplex(second.lineAdmittance, 1, -1);
    expectComplex(first.reflection, -0.2, -0.4);
    expectComplex(second.reflection, -0.2, 0.4);
    expect(first.requiredSusceptance).toBeCloseTo(-1, 12);
    expect(second.requiredSusceptance).toBeCloseTo(1, 12);
    expect(first.shortLength).toBeCloseTo(0.125, 12);
    expect(first.openLength).toBeCloseTo(0.375, 12);
    expect(second.shortLength).toBeCloseTo(0.375, 12);
    expect(second.openLength).toBeCloseTo(0.125, 12);
  });

  it('reconstructs a match for both branches and both terminations over varied passive loads', () => {
    for (const z0 of [25, 50, 75]) {
      for (const stubZ0 of [15, 50, 120]) {
        for (const resistance of [5, 25, 50, 100, 240]) {
          for (const reactance of [-130, -25, 0, 50, 160]) {
            const input: SingleStubInput = { z0, stubZ0, load: { kind: 'impedance', resistance, reactance } };
            const result = solveSingleStub(input);
            if (resistance === z0 && reactance === 0) continue;
            expect(result.status).toBe('solved');
            expect(result.branches).toHaveLength(2);
            expect(result.branches[0].distance).toBeLessThan(result.branches[1].distance);
            for (const branch of result.branches) {
              expect(branch.distance).toBeGreaterThanOrEqual(0);
              expect(branch.distance).toBeLessThan(0.5);
              expectComplex(branch.lineAdmittance, 1, -branch.requiredSusceptance, 9);
              for (const termination of ['open', 'short'] as const) {
                const stubLength = termination === 'open' ? branch.openLength : branch.shortLength;
                expect(stubLength).toBeGreaterThanOrEqual(0);
                expect(stubLength).toBeLessThan(0.5);
                const final = evaluateSingleStub({ ...input, termination, distance: branch.distance, stubLength });
                expectComplex(final.totalAdmittance, 1, 0, 9);
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

  it('keeps the quarter-wave branch that a finite tangent-root calculation can miss', () => {
    const solution = solveSingleStub({ ...example, load: { kind: 'impedance', resistance: 50, reactance: 50 } });
    expect(solution.branches[0].distance).toBeCloseTo(0.25, 13);
    expectComplex(solution.branches[0].lineAdmittance, 1, 1);
    expect(solution.branches[1].distance).toBeCloseTo(0.42620819117478337, 13);
  });

  it('retains a valid attachment directly at the load', () => {
    const solution = solveSingleStub({ ...example, load: { kind: 'impedance', resistance: 25, reactance: 25 } });
    expect(solution.branches[0].distance).toBe(0);
    expectComplex(solution.branches[0].lineAdmittance, 1, -1);
    expect(solution.branches[0].requiredSusceptance).toBe(1);
  });

  it('changes only stub lengths when the stub characteristic impedance changes', () => {
    const same = solveSingleStub(example);
    const different = solveSingleStub({ ...example, stubZ0: 75 });
    for (let index = 0; index < 2; index += 1) {
      const first = same.branches[index];
      const second = different.branches[index];
      expect(second.distance).toBe(first.distance);
      expect(second.lineAdmittance).toEqual(first.lineAdmittance);
      expect(second.requiredSusceptance).toBe(first.requiredSusceptance);
      expect(second.openLength).not.toBeCloseTo(first.openLength, 8);
      expect(Math.abs(second.openLength - second.shortLength)).toBeCloseTo(0.25, 12);
    }
  });

  it('identifies the continuous already-matched family without inventing two branches', () => {
    const input: SingleStubInput = { ...example, stubZ0: 90, load: { kind: 'impedance', resistance: 50, reactance: 0 } };
    const result = solveSingleStub(input);
    expect(result.status).toBe('already-matched');
    expect(result.branches).toEqual([]);
    expect(result.vswr).toBe(1);
    for (const distance of [0, 0.137, 0.25, 0.5, 1.2]) {
      expectComplex(evaluateSingleStub({ ...input, distance, termination: 'open', stubLength: 0 }).totalImpedance, 50, 0);
      expectComplex(evaluateSingleStub({ ...input, distance, termination: 'short', stubLength: 0.25 }).totalImpedance, 50, 0);
    }
  });

  it('keeps genuinely nonzero small mismatch distinct from an exact match', () => {
    const result = solveSingleStub({ ...example, load: { kind: 'impedance', resistance: 50, reactance: 1e-8 } });
    expect(result.status).toBe('solved');
    expect(result.branches).toHaveLength(2);
    expect(result.branches[0].distance).toBeLessThan(result.branches[1].distance);
  });

  it.each([
    { kind: 'open' as const },
    { kind: 'short' as const },
    { kind: 'impedance' as const, resistance: 0, reactance: 0 },
    { kind: 'impedance' as const, resistance: 0, reactance: 50 },
    { kind: 'impedance' as const, resistance: 0, reactance: -75 },
  ])('identifies a zero-real-power load as unmatchable: %j', (load) => {
    const result = solveSingleStub({ ...example, load });
    expect(result.status).toBe('unmatchable');
    expect(result.branches).toEqual([]);
    expect(result.vswr).toBe(Infinity);
    expect(result.message).toMatch(/real power/);
  });

  it.each([
    { ...example, z0: 0 },
    { ...example, z0: NaN },
    { ...example, stubZ0: 0 },
    { ...example, stubZ0: -25 },
    { ...example, stubZ0: Infinity },
    { ...example, load: { kind: 'impedance' as const, resistance: -1, reactance: 0 } },
    { ...example, load: { kind: 'impedance' as const, resistance: 1, reactance: NaN } },
    { ...example, stubZ0: Number.MIN_VALUE },
  ])('rejects invalid or unrepresentable synthesis inputs: %j', (input) => {
    expect(() => solveSingleStub(input)).toThrow(RangeError);
  });
});

describe('manual single shunt-stub evaluation', () => {
  it('agrees with the existing line model when an open stub contributes zero susceptance', () => {
    for (const distance of [0, 0.01, 0.125, 0.25, 0.499, 0.5, 1.3]) {
      const manual = evaluateSingleStub({ ...example, distance, stubLength: 0, termination: 'open' });
      const line = solveLine({ z0: example.z0, load: example.load, lengthInWavelengths: distance });
      expectComplex(manual.totalImpedance, line.inputImpedance!.re, line.inputImpedance!.im, 9);
      expectComplex(manual.reflection, line.inputReflection.re, line.inputReflection.im, 12);
    }
  });

  it('preserves independent half-wave repeats of the main line and stub', () => {
    for (const branch of solveSingleStub(example).branches) {
      for (const termination of ['open', 'short'] as const) {
        const length = termination === 'open' ? branch.openLength : branch.shortLength;
        for (const lineRepeats of [0, 1, 4]) {
          for (const stubRepeats of [0, 1, 3]) {
            const final = evaluateSingleStub({ ...example, termination, distance: branch.distance + lineRepeats * 0.5, stubLength: length + stubRepeats * 0.5 });
            expectComplex(final.totalImpedance, 50, 0, 9);
            expect(final.reflectionMagnitude).toBeLessThan(1e-10);
          }
        }
      }
    }
  });

  it.each([
    { termination: 'open' as const, stubLength: 0.25 },
    { termination: 'open' as const, stubLength: 0.75 },
    { termination: 'short' as const, stubLength: 0 },
    { termination: 'short' as const, stubLength: 0.5 },
  ])('represents the ideal stub pole as a shorted junction: %j', (stub) => {
    const result = evaluateSingleStub({ ...example, distance: 0.173, ...stub });
    expect(result.stubSusceptance).toBe(Infinity);
    expect(result.totalAdmittance).toBeNull();
    expectComplex(result.totalImpedance, 0, 0);
    expectComplex(result.reflection, -1, 0);
    expect(result.reflectionMagnitude).toBe(1);
    expect(result.vswr).toBe(Infinity);
  });

  it('does not clamp a finite stub close to its pole to an arbitrary large value', () => {
    const before = evaluateSingleStub({ ...example, distance: 0.1, termination: 'open', stubLength: 0.25 - 1e-8 });
    const after = evaluateSingleStub({ ...example, distance: 0.1, termination: 'open', stubLength: 0.25 + 1e-8 });
    expect(Number.isFinite(before.stubSusceptance)).toBe(true);
    expect(Number.isFinite(after.stubSusceptance)).toBe(true);
    expect(before.stubSusceptance).toBeGreaterThan(1e7);
    expect(after.stubSusceptance).toBeLessThan(-1e7);
    expect(before.totalAdmittance).not.toBeNull();
    expect(after.totalAdmittance).not.toBeNull();
  });

  it('preserves finite susceptance immediately beside a quarter-wave pole', () => {
    const before = evaluateSingleStub({ ...example, distance: 0.1, termination: 'open', stubLength: 0.25 - Number.EPSILON / 8 });
    const after = evaluateSingleStub({ ...example, distance: 0.1, termination: 'open', stubLength: 0.25 + Number.EPSILON / 4 });
    expect(Number.isFinite(before.stubSusceptance)).toBe(true);
    expect(Number.isFinite(after.stubSusceptance)).toBe(true);
    expect(before.stubSusceptance).toBeGreaterThan(1e15);
    expect(after.stubSusceptance).toBeLessThan(-1e15);
    expect(before.totalAdmittance).not.toBeNull();
    expect(after.totalAdmittance).not.toBeNull();
  });

  it('preserves a finite 1e-17 stub length and load-to-junction distance', () => {
    const open = evaluateSingleStub({ ...example, distance: 0, termination: 'open', stubLength: 1e-17 });
    expect(open.stubSusceptance).toBeGreaterThan(0);
    expect(open.stubSusceptance / (2 * Math.PI * 1e-17)).toBeCloseTo(1, 14);
    const short = evaluateSingleStub({ ...example, distance: 0, termination: 'short', stubLength: 1e-17 });
    expect(Number.isFinite(short.stubSusceptance)).toBe(true);
    expect(short.stubSusceptance).toBeLessThan(-1e16);
    expect(short.totalAdmittance).not.toBeNull();
    const shortLine = evaluateSingleStub({ ...example, load: { kind: 'short' }, distance: 1e-17, termination: 'open', stubLength: 0 });
    expect(shortLine.lineAdmittance).not.toBeNull();
    expect(Number.isFinite(shortLine.lineAdmittance!.im)).toBe(true);
    expect(shortLine.lineAdmittance!.im).toBeLessThan(-1e16);
  });

  it('distinguishes a finite reactive-line admittance beside an exact pole', () => {
    const result = evaluateSingleStub({ ...example, load: { kind: 'impedance', resistance: 0, reactance: -50 },
      distance: 0.125 - Number.EPSILON / 16, termination: 'open', stubLength: 0 });
    expect(result.lineAdmittance).not.toBeNull();
    expect(Number.isFinite(result.lineAdmittance!.im)).toBe(true);
    expect(Math.abs(result.lineAdmittance!.im)).toBeGreaterThan(1e15);
    expect(result.totalImpedance).not.toEqual({ re: 0, im: 0 });
  });

  it('shows a mismatch after manually moving away from a synthesized design', () => {
    const branch = solveSingleStub(example).branches[0];
    const tuned = evaluateSingleStub({ ...example, termination: 'short', distance: branch.distance, stubLength: branch.shortLength });
    const detuned = evaluateSingleStub({ ...example, termination: 'short', distance: branch.distance + 0.03, stubLength: branch.shortLength + 0.02 });
    expect(tuned.reflectionMagnitude).toBeLessThan(1e-12);
    expect(detuned.reflectionMagnitude).toBeGreaterThan(0.1);
    expect(detuned.vswr).toBeGreaterThan(1);
  });

  it('keeps ideal open, short, and reactive line boundaries meaningful', () => {
    const open = evaluateSingleStub({ ...example, load: { kind: 'open' }, distance: 0, termination: 'open', stubLength: 0 });
    expectComplex(open.lineAdmittance, 0, 0);
    expect(open.totalImpedance).toBeNull();
    expectComplex(open.reflection, 1, 0);
    const short = evaluateSingleStub({ ...example, load: { kind: 'short' }, distance: 0, termination: 'open', stubLength: 0 });
    expect(short.lineAdmittance).toBeNull();
    expectComplex(short.totalImpedance, 0, 0);
    const quarter = evaluateSingleStub({ ...example, load: { kind: 'short' }, distance: 0.25, termination: 'open', stubLength: 0 });
    expectComplex(quarter.lineAdmittance, 0, 0);
    expect(quarter.totalImpedance).toBeNull();
    const reactivePole = evaluateSingleStub({ ...example, load: { kind: 'impedance', resistance: 0, reactance: -50 }, distance: 0.125, termination: 'open', stubLength: 0 });
    expect(reactivePole.lineAdmittance).toBeNull();
    expectComplex(reactivePole.totalImpedance, 0, 0);
  });

  it.each([
    { distance: -0.1, stubLength: 0.1 },
    { distance: 0.1, stubLength: -0.1 },
    { distance: NaN, stubLength: 0.1 },
    { distance: 0.1, stubLength: Infinity },
  ])('rejects invalid manual lengths: %j', (lengths) => {
    expect(() => evaluateSingleStub({ ...example, termination: 'open', ...lengths })).toThrow(RangeError);
  });
});
