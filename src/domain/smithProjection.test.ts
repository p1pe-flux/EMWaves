import { describe, expect, it } from 'vitest';
import { impedanceToReflection, reflectionToImpedance, type ComplexValue } from './transmission';
import { DEFAULT_PROJECTION_BOUNDS, projectImpedance, projectionGrid } from './smithProjection';

function expectPoint(actual: ComplexValue | null, expected: ComplexValue, precision = 11): void {
  expect(actual).not.toBeNull();
  expect(actual!.re).toBeCloseTo(expected.re, precision);
  expect(actual!.im).toBeCloseTo(expected.im, precision);
}

describe('impedance-plane to Smith-chart projection', () => {
  it('starts at the Cartesian impedance plane, including negative resistance', () => {
    for (const point of [{ re: 2, im: 1 }, { re: -2, im: -3 }, { re: 0, im: 0 }]) {
      expect(projectImpedance(point, 0)).toEqual(point);
    }
  });

  it('ends at the existing physical model for passive loads', () => {
    for (const resistance of [0, 0.2, 1, 2, 5, 100]) {
      for (const reactance of [-10, -1, 0, 0.5, 3]) {
        const z = { re: resistance, im: reactance };
        expectPoint(projectImpedance(z, 1), impedanceToReflection(z));
      }
    }
    expectPoint(projectImpedance({ re: -2, im: 0 }, 1), { re: 3, im: 0 });
    expect(projectImpedance({ re: -1, im: 0 }, 1)).toBeNull();
  });

  it('uses a Möbius deformation rather than interpolating endpoint coordinates', () => {
    const a = Math.SQRT2 - 1;
    expectPoint(projectImpedance({ re: 0, im: 0 }, 0.5), { re: -a, im: 0 });
    expectPoint(projectImpedance({ re: 1, im: 0 }, 0.5), { re: a, im: 0 });
    for (const progress of [0, 0.13, 0.5, 0.91, 1]) {
      expectPoint(projectImpedance({ re: 0, im: 1 }, progress), { re: 0, im: 1 });
      expectPoint(projectImpedance({ re: 0, im: -1 }, progress), { re: 0, im: -1 });
    }
  });

  it('composes by adding the projection angle', () => {
    for (const z of [{ re: 2, im: 1 }, { re: -0.4, im: 0.8 }, { re: 0, im: -2 }]) {
      for (const [first, second] of [[0.2, 0.3], [0.4, 0.6], [0.07, 0.19]]) {
        expectPoint(projectImpedance(projectImpedance(z, first)!, second), projectImpedance(z, first + second)!);
      }
    }
  });

  it('separates passive and active regions throughout the deformation', () => {
    for (const progress of [0.2, 0.5, 0.8, 1]) {
      const a = Math.tan(Math.PI * progress / 4);
      const center = (1 - a * a) / (2 * a);
      const radius = (1 + a * a) / (2 * a);
      for (const reactance of [-2, -0.2, 0, 0.2, 2]) {
        const boundary = projectImpedance({ re: 0, im: reactance }, progress)!;
        expect(Math.hypot(boundary.re - center, boundary.im)).toBeCloseTo(radius, 11);
        const passive = projectImpedance({ re: 0.4, im: reactance }, progress)!;
        expect(Math.hypot(passive.re - center, passive.im)).toBeLessThan(radius);
        const active = projectImpedance({ re: -0.4, im: reactance }, progress)!;
        expect(Math.hypot(active.re - center, active.im)).toBeGreaterThan(radius);
      }
    }
  });

  it('handles poles and extreme finite values without emitting nonfinite coordinates', () => {
    for (const progress of [0.125, 0.5, 1]) {
      const a = progress === 1 ? 1 : Math.tan(Math.PI * progress / 4);
      expect(projectImpedance({ re: -1 / a, im: 0 }, progress)).toBeNull();
      for (const point of [
        { re: -1 / a, im: 1e-100 },
        { re: Number.MAX_VALUE, im: Number.MAX_VALUE },
        { re: -Number.MAX_VALUE, im: -Number.MAX_VALUE },
        { re: Number.MIN_VALUE, im: -Number.MIN_VALUE },
      ]) {
        const projected = projectImpedance(point, progress);
        if (projected !== null) {
          expect(Number.isFinite(projected.re)).toBe(true);
          expect(Number.isFinite(projected.im)).toBe(true);
        }
      }
    }
    const huge = projectImpedance({ re: 1e300, im: 1e300 }, 1)!;
    expect(huge.re).toBeCloseTo(1, 12);
    expect(huge.im / 1e-300).toBeCloseTo(1, 12);
  });

  it('rejects invalid progress and nonfinite source values', () => {
    for (const progress of [-0.1, 1.1, Infinity, NaN]) {
      expect(() => projectImpedance({ re: 1, im: 0 }, progress)).toThrow(RangeError);
    }
    for (const z of [{ re: NaN, im: 0 }, { re: 1, im: Infinity }]) {
      expect(() => projectImpedance(z, 0.5)).toThrow(RangeError);
    }
  });
});

