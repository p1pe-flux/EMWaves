import { describe, expect, it } from 'vitest';
import { evaluateQuarterWave, solveQuarterWave, type QuarterWaveInput } from './quarterWave';
import { solveLine, type ComplexValue } from './transmission';

const example: QuarterWaveInput = { z0: 50, load: { kind: 'impedance', resistance: 100, reactance: 50 } };

function expectComplex(actual: ComplexValue | null, re: number, im: number, digits = 10): void {
  expect(actual).not.toBeNull();
  expect(actual!.re).toBeCloseTo(re, digits);
  expect(actual!.im).toBeCloseTo(im, digits);
}

describe('quarter-wave synthesis', () => {
  it('matches both real-axis branches of the complex teaching example', () => {
    const result = solveQuarterWave(example);
    expect(result.status).toBe('solved');
    expectComplex(result.normalizedLoad, 2, 1);
    expectComplex(result.loadReflection, 0.4, 0.2);
    expect(result.branches).toHaveLength(2);
    const [first, second] = result.branches;
    expect(first.distance).toBeCloseTo(0.03689590441260832, 13);
    expect(second.distance).toBeCloseTo(0.2868959044126083, 13);
    expect(first.resistance).toBeCloseTo(130.90169943749476, 10);
    expect(second.resistance).toBeCloseTo(19.09830056250526, 10);
    expect(first.transformerZ0).toBeCloseTo(80.90169943749474, 10);
    expect(second.transformerZ0).toBeCloseTo(30.90169943749474, 10);
    expectComplex(first.reflection, Math.sqrt(0.2), 0);
    expectComplex(second.reflection, -Math.sqrt(0.2), 0);
    for (const branch of result.branches) {
      expect(branch.transformerLength).toBe(0.25);
      expect(branch.residual).toBeLessThan(1e-12);
      const evaluation = evaluateQuarterWave({ ...example, ...branch });
      expectComplex(evaluation.lineImpedance, branch.resistance, 0);
      expectComplex(evaluation.inputImpedance, 50, 0);
      expectComplex(evaluation.reflection, 0, 0);
      expect(evaluation.vswr).toBeCloseTo(1, 12);
    }
  });

  it.each([10, 25, 100, 200])('includes the load and its quarter-wave inversion for real RL=%s Ω', (resistance) => {
    const input: QuarterWaveInput = { z0: 50, load: { kind: 'impedance', resistance, reactance: 0 } };
    const result = solveQuarterWave(input);
    expect(result.branches[0].distance).toBe(0);
    expect(result.branches[1].distance).toBe(0.25);
    expect(result.branches[0].resistance).toBeCloseTo(resistance, 10);
    expect(result.branches[1].resistance).toBeCloseTo(2500 / resistance, 10);
    expect(Math.sign(result.branches[0].reflection.re)).toBe(Math.sign(resistance - 50));
    expect(Math.sign(result.branches[1].reflection.re)).toBe(-Math.sign(resistance - 50));
  });

  it('uses clockwise travel and sorts the capacitive-load intersections by distance', () => {
    const input: QuarterWaveInput = { ...example, load: { kind: 'impedance', resistance: 100, reactance: -50 } };
    const result = solveQuarterWave(input);
    expect(result.branches[0].distance).toBeCloseTo(0.21310409558739168, 13);
    expect(result.branches[1].distance).toBeCloseTo(0.4631040955873917, 13);
    expect(result.branches[0].reflection.re).toBeLessThan(0);
    expect(result.branches[1].reflection.re).toBeGreaterThan(0);
  });

  it('matches a deterministic sweep of passive real and complex loads at both branches', () => {
    for (const z0 of [25, 50, 90]) {
      for (let index = 0; index < 45; index += 1) {
        const resistance = 2 + (index * 73 % 331);
        const reactance = -140 + (index * 41 % 281);
        const input: QuarterWaveInput = { z0, load: { kind: 'impedance', resistance, reactance } };
        const result = solveQuarterWave(input);
        expect(result.branches).toHaveLength(2);
        expect(result.branches[0].distance).toBeGreaterThanOrEqual(0);
        expect(result.branches[1].distance).toBeLessThan(0.5);
        expect(result.branches[1].distance - result.branches[0].distance).toBeCloseTo(0.25, 12);
        for (const branch of result.branches) {
          expect(branch.resistance).toBeGreaterThan(0);
          expect(branch.transformerZ0 ** 2 / (z0 * branch.resistance)).toBeCloseTo(1, 12);
          const evaluation = evaluateQuarterWave({ ...input, ...branch });
          expectComplex(evaluation.lineImpedance, branch.resistance, 0, 8);
          expectComplex(evaluation.inputImpedance, z0, 0, 8);
          expect(evaluation.reflectionMagnitude).toBeLessThan(1e-10);
        }
      }
    }
  });

  it('returns one canonical same-impedance section for an already-matched load', () => {
    const result = solveQuarterWave({ ...example, load: { kind: 'impedance', resistance: 50, reactance: 0 } });
    expect(result.status).toBe('already-matched');
    expect(result.branches).toEqual([{ distance: 0, resistance: 50, reflection: { re: 0, im: 0 }, transformerZ0: 50, transformerLength: 0.25, residual: 0 }]);
    expect(result.message).toMatch(/placement is arbitrary/);
    expect(result.vswr).toBe(1);
  });

  it('preserves a nonzero near-match as two distinct branches', () => {
    const result = solveQuarterWave({ ...example, load: { kind: 'impedance', resistance: 50, reactance: 1e-9 } });
    expect(result.status).toBe('solved');
    expect(result.branches).toHaveLength(2);
    expect(result.branches[1].distance - result.branches[0].distance).toBeCloseTo(0.25, 12);
    expect(result.branches.every((branch) => branch.residual < 1e-10)).toBe(true);
  });

  it.each([{ kind: 'open' as const }, { kind: 'short' as const }, { kind: 'impedance' as const, resistance: 0, reactance: 0 }, { kind: 'impedance' as const, resistance: 0, reactance: 50 }, { kind: 'impedance' as const, resistance: 0, reactance: -75 }])('explains why a zero-real-power load is unmatchable: %j', (load) => {
    const result = solveQuarterWave({ ...example, load });
    expect(result.status).toBe('unmatchable');
    expect(result.branches).toEqual([]);
    expect(result.vswr).toBe(Infinity);
    expect(result.message).toMatch(/real power/);
  });

  it('uses a scaled square root and direct transfer for extreme finite real impedances', () => {
    const matched = solveQuarterWave({ z0: 1e300, load: { kind: 'impedance', resistance: 1e300, reactance: 0 } });
    expect(matched.branches[0].transformerZ0).toBe(1e300);
    for (const resistance of [1e-250, 1e250]) {
      const input: QuarterWaveInput = { z0: 1, load: { kind: 'impedance', resistance, reactance: 0 } };
      const result = solveQuarterWave(input);
      expect(Number.isFinite(result.vswr)).toBe(true);
      for (const branch of result.branches) {
        expect(Number.isFinite(branch.resistance)).toBe(true);
        expect(Number.isFinite(branch.transformerZ0)).toBe(true);
        expect(branch.residual).toBeLessThan(1e-10);
      }
    }
  });

  it.each([
    { ...example, z0: 0 }, { ...example, z0: -50 }, { ...example, z0: NaN },
    { ...example, load: { kind: 'impedance' as const, resistance: -1, reactance: 0 } },
    { ...example, load: { kind: 'impedance' as const, resistance: 1, reactance: Infinity } },
    { ...example, z0: Number.MIN_VALUE },
  ])('rejects invalid or unrepresentable inputs instead of emitting NaN: %j', (input) => {
    expect(() => solveQuarterWave(input)).toThrow(RangeError);
  });
});

