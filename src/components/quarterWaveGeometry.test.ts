import { describe, expect, it } from 'vitest';
import { evaluateQuarterWave, solveQuarterWave } from '../domain/quarterWave';
import { reflectionToImpedance, type ComplexValue } from '../domain/transmission';
import { interpolateReference, quarterWaveCircle, quarterWaveReflection } from './quarterWaveGeometry';

function expectComplex(value: ComplexValue, re: number, im: number): void {
  expect(value.re).toBeCloseTo(re, 11);
  expect(value.im).toBeCloseTo(im, 11);
}

const input = { z0: 50, load: { kind: 'impedance' as const, resistance: 100, reactance: 50 } };

describe('quarter-wave physical chart geometry', () => {
  it('plots actual impedances in the requested real reference, including ideal endpoints', () => {
    expectComplex(quarterWaveReflection({ re: 100, im: 50 }, 50), 0.4, 0.2);
    expectComplex(quarterWaveReflection({ re: 50, im: 0 }, 50), 0, 0);
    expectComplex(quarterWaveReflection({ re: 0, im: 0 }, 50), -1, 0);
    expectComplex(quarterWaveReflection(null, 50), 1, 0);
    expectComplex(quarterWaveReflection({ re: 0, im: 50 }, 50), 0, 1);
  });

  it('renormalizes a fixed real resistance without moving the circuit or propagating along a line', () => {
    const branch = solveQuarterWave(input).branches[0];
    const resistance = { re: branch.resistance, im: 0 };
    const radii: number[] = [];
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const reference = interpolateReference(input.z0, branch.transformerZ0, progress);
      const gamma = quarterWaveReflection(resistance, reference);
      expect(gamma.im).toBe(0);
      const reading = reflectionToImpedance(gamma)!;
      expect(reading.re * reference).toBeCloseTo(branch.resistance, 10);
      expect(reading.im).toBe(0);
      radii.push(Math.hypot(gamma.re, gamma.im));
    }
    expect(radii[0]).toBeGreaterThan(radii.at(-1)!);
    const propagated = evaluateQuarterWave({ ...input, ...branch, transformerLength: 0.125 });
    expect(Math.abs(propagated.transformerInputReflection.im)).toBeGreaterThan(0.1);
    expect(Math.hypot(propagated.transformerInputReflection.re, propagated.transformerInputReflection.im)).toBeCloseTo(radii.at(-1)!, 12);
  });

  it('reaches Z0 in ohms before reaching the chart center in the main-line reference', () => {
    for (const branch of solveQuarterWave(input).branches) {
      const endpoint = evaluateQuarterWave({ ...input, ...branch });
      expect(endpoint.inputImpedance!.re).toBeCloseTo(input.z0, 10);
      expect(endpoint.inputImpedance!.im).toBeCloseTo(0, 10);
      const own = quarterWaveReflection(endpoint.inputImpedance, branch.transformerZ0);
      const main = quarterWaveReflection(endpoint.inputImpedance, input.z0);
      expectComplex(own, endpoint.transformerInputReflection.re, endpoint.transformerInputReflection.im);
      expect(Math.abs(own.re)).toBeGreaterThan(0.1);
      expectComplex(main, 0, 0);
      const start = quarterWaveReflection({ re: branch.resistance, im: 0 }, branch.transformerZ0);
      expectComplex(own, -start.re, -start.im);
    }
  });

  it('interpolates positive references geometrically and clamps to their exact endpoints', () => {
    expect(interpolateReference(150, 600, -1)).toBe(150);
    expect(interpolateReference(150, 600, 0)).toBe(150);
    expect(interpolateReference(150, 600, 0.5)).toBeCloseTo(300, 11);
    expect(interpolateReference(150, 600, 1)).toBe(600);
    expect(interpolateReference(150, 600, 2)).toBe(600);
    for (const progress of [0, 0.1, 0.5, 0.9, 1]) {
      const reference = interpolateReference(Number.MIN_VALUE, Number.MAX_VALUE, progress);
      expect(Number.isFinite(reference)).toBe(true);
      expect(reference).toBeGreaterThan(0);
    }
  });

  it('draws partial and complete SWR circles without changing their radius', () => {
    const radius = Math.sqrt(0.2);
    for (const progress of [0, 0.25, 0.75, 1]) {
      const points = quarterWaveCircle(radius, progress);
      expectComplex(points[0], radius, 0);
      for (const point of points) {
        expect(Number.isFinite(point.re)).toBe(true);
        expect(Number.isFinite(point.im)).toBe(true);
        expect(Math.hypot(point.re, point.im)).toBeCloseTo(radius, 12);
      }
      expectComplex(points.at(-1)!, radius * Math.cos(2 * Math.PI * progress), radius * Math.sin(2 * Math.PI * progress));
    }
  });

  it('keeps scaled physical reflections finite for very large impedances and references', () => {
    expectComplex(quarterWaveReflection({ re: 1e300, im: 0 }, 1e300), 0, 0);
    expectComplex(quarterWaveReflection({ re: 1e300, im: 1e300 }, 1e300), 0.2, 0.4);
    const point = quarterWaveReflection({ re: Number.MAX_VALUE, im: Number.MAX_VALUE }, 50);
    expect(Number.isFinite(point.re)).toBe(true);
    expect(Number.isFinite(point.im)).toBe(true);
    expect(Math.hypot(point.re, point.im)).toBeLessThanOrEqual(1 + 8 * Number.EPSILON);
  });

  it.each([0, -50, NaN, Infinity])('rejects an invalid chart reference: %s', (reference) => {
    expect(() => quarterWaveReflection({ re: 50, im: 0 }, reference)).toThrow(RangeError);
  });
});
