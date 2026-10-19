import { DomainError } from './errors';
import type { ComplexValue } from './transmission';

export type ProjectionBounds = {
  minRe: number;
  maxRe: number;
  minIm: number;
  maxIm: number;
};

export type ProjectionCurve = {
  kind: 'resistance' | 'reactance';
  value: number;
  region: 'passive' | 'active' | 'boundary';
  /** Separate, finite polylines; never join these across a projection pole. */
  paths: ComplexValue[][];
};

export type ProjectionGridOptions = {
  bounds?: ProjectionBounds;
  /** Samples per full source line, before clipping. Defaults to 128. */
  segments?: number;
  resistanceValues?: readonly number[];
  reactanceValues?: readonly number[];
};

export const DEFAULT_PROJECTION_BOUNDS: Readonly<ProjectionBounds> = Object.freeze({
  minRe: -2.2, maxRe: 2.2, minIm: -1.8, maxIm: 1.8,
});

// Uniform Cartesian spacing makes the two endpoint grids easy to recognize.
const GRID_VALUES = Object.freeze([
  -8, -6, ...Array.from({ length: 33 }, (_, index) => (index - 16) / 4), 6, 8,
]);
const HALF_PI = Math.PI / 2;

function projectionParameter(progress: number): number {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
    throw new DomainError('projection.invalid-progress');
  }
  return progress === 1 ? 1 : Math.tan(Math.PI * progress / 4);
}

function project(z: ComplexValue, a: number): ComplexValue | null {
  if (a === 0) return { re: z.re === 0 ? 0 : z.re, im: z.im === 0 ? 0 : z.im };
  if (z.im === 0 && z.re === -1 / a) return null;

  // Scale numerator and denominator together before forming the quotient.
  const scale = Math.max(1, Math.abs(z.re), Math.abs(z.im));
  const reciprocalScale = 1 / scale;
  const re = z.re / scale;
  const im = z.im / scale;
  const denominatorRe = a * re + reciprocalScale;
  const denominatorIm = a * im;
  const denominatorScale = Math.max(Math.abs(denominatorRe), Math.abs(denominatorIm));
  if (denominatorScale === 0) return null;
  const dr = denominatorRe / denominatorScale;
  const di = denominatorIm / denominatorScale;
  const denominator = dr * dr + di * di;
  const resultRe = (((re - a * reciprocalScale) * dr + im * di) / denominator) / denominatorScale;

  // The analytic determinant avoids cancellation of the imaginary component
  // for very large impedances, where the two quotient products nearly agree.
  const denominatorMagnitude = Math.hypot(denominatorRe, denominatorIm);
  const resultIm = (im / denominatorMagnitude) * (reciprocalScale / denominatorMagnitude) * (1 + a * a);
  if (!Number.isFinite(resultRe) || !Number.isFinite(resultIm)) return null;
  return { re: resultRe === 0 ? 0 : resultRe, im: resultIm === 0 ? 0 : resultIm };
}

/**
 * A continuous Möbius transformation of normalized impedance z = r + jx:
 * w = (z cos θ − sin θ) / (z sin θ + cos θ), θ = progress·π/4.
 * Progress zero is the Cartesian impedance plane; one is Γ = (z−1)/(z+1).
 * Negative resistance is allowed here solely to illustrate the active region.
 * null denotes the pole, or a result beyond the finite floating-point range.
 */
export function projectImpedance(z: ComplexValue, progress: number): ComplexValue | null {
  const a = projectionParameter(progress);
  if (!Number.isFinite(z.re) || !Number.isFinite(z.im)) {
    throw new DomainError('projection.invalid-impedance');
  }
  return project(z, a);
}

function inside(point: ComplexValue, bounds: ProjectionBounds): boolean {
  return point.re >= bounds.minRe && point.re <= bounds.maxRe
    && point.im >= bounds.minIm && point.im <= bounds.maxIm;
}

/** Clip an entering/exiting segment. Two outside samples are never connected. */
function clipSegment(first: ComplexValue, last: ComplexValue, bounds: ProjectionBounds): [ComplexValue, ComplexValue] | null {
  const dx = last.re - first.re;
  const dy = last.im - first.im;
  let start = 0;
  let end = 1;
  for (const [direction, distance] of [
    [-dx, first.re - bounds.minRe], [dx, bounds.maxRe - first.re],
    [-dy, first.im - bounds.minIm], [dy, bounds.maxIm - first.im],
  ]) {
    if (direction === 0) {
      if (distance < 0) return null;
      continue;
    }
    const ratio = distance / direction;
    if (direction < 0) start = Math.max(start, ratio);
    else end = Math.min(end, ratio);
    if (start > end) return null;
  }
  const point = (parameter: number): ComplexValue => ({
    re: Math.max(bounds.minRe, Math.min(bounds.maxRe, first.re + parameter * dx)),
    im: Math.max(bounds.minIm, Math.min(bounds.maxIm, first.im + parameter * dy)),
  });
  return [start === 0 ? first : point(start), end === 1 ? last : point(end)];
}

