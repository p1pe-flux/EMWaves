import { describe, expect, it } from 'vitest';
import { solveLumpedMatching, type LumpedMatchingTopology, type LumpedComponent, type LumpedConnection } from './lumpedMatching';
import {
  classifyLumpedFeasibility, classifyLumpedPhysicalLoadFeasibility, describeLumpedFeasibility,
  type LumpedFeasibilityClassification,
} from './lumpedFeasibility';

function topologyFor(order: 'LC' | 'CL', inductorConnection: LumpedConnection, capacitorConnection: LumpedConnection): LumpedMatchingTopology {
  return { elements: [...order].map(component => ({
    component: component as LumpedComponent,
    connection: component === 'L' ? inductorConnection : capacitorConnection,
  })) as LumpedMatchingTopology['elements'] };
}
const topologies: LumpedMatchingTopology[] = (['LC', 'CL'] as const).flatMap(order =>
  (['series', 'parallel'] as const).flatMap(inductorConnection =>
    (['series', 'parallel'] as const).map(capacitorConnection => topologyFor(order, inductorConnection, capacitorConnection))));

const seriesLParallelC = topologyFor('LC', 'series', 'parallel');
const parallelCSeriesL = topologyFor('CL', 'series', 'parallel');
const parallelLSeriesC = topologyFor('LC', 'parallel', 'series');
const seriesCParallelL = topologyFor('CL', 'parallel', 'series');

