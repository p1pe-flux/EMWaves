import { describe, expect, it } from 'vitest';
import { classifyLumpedFeasibility } from '../domain/lumpedFeasibility';
import type { LumpedMatchingTopology } from '../domain/lumpedMatching';
import { impedanceToReflection, reflectionToImpedance, type ComplexValue } from '../domain/transmission';
import { lumpedFeasibilityGeometry } from './lumpedFeasibilityGeometry';

const elements = (['L', 'C'] as const).flatMap(component => (['series', 'parallel'] as const).map(connection => ({ component, connection })));
const topologies: LumpedMatchingTopology[] = elements.flatMap(source => elements.map(load => ({ elements: [source, load] })));

function inside(point: ComplexValue, polygon: ComplexValue[]): boolean {
  let found = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.im > point.im) !== (b.im > point.im)
      && point.re < (b.re - a.re) * (point.im - a.im) / (b.im - a.im) + a.re) found = !found;
  }
  return found;
}

function area(polygon: ComplexValue[]): number {
  return Math.abs(polygon.reduce((sum, point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return sum + point.re * next.im - next.re * point.im;
  }, 0)) / 2;
}

describe('two-component feasible load contours', () => {
  it.each(topologies.map((topology, index) => ({ topology, index })))('draws the exact load set for topology $index', ({ topology }) => {
    const geometry = lumpedFeasibilityGeometry(topology);
    const [source, load] = topology.elements;
    if (source.connection === load.connection) {
      expect(geometry.loops).toHaveLength(0);
      expect(geometry.excludedBoundaries).toHaveLength(0);
      expect(geometry.allowedCurve).toHaveLength(97);
      const center = source.connection === 'series' ? 0.5 : -0.5;
      for (const point of geometry.allowedCurve!) {
        expect(Math.hypot(point.re - center, point.im)).toBeCloseTo(0.5, 13);
        if (source.component === load.component) {
          expect(source.component === 'L' ? point.im : -point.im).toBeLessThanOrEqual(1e-14);
        }
      }
      if (source.component !== load.component) {
        expect(geometry.allowedCurve!.some(point => point.im > 0.45)).toBe(true);
        expect(geometry.allowedCurve!.some(point => point.im < -0.45)).toBe(true);
      }
      return;
    }

    expect(geometry.allowedCurve).toBeNull();
    expect(geometry.loops).toHaveLength(1);
    expect(geometry.excludedBoundaries).toHaveLength(2);
    const loop = geometry.loops[0];
    for (const point of loop) expect(Math.hypot(point.re, point.im)).toBeLessThanOrEqual(1.00000000000001);
    expect(area(loop)).toBeCloseTo(source.component === load.component ? Math.PI / 4 : Math.PI / 2, 3);

    for (let i = -19; i <= 19; i++) for (let j = -19; j <= 19; j++) {
      const gamma = { re: i / 20, im: j / 20 };
      if (Math.hypot(gamma.re, gamma.im) > 0.97) continue;
      // Sample strict interiors, away from the chord approximation of each arc.
      if ([0.5, -0.5].some(center => Math.abs(Math.hypot(gamma.re - center, gamma.im) - 0.5) < 0.002)) continue;
      const classification = classifyLumpedFeasibility(topology, reflectionToImpedance(gamma));
      expect(inside(gamma, loop), JSON.stringify({ topology, gamma })).toBe(classification === 'matchable');
    }
  });

  it.each(['L', 'C'] as const)('keeps the identical-%s region fixed when the series and parallel positions swap', component => {
    const first = lumpedFeasibilityGeometry({ elements: [{ component, connection: 'series' }, { component, connection: 'parallel' }] });
    const second = lumpedFeasibilityGeometry({ elements: [{ component, connection: 'parallel' }, { component, connection: 'series' }] });
    expect(first).toEqual(second);
  });

  it('conjugates the mixed LL region into the CC region', () => {
    const ll = lumpedFeasibilityGeometry({ elements: [{ component: 'L', connection: 'series' }, { component: 'L', connection: 'parallel' }] });
    const cc = lumpedFeasibilityGeometry({ elements: [{ component: 'C', connection: 'series' }, { component: 'C', connection: 'parallel' }] });
    expect(cc.loops).toEqual(ll.loops.map(loop => loop.map(point => ({ re: point.re, im: -point.im }))));
    for (const point of ll.loops[0]) expect(point.im).toBeLessThanOrEqual(1e-14);
    for (const point of cc.loops[0]) expect(point.im).toBeGreaterThanOrEqual(-1e-14);
  });

  it.each(topologies.filter(({ elements: [source, load] }) => source.connection !== load.connection).map((topology, index) => ({ topology, index })))('uses physical Γ positions for both grid readings in mixed topology $index', ({ topology }) => {
    const loop = lumpedFeasibilityGeometry(topology).loops[0];
    for (const z of [{ re: 0.5, im: -1 }, { re: 0.5, im: 1 }, { re: 2, im: -1 }, { re: 0.5, im: -0.2 }]) {
      const physical = impedanceToReflection(z);
      const denominatorZ = z.re * z.re + z.im * z.im;
      const y = { re: z.re / denominatorZ, im: -z.im / denominatorZ };
      const denominatorY = (1 + y.re) ** 2 + y.im ** 2;
      const fromY = { re: (1 - y.re ** 2 - y.im ** 2) / denominatorY, im: -2 * y.im / denominatorY };
      expect(fromY.re).toBeCloseTo(physical.re, 13);
      expect(fromY.im).toBeCloseTo(physical.im, 13);
      expect(inside(fromY, loop)).toBe(inside(physical, loop));
    }
  });
});
