import type { LumpedMatchingTopology } from '../domain/lumpedMatching';
import type { ComplexValue } from '../domain/transmission';

export interface LumpedFeasibilityGeometry {
  /** Fixed physical Γ coordinates, shared by the impedance and admittance grids. */
  loops: ComplexValue[][];
  /** Limits requiring a zero contribution or an infinite component value. */
  excludedBoundaries: ComplexValue[][];
  /** Equal connections give a curve rather than a two-dimensional region. */
  allowedCurve: ComplexValue[] | null;
}

function arc(center: number, radius: number, start: number, end: number): ComplexValue[] {
  return Array.from({ length: 97 }, (_, index) => {
    const angle = start + (end - start) * index / 96;
    return { re: center + radius * Math.cos(angle), im: radius * Math.sin(angle) };
  });
}

/**
 * Analytic load-plane contours for two positive, finite reactive components.
 * The paths include their limiting endpoints for drawing; the domain classifier
 * keeps zero-valued elements, infinite elements and reactive loads excluded.
 */
export function lumpedFeasibilityGeometry(topology: LumpedMatchingTopology): LumpedFeasibilityGeometry {
  const [source, load] = topology.elements;
  const sameComponent = source.component === load.component;
  if (source.connection === load.connection) {
    const center = source.connection === 'series' ? 0.5 : -0.5;
    // Identical reactances cannot cancel each other. The load must supply the
    // opposite sign: inductors need a capacitive load, capacitors an inductive one.
    const [start, end] = !sameComponent ? [0, 2 * Math.PI]
      : source.component === 'L' ? [Math.PI, 2 * Math.PI] : [0, Math.PI];
    return { loops: [], excludedBoundaries: [], allowedCurve: arc(center, 0.5, start, end) };
  }

  if (sameComponent) {
    // LL occupies the lower scallop outside both unity circles. CC is its
    // conjugate. Changing which component is in series does not change this set.
    const reflect = (point: ComplexValue) => ({ re: point.re, im: source.component === 'L' ? point.im : -point.im });
    const conductanceBoundary = arc(-0.5, 0.5, Math.PI, 2 * Math.PI);
    const resistanceBoundary = arc(0.5, 0.5, Math.PI, 2 * Math.PI);
    const passiveBoundary = arc(0, 1, 0, -Math.PI);
    return {
      loops: [[...conductanceBoundary, ...resistanceBoundary.slice(1), ...passiveBoundary.slice(1)].map(reflect)],
      excludedBoundaries: [conductanceBoundary.map(reflect), resistanceBoundary.map(reflect)],
      allowedCurve: null,
    };
  }

  // Source-series L / load-parallel C is the upper half-disk outside g=1,
  // joined to the lower half of the r=1 disk. The other LC sets are reflections.
  const realSign = source.connection === 'series' ? 1 : -1;
  const imaginarySign = source.component === 'L' ? 1 : -1;
  const reflect = (point: ComplexValue) => ({ re: realSign * point.re, im: imaginarySign * point.im });
  const conductanceBoundary = arc(-0.5, 0.5, Math.PI, 0);
  const resistanceBoundary = arc(0.5, 0.5, Math.PI, 2 * Math.PI);
  const passiveBoundary = arc(0, 1, 0, Math.PI);
  return {
    loops: [[...conductanceBoundary, ...resistanceBoundary.slice(1), ...passiveBoundary.slice(1)].map(reflect)],
    excludedBoundaries: [conductanceBoundary.map(reflect), resistanceBoundary.map(reflect)],
    allowedCurve: null,
  };
}
