import { describe, expect, it } from 'vitest';
import {
  impedanceToReflection,
  reflectionToImpedance,
  solveLine,
  type ComplexValue,
  type LineInput,
} from './transmission';

function expectComplex(actual: ComplexValue | null, re: number, im: number): void {
  expect(actual).not.toBeNull();
  expect(actual!.re).toBeCloseTo(re, 10);
  expect(actual!.im).toBeCloseTo(im, 10);
}

const example: LineInput = {
  z0: 50,
  load: { kind: 'impedance', resistance: 100, reactance: 50 },
  lengthInWavelengths: 0,
};

describe('Smith transforms', () => {
  it('maps normalized 2 + j to 0.4 + j0.2 and back', () => {
    expectComplex(impedanceToReflection({ re: 2, im: 1 }), 0.4, 0.2);
    expectComplex(reflectionToImpedance({ re: 0.4, im: 0.2 }), 2, 1);
  });

  it('handles matched, short, and open boundaries', () => {
    expectComplex(impedanceToReflection({ re: 1, im: 0 }), 0, 0);
    expectComplex(impedanceToReflection({ re: 0, im: 0 }), -1, 0);
    expectComplex(reflectionToImpedance({ re: -1, im: 0 }), 0, 0);
    expect(reflectionToImpedance({ re: 1, im: 0 })).toBeNull();
  });

  it('does not overflow the complex quotient for huge finite impedances', () => {
    const gamma = impedanceToReflection({ re: 1e300, im: 1e300 });
    expect(Number.isFinite(gamma.re)).toBe(true);
    expect(Number.isFinite(gamma.im)).toBe(true);
    expect(gamma.re).toBeCloseTo(1, 12);
  });

  it.each([
    { re: 1, im: 1e-8 },
    { re: 1, im: -1e-8 },
    { re: 0.999999999998875, im: 0.0000014999999999994376 },
    { re: 0.9995589874191622, im: 0.02969563384707144 },
    { re: 0.9995589874191622, im: -0.02969563384707144 },
  ])('keeps an accepted near-open boundary point passive: %j', (gamma) => {
    const z = reflectionToImpedance(gamma);
    expect(z).not.toBeNull();
    expect(z!.re).toBe(0);
    expect(Number.isFinite(z!.im)).toBe(true);
    expect(() => impedanceToReflection(z!)).not.toThrow();
    const restored = impedanceToReflection(z!);
    expect(Math.hypot(restored.re - gamma.re, restored.im - gamma.im)).toBeLessThan(8 * Number.EPSILON);
    expect(() => solveLine({
      z0: 50,
      load: { kind: 'impedance', resistance: z!.re * 50, reactance: z!.im * 50 },
      lengthInWavelengths: 0,
    })).not.toThrow();
  });

  it('returns passive finite impedances across the disk and its roundoff boundary', () => {
    for (const radius of [0.5, 0.99, 1, 1 + 2 * Number.EPSILON]) {
      for (let index = 0; index < 1000; index += 1) {
        const angle = 2 * Math.PI * index / 1000;
        const gamma = { re: radius * Math.cos(angle), im: radius * Math.sin(angle) };
        const z = reflectionToImpedance(gamma);
        if (z === null) continue;
        expect(z.re).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(z.re)).toBe(true);
        expect(Number.isFinite(z.im)).toBe(true);
        const restored = impedanceToReflection(z);
        expect(Math.hypot(restored.re - gamma.re, restored.im - gamma.im)).toBeLessThan(16 * Number.EPSILON);
      }
    }
  });

  it('preserves a large finite near-open resistance and the existing pole tolerance', () => {
    const re = 1 - 16 * Number.EPSILON;
    const z = reflectionToImpedance({ re, im: 0 });
    expect(z).not.toBeNull();
    expect(z!.re / ((1 + re) / (1 - re))).toBeCloseTo(1, 12);
    expect(z!.im).toBe(0);
    expect(reflectionToImpedance({ re: 1, im: 4 * Number.EPSILON })).toBeNull();
  });

  it('rejects active loads, nonfinite values and reflections outside the passive disk', () => {
    expect(() => impedanceToReflection({ re: -1, im: 0 })).toThrow(RangeError);
    expect(() => impedanceToReflection({ re: 1, im: NaN })).toThrow(RangeError);
    expect(() => reflectionToImpedance({ re: 1.1, im: 0 })).toThrow(RangeError);
    expect(() => reflectionToImpedance({ re: 1 + 16 * Number.EPSILON, im: 0 })).toThrow(RangeError);
    expect(() => reflectionToImpedance({ re: Infinity, im: 0 })).toThrow(RangeError);
  });
});

