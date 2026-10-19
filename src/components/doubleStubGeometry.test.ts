import { describe, expect, it } from 'vitest';
import { solveDoubleStub } from '../domain/doubleStub';
import type { Load } from '../domain/transmission';
import { chartPoint, rotateTowardGenerator } from './singleStubConstructionGeometry';
import { doubleStubAdditionPath, doubleStubChartPoint, doubleStubCirclePath, doubleStubIsolatedPoint, doubleStubLoadPath, doubleStubPropagationPath, doubleStubSusceptance, conductanceCircle, transportedUnityCircle, transportedUnityCenterPath } from './doubleStubGeometry';

const input = { z0: 50, stub1Z0: 50, stub2Z0: 50, distance: 0.125, separation: 0.125, load: { kind: 'impedance' as const, resistance: 100, reactance: 50 } };
describe('backward double-stub chart geometry', () => {
  it('moves the entire circle counterclockwise, including its center', () => {
    expect(transportedUnityCircle(0.125, 0)).toEqual({ center: { re: 0.5, im: 0 }, radius: 0.5 });
    const middle = transportedUnityCircle(0.125, 0.5), final = transportedUnityCircle(0.125);
    expect(middle.center.re).toBeCloseTo(Math.SQRT1_2 / 2, 12);
    expect(middle.center.im).toBeCloseTo(Math.SQRT1_2 / 2, 12);
    expect(final.center.re).toBeCloseTo(0, 12);
    expect(final.center.im).toBeCloseTo(0.5, 12);
    expect(final.radius).toBe(0.5);
    for (const point of doubleStubCirclePath(final.center, final.radius)) expect(Math.hypot(point.re - final.center.re, point.im - final.center.im)).toBeCloseTo(0.5, 12);
  });
  it('shares the final transport locus with the numerical solver', () => {
    const solution = solveDoubleStub(input), locus = transportedUnityCircle(input.separation);
    expect(locus.center.re).toBeCloseTo(solution.locus.center.re, 12);
    expect(locus.center.im).toBeCloseTo(solution.locus.center.im, 12);
    expect(locus.radius).toBe(solution.locus.radius);
  });
  it.each([40, 40.125, 1e308, Number.MAX_VALUE])('keeps a nondegenerate center trail for %s wavelengths', (separation) => {
    for (const progress of [0.25, 0.6, 1]) {
      const path = transportedUnityCenterPath(separation, progress);
      expect(path).toHaveLength(81);
      expect(Math.max(...path.map(point => Math.hypot(point.re - path[0].re, point.im - path[0].im)))).toBeGreaterThan(0.99);
      for (const point of path) expect(Math.hypot(point.re, point.im)).toBeCloseTo(0.5, 14);
      const endpoint = transportedUnityCircle(separation, progress).center;
      expect(path.at(-1)!.re).toBe(endpoint.re);
      expect(path.at(-1)!.im).toBe(endpoint.im);
    }
  });
  it.each([0, Number.MIN_VALUE, 1e-300, 1e-17, 0.125, 0.5])('preserves tiny transport endpoints and counterclockwise direction at %s wavelengths', (separation) => {
    for (const progress of [0, 0.5, 1]) {
      const path = transportedUnityCenterPath(separation, progress);
      expect(path[0]).toEqual({ re: 0.5, im: 0 });
      const endpoint = transportedUnityCircle(separation, progress).center;
      expect(path.at(-1)!.re).toBe(endpoint.re);
      expect(path.at(-1)!.im).toBe(endpoint.im);
    }
    const path = transportedUnityCenterPath(0.125);
    expect(path[1].re * path[0].im - path[1].im * path[0].re).toBeLessThan(0);
  });
  it('keeps huge finite periodic spacings finite without overflowing the rotation angle', () => {
    const locus = transportedUnityCircle(1e308, 0.5);
    expect(Number.isFinite(locus.center.re) && Number.isFinite(locus.center.im)).toBe(true);
    const points = doubleStubPropagationPath({ re: 1, im: 1 }, 1e308);
    expect(points.every((p) => Number.isFinite(p.re) && Number.isFinite(p.im))).toBe(true);
  });
  it('puts the right-side load and both candidates on their conductance circle', () => {
    const solution = solveDoubleStub(input), circle = conductanceCircle(solution.rightAdmittance!.re);
    for (const y of [solution.rightAdmittance!, ...solution.branches.map((b) => b.rightAfter)]) {
      const p = doubleStubChartPoint(y);
      expect(Math.hypot(p.re - circle.center.re, p.im - circle.center.im)).toBeCloseTo(circle.radius, 11);
    }
  });
  it('adds Stub 2, propagates clockwise, and cancels Stub 1 for every branch', () => {
    const solution = solveDoubleStub(input);
    for (const branch of solution.branches) {
      const add2 = doubleStubAdditionPath(solution.rightAdmittance!, branch.stub2.susceptance);
      const right = doubleStubChartPoint(branch.rightAfter);
      expect(add2.at(-1)!.re).toBeCloseTo(right.re, 11); expect(add2.at(-1)!.im).toBeCloseTo(right.im, 11);
      const propagate = doubleStubPropagationPath(branch.rightAfter, input.separation), left = doubleStubChartPoint(branch.leftBefore);
      expect(propagate.at(-1)!.re).toBeCloseTo(left.re, 11); expect(propagate.at(-1)!.im).toBeCloseTo(left.im, 11);
      const cancelled = doubleStubAdditionPath(branch.leftBefore, branch.stub1.susceptance).at(-1)!;
      expect(cancelled.re).toBeCloseTo(0, 11); expect(cancelled.im).toBeCloseTo(0, 11);
      expect(propagate[1].re * propagate[0].im - propagate[1].im * propagate[0].re).toBeGreaterThan(0);
    }
  });
  it('uses opposite reading coordinates and explicit isolated-stub poles', () => {
    const load = doubleStubChartPoint({ re: 0.4, im: -0.2 });
    expect(load.re).toBeCloseTo(-0.4, 12); expect(load.im).toBeCloseTo(-0.2, 12);
    expect(doubleStubIsolatedPoint(50, 50, 0, 'short')).toEqual({ re: 1, im: 0 });
    expect(doubleStubIsolatedPoint(50, 50, 0, 'open')).toEqual({ re: -1, im: 0 });
    const short = doubleStubIsolatedPoint(50, 50, 0.125, 'short');
    expect(short.re).toBeCloseTo(0, 12); expect(short.im).toBeCloseTo(-1, 12);
    const unequal = doubleStubIsolatedPoint(50, 100, 0.125, 'short');
    expect(unequal.re).toBeCloseTo(-0.6, 12); expect(unequal.im).toBeCloseTo(-0.8, 12);
    expect(Number.isFinite(doubleStubSusceptance(50, 50, 1e-17, 'short'))).toBe(true);
    expect(doubleStubSusceptance(50, 50, 0.25, 'open')).toBe(Infinity);
  });
});

