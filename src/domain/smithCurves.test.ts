import { describe, expect, it } from 'vitest';
import { loadCurves } from './smithCurves';
import { impedanceToReflection, reflectionToImpedance, type ComplexValue } from './transmission';

function finitePassive(points: ComplexValue[]): void {
  for (const point of points) {
    expect(Number.isFinite(point.re)).toBe(true);
    expect(Number.isFinite(point.im)).toBe(true);
    expect(Math.hypot(point.re, point.im)).toBeLessThanOrEqual(1 + 8 * Number.EPSILON);
  }
}

describe('load construction curves', () => {
  it('has no finite impedance construction for an open circuit', () => {
    expect(loadCurves(null)).toBeNull();
  });

  it.each([
    { re: 0, im: 0 },
    { re: 1, im: 0 },
    { re: 2, im: 1 },
    { re: 0.4, im: -0.7 },
    { re: 0, im: 3 },
    { re: 3, im: -10 },
  ])('includes the exact load in both ordered curves: %j', (z) => {
    const curves = loadCurves(z)!;
    const load = impedanceToReflection(z);
    expect(curves.resistance).toContainEqual(load);
    expect(curves.reactance).toContainEqual(load);
    expect(curves.resistance[0]).toEqual(curves.resistance.at(-1));
    expect(curves.reactance[0]).toEqual(impedanceToReflection({ re: 0, im: z.im }));
    expect(curves.reactance.at(-1)).toEqual({ re: 1, im: 0 });
    expect(curves.resistance.length).toBeGreaterThanOrEqual(193);
    expect(curves.reactance.length).toBeGreaterThanOrEqual(193);
    finitePassive(curves.resistance);
    finitePassive(curves.reactance);

    // The inserted point must not create a shortcut across the full circle.
    const radius = 1 / (z.re + 1);
    for (let index = 1; index < curves.resistance.length; index += 1) {
      const previous = curves.resistance[index - 1];
      const current = curves.resistance[index];
      expect(Math.hypot(current.re - previous.re, current.im - previous.im))
        .toBeLessThanOrEqual(2 * radius * Math.sin(Math.PI / 192) + 1e-14);
    }

    // Along the reactance arc, r must increase from zero to the open-circuit limit.
    let previousResistance = -1e-8;
    for (const point of curves.reactance) {
      const impedance = reflectionToImpedance(point);
      if (impedance !== null) {
        expect(impedance.re).toBeGreaterThanOrEqual(previousResistance - 1e-8);
        previousResistance = impedance.re;
      }
    }
  });

  it.each([0, 0.2, 1, 2, 10])('keeps resistance r=%s constant on the full circle', (r) => {
    const curves = loadCurves({ re: r, im: -0.37 })!;
    const radius = 1 / (r + 1);
    const center = r / (r + 1);
    for (const point of curves.resistance) {
      expect(Math.hypot(point.re - center, point.im)).toBeCloseTo(radius, 12);
      const impedance = reflectionToImpedance(point);
      if (impedance !== null) expect(impedance.re).toBeCloseTo(r, 8);
    }
  });

  it.each([-10, -1, -0.2, -1e-12, 0, 1e-12, 0.2, 1, 10])('keeps reactance x=%s constant on the visible arc', (x) => {
    const curves = loadCurves({ re: 0.73, im: x })!;
    for (const point of curves.reactance) {
      const impedance = reflectionToImpedance(point);
      if (impedance !== null) expect(impedance.im).toBeCloseTo(x, 8);
      if (x === 0) expect(point.im).toBe(0);
      else expect(Math.sign(point.im) === Math.sign(x) || point.im === 0).toBe(true);
    }
  });

  it('draws the unit circle for a short and a diameter for zero reactance', () => {
    const curves = loadCurves({ re: 0, im: 0 })!;
    for (const point of curves.resistance) expect(Math.hypot(point.re, point.im)).toBeCloseTo(1, 12);
    expect(curves.reactance[0]).toEqual({ re: -1, im: 0 });
    expect(curves.reactance.at(-1)).toEqual({ re: 1, im: 0 });
    for (const point of curves.reactance) expect(point.im).toBe(0);
    expect(loadCurves({ re: 1, im: 0 })!.resistance).toContainEqual({ re: 0, im: 0 });
  });

  it.each([
    { re: Number.MAX_VALUE, im: Number.MAX_VALUE },
    { re: Number.MAX_VALUE, im: -Number.MAX_VALUE },
    { re: 0, im: Number.MAX_VALUE },
    { re: 0, im: -Number.MAX_VALUE },
    { re: Number.MIN_VALUE, im: Number.MIN_VALUE },
    { re: 2, im: Number.MIN_VALUE },
    { re: 2, im: -Number.MIN_VALUE },
    { re: Number.MAX_VALUE, im: Number.MIN_VALUE },
    { re: Number.MAX_VALUE, im: 0 },
    { re: 1e-300, im: -1e-300 },
  ])('keeps all points finite for extreme finite loads: %j', (z) => {
    const curves = loadCurves(z)!;
    finitePassive(curves.resistance);
    finitePassive(curves.reactance);
    expect(curves.resistance).toContainEqual(impedanceToReflection(z));
    expect(curves.reactance).toContainEqual(impedanceToReflection(z));
  });

  it('preserves arc order when a subnormal reactance underflows during division', () => {
    const points = loadCurves({ re: 2, im: Number.MIN_VALUE })!.reactance;
    for (let index = 1; index < points.length; index += 1) {
      expect(points[index].re).toBeGreaterThanOrEqual(points[index - 1].re - 1e-15);
    }
  });

  it.each([
    { re: -1, im: 0 },
    { re: NaN, im: 1 },
    { re: 1, im: Infinity },
    { re: Infinity, im: 1 },
  ])('rejects invalid finite passive impedances: %j', (z) => {
    expect(() => loadCurves(z)).toThrow(RangeError);
  });
});