describe('LC feasible load regions', () => {
  it.each(topologies)('describes the selected physical generator-to-load topology: %j', topology => {
    const region = describeLumpedFeasibility(topology);
    expect(region.sourceComponent + region.loadComponent).toBe(topology.elements.map(element => element.component).join(''));
    expect(region.sourceConnection).toBe(topology.elements[0].connection);
    expect(region.loadConnection).toBe(topology.elements[1].connection);
    expect(region.kind).toBe(topology.elements[0].connection === topology.elements[1].connection ? 'curve' : 'area');
    expect(region.formula).toContain('r');
    expect(region.formula).not.toContain('g');
    expect(region.boundaryFormula.length).toBeGreaterThan(0);
  });

  it.each(topologies)('agrees with independent synthesis over the passive load plane: %j', topology => {
    for (const r of [0.0625, 0.125, 0.25, 0.5, 0.75, 1, 1.25, 2, 4]) {
      for (const x of [-4, -2, -1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1, 2, 4]) {
        const load = { kind: 'impedance' as const, resistance: 64 * r, reactance: 64 * x };
        const classification = classifyLumpedFeasibility(topology, { re: r, im: x });
        expect(classifyLumpedPhysicalLoadFeasibility(topology, { z0: 64, load })).toBe(classification);
        const solution = solveLumpedMatching({ ...topology, z0: 64, load, frequencyHz: 1e9 });
        const expected: Record<typeof solution.status, LumpedFeasibilityClassification[]> = {
          solved: ['matchable'], continuous: ['continuous'], 'already-matched': ['boundary'],
          'no-solution': ['outside', 'boundary'], unmatchable: ['unmatchable'],
        };
        expect(expected[solution.status], `${JSON.stringify(topology)} z=${r}+j${x}, ${solution.status}`).toContain(classification);
      }
    }
  });

  it('includes the exact signed domain of both possible series-L/parallel-C orders', () => {
    for (const z of [{ re: 2, im: -5 }, { re: 2, im: 5 }, { re: 1, im: 1 }, { re: 0.5, im: 1 }]) {
      expect(classifyLumpedFeasibility(seriesLParallelC, z)).toBe('matchable');
      expect(classifyLumpedFeasibility(parallelCSeriesL, z)).toBe('outside');
    }
    for (const z of [{ re: 0.5, im: -5 }, { re: 0.5, im: 0 }, { re: 0.5, im: 0.25 }]) {
      expect(classifyLumpedFeasibility(seriesLParallelC, z)).toBe('outside');
      expect(classifyLumpedFeasibility(parallelCSeriesL, z)).toBe('matchable');
    }
  });

  it('uses conjugate regions for series-C/parallel-L, without accepting negative components', () => {
    for (const z of [{ re: 2, im: -5 }, { re: 1, im: 1 }, { re: 0.5, im: -1 }, { re: 0.5, im: 0.25 }]) {
      const conjugate = { re: z.re, im: -z.im };
      expect(classifyLumpedFeasibility(seriesLParallelC, z)).toBe(classifyLumpedFeasibility(seriesCParallelL, conjugate));
      expect(classifyLumpedFeasibility(parallelCSeriesL, z)).toBe(classifyLumpedFeasibility(parallelLSeriesC, conjugate));
    }
  });

  it('excludes the strict zero/infinite-component boundaries instead of shading them', () => {
    for (const topology of [seriesLParallelC, parallelCSeriesL]) {
      for (const z of [{ re: 0.5, im: 0.5 }, { re: 1, im: 0 }, { re: 1, im: -1 }, { re: 1, im: -10 }]) {
        expect(classifyLumpedFeasibility(topology, z)).toBe('boundary');
      }
      expect(classifyLumpedFeasibility(topology, { re: 0.5, im: -0.5 })).not.toBe('boundary');
      expect(classifyLumpedFeasibility(topology, { re: 1, im: 1 })).not.toBe('boundary');
    }
    for (const topology of [seriesCParallelL, parallelLSeriesC]) {
      for (const z of [{ re: 0.5, im: -0.5 }, { re: 1, im: 0 }, { re: 1, im: 1 }, { re: 1, im: 10 }]) {
        expect(classifyLumpedFeasibility(topology, z)).toBe('boundary');
      }
      expect(classifyLumpedFeasibility(topology, { re: 0.5, im: 0.5 })).not.toBe('boundary');
      expect(classifyLumpedFeasibility(topology, { re: 1, im: -1 })).not.toBe('boundary');
    }
  });

  it.each(['LC', 'CL'] as const)('marks matching curves as continuous families for order %s, never areas', order => {
    const series: LumpedMatchingTopology = topologyFor(order, 'series', 'series');
    const parallel: LumpedMatchingTopology = topologyFor(order, 'parallel', 'parallel');
    for (const x of [-10, -1, 0, 1, 10]) expect(classifyLumpedFeasibility(series, { re: 1, im: x })).toBe('continuous');
    for (const z of [{ re: 0.5, im: -0.5 }, { re: 0.5, im: 0.5 }, { re: 1, im: 0 }]) {
      expect(classifyLumpedFeasibility(parallel, z)).toBe('continuous');
    }
    expect(classifyLumpedFeasibility(series, { re: 0.5, im: 0.5 })).toBe('outside');
    expect(classifyLumpedFeasibility(parallel, { re: 1, im: 1 })).toBe('outside');
    expect(describeLumpedFeasibility(series).kind).toBe('curve');
    expect(describeLumpedFeasibility(parallel).kind).toBe('curve');
  });

  it('retains exact physical conductance-one curves without normalized roundoff or numeric scale drift', () => {
    const parallel: LumpedMatchingTopology = topologyFor('LC', 'parallel', 'parallel');
    for (const scale of [2 ** -1000, 1, 2 ** 900]) {
      const input = { z0: 50 * scale, load: { kind: 'impedance' as const, resistance: 5 * scale, reactance: 15 * scale } };
      expect(classifyLumpedPhysicalLoadFeasibility(parallel, input)).toBe('continuous');
      expect(classifyLumpedPhysicalLoadFeasibility(seriesLParallelC, input)).toBe('boundary');
      expect(classifyLumpedPhysicalLoadFeasibility(parallelCSeriesL, input)).toBe('boundary');
    }
    for (const direction of [-1, 1]) {
      const input = { z0: 50, load: { kind: 'impedance' as const, resistance: 5, reactance: 15 + direction * 15 * Number.EPSILON } };
      expect(classifyLumpedPhysicalLoadFeasibility(seriesLParallelC, input)).toBe(direction > 0 ? 'matchable' : 'outside');
      expect(classifyLumpedPhysicalLoadFeasibility(parallelCSeriesL, input)).toBe(direction > 0 ? 'outside' : 'matchable');
      expect(classifyLumpedPhysicalLoadFeasibility(parallel, input)).toBe('outside');
    }
  });

  it.each(topologies)('never calls the reactive outer rim matchable: %j', topology => {
    for (const x of [-100, -1, 0, 1, 100]) expect(classifyLumpedFeasibility(topology, { re: 0, im: x })).toBe('unmatchable');
    expect(classifyLumpedFeasibility(topology, null)).toBe('unmatchable');
    for (const load of [{ kind: 'open' as const }, { kind: 'short' as const }, { kind: 'impedance' as const, resistance: 0, reactance: 50 }]) {
      expect(classifyLumpedPhysicalLoadFeasibility(topology, { z0: 50, load })).toBe('unmatchable');
    }
  });

  it('rejects invalid finite-domain inputs and topologies', () => {
    expect(() => classifyLumpedFeasibility(seriesLParallelC, { re: NaN, im: 0 })).toThrow(RangeError);
    expect(() => classifyLumpedFeasibility(seriesLParallelC, { re: 1, im: Infinity })).toThrow(RangeError);
    expect(() => classifyLumpedPhysicalLoadFeasibility(seriesLParallelC, { z0: 0, load: { kind: 'open' } })).toThrow(RangeError);
    expect(() => classifyLumpedPhysicalLoadFeasibility(seriesLParallelC, { z0: 50, load: { kind: 'impedance', resistance: -1, reactance: 0 } })).toThrow(RangeError);
    expect(() => describeLumpedFeasibility({ elements: [] } as unknown as LumpedMatchingTopology)).toThrow(RangeError);
    expect(() => describeLumpedFeasibility({ elements: [{ component: 'L', connection: 'bad' }, { component: 'C', connection: 'parallel' }] } as unknown as LumpedMatchingTopology)).toThrow(RangeError);
  });
});