describe('load-to-Stub-2 admittance path', () => {
  it.each([40, 40.125, 1_000_000.375])('draws a full nondegenerate trail ending at the physical plane for %s wavelengths', (distance) => {
    const reflection = { re: 0.4, im: 0.2 };
    for (const progress of [0.25, 0.6, 1]) {
      const path = doubleStubLoadPath(reflection, distance, progress);
      const radius = Math.hypot(reflection.re, reflection.im);
      expect(path).toHaveLength(81);
      expect(Math.max(...path.map((point) => Math.hypot(point.re - path[0].re, point.im - path[0].im)))).toBeGreaterThan(radius * 1.9);
      const endpoint = rotateTowardGenerator(chartPoint(reflection, true), (distance * progress) % 0.5);
      expect(path.at(-1)!.re).toBeCloseTo(endpoint.re, 12);
      expect(path.at(-1)!.im).toBeCloseTo(endpoint.im, 12);
      const between = doubleStubPropagationPath({ re: 1, im: 1 }, distance, progress);
      expect(Math.max(...between.map((point) => Math.hypot(point.re - between[0].re, point.im - between[0].im)))).toBeGreaterThan(0.8);
    }
  });
  it('starts at the diametric load reading and follows the current transformed load at every progress', () => {
    const loadReflection = solveDoubleStub(input).loadReflection;
    const start = chartPoint(loadReflection, true);
    for (const distance of [0.031, 0.125, 0.25, 0.5]) {
      for (const progress of [0, 0.25, 0.5, 1]) {
        const path = doubleStubLoadPath(loadReflection, distance, progress);
        expect(path[0]).toEqual(start);
        const expected = doubleStubChartPoint(solveDoubleStub({ ...input, distance: distance * progress }).rightAdmittance);
        expect(path.at(-1)!.re).toBeCloseTo(expected.re, 12);
        expect(path.at(-1)!.im).toBeCloseTo(expected.im, 12);
      }
    }
  });

  it('keeps the SWR magnitude fixed and travels clockwise toward the generator', () => {
    const reflection = solveDoubleStub(input).loadReflection;
    const path = doubleStubLoadPath(reflection, 0.375);
    const radius = Math.hypot(reflection.re, reflection.im);
    for (let i = 0; i < path.length; i += 1) {
      expect(Math.hypot(path[i].re, path[i].im)).toBeCloseTo(radius, 12);
      if (i > 0) expect(path[i].re * path[i - 1].im - path[i].im * path[i - 1].re).toBeGreaterThan(0);
    }
  });

  it('preserves zero length and has the expected quarter- and half-wave endpoints', () => {
    const reflection = { re: 0.4, im: 0.2 };
    const start = { re: -0.4, im: -0.2 };
    for (const point of doubleStubLoadPath(reflection, 0)) expect(point).toEqual(start);
    const quarter = doubleStubLoadPath(reflection, 0.25).at(-1)!;
    expect(quarter.re).toBeCloseTo(reflection.re, 12);
    expect(quarter.im).toBeCloseTo(reflection.im, 12);
    const half = doubleStubLoadPath(reflection, 0.5).at(-1)!;
    expect(half).toEqual(start);
    for (const point of doubleStubLoadPath({ re: 0, im: 0 }, 0.37)) expect(point).toEqual({ re: 0, im: 0 });
  });

  it.each<Load>([
    { kind: 'open' }, { kind: 'short' },
    { kind: 'impedance', resistance: 0, reactance: 50 },
    { kind: 'impedance', resistance: 0, reactance: -50 },
  ])('keeps ideal load endpoints finite and agrees with the transformed admittance: %j', (load) => {
    const reflection = solveDoubleStub({ ...input, load }).loadReflection;
    for (const distance of [0, 0.125, 0.25, 0.5]) {
      const path = doubleStubLoadPath(reflection, distance);
      const expected = doubleStubChartPoint(solveDoubleStub({ ...input, load, distance }).rightAdmittance);
      for (const point of path) {
        expect(Number.isFinite(point.re) && Number.isFinite(point.im)).toBe(true);
        expect(Math.hypot(point.re, point.im)).toBeCloseTo(1, 12);
      }
      expect(path.at(-1)!.re).toBeCloseTo(expected.re, 12);
      expect(path.at(-1)!.im).toBeCloseTo(expected.im, 12);
    }
  });

  it('bounds progress and reduces huge finite distances before forming a rotation angle', () => {
    const reflection = { re: 0.4, im: 0.2 };
    expect(doubleStubLoadPath(reflection, 0.125, 2)).toEqual(doubleStubLoadPath(reflection, 0.125));
    expect(doubleStubLoadPath(reflection, 0.125, -1)).toEqual(doubleStubLoadPath(reflection, 0));
    for (const distance of [1e308, Number.MAX_VALUE]) {
      for (const progress of [0, 0.5, 1]) {
        const path = doubleStubLoadPath(reflection, distance, progress);
        expect(path.every((point) => Number.isFinite(point.re) && Number.isFinite(point.im))).toBe(true);
        for (const point of path) expect(Math.hypot(point.re, point.im)).toBeCloseTo(Math.hypot(0.4, 0.2), 12);
      }
    }
  });
});
