import { applyLCStage } from '../domain/lcMatching';
import type { LCMatchingTopology } from '../domain/lcMatching';
import { toLumpedTopology, type LumpedMatchingTopology } from '../domain/lumpedMatching';
import type { ComplexValue } from '../domain/transmission';
import { impedanceToReflection } from '../domain/transmission';

export type LCReading = 'impedance' | 'admittance';
export type LCConnection = 'series' | 'parallel';
export interface LCLocus { center: ComplexValue; radius: number }
export const clampLCProgress = (value: number) => Math.max(0, Math.min(1, value));
export const easeLCProgress = (value: number) => { const t = clampLCProgress(value); return t * t * (3 - 2 * t); };

/** Circuit order is source→load; the first calculated element is at the load. */
export function lcMatchingReadings(topology: LCMatchingTopology | LumpedMatchingTopology): { first: LCReading; second: LCReading } {
  const [source, load] = toLumpedTopology(topology).elements;
  return { first: load.connection === 'series' ? 'impedance' : 'admittance', second: source.connection === 'series' ? 'impedance' : 'admittance' };
}

export function lcReciprocal(value: ComplexValue | null): ComplexValue | null {
  if (value === null) return { re: 0, im: 0 };
  const scale = Math.max(Math.abs(value.re), Math.abs(value.im));
  if (scale === 0) return null;
  const re = value.re / scale;
  const im = value.im / scale;
  const norm = re * re + im * im;
  return { re: re / norm / scale, im: -im / norm / scale };
}

export function lcReadingValue(impedance: ComplexValue | null, reading: LCReading): ComplexValue | null {
  return reading === 'impedance' ? impedance : lcReciprocal(impedance);
}

/** Constant-r/g circle in physical Γ: resistance is right, conductance left. */
export function lcConstantRealLocus(real: number, reading: LCReading = 'impedance'): LCLocus {
  const sign = reading === 'impedance' ? 1 : -1;
  return { center: { re: sign * real / (real + 1), im: 0 }, radius: 1 / (real + 1) };
}

/** Reading changes emphasize the other grid, with every physical Γ fixed. */
export function lcGridFocus(from: LCReading, to: LCReading = from, progress = 1): number {
  const initial = from === 'admittance' ? 1 : 0;
  const final = to === 'admittance' ? 1 : 0;
  return initial + (final - initial) * easeLCProgress(progress);
}

export function lcCirclePath(locus: LCLocus, progress = 1): ComplexValue[] {
  return Array.from({ length: 121 }, (_, index) => {
    const angle = 2 * Math.PI * clampLCProgress(progress) * index / 120;
    return { re: locus.center.re + locus.radius * Math.cos(angle), im: locus.center.im + locus.radius * Math.sin(angle) };
  });
}

/** Interpolate x or b, never L/C: zero added series-C or shunt-L means ∞. */
export function lcStagePath(impedance: ComplexValue | null, connection: LCConnection, normalizedValue: number, progress = 1): ComplexValue[] {
  return Array.from({ length: 121 }, (_, index) => {
    const z = applyLCStage(impedance, connection, normalizedValue * clampLCProgress(progress) * index / 120);
    return z === null ? { re: 1, im: 0 } : impedanceToReflection(z);
  });
}
