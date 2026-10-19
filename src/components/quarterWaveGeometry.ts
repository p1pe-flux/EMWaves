import type { ComplexValue } from '../domain/transmission';

/** Physical Γ for an actual impedance in Ω, with a positive real chart reference. */
export function quarterWaveReflection(impedance: ComplexValue | null, reference: number): ComplexValue {
  if (!Number.isFinite(reference) || reference <= 0) throw new RangeError('Use a positive finite chart reference.');
  if (impedance === null) return { re: 1, im: 0 };
  const scale = Math.max(reference, Math.abs(impedance.re), Math.abs(impedance.im));
  const r = impedance.re / scale;
  const x = impedance.im / scale;
  const c = reference / scale;
  const denominator = (r + c) ** 2 + x ** 2;
  if (denominator === 0) throw new RangeError('The impedance is outside the reliable numeric range.');
  return { re: ((r - c) * (r + c) + x ** 2) / denominator, im: 2 * x * c / denominator };
}

/** Renormalization changes coordinates, not the circuit or its physical length. */
export function interpolateReference(from: number, to: number, progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  if (p === 0) return from;
  if (p === 1) return to;
  return Math.exp((1 - p) * Math.log(from) + p * Math.log(to));
}

export function quarterWaveCircle(radius: number, progress: number): ComplexValue[] {
  return Array.from({ length: 97 }, (_, i) => {
    const angle = Math.PI * 2 * progress * i / 96;
    return { re: radius * Math.cos(angle), im: radius * Math.sin(angle) };
  });
}
