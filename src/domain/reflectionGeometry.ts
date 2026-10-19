import { impedanceToReflection, type ComplexValue } from './transmission';

export type ReflectionGeometry = {
  gamma: ComplexValue;
  magnitude: number;
  /** Principal atan2 argument in radians; null when Γ = 0. */
  phase: number | null;
};

/**
 * Geometry of Γ = (z−1)/(z+1) for a passive normalized impedance z = Z/Z0.
 * null represents the ideal open z = ∞, whose reflection coefficient is 1.
 * The existing transmission model owns validation and the complex quotient;
 * the expanded r²+x² formulas are unsuitable for extreme finite impedances.
 */
export function reflectionGeometry(z: ComplexValue | null): ReflectionGeometry {
  const gamma = z === null ? { re: 1, im: 0 } : impedanceToReflection(z);
  const magnitude = z === null || z.re === 0 ? 1 : Math.min(1, Math.hypot(gamma.re, gamma.im));
  if (gamma.re === 0 && gamma.im === 0) return { gamma, magnitude, phase: null };

  // Signed zeros must not change the short-circuit argument from +π to −π.
  const phase = Math.atan2(gamma.im === 0 ? 0 : gamma.im, gamma.re === 0 ? 0 : gamma.re);
  return { gamma, magnitude, phase: phase === 0 ? 0 : phase };
}