describe('quarter-wave cascade evaluation', () => {
  it('keeps transformer-reference Γ separate from the final main-line reference', () => {
    const branch = solveQuarterWave(example).branches[0];
    const start = evaluateQuarterWave({ ...example, ...branch, transformerLength: 0 });
    const middle = evaluateQuarterWave({ ...example, ...branch, transformerLength: 0.125 });
    const finish = evaluateQuarterWave({ ...example, ...branch });
    expectComplex(start.inputImpedance, branch.resistance, 0);
    expectComplex(start.reflection, branch.reflection.re, 0);
    expect(start.transformerLoadReflection.re).toBeGreaterThan(0);
    expect(start.transformerLoadReflection.re).not.toBeCloseTo(start.reflection.re, 4);
    expectComplex(middle.transformerInputReflection, 0, -start.transformerLoadReflection.re);
    expectComplex(finish.transformerInputReflection, -start.transformerLoadReflection.re, 0);
    expect(finish.transformerInputReflection.re).not.toBe(0);
    expectComplex(finish.reflection, 0, 0);
    for (const length of [0, 0.037, 0.125, 0.2, 0.25]) {
      const value = evaluateQuarterWave({ ...example, ...branch, transformerLength: length });
      const independent = solveLine({ z0: branch.transformerZ0, load: { kind: 'impedance', resistance: branch.resistance, reactance: 0 }, lengthInWavelengths: length });
      expectComplex(value.inputImpedance, independent.inputImpedance!.re, independent.inputImpedance!.im, 9);
      expect(Math.hypot(value.transformerInputReflection.re, value.transformerInputReflection.im)).toBeCloseTo(Math.hypot(value.transformerLoadReflection.re, value.transformerLoadReflection.im), 12);
    }
  });

  it('implements quarter-wave impedance inversion for arbitrary transformer impedance', () => {
    const input: QuarterWaveInput = { z0: 50, load: { kind: 'impedance', resistance: 100, reactance: 0 } };
    const result = evaluateQuarterWave({ ...input, distance: 0, transformerZ0: 75, transformerLength: 0.25 });
    expectComplex(result.inputImpedance, 75 ** 2 / 100, 0);
    expect(result.reflectionMagnitude).toBeGreaterThan(0);
  });

  it('preserves independent main-line and transformer half-wave repetitions', () => {
    for (const branch of solveQuarterWave(example).branches) {
      for (const linePeriods of [0, 1, 4]) {
        for (const transformerPeriods of [0, 1, 3]) {
          const result = evaluateQuarterWave({ ...example, ...branch, distance: branch.distance + linePeriods * 0.5, transformerLength: branch.transformerLength + transformerPeriods * 0.5 });
          expectComplex(result.inputImpedance, 50, 0, 9);
          expect(result.reflectionMagnitude).toBeLessThan(1e-10);
        }
      }
    }
  });

  it('represents ideal open, short, and reactive poles explicitly', () => {
    const config = { z0: 50, distance: 0, transformerZ0: 75, transformerLength: 0.25 };
    const open = evaluateQuarterWave({ ...config, load: { kind: 'open' } });
    expect(open.lineImpedance).toBeNull();
    expectComplex(open.inputImpedance, 0, 0);
    expectComplex(open.reflection, -1, 0);
    expect(open.vswr).toBe(Infinity);
    const short = evaluateQuarterWave({ ...config, load: { kind: 'short' } });
    expectComplex(short.lineImpedance, 0, 0);
    expect(short.inputImpedance).toBeNull();
    expectComplex(short.reflection, 1, 0);
    const reactive = evaluateQuarterWave({ ...config, load: { kind: 'impedance', resistance: 0, reactance: 50 }, distance: 0.125, transformerLength: 0 });
    expect(reactive.lineImpedance).toBeNull();
    expect(reactive.inputImpedance).toBeNull();
    expect(reactive.reflectionMagnitude).toBe(1);
  });

  it('retains finite behavior close to a quarter-wave pole without arbitrary clipping', () => {
    const input: QuarterWaveInput = { z0: 50, load: { kind: 'short' } };
    for (const transformerLength of [0.25 - 1e-8, 0.25 + 1e-8]) {
      const result = evaluateQuarterWave({ ...input, distance: 0, transformerZ0: 75, transformerLength });
      expect(result.inputImpedance).not.toBeNull();
      expect(Number.isFinite(result.inputImpedance!.im)).toBe(true);
      expect(Math.abs(result.inputImpedance!.im)).toBeGreaterThan(1e8);
    }
  });

  it('keeps the neighboring finite reactive line distinct from its exact pole', () => {
    const config = { z0: 50, load: { kind: 'impedance' as const, resistance: 0, reactance: 50 },
      transformerZ0: 75, transformerLength: 0 };
    for (const distance of [0.125 - Number.EPSILON / 16, 0.125 + Number.EPSILON / 8]) {
      const result = evaluateQuarterWave({ ...config, distance });
      expect(result.lineImpedance).not.toBeNull();
      expect(result.inputImpedance).not.toBeNull();
      expect(Number.isFinite(result.inputImpedance!.im)).toBe(true);
      expect(Math.abs(result.inputImpedance!.im)).toBeGreaterThan(1e17);
    }
  });

  it.each([
    { distance: -0.1, transformerZ0: 75, transformerLength: 0.25 },
    { distance: 0.1, transformerZ0: 0, transformerLength: 0.25 },
    { distance: 0.1, transformerZ0: Infinity, transformerLength: 0.25 },
    { distance: NaN, transformerZ0: 75, transformerLength: 0.25 },
    { distance: 0.1, transformerZ0: 75, transformerLength: -1 },
    { distance: 0.1, transformerZ0: 75, transformerLength: Infinity },
  ])('rejects invalid cascade parameters: %j', (parameters) => {
    expect(() => evaluateQuarterWave({ ...example, ...parameters })).toThrow(RangeError);
  });
});
