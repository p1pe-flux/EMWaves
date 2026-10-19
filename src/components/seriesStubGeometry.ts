import type { ComplexValue } from '../domain/transmission';
import { impedanceToReflection } from '../domain/transmission';
import { loadCurves } from '../domain/smithCurves';
import type { StubTermination } from '../domain/singleStub';
export { easeProgress, rotateTowardGenerator, rotationPath } from './singleStubConstructionGeometry';

export const clampSeriesProgress = (value: number) => Math.max(0, Math.min(1, value));

export function seriesCircleArc(center: ComplexValue, radius: number, progress: number): ComplexValue[] {
  return Array.from({ length: 97 }, (_, index) => {
    const angle = 2 * Math.PI * clampSeriesProgress(progress) * index / 96;
    return { re: center.re + radius * Math.cos(angle), im: center.im + radius * Math.sin(angle) };
  });
}

export function revealSeriesPath(points: ComplexValue[], progress: number): ComplexValue[] {
  if (points.length < 2) return points;
  const position = clampSeriesProgress(progress) * (points.length - 1);
  const index = Math.floor(position);
  if (index >= points.length - 1) return points;
  const fraction = position - index;
  const first = points[index];
  const second = points[index + 1];
  return [...points.slice(0, index + 1), { re: first.re + (second.re - first.re) * fraction, im: first.im + (second.im - first.im) * fraction }];
}

export function seriesCancellationPath(reactance: number, progress: number): ComplexValue[] {
  return Array.from({ length: 81 }, (_, index) => impedanceToReflection({ re: 1, im: reactance * (1 - clampSeriesProgress(progress) * index / 80) }));
}

/** The visible constant-x curve starts at r=0 and ends at the open boundary. */
export function constantReactancePath(reactance: number): ComplexValue[] {
  return loadCurves({ re: 1, im: reactance })!.reactance;
}

/**
 * Main-line-normalized isolated stub: z_s=jρtanθ (short), -jρcotθ (open).
 * Evaluate Γ directly in homogeneous sine/cosine coordinates, including poles;
 * the grid/reference never changes even when Z0s differs from Z0.
 */
export function seriesStubPoint(z0: number, stubZ0: number, length: number, termination: StubTermination): ComplexValue {
  const angle = 2 * Math.PI * length;
  const ratio = stubZ0 / z0;
  const real = termination === 'short' ? Math.cos(angle) : Math.sin(angle);
  const imaginary = termination === 'short' ? ratio * Math.sin(angle) : -ratio * Math.cos(angle);
  const scale = Math.max(Math.abs(real), Math.abs(imaginary));
  const a = real / scale;
  const b = imaginary / scale;
  const denominator = a * a + b * b;
  return { re: (b * b - a * a) / denominator, im: a === 0 || b === 0 ? 0 : 2 * a * b / denominator };
}

export function seriesStubPath(z0: number, stubZ0: number, length: number, termination: StubTermination): ComplexValue[] {
  return Array.from({ length: 161 }, (_, index) => seriesStubPoint(z0, stubZ0, length * index / 160, termination));
}
