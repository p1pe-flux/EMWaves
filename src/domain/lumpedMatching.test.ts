import { describe, expect, it } from 'vitest';
import {
  applyLumpedStage, evaluateLumpedMatching, normalizedElementSign, solveLumpedMatching,
  toLumpedMatchingInput, toLumpedTopology,
  type LumpedElement, type LumpedMatchingInput, type LumpedMatchingTopology,
} from './lumpedMatching';
import {
  classifyLumpedFeasibility, classifyLumpedPhysicalLoadFeasibility, describeLumpedFeasibility,
} from './lumpedFeasibility';

const elements: LumpedElement[] = (['L', 'C'] as const).flatMap(component =>
  (['series', 'parallel'] as const).map(connection => ({ component, connection })));
const topologies: LumpedMatchingTopology[] = elements.flatMap(source => elements.map(load => ({ elements: [source, load] })));
const context = { z0: 50, frequencyHz: 1e9 };
const inputFor = (topology: LumpedMatchingTopology, re: number, im: number): LumpedMatchingInput => ({
  ...context, ...topology, load: { kind: 'impedance', resistance: re * context.z0, reactance: im * context.z0 },
});
function physicalValue(element: LumpedElement, normalized: number, z0 = context.z0, frequencyHz = context.frequencyHz): number {
  const omega = 2 * Math.PI * frequencyHz;
  if (element.component === 'L') return element.connection === 'series' ? normalized * z0 / omega : -z0 / (omega * normalized);
  return element.connection === 'series' ? -1 / (omega * z0 * normalized) : normalized / (omega * z0);
}