type Sample = { source: number; point: ComplexValue | null };

function finitePaths(samples: Sample[], pole: number | null, bounds: ProjectionBounds): ComplexValue[][] {
  const paths: ComplexValue[][] = [];
  let path: ComplexValue[] = [];
  const maxChord = Math.max(bounds.maxRe - bounds.minRe, bounds.maxIm - bounds.minIm) / 6;
  const flush = () => {
    if (path.length > 1) paths.push(path);
    path = [];
  };
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    const first = previous.point;
    const last = current.point;
    if (first === null || last === null || (pole !== null && previous.source <= pole && current.source >= pole)) {
      flush();
      continue;
    }
    const firstInside = inside(first, bounds);
    const lastInside = inside(last, bounds);
    if ((!firstInside && !lastInside)
      || (firstInside && lastInside && Math.hypot(last.re - first.re, last.im - first.im) > maxChord)) {
      flush();
      continue;
    }
    const clipped = clipSegment(first, last, bounds);
    if (clipped === null) { flush(); continue; }
    const previousEnd = path.at(-1);
    if (previousEnd === undefined || previousEnd.re !== clipped[0].re || previousEnd.im !== clipped[0].im) {
      flush();
      path.push(clipped[0]);
    }
    if (clipped[1].re !== path.at(-1)!.re || clipped[1].im !== path.at(-1)!.im) path.push(clipped[1]);
    if (!lastInside) flush();
  }
  flush();
  return paths;
}

/**
 * Project a Cartesian impedance grid. The source lines include ±∞ exactly,
 * so the final resistance circles close at Γ=1 without a finite-domain gap.
 * Reactance lines are split at r=0 to keep passive and active colors separate.
 * All returned points are inside bounds; separate paths must remain separate.
 */
export function projectionGrid(progress: number, options: ProjectionGridOptions = {}): ProjectionCurve[] {
  const a = projectionParameter(progress);
  const bounds = options.bounds ?? DEFAULT_PROJECTION_BOUNDS;
  const segments = options.segments ?? 128;
  const resistanceValues = options.resistanceValues ?? GRID_VALUES;
  const reactanceValues = options.reactanceValues ?? GRID_VALUES;
  if (!Object.values(bounds).every(Number.isFinite) || bounds.minRe >= bounds.maxRe || bounds.minIm >= bounds.maxIm) {
    throw new DomainError('projection.invalid-bounds');
  }
  if (!Number.isInteger(segments) || segments < 16 || segments > 4096) {
    throw new DomainError('projection.invalid-segments');
  }
  if (![...resistanceValues, ...reactanceValues].every(Number.isFinite)) {
    throw new DomainError('projection.invalid-grid-values');
  }
  const infinity = a === 0 || !Number.isFinite(1 / a) ? null : { re: 1 / a, im: 0 };
  const curves: ProjectionCurve[] = [];
  for (const resistance of resistanceValues) {
    // Adapt source spacing to the circle size while retaining detail when its
    // pole approaches infinity and the visible portion becomes a straight line.
    const sourceScale = a === 0 ? 1 : Math.max(0.25, Math.min(8, Math.abs(1 + a * resistance) / a));
    const samples: Sample[] = Array.from({ length: segments + 1 }, (_, index) => {
      const source = index === 0 ? -Infinity : index === segments ? Infinity
        : sourceScale * Math.tan(-HALF_PI + Math.PI * index / segments);
      return { source, point: Number.isFinite(source) ? project({ re: resistance, im: source }, a) : infinity };
    });
    curves.push({
      kind: 'resistance', value: resistance,
      region: resistance === 0 ? 'boundary' : resistance > 0 ? 'passive' : 'active',
      paths: finitePaths(samples, a !== 0 && resistance === -1 / a ? 0 : null, bounds),
    });
  }
  for (const reactance of reactanceValues) {
    for (const region of ['active', 'passive'] as const) {
      const samples: Sample[] = Array.from({ length: segments + 1 }, (_, index) => {
        const angle = region === 'active' ? -HALF_PI + HALF_PI * index / segments : HALF_PI * index / segments;
        const atInfinity = region === 'active' ? index === 0 : index === segments;
        const source = atInfinity ? (region === 'active' ? -Infinity : Infinity) : Math.tan(angle);
        return { source, point: atInfinity ? infinity : project({ re: source, im: reactance }, a) };
      });
      curves.push({
        kind: 'reactance', value: reactance, region,
        paths: finitePaths(samples, a !== 0 && reactance === 0 ? -1 / a : null, bounds),
      });
    }
  }
  return curves;
}
