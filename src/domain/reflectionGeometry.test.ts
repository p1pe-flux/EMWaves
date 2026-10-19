import { describe, expect, it } from 'vitest';
import { reflectionGeometry } from './reflectionGeometry';
import { solveLine, type ComplexValue } from './transmission';

describe('reflection coefficient geometry', () => {
  it('maps normalized 2 + j to the known Cartesian and polar reflection', () => {
    const geometry = reflectionGeometry({ re: 2, im: 1 });
    expect(geometry.gamma.re).toBeCloseTo(0.4, 12);
    expect(geometry.gamma.im).toBeCloseTo(0.2, 12);
    expect(geometry.magnitude).toBeCloseTo(Math.sqrt(0.2), 12);
    expect(geometry.phase).toBeCloseTo(Math.atan(0.5), 12);
  });

  it.each([
    [{ re: 2, im: 1 }, Math.atan(0.5)],
    [{ re: 0.5, im: 0.5 }, Math.PI - Math.atan(2)],
    [{ re: 0.5, im: -0.5 }, -Math.PI + Math.atan(2)],
    [{ re: 2, im: -1 }, -Math.atan(0.5)],
  ])('uses the correct principal argument in every quadrant: %j', (z, expected) => {
    const geometry = reflectionGeometry(z);
    expect(geometry.phase).toBeCloseTo(expected, 12);
    expect(geometry.magnitude * Math.cos(geometry.phase!)).toBeCloseTo(geometry.gamma.re, 12);
    expect(geometry.magnitude * Math.sin(geometry.phase!)).toBeCloseTo(geometry.gamma.im, 12);
  });

  it('distinguishes a match, short, open, and the two imaginary-axis points', () => {
    expect(reflectionGeometry({ re: 1, im: 0 })).toEqual({
      gamma: { re: 0, im: 0 }, magnitude: 0, phase: null,
    });
    expect(reflectionGeometry({ re: 0, im: 0 })).toEqual({
      gamma: { re: -1, im: 0 }, magnitude: 1, phase: Math.PI,
    });
    expect(reflectionGeometry(null)).toEqual({
      gamma: { re: 1, im: 0 }, magnitude: 1, phase: 0,
    });
    expect(reflectionGeometry({ re: 0, im: 1 })).toEqual({
      gamma: { re: 0, im: 1 }, magnitude: 1, phase: Math.PI / 2,
    });
    expect(reflectionGeometry({ re: 0, im: -1 })).toEqual({
      gamma: { re: 0, im: -1 }, magnitude: 1, phase: -Math.PI / 2,
    });
  });

  it('agrees with the transmission model for different physical impedance scales', () => {
    for (const z0 of [1, 50, 75]) {
      for (const z of [{ re: 0, im: 0.37 }, { re: 0.4, im: -0.7 }, { re: 1, im: 0 }, { re: 2, im: 1 }]) {
        const line = solveLine({
          z0,
          load: { kind: 'impedance', resistance: z.re * z0, reactance: z.im * z0 },
          lengthInWavelengths: 0,
        });
        const geometry = reflectionGeometry(z);
        expect(geometry.gamma.re).toBeCloseTo(line.loadReflection.re, 12);
        expect(geometry.gamma.im).toBeCloseTo(line.loadReflection.im, 12);
        expect(geometry.magnitude).toBeCloseTo(line.reflectionMagnitude, 12);
      }
    }
  });

  it('keeps ideal reactive loads exactly on the unit circle', () => {
    for (const im of [-1e300, -75, -0.37, -Number.MIN_VALUE, 0, Number.MIN_VALUE, 0.37, 75, 1e300]) {
      expect(reflectionGeometry({ re: 0, im }).magnitude).toBe(1);
    }
  });

  it('normalizes signed zeros without inventing a matched-load argument', () => {
    expect(reflectionGeometry({ re: 0, im: -0 }).phase).toBe(Math.PI);
    expect(reflectionGeometry({ re: 1, im: -0 }).phase).toBeNull();
    const phase = reflectionGeometry({ re: 2, im: -0 }).phase;
    expect(phase).toBe(0);
    expect(Object.is(phase, -0)).toBe(false);
  });

  it('keeps extreme finite inputs representable without evaluating squared impedances', () => {
    for (const z of [
      { re: Number.MAX_VALUE, im: Number.MAX_VALUE },
      { re: Number.MAX_VALUE, im: -Number.MAX_VALUE },
      { re: Number.MIN_VALUE, im: -Number.MIN_VALUE },
      { re: 1e300, im: 1e300 },
    ]) {
      const geometry = reflectionGeometry(z);
      expect(Number.isFinite(geometry.gamma.re)).toBe(true);
      expect(Number.isFinite(geometry.gamma.im)).toBe(true);
      expect(geometry.magnitude).toBeGreaterThanOrEqual(0);
      expect(geometry.magnitude).toBeLessThanOrEqual(1);
      if (geometry.phase !== null) expect(Number.isFinite(geometry.phase)).toBe(true);
    }
  });

  it('rejects active and nonfinite impedances using the model validation', () => {
    for (const z of [{ re: -0.1, im: 0 }, { re: Infinity, im: 0 }, { re: 1, im: NaN }]) {
      expect(() => reflectionGeometry(z)).toThrow(RangeError);
    }
  });

  it('leaves the source value unchanged', () => {
    const z: ComplexValue = Object.freeze({ re: 2, im: 1 });
    reflectionGeometry(z);
    expect(z).toEqual({ re: 2, im: 1 });
  });
});
