import { DomainError } from './errors';
const TRAVERSAL_DURATION_MS = 8000;

function assertLineLength(totalLength: number): void {
  if (!Number.isFinite(totalLength) || totalLength < 0) {
    throw new DomainError('line.invalid-total-length');
  }
}

/** Parse a total line length in wavelengths, retaining zero as a valid length. */
export function parseLineLength(text: string): number {
  if (!text.trim()) throw new DomainError('line.missing-total-length');
  const length = Number(text);
  assertLineLength(length);
  return length === 0 ? 0 : length;
}

/** Constrain a finite load-to-generator position to the current line segment. */
export function clampLinePosition(distance: number, totalLength: number): number {
  assertLineLength(totalLength);
  if (!Number.isFinite(distance)) throw new DomainError('line.invalid-position');
  return Math.max(0, Math.min(totalLength, distance));
}

/**
 * Advance at a constant speed of totalLength/8000 wavelengths per millisecond.
 * Starting at the load takes eight seconds to reach the generator; starting
 * farther along takes the corresponding fraction of those eight seconds.
 */
export function advanceLinePosition(distance: number, totalLength: number, elapsedMs: number): number {
  const current = clampLinePosition(distance, totalLength);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new DomainError('line.invalid-elapsed-time');
  }
  if (totalLength === 0 || elapsedMs === 0) return current;
  if (elapsedMs >= TRAVERSAL_DURATION_MS) return totalLength;
  const increment = totalLength * (elapsedMs / TRAVERSAL_DURATION_MS);
  // Compare to the remaining distance before addition to avoid overflowing a
  // large finite length when the next frame would pass the generator.
  return increment >= totalLength - current ? totalLength : current + increment;
}
