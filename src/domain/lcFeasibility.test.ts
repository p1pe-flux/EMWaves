import { describe, expect, it } from 'vitest';
import { solveLCMatching, type LCMatchingTopology } from './lcMatching';
import {
  classifyLCFeasibility, classifyLCPhysicalLoadFeasibility, describeLCFeasibility,
  type LCFeasibilityClassification,
} from './lcFeasibility';

const topologies: LCMatchingTopology[] = (['LC', 'CL'] as const).flatMap(order =>
  (['series', 'parallel'] as const).flatMap(inductorConnection =>
    (['series', 'parallel'] as const).map(capacitorConnection => ({ order, inductorConnection, capacitorConnection }))));

const seriesLParallelC: LCMatchingTopology = { order: 'LC', inductorConnection: 'series', capacitorConnection: 'parallel' };
const parallelCSeriesL: LCMatchingTopology = { ...seriesLParallelC, order: 'CL' };
const parallelLSeriesC: LCMatchingTopology = { order: 'LC', inductorConnection: 'parallel', capacitorConnection: 'series' };
const seriesCParallelL: LCMatchingTopology = { ...parallelLSeriesC, order: 'CL' };

describe('LC feasible load regions', () => {
  it.each(topologies)('describes the selected physical generator-to-load topology: %j', topology => {
    const region = describeLCFeasibility(topology);
    expect(region.sourceComponent + region.loadComponent).toBe(topology.order);
    expect(region.sourceConnection).toBe(region.sourceComponent === 'L' ? topology.inductorConnection : topology.capacitorConnection);
    expect(region.loadConnection).toBe(region.loadComponent === 'L' ? topology.inductorConnection : topology.capacitorConnection);
    expect(region.kind).toBe(topology.inductorConnection === topology.capacitorConnection ? 'curve' : 'area');
    expect(region.formula).toContain('r');
    expect(region.formula).not.toContain('g');
    expect(region.boundaryFormula.length).toBeGreaterThan(0);
  });

  it.each(topologies)('agrees with independent synthesis over the passive load plane: %j', topology => {
    for (const r of [0.0625, 0.125, 0.25, 0.5, 0.75, 1, 1.25, 2, 4]) {
      for (const x of [-4, -2, -1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1, 2, 4]) {
        const load = { kind: 'impedance' as const, resistance: 64 * r, reactance: 64 * x };
        const classification = classifyLCFeasibility(topology, { re: r, im: x });
        expect(classifyLCPhysicalLoadFeasibility(topology, { z0: 64, load })).toBe(classification);
        const solution = solveLCMatching({ ...topology, z0: 64, load, frequencyHz: 1e9 });
        const expected: Record<typeof solution.status, LCFeasibilityClassification[]> = {
          solved: ['matchable'], continuous: ['continuous'], 'already-matched': ['boundary'],
          'no-solution': ['outside', 'boundary'], unmatchable: ['unmatchable'],
        };
        expect(expected[solution.status], `${JSON.stringify(topology)} z=${r}+j${x}, ${solution.status}`).toContain(classification);
      }
    }
  });

  it('includes the exact signed domain of both possible series-L/parallel-C orders', () => {
    for (const z of [{ re: 2, im: -5 }, { re: 2, im: 5 }, { re: 1, im: 1 }, { re: 0.5, im: 1 }]) {
      expect(classifyLCFeasibility(seriesLParallelC, z)).toBe('matchable');
      expect(classifyLCFeasibility(parallelCSeriesL, z)).toBe('outside');
    }
    for (const z of [{ re: 0.5, im: -5 }, { re: 0.5, im: 0 }, { re: 0.5, im: 0.25 }]) {
      expect(classifyLCFeasibility(seriesLParallelC, z)).toBe('outside');
      expect(classifyLCFeasibility(parallelCSeriesL, z)).toBe('matchable');
    }
  });

  it('uses conjugate regions for series-C/parallel-L, without accepting negative components', () => {
    for (const z of [{ re: 2, im: -5 }, { re: 1, im: 1 }, { re: 0.5, im: -1 }, { re: 0.5, im: 0.25 }]) {
      const conjugate = { re: z.re, im: -z.im };
      expect(classifyLCFeasibility(seriesLParallelC, z)).toBe(classifyLCFeasibility(seriesCParallelL, conjugate));
      expect(classifyLCFeasibility(parallelCSeriesL, z)).toBe(classifyLCFeasibility(parallelLSeriesC, conjugate));
    }
  });

  it('excludes the strict zero/infinite-component boundaries instead of shading them', () => {
    for (const topology of [seriesLParallelC, parallelCSeriesL]) {
      for (const z of [{ re: 0.5, im: 0.5 }, { re: 1, im: 0 }, { re: 1, im: -1 }, { re: 1, im: -10 }]) {
        expect(classifyLCFeasibility(topology, z)).toBe('boundary');
      }
      expect(classifyLCFeasibility(topology, { re: 0.5, im: -0.5 })).not.toBe('boundary');
      expect(classifyLCFeasibility(topology, { re: 1, im: 1 })).not.toBe('boundary');
    }
    for (const topology of [seriesCParallelL, parallelLSeriesC]) {
      for (const z of [{ re: 0.5, im: -0.5 }, { re: 1, im: 0 }, { re: 1, im: 1 }, { re: 1, im: 10 }]) {
        expect(classifyLCFeasibility(topology, z)).toBe('boundary');
      }
      expect(classifyLCFeasibility(topology, { re: 0.5, im: 0.5 })).not.toBe('boundary');
      expect(classifyLCFeasibility(topology, { re: 1, im: -1 })).not.toBe('boundary');
    }
  });

  it.each(['LC', 'CL'] as const)('marks matching curves as continuous families for order %s, never areas', order => {
    const series: LCMatchingTopology = { order, inductorConnection: 'series', capacitorConnection: 'series' };
    const parallel: LCMatchingTopology = { order, inductorConnection: 'parallel', capacitorConnection: 'parallel' };
    for (const x of [-10, -1, 0, 1, 10]) expect(classifyLCFeasibility(series, { re: 1, im: x })).toBe('continuous');
    for (const z of [{ re: 0.5, im: -0.5 }, { re: 0.5, im: 0.5 }, { re: 1, im: 0 }]) {
      expect(classifyLCFeasibility(parallel, z)).toBe('continuous');
    }
    expect(classifyLCFeasibility(series, { re: 0.5, im: 0.5 })).toBe('outside');
    expect(classifyLCFeasibility(parallel, { re: 1, im: 1 })).toBe('outside');
    expect(describeLCFeasibility(series).kind).toBe('curve');
    expect(describeLCFeasibility(parallel).kind).toBe('curve');
  });

  it('retains exact physical conductance-one curves without normalized roundoff or numeric scale drift', () => {
    const parallel: LCMatchingTopology = { order: 'LC', inductorConnection: 'parallel', capacitorConnection: 'parallel' };
    for (const scale of [2 ** -1000, 1, 2 ** 900]) {
      const input = { z0: 50 * scale, load: { kind: 'impedance' as const, resistance: 5 * scale, reactance: 15 * scale } };
      expect(classifyLCPhysicalLoadFeasibility(parallel, input)).toBe('continuous');
      expect(classifyLCPhysicalLoadFeasibility(seriesLParallelC, input)).toBe('boundary');
      expect(classifyLCPhysicalLoadFeasibility(parallelCSeriesL, input)).toBe('boundary');
    }
    for (const direction of [-1, 1]) {
      const input = { z0: 50, load: { kind: 'impedance' as const, resistance: 5, reactance: 15 + direction * 15 * Number.EPSILON } };
      expect(classifyLCPhysicalLoadFeasibility(seriesLParallelC, input)).toBe(direction > 0 ? 'matchable' : 'outside');
      expect(classifyLCPhysicalLoadFeasibility(parallelCSeriesL, input)).toBe(direction > 0 ? 'outside' : 'matchable');
      expect(classifyLCPhysicalLoadFeasibility(parallel, input)).toBe('outside');
    }
  });

  it.each(topologies)('never calls the reactive outer rim matchable: %j', topology => {
    for (const x of [-100, -1, 0, 1, 100]) expect(classifyLCFeasibility(topology, { re: 0, im: x })).toBe('unmatchable');
    expect(classifyLCFeasibility(topology, null)).toBe('unmatchable');
    for (const load of [{ kind: 'open' as const }, { kind: 'short' as const }, { kind: 'impedance' as const, resistance: 0, reactance: 50 }]) {
      expect(classifyLCPhysicalLoadFeasibility(topology, { z0: 50, load })).toBe('unmatchable');
    }
  });

  it('rejects invalid finite-domain inputs and topologies', () => {
    expect(() => classifyLCFeasibility(seriesLParallelC, { re: NaN, im: 0 })).toThrow(RangeError);
    expect(() => classifyLCFeasibility(seriesLParallelC, { re: 1, im: Infinity })).toThrow(RangeError);
    expect(() => classifyLCPhysicalLoadFeasibility(seriesLParallelC, { z0: 0, load: { kind: 'open' } })).toThrow(RangeError);
    expect(() => classifyLCPhysicalLoadFeasibility(seriesLParallelC, { z0: 50, load: { kind: 'impedance', resistance: -1, reactance: 0 } })).toThrow(RangeError);
    expect(() => describeLCFeasibility({ ...seriesLParallelC, order: 'bad' } as unknown as LCMatchingTopology)).toThrow(RangeError);
    expect(() => describeLCFeasibility({ ...seriesLParallelC, inductorConnection: 'bad' } as unknown as LCMatchingTopology)).toThrow(RangeError);
  });
});
