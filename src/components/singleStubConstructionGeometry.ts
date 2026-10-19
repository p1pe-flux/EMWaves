import { reflectionToImpedance } from '../domain/transmission';
import type { ComplexValue } from '../domain/transmission';
import { loadCurves } from '../domain/smithCurves';

/** Physical reflection coordinates: converting the reading never rotates the point. */
export function admittanceReflection(y: ComplexValue): ComplexValue {
  const scale = Math.max(1, Math.abs(y.re), Math.abs(y.im));
  const unit = 1 / scale;
  const real = y.re / scale;
  const imaginary = y.im / scale;
  const denominator = (unit + real) ** 2 + imaginary ** 2;
  return {
    re: (unit ** 2 - real ** 2 - imaginary ** 2) / denominator,
    im: imaginary === 0 ? 0 : -2 * unit * imaginary / denominator,
  };
}

export function reflectionAdmittance(gamma: ComplexValue): ComplexValue | null {
  // y(Γ) = z(−Γ); the shared quotient also clamps passive-disk roundoff.
  return reflectionToImpedance({ re: -gamma.re, im: -gamma.im });
}

export function rotateTowardGenerator(gamma: ComplexValue, distance: number): ComplexValue {
  const angle = -4 * Math.PI * distance;
  return {
    re: gamma.re * Math.cos(angle) - gamma.im * Math.sin(angle),
    im: gamma.re * Math.sin(angle) + gamma.im * Math.cos(angle),
  };
}

export function rotationPath(gamma: ComplexValue, distance: number): ComplexValue[] {
  const segments = Math.max(2, Math.ceil(Math.abs(distance) * 240));
  return Array.from({ length: segments + 1 }, (_, index) => rotateTowardGenerator(gamma, distance * index / segments));
}

export function cancellationPath(susceptance: number, progress: number): ComplexValue[] {
  return Array.from({ length: 81 }, (_, index) => admittanceReflection({ re: 1, im: susceptance * (1 - progress * index / 80) }));
}

/** Read admittance on the unchanged standard Smith grid at the antipodal point. */
export function chartPoint(gamma: ComplexValue, admittanceReading: boolean): ComplexValue {
  const sign = admittanceReading ? -1 : 1;
  return { re: gamma.re === 0 ? 0 : sign * gamma.re, im: gamma.im === 0 ? 0 : sign * gamma.im };
}

/** Coordinate conversion only: travel along the diameter, never along the line. */
export function reflectThroughCenter(gamma: ComplexValue, progress: number): ComplexValue {
  const scale = 1 - 2 * Math.max(0, Math.min(1, progress));
  return { re: scale === 0 || gamma.re === 0 ? 0 : scale * gamma.re, im: scale === 0 || gamma.im === 0 ? 0 : scale * gamma.im };
}

export function chartCancellationPath(susceptance: number, progress: number): ComplexValue[] {
  return cancellationPath(susceptance, progress).map((point) => chartPoint(point, true));
}

export function easeProgress(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  return p * p * (3 - 2 * p);
}

/**
 * Constant main-line-normalized susceptance on the unchanged standard grid.
 * Read its coordinates as y = g + jb: g grows from zero on the outer boundary,
 * through the exact g = 1 point, to the limiting point (+1, 0) as g → ∞.
 */
export function constantSusceptancePath(b: number): ComplexValue[] {
  return loadCurves({ re: 1, im: b })!.reactance;
}