describe('general two-reactive-element synthesis', () => {
  it.each(topologies)('recovers a physical network for all sixteen generator-to-load configurations: %j', topology => {
    const normalized = topology.elements.map((element, index) => normalizedElementSign(element) * [0.35, 0.8][index]) as [number, number];
    let load = applyLumpedStage({ re: 1, im: 0 }, topology.elements[0].connection, -normalized[0]);
    load = applyLumpedStage(load, topology.elements[1].connection, -normalized[1]);
    expect(load).not.toBeNull();
    expect(load!.re).toBeGreaterThan(0);
    const input = inputFor(topology, load!.re, load!.im);
    const result = solveLumpedMatching(input);
    if (topology.elements[0].connection === topology.elements[1].connection) {
      // Exact curve membership is intentional: normalization may perturb a generated g=1 load.
      if (result.status === 'continuous') expect(result.family).toBeDefined();
      else expect(classifyLumpedPhysicalLoadFeasibility(topology, input)).toBe('outside');
    } else {
      expect(result.status).toBe('solved');
      expect(result.branches).toHaveLength(1);
      const branch = result.branches[0];
      expect(branch.elements.map(element => element.component)).toEqual(topology.elements.map(element => element.component));
      expect(branch.stages.map(stage => stage.elementIndex)).toEqual([1, 0]);
      for (const index of [0, 1] as const) {
        const expected = physicalValue(topology.elements[index], normalized[index]);
        expect(branch.elements[index].value / expected).toBeCloseTo(1, 11);
        expect(branch.elements[index].normalizedValue).toBeCloseTo(normalized[index], 12);
      }
      const evaluated = evaluateLumpedMatching({ ...input, values: branch.elements.map(element => element.value) as [number, number] });
      expect(evaluated.inputImpedance!.re).toBeCloseTo(50, 10);
      expect(evaluated.inputImpedance!.im).toBeCloseTo(0, 10);
      expect(evaluated.reflectionMagnitude).toBeLessThan(1e-12);
    }
  });

  it.each(topologies)('agrees with feasibility throughout the passive load plane: %j', topology => {
    for (const r of [0.125, 0.25, 0.5, 0.75, 1, 2, 4]) for (const x of [-4, -1, -0.5, 0, 0.5, 1, 4]) {
      const input = inputFor(topology, r, x);
      const classified = classifyLumpedPhysicalLoadFeasibility(topology, input);
      const solved = solveLumpedMatching(input);
      if (solved.status === 'solved') expect(classified).toBe('matchable');
      else if (solved.status === 'continuous') expect(classified).toBe('continuous');
      else expect(['outside', 'boundary']).toContain(classified);
      if (classified === 'matchable') expect(solved.status).toBe('solved');
      if (classified === 'continuous') expect(solved.status).toBe('continuous');
      expect(solved.branches.length).toBeLessThanOrEqual(1);
    }
  });

  it.each(['L', 'C'] as const)('finds both mixed-connection orders of %s–%s without negative components', component => {
    const x = component === 'L' ? -1 : 1;
    for (const sourceConnection of ['series', 'parallel'] as const) {
      const topology: LumpedMatchingTopology = { elements: [
        { component, connection: sourceConnection },
        { component, connection: sourceConnection === 'series' ? 'parallel' : 'series' },
      ] };
      const result = solveLumpedMatching(inputFor(topology, 0.5, x));
      expect(result.status).toBe('solved');
      expect(result.branches[0].elements.every(element => element.value > 0 && Number.isFinite(element.value))).toBe(true);
      expect(result.branches[0].residual).toBeLessThan(1e-12);
      expect(solveLumpedMatching(inputFor(topology, 0.5, -x)).status).toBe('no-solution');
      expect(solveLumpedMatching(inputFor(topology, 2, x)).status).toBe('no-solution');
    }
  });

  it.each(elements)('preserves the bounded positive split for two identical %j elements', element => {
    const topology: LumpedMatchingTopology = { elements: [element, element] };
    const sign = normalizedElementSign(element);
    // Both r=1 and g=1 loads are constructed with exact binary coordinates.
    const input = element.connection === 'series' ? inputFor(topology, 1, -2 * sign)
      : inputFor(topology, 0.5, sign === 1 ? 0.5 : -0.5);
    const result = solveLumpedMatching(input);
    expect(result.status).toBe('continuous');
    expect(result.branches).toHaveLength(0);
    const family = result.family!;
    expect(family.minimum).toBe(0);
    expect(family.maximum).toBe(element.connection === 'series' ? 2 : 1);
    expect(family.signs).toEqual([sign, sign]);
    for (const fraction of [0.1, 0.5, 0.9]) {
      const q = family.maximum! * fraction;
      const normalized: [number, number] = [sign * q, family.totalNormalizedValue - sign * q];
      const values = normalized.map(value => physicalValue(element, value)) as [number, number];
      const evaluated = evaluateLumpedMatching({ ...input, values });
      expect(evaluated.reflectionMagnitude).toBeLessThan(1e-12);
      expect(values.every(value => value > 0 && Number.isFinite(value))).toBe(true);
    }
    expect(solveLumpedMatching(inputFor(topology, 1, 0)).status).toBe('already-matched');
  });

  it.each(['LC', 'CL'] as const)('keeps unbounded opposite-sign families, including nonzero lower bounds: %s', order => {
    for (const connection of ['series', 'parallel'] as const) for (const x of [-1, 1]) {
      const topology: LumpedMatchingTopology = { elements: [
        { component: order[0] as 'L' | 'C', connection }, { component: order[1] as 'L' | 'C', connection },
      ] };
      const input = connection === 'series' ? inputFor(topology, 1, x) : inputFor(topology, 0.5, x * 0.5);
      const result = solveLumpedMatching(input);
      expect(result.status).toBe('continuous');
      expect(result.family!.maximum).toBeNull();
      const q = result.family!.minimum + 1;
      const contributions: [number, number] = [result.family!.signs[0] * q, result.family!.totalNormalizedValue - result.family!.signs[0] * q];
      const values = contributions.map((value, index) => physicalValue(topology.elements[index], value)) as [number, number];
      expect(evaluateLumpedMatching({ ...input, values }).reflectionMagnitude).toBeLessThan(1e-12);
    }
  });

  it('halves both SI values at doubled design frequency while preserving the construction', () => {
    const input: LumpedMatchingInput = { ...context, elements: [{ component: 'L', connection: 'series' }, { component: 'L', connection: 'parallel' }], load: { kind: 'impedance', resistance: 25, reactance: -50 } };
    const original = solveLumpedMatching(input).branches[0];
    const doubled = solveLumpedMatching({ ...input, frequencyHz: 2e9 }).branches[0];
    for (const index of [0, 1] as const) {
      expect(doubled.elements[index].value).toBeCloseTo(original.elements[index].value / 2, 20);
      expect(doubled.elements[index].normalizedValue).toBe(original.elements[index].normalizedValue);
    }
  });

  it.each(topologies)('distinguishes unmatchable ideal loads and validates both independent choices: %j', topology => {
    for (const load of [{ kind: 'open' as const }, { kind: 'short' as const }, { kind: 'impedance' as const, resistance: 0, reactance: 50 }]) {
      expect(solveLumpedMatching({ ...context, ...topology, load }).status).toBe('unmatchable');
    }
    expect(() => solveLumpedMatching({ ...inputFor(topology, 1, 0), frequencyHz: 0 })).toThrow(RangeError);
  });

  it('does not turn same-type boundary elements into tiny positive realizations', () => {
    for (const component of ['L', 'C'] as const) for (const connection of ['series', 'parallel'] as const) {
      const topology: LumpedMatchingTopology = { elements: [{ component, connection }, { component, connection: connection === 'series' ? 'parallel' : 'series' }] };
      const direction = component === 'L' ? -1 : 1;
      for (const [r, x] of [[0.5, direction * 0.5], [1, direction]]) {
        expect(classifyLumpedFeasibility(topology, { re: r, im: x })).toBe('boundary');
        expect(solveLumpedMatching(inputFor(topology, r, x)).status).toBe('no-solution');
      }
      const x = direction * (0.5 + Number.EPSILON);
      expect(solveLumpedMatching(inputFor(topology, 0.5, x)).status).toBe('solved');
      expect(solveLumpedMatching(inputFor(topology, 0.5, direction * (0.5 - Number.EPSILON))).status).toBe('no-solution');
    }
  });

  it('retains exact physical g=1 families at extreme scales', () => {
    const topology: LumpedMatchingTopology = { elements: [{ component: 'L', connection: 'parallel' }, { component: 'L', connection: 'parallel' }] };
    for (const scale of [2 ** -1000, 1, 2 ** 900]) {
      const input: LumpedMatchingInput = { ...topology, frequencyHz: 1e9, z0: 50 * scale, load: { kind: 'impedance', resistance: 5 * scale, reactance: -15 * scale } };
      expect(solveLumpedMatching(input).status).toBe('continuous');
      expect(classifyLumpedPhysicalLoadFeasibility(topology, input)).toBe('continuous');
    }
  });

  it('validates and copies the canonical topology without aliasing the caller’s elements', () => {
    const input = inputFor({ elements: [{ component: 'C', connection: 'series' }, { component: 'L', connection: 'parallel' }] }, 2, 1);
    const normalized = toLumpedMatchingInput(input);
    expect(normalized).toEqual(input);
    expect(normalized.elements).not.toBe(input.elements);
    expect(normalized.elements[0]).not.toBe(input.elements[0]);
    expect(toLumpedTopology(input).elements.map(element => element.component)).toEqual(['C', 'L']);
    expect(() => toLumpedTopology({ elements: [] } as never)).toThrow(RangeError);
    expect(() => describeLumpedFeasibility({ elements: [{ component: 'bad', connection: 'series' }, { component: 'L', connection: 'series' }] } as never)).toThrow(RangeError);
    expect(() => evaluateLumpedMatching({ ...input, values: [0, 1e-9] })).toThrow(RangeError);
  });
});
