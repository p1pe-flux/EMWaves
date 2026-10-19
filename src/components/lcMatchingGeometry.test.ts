import { describe, expect, it } from 'vitest';
import { evaluateLCMatching, solveLCMatching, type LCMatchingInput } from '../domain/lcMatching';
import { lcConstantRealLocus, lcGridFocus, lcMatchingReadings, lcReadingValue, lcStagePath, type LCReading } from './lcMatchingGeometry';

const example: LCMatchingInput = { z0: 50, frequencyHz: 1e9, load: { kind: 'impedance', resistance: 100, reactance: 50 }, order: 'LC', inductorConnection: 'series', capacitorConnection: 'parallel' };
const mixedExamples: LCMatchingInput[] = [
  example,
  { ...example, order: 'CL', inductorConnection: 'parallel', capacitorConnection: 'series' },
  { ...example, order: 'CL', load: { kind: 'impedance', resistance: 25, reactance: 10 } },
  { ...example, inductorConnection: 'parallel', capacitorConnection: 'series', load: { kind: 'impedance', resistance: 25, reactance: 10 } },
];

describe('L–C construction geometry on the combined Z/Y chart', () => {
  it('places resistance circles on the right and conductance circles on the left in physical Γ', () => {
    expect(lcConstantRealLocus(1, 'impedance')).toEqual({ center: { re: 0.5, im: 0 }, radius: 0.5 });
    expect(lcConstantRealLocus(1, 'admittance')).toEqual({ center: { re: -0.5, im: 0 }, radius: 0.5 });
  });

  it.each(mixedExamples)('preserves physical paths and the correct two loci for $order, L $inductorConnection / C $capacitorConnection', input => {
    const result = solveLCMatching(input);
    const [first, second] = result.branches[0].stages;
    const firstReading: LCReading = first.connection === 'series' ? 'impedance' : 'admittance';
    const secondReading: LCReading = second.connection === 'series' ? 'impedance' : 'admittance';
    const path = lcStagePath(result.normalizedLoad, first.connection, first.normalizedValue);
    expect(path[0].re).toBeCloseTo(result.loadReflection.re, 13);
    expect(path[0].im).toBeCloseTo(result.loadReflection.im, 13);
    expect(path.at(-1)!.re).toBeCloseTo(first.reflection.re, 13);
    expect(path.at(-1)!.im).toBeCloseTo(first.reflection.im, 13);
    const load = lcReadingValue(result.normalizedLoad, firstReading)!;
    const locus = lcConstantRealLocus(load.re, firstReading);
    for (const point of path) {
      expect(Math.hypot(point.re - locus.center.re, point.im - locus.center.im)).toBeCloseTo(locus.radius, 12);
    }
    expect(Math.hypot(path[40].re, path[40].im)).not.toBeCloseTo(Math.hypot(path[0].re, path[0].im), 3);
    const unit = lcConstantRealLocus(1, secondReading);
    expect(Math.hypot(first.reflection.re - unit.center.re, first.reflection.im)).toBeCloseTo(0.5, 12);
    const secondPath = lcStagePath(first.impedance, second.connection, second.normalizedValue);
    for (const point of secondPath) expect(Math.hypot(point.re - unit.center.re, point.im)).toBeCloseTo(0.5, 12);
    const finish = secondPath.at(-1)!;
    expect(Math.hypot(finish.re, finish.im)).toBeLessThan(1e-14);
  });

  it.each((['series', 'parallel'] as const).flatMap(connection => (['LC', 'CL'] as const).map(order => ({ connection, order }))))('keeps both loci coincident for the $connection family in $order order', ({ connection, order }) => {
    const input: LCMatchingInput = { ...example, order, inductorConnection: connection, capacitorConnection: connection, load: connection === 'series' ? { kind: 'impedance', resistance: 50, reactance: 20 } : { kind: 'impedance', resistance: 25, reactance: 25 } };
    const result = solveLCMatching(input);
    expect(result.status).toBe('continuous');
    const { first, second } = lcMatchingReadings(input);
    expect(first).toBe(connection === 'series' ? 'impedance' : 'admittance');
    expect(second).toBe(first);
    const load = lcReadingValue(result.normalizedLoad, first)!;
    const locus = lcConstantRealLocus(load.re, first);
    const target = lcConstantRealLocus(1, second);
    expect(locus).toEqual(target);
    expect(locus.center.re).toBe(connection === 'series' ? 0.5 : -0.5);
    const q = 2;
    const omega = 2 * Math.PI * input.frequencyHz;
    const inductance = connection === 'series' ? q * input.z0 / omega : input.z0 / (omega * q);
    const capacitance = connection === 'series' ? 1 / (omega * input.z0 * (q + load.im)) : (q - load.im) / (omega * input.z0);
    const evaluated = evaluateLCMatching({ ...input, inductance, capacitance });
    expect(evaluated.reflectionMagnitude).toBeLessThan(1e-14);
    for (let index = 0; index < evaluated.stages.length; index += 1) {
      const stage = evaluated.stages[index];
      const start = index === 0 ? result.normalizedLoad : evaluated.stages[index - 1].impedance;
      for (const point of lcStagePath(start, stage.connection, stage.normalizedValue)) {
        expect(Math.hypot(point.re - locus.center.re, point.im)).toBeCloseTo(locus.radius, 12);
      }
    }
  });

  it('starts a series capacitor or parallel inductor at zero contribution, not zero component value', () => {
    const z = { re: 0.5, im: 0.2 };
    const capacitor = lcStagePath(z, 'series', -2, 0);
    const inductor = lcStagePath(z, 'parallel', -2, 0);
    expect(capacitor[0]).toEqual(capacitor.at(-1));
    expect(inductor[0]).toEqual(inductor.at(-1));
    expect(capacitor).toEqual(inductor);
    expect(lcStagePath(z, 'series', -2, 0.5).at(-1)).toEqual(lcStagePath(z, 'series', -1).at(-1));
  });

  it('changes grid emphasis smoothly and reversibly, independently of physical Γ', () => {
    expect(lcGridFocus('impedance')).toBe(0);
    expect(lcGridFocus('admittance')).toBe(1);
    expect(lcGridFocus('impedance', 'admittance', 0)).toBe(0);
    expect(lcGridFocus('impedance', 'admittance', 0.5)).toBe(0.5);
    expect(lcGridFocus('impedance', 'admittance', 1)).toBe(1);
    for (const progress of [0, 0.1, 0.2, 0.5, 0.8, 1]) {
      expect(lcGridFocus('impedance', 'admittance', progress)).toBeCloseTo(lcGridFocus('admittance', 'impedance', 1 - progress), 14);
      expect(lcGridFocus('impedance', 'admittance', progress) + lcGridFocus('admittance', 'impedance', progress)).toBeCloseTo(1, 14);
    }
    expect(lcGridFocus('admittance', 'impedance', -1)).toBe(1);
    expect(lcGridFocus('admittance', 'impedance', 2)).toBe(0);
    expect(lcReadingValue(null, 'admittance')).toEqual({ re: 0, im: 0 });
    expect(lcReadingValue({ re: 0, im: 0 }, 'admittance')).toBeNull();
  });
});
