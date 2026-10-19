import { describe, expect, it } from 'vitest';
import { impedanceToReflection } from '../domain/transmission';
import { solveSeriesStub } from '../domain/seriesStub';
import { constantReactancePath, rotateTowardGenerator, seriesCancellationPath, seriesStubPath, seriesStubPoint } from './seriesStubGeometry';

describe('series-stub impedance construction geometry', () => {
  it.each([25, 50, 75, 200])('keeps every %s-ohm stub on the main-reference boundary and reaches its solved reactance', (stubZ0) => {
    const solution = solveSeriesStub({ z0: 50, stubZ0, load: { kind: 'impedance', resistance: 100, reactance: 50 } });
    for (const branch of solution.branches) {
      const expected = impedanceToReflection({ re: 0, im: branch.requiredReactance });
      for (const termination of ['short', 'open'] as const) {
        const length = termination === 'short' ? branch.shortLength : branch.openLength;
        const trace = seriesStubPath(50, stubZ0, length, termination);
        expect(trace[0].re).toBe(termination === 'short' ? -1 : 1);
        expect(trace[0].im).toBe(0);
        for (const point of trace) {
          expect(Number.isFinite(point.re) && Number.isFinite(point.im)).toBe(true);
          expect(Math.hypot(point.re, point.im)).toBeCloseTo(1, 13);
        }
        expect(trace.at(-1)!.re).toBeCloseTo(expected.re, 12);
        expect(trace.at(-1)!.im).toBeCloseTo(expected.im, 12);
      }
    }
  });

  it('crosses exact stub poles without an infinite chart coordinate', () => {
    for (const termination of ['short', 'open'] as const) {
      for (const length of [0, 0.125, 0.25, 0.375, 0.5]) {
        const point = seriesStubPoint(50, 75, length, termination);
        expect(Number.isFinite(point.re) && Number.isFinite(point.im)).toBe(true);
        expect(Math.hypot(point.re, point.im)).toBeCloseTo(1, 13);
      }
    }
    expect(seriesStubPoint(50, 75, 0.25, 'short').re).toBeCloseTo(1, 13);
    expect(seriesStubPoint(50, 75, 0.25, 'open').re).toBeCloseTo(-1, 13);
  });

  it('travels clockwise to the physical impedance intersection, then cancels on r=1', () => {
    const solution = solveSeriesStub({ z0: 50, stubZ0: 50, load: { kind: 'impedance', resistance: 100, reactance: 50 } });
    for (const branch of solution.branches) {
      const reached = rotateTowardGenerator(solution.loadReflection, branch.distance);
      expect(reached.re).toBeCloseTo(branch.reflection.re, 13);
      expect(reached.im).toBeCloseTo(branch.reflection.im, 13);
      const path = seriesCancellationPath(branch.lineImpedance.im, 1);
      expect(path[0].re).toBeCloseTo(branch.reflection.re, 13);
      expect(path[0].im).toBeCloseTo(branch.reflection.im, 13);
      expect(path.at(-1)).toEqual({ re: 0, im: 0 });
      for (const point of path) expect(Math.hypot(point.re - 0.5, point.im)).toBeCloseTo(0.5, 13);
      expect(constantReactancePath(branch.requiredReactance)[0]).toEqual(impedanceToReflection({ re: 0, im: branch.requiredReactance }));
    }
  });
});
