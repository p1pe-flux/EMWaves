import { describe, expect, it } from 'vitest';
import { impedanceToReflection, reflectionToImpedance } from '../domain/transmission';
import { evaluateSingleStub, solveSingleStub } from '../domain/singleStub';
import { admittanceReflection, cancellationPath, chartCancellationPath, chartPoint, constantSusceptancePath, easeProgress, reflectThroughCenter, reflectionAdmittance, rotateTowardGenerator, rotationPath } from './singleStubConstructionGeometry';

describe('single-stub chart construction', () => {
  it('reflects the reading through the center on the unchanged standard grid', () => {
    const gamma = { re: 0.4, im: 0.2 };
    expect(reflectThroughCenter(gamma, 0)).toEqual(gamma);
    expect(reflectThroughCenter(gamma, 0.5)).toEqual({ re: 0, im: 0 });
    expect(reflectThroughCenter(gamma, 1)).toEqual({ re: -0.4, im: -0.2 });
    expect(chartPoint(gamma, true)).toEqual(reflectThroughCenter(gamma, 1));
    const y = admittanceReflection({ re: 0.4, im: -0.2 });
    expect(chartPoint(y, true).re).toBeCloseTo(-0.4, 12);
    expect(chartPoint(y, true).im).toBeCloseTo(-0.2, 12);
  });

  it('cancels susceptance on the right-hand unity circle of the standard grid', () => {
    for (const point of chartCancellationPath(1, 1)) {
      expect(Math.hypot(point.re - 0.5, point.im)).toBeCloseTo(0.5, 12);
    }
    expect(chartCancellationPath(1, 1).at(-1)).toEqual({ re: 0, im: 0 });
    const start = chartCancellationPath(1, 0)[0];
    expect(start.re).toBeCloseTo(0.2, 12);
    expect(start.im).toBeCloseTo(0.4, 12);
  });

  it('reads both admittance intersections without adding a quarter wavelength', () => {
    const load = { re: 0.4, im: 0.2 };
    for (const [distance, expectedImaginary] of [[0.19879180882521663, 0.4], [0.375, -0.4]]) {
      const point = rotateTowardGenerator(chartPoint(load, true), distance);
      expect(point.re).toBeCloseTo(0.2, 12);
      expect(point.im).toBeCloseTo(expectedImaginary, 12);
      const reading = reflectionToImpedance(point)!;
      expect(reading.re).toBeCloseTo(1, 12);
      expect(reading.im).toBeCloseTo(Math.sign(expectedImaginary), 12);
    }
  });

  it('uses the stub reference for both printed-chart termination constructions', () => {
    const input = { z0: 50, stubZ0: 75, load: { kind: 'impedance' as const, resistance: 100, reactance: 50 } };
    const branch = solveSingleStub(input).branches[0];
    for (const termination of ['open', 'short'] as const) {
      const endpoint = { re: termination === 'open' ? -1 : 1, im: 0 };
      const length = termination === 'open' ? branch.openLength : branch.shortLength;
      const point = rotateTowardGenerator(endpoint, length);
      const reading = reflectionToImpedance(point)!;
      expect(reading.re).toBeCloseTo(0, 12);
      expect(reading.im).toBeCloseTo(branch.requiredSusceptance * input.stubZ0 / input.z0, 12);
    }
    const pole = evaluateSingleStub({ ...input, distance: 0.1, termination: 'short', stubLength: 0 });
    expect(pole.reflection).toEqual({ re: -1, im: 0 });
    expect(chartPoint(pole.reflection, true)).toEqual({ re: 1, im: 0 });
  });

  it('eases the animation continuously without changing its geometric endpoints', () => {
    expect(easeProgress(0)).toBe(0);
    expect(easeProgress(0.5)).toBe(0.5);
    expect(easeProgress(1)).toBe(1);
    expect(easeProgress(0.01)).toBeLessThan(0.01);
    expect(easeProgress(0.99)).toBeGreaterThan(0.99);
  });
  it('preserves physical Γ when converting the example from impedance to admittance', () => {
    const gamma = admittanceReflection({ re: 0.4, im: -0.2 });
    expect(gamma.re).toBeCloseTo(0.4, 12);
    expect(gamma.im).toBeCloseTo(0.2, 12);
    expect(reflectionAdmittance(gamma)?.re).toBeCloseTo(0.4, 12);
    expect(reflectionAdmittance(gamma)?.im).toBeCloseTo(-0.2, 12);
  });

  it('moves clockwise toward the generator on the complete SWR circle', () => {
    const gamma = { re: 0.4, im: 0.2 };
    const point = rotateTowardGenerator(gamma, 0.125);
    expect(point.re).toBeCloseTo(0.2, 12);
    expect(point.im).toBeCloseTo(-0.4, 12);
    for (const sample of rotationPath(gamma, 0.375)) {
      expect(Math.hypot(sample.re, sample.im)).toBeCloseTo(Math.hypot(0.4, 0.2), 12);
    }
  });

  it.each([1, -1, 4])('cancels b=%s along the mirrored g=1 circle to the match', (b) => {
    const path = cancellationPath(b, 1);
    for (const point of path) {
      expect(Math.hypot(point.re + 0.5, point.im)).toBeCloseTo(0.5, 12);
      expect(reflectionAdmittance(point)?.re).toBeCloseTo(1, 12);
    }
    expect(path.at(-1)).toEqual({ re: 0, im: 0 });
  });

  it('leaves an infinite admittance explicit at the shorted chart endpoint', () => {
    expect(reflectionAdmittance({ re: -1, im: 0 })).toBeNull();
  });
});