describe('lossless line', () => {
  it('matches the analytic complex-load result at the load', () => {
    const solution = solveLine(example);
    expectComplex(solution.normalizedLoad, 2, 1);
    expectComplex(solution.loadReflection, 0.4, 0.2);
    expectComplex(solution.inputImpedance, 100, 50);
    expect(solution.reflectionMagnitude).toBeCloseTo(Math.sqrt(0.2), 12);
    expect(solution.vswr).toBeCloseTo((1 + Math.sqrt(0.2)) / (1 - Math.sqrt(0.2)), 12);
    expect(solution.returnLossDb).toBeCloseTo(6.98970004336, 10);
  });

  it('transforms a quarter wave to Z0² / ZL', () => {
    const solution = solveLine({ ...example, lengthInWavelengths: 0.25 });
    expectComplex(solution.inputReflection, -0.4, -0.2);
    expectComplex(solution.inputImpedance, 20, -10);
  });

  it('recovers the load at half-wave multiples', () => {
    for (const lengthInWavelengths of [0, 0.5, 1, 2.5, 100]) {
      const solution = solveLine({ ...example, lengthInWavelengths });
      expectComplex(solution.inputImpedance, 100, 50);
    }
  });

  it.each([1e-18, 1e18])('preserves a finite %s Ω load when Γ rounds to the disk boundary', resistance => {
    for (const lengthInWavelengths of [0, 0.5, 1.5]) {
      const solution = solveLine({ z0: 50, load: { kind: 'impedance', resistance, reactance: 0 }, lengthInWavelengths });
      expect(solution.inputImpedance).not.toBeNull();
      expect(solution.inputImpedance!.re / resistance).toBeCloseTo(1, 13);
      expect(solution.inputImpedance!.im).toBe(0);
      expect(solution.vswr / Math.max(resistance / 50, 50 / resistance)).toBeCloseTo(1, 13);
    }
    const quarter = solveLine({ z0: 50, load: { kind: 'impedance', resistance, reactance: 0 }, lengthInWavelengths: 0.25 });
    expect(quarter.inputImpedance).not.toBeNull();
    expect(quarter.inputImpedance!.re / (50 * 50 / resistance)).toBeCloseTo(1, 13);
    expect(quarter.inputImpedance!.im).toBe(0);
  });

  it('preserves the positive real part of a highly reflective load during propagation', () => {
    const solution = solveLine({ z0: 50, load: { kind: 'impedance', resistance: 1e18, reactance: 0 }, lengthInWavelengths: 0.125 });
    expect(solution.inputImpedance).not.toBeNull();
    // At βd=π/4: Re(Zin)=2 R Z0²/(R²+Z0²), Im(Zin)=Z0(Z0²−R²)/(R²+Z0²).
    expect(solution.inputImpedance!.re / (2 * 50 * 50 / 1e18)).toBeCloseTo(1, 13);
    expect(solution.inputImpedance!.im).toBeCloseTo(-50, 12);
  });

  it('rotates clockwise toward the generator and preserves the SWR circle', () => {
    expectComplex(solveLine({ ...example, lengthInWavelengths: 0.125 }).inputReflection, 0.2, -0.4);
    for (let index = 0; index <= 100; index += 1) {
      const solution = solveLine({ ...example, lengthInWavelengths: index / 200 });
      expect(Math.hypot(solution.inputReflection.re, solution.inputReflection.im))
        .toBeCloseTo(solution.reflectionMagnitude, 12);
    }
  });

  it('keeps a matched load constant at every position', () => {
    for (const lengthInWavelengths of [0, 0.13, 0.25, 0.5]) {
      const solution = solveLine({ z0: 50, load: { kind: 'impedance', resistance: 50, reactance: 0 }, lengthInWavelengths });
      expectComplex(solution.inputReflection, 0, 0);
      expectComplex(solution.inputImpedance, 50, 0);
      expect(solution.vswr).toBe(1);
      expect(solution.returnLossDb).toBe(Infinity);
    }
  });

  it('swaps open and short circuits after a quarter wave', () => {
    const open = solveLine({ z0: 50, load: { kind: 'open' }, lengthInWavelengths: 0 });
    expect(open.normalizedLoad).toBeNull();
    expect(open.inputImpedance).toBeNull();
    expect(open.vswr).toBe(Infinity);
    expect(open.returnLossDb).toBe(0);
    expectComplex(solveLine({ z0: 50, load: { kind: 'open' }, lengthInWavelengths: 0.25 }).inputImpedance, 0, 0);
    expect(solveLine({ z0: 50, load: { kind: 'short' }, lengthInWavelengths: 0.25 }).inputImpedance).toBeNull();
    expectComplex(solveLine({ z0: 50, load: { kind: 'short' }, lengthInWavelengths: 0.5 }).inputImpedance, 0, 0);
  });

  it('handles purely reactive loads on the perimeter', () => {
    const solution = solveLine({ z0: 50, load: { kind: 'impedance', resistance: 0, reactance: 50 }, lengthInWavelengths: 0 });
    expectComplex(solution.loadReflection, 0, 1);
    expectComplex(solution.inputImpedance, 0, 50);
    expect(solution.vswr).toBe(Infinity);
    for (const reactance of [-1e5, -75, -0.5, 0, 0.5, 17, 75, 1e5]) {
      expect(solveLine({ z0: 50, load: { kind: 'impedance', resistance: 0, reactance }, lengthInWavelengths: 0.18 }).vswr)
        .toBe(Infinity);
    }
  });

  it.each([
    { ...example, z0: 0 },
    { ...example, z0: -50 },
    { ...example, z0: Infinity },
    { ...example, z0: NaN },
    { ...example, lengthInWavelengths: -0.1 },
    { ...example, lengthInWavelengths: Infinity },
    { ...example, load: { kind: 'impedance' as const, resistance: -1, reactance: 0 } },
    { ...example, load: { kind: 'impedance' as const, resistance: 50, reactance: NaN } },
  ])('rejects invalid line parameters (%j)', (input) => {
    expect(() => solveLine(input)).toThrow(RangeError);
  });

  it('rejects unrepresentable normalized impedances instead of emitting NaN', () => {
    expect(() => solveLine({ ...example, z0: Number.MIN_VALUE })).toThrow(RangeError);
    expect(() => solveLine({ ...example, load: { kind: 'impedance', resistance: Number.MIN_VALUE, reactance: 0 } })).toThrow(RangeError);
  });
});