describe('projected impedance grid', () => {
  it('begins with constant Cartesian coordinates and separately colored half planes', () => {
    for (const curve of projectionGrid(0)) {
      for (const path of curve.paths) {
        for (const point of path) {
          if (curve.kind === 'resistance') expect(point.re).toBeCloseTo(curve.value, 12);
          else {
            expect(point.im).toBeCloseTo(curve.value, 12);
            if (curve.region === 'passive') expect(point.re).toBeGreaterThanOrEqual(0);
            else expect(point.re).toBeLessThanOrEqual(0);
          }
        }
      }
    }
  });

  it('ends with a complete unit-circle boundary and circles closed at the common open point', () => {
    const grid = projectionGrid(1);
    const boundary = grid.find((curve) => curve.kind === 'resistance' && curve.value === 0)!;
    expect(boundary.region).toBe('boundary');
    expect(boundary.paths).toHaveLength(1);
    const path = boundary.paths[0];
    expect(path[0]).toEqual({ re: 1, im: 0 });
    expect(path.at(-1)).toEqual(path[0]);
    expect(path.some((point) => point.re < -0.999)).toBe(true);
    expect(path.some((point) => point.im > 0.999)).toBe(true);
    expect(path.some((point) => point.im < -0.999)).toBe(true);
    for (const point of path) expect(Math.hypot(point.re, point.im)).toBeCloseTo(1, 12);
    for (const curve of grid.filter((item) => item.kind === 'resistance' && item.region === 'passive')) {
      expect(curve.paths).toHaveLength(1);
      expect(curve.paths[0][0]).toEqual({ re: 1, im: 0 });
      expect(curve.paths[0].at(-1)).toEqual({ re: 1, im: 0 });
    }
  });

  it('preserves the represented impedance on final passive grid curves', () => {
    for (const curve of projectionGrid(1).filter((item) => item.region !== 'active')) {
      for (const path of curve.paths) {
        for (const point of path) {
          const z = reflectionToImpedance(point);
          if (z !== null) {
            expect(curve.kind === 'resistance' ? z.re : z.im).toBeCloseTo(curve.value, 7);
          }
        }
      }
    }
  });

  it('splits pole-crossing real lines rather than drawing through the passive disk', () => {
    const grid = projectionGrid(1, { resistanceValues: [-1], reactanceValues: [0] });
    const realActive = grid.find((curve) => curve.kind === 'reactance' && curve.region === 'active')!;
    expect(realActive.paths).toHaveLength(2);
    for (const path of realActive.paths) {
      const side = Math.sign(path[0].re);
      for (const point of path) {
        expect(point.im).toBe(0);
        expect(Math.abs(point.re)).toBeGreaterThanOrEqual(1 - 1e-12);
        expect(Math.sign(point.re)).toBe(side);
      }
    }
    const vertical = grid.find((curve) => curve.kind === 'resistance')!;
    for (const path of vertical.paths) {
      const side = Math.sign(path.find((point) => point.im !== 0)!.im);
      for (const point of path) {
        expect(point.re).toBeCloseTo(1, 11);
        expect(point.im === 0 || Math.sign(point.im) === side).toBe(true);
      }
    }
  });

  it('keeps dense paths finite and inside their viewport throughout the animation', () => {
    const bounds = { minRe: -1.45, maxRe: 1.45, minIm: -1.18, maxIm: 1.18 };
    for (const progress of [0, 1e-12, 0.01, 0.2, 0.49999, 0.8, 0.99999, 1]) {
      const grid = projectionGrid(progress, { bounds });
      let count = 0;
      expect(grid.some((curve) => curve.region === 'active' && curve.paths.length > 0)).toBe(true);
      expect(grid.some((curve) => curve.region === 'passive' && curve.paths.length > 0)).toBe(true);
      for (const curve of grid) for (const path of curve.paths) {
        expect(path.length).toBeGreaterThan(1);
        count += path.length;
        for (const point of path) {
          expect(Number.isFinite(point.re)).toBe(true);
          expect(Number.isFinite(point.im)).toBe(true);
          expect(point.re).toBeGreaterThanOrEqual(bounds.minRe);
          expect(point.re).toBeLessThanOrEqual(bounds.maxRe);
          expect(point.im).toBeGreaterThanOrEqual(bounds.minIm);
          expect(point.im).toBeLessThanOrEqual(bounds.maxIm);
        }
      }
      expect(count).toBeLessThan(15000);
    }
  });

  it('validates viewport, density, and source line values', () => {
    expect(() => projectionGrid(0.5, { bounds: { ...DEFAULT_PROJECTION_BOUNDS, maxRe: -3 } })).toThrow(RangeError);
    expect(() => projectionGrid(0.5, { segments: 0 })).toThrow(RangeError);
    expect(() => projectionGrid(0.5, { segments: 16.5 })).toThrow(RangeError);
    expect(() => projectionGrid(0.5, { resistanceValues: [Infinity] })).toThrow(RangeError);
  });
});