describe('constant-susceptance construction arcs', () => {
  it.each([-3.5, -1, -0.2, 0.2, 1, 3.5])('reads b=%s at every finite point from the stub boundary through g=1', (b) => {
    const path = constantSusceptancePath(b);
    expect(path[0]).toEqual(impedanceToReflection({ re: 0, im: b }));
    expect(path).toContainEqual(impedanceToReflection({ re: 1, im: b }));
    expect(path.at(-1)).toEqual({ re: 1, im: 0 });
    expect(Math.hypot(path[0].re, path[0].im)).toBeCloseTo(1, 12);
    let previousConductance = 0;
    for (const point of path) {
      const reading = reflectionToImpedance(point);
      if (reading === null) continue; // The g → ∞ asymptote has no finite reading.
      expect(reading.im).toBeCloseTo(b, 9);
      expect(reading.re).toBeGreaterThanOrEqual(previousConductance - 1e-9);
      previousConductance = reading.re;
    }
  });

  it('draws b=0 as the complete real diameter and includes the matched point', () => {
    const path = constantSusceptancePath(0);
    expect(path[0]).toEqual({ re: -1, im: 0 });
    expect(path).toContainEqual({ re: 0, im: 0 });
    expect(path.at(-1)).toEqual({ re: 1, im: 0 });
    for (let index = 0; index < path.length; index += 1) {
      expect(path[index].im).toBe(0);
      if (index > 0) expect(path[index].re).toBeGreaterThanOrEqual(path[index - 1].re);
    }
  });

  it('connects the line point to its constant-b arc and the cancelling stub to the opposite arc', () => {
    const positive = constantSusceptancePath(1);
    const negative = constantSusceptancePath(-1);
    expect(positive).toContainEqual(impedanceToReflection({ re: 1, im: 1 }));
    expect(negative).toContainEqual(impedanceToReflection({ re: 1, im: -1 }));
    expect(positive[0]).toEqual({ re: 0, im: 1 });
    expect(negative[0]).toEqual({ re: 0, im: -1 });
    expect(positive.length).toBe(negative.length);
    for (let index = 0; index < positive.length; index += 1) {
      expect(negative[index].re).toBeCloseTo(positive[index].re, 12);
      expect(negative[index].im).toBeCloseTo(-positive[index].im, 12);
    }
  });

  it('uses main-line normalization for the stub target even when its own impedance differs', () => {
    const input = { z0: 50, stubZ0: 75, load: { kind: 'impedance' as const, resistance: 100, reactance: 50 } };
    const branch = solveSingleStub(input).branches[0];
    const target = constantSusceptancePath(branch.requiredSusceptance)[0];
    for (const termination of ['open', 'short'] as const) {
      const stubLength = termination === 'open' ? branch.openLength : branch.shortLength;
      const evaluation = evaluateSingleStub({ ...input, termination, distance: branch.distance, stubLength });
      const actual = impedanceToReflection({ re: 0, im: evaluation.stubSusceptance });
      expect(actual.re).toBeCloseTo(target.re, 12);
      expect(actual.im).toBeCloseTo(target.im, 12);
      expect(reflectionToImpedance(target)!.im).toBeCloseTo(-1, 12);
    }
  });

  it.each([Number.MIN_VALUE, -Number.MIN_VALUE, 1e-300, -1e-300, 1e300, -1e300, Number.MAX_VALUE, -Number.MAX_VALUE])('keeps b=%s finite without overflow', (b) => {
    const path = constantSusceptancePath(b);
    expect(path).toContainEqual(impedanceToReflection({ re: 1, im: b }));
    for (const point of path) {
      expect(Number.isFinite(point.re)).toBe(true);
      expect(Number.isFinite(point.im)).toBe(true);
      expect(Math.hypot(point.re, point.im)).toBeLessThanOrEqual(1 + 8 * Number.EPSILON);
    }
  });

  it.each([NaN, Infinity, -Infinity])('rejects a nonfinite constant susceptance: %s', (b) => {
    expect(() => constantSusceptancePath(b)).toThrow(RangeError);
  });
});
