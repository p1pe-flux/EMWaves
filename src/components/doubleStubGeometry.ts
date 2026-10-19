import type { ComplexValue } from '../domain/transmission';
import { admittanceReflection, chartPoint, rotateTowardGenerator } from './singleStubConstructionGeometry';

/** Printed admittance reading on the unchanged impedance grid: p_y = −Γ. */
export function doubleStubChartPoint(y: ComplexValue | null): ComplexValue {
  return y === null ? { re: 1, im: 0 } : chartPoint(admittanceReflection(y), true);
}
/** Move the entire g=1 circle toward the load, counterclockwise by 4πs. */
export function transportedUnityCircle(separation: number, progress = 1): { center: ComplexValue; radius: number } {
  const effective = separation * Math.max(0, Math.min(1, progress));
  const angle = 4 * Math.PI * (effective % 0.5);
  return { center: { re: 0.5 * Math.cos(angle), im: 0.5 * Math.sin(angle) }, radius: 0.5 };
}
export function conductanceCircle(g: number): { center: ComplexValue; radius: number } {
  return { center: { re: g / (1 + g), im: 0 }, radius: 1 / (1 + g) };
}
export function doubleStubCirclePath(center: ComplexValue, radius: number, progress = 1): ComplexValue[] {
  return Array.from({ length: 121 }, (_, i) => {
    const angle = 2 * Math.PI * progress * i / 120;
    return { re: center.re + radius * Math.cos(angle), im: center.im + radius * Math.sin(angle) };
  });
}
/** Physical shunt addition: g stays fixed, b changes; Smith coordinates do not add. */
export function doubleStubAdditionPath(y: ComplexValue, susceptance: number, progress = 1): ComplexValue[] {
  return Array.from({ length: 81 }, (_, i) => doubleStubChartPoint({ re: y.re, im: y.im + susceptance * progress * i / 80 }));
}
export function doubleStubPropagationPath(y: ComplexValue, separation: number, progress = 1): ComplexValue[] {
  return propagationTrail(doubleStubChartPoint(y), separation, progress);
}

/** A bounded trail ending at the exact physical plane, even after many turns. */
function propagationTrail(start: ComplexValue, distance: number, progress: number, direction: 1 | -1 = 1): ComplexValue[] {
  const traveled = distance * Math.max(0, Math.min(1, progress));
  const visible = Math.min(traveled, 0.5);
  const endpoint = traveled % 0.5;
  // For long lines draw the last complete revolution, rather than aliasing many
  // revolutions onto fixed samples. The last point remains the physical reading.
  return Array.from({ length: 81 }, (_, index) => {
    const length = traveled <= 0.5 ? traveled * index / 80 : endpoint - visible * (1 - index / 80);
    const point = rotateTowardGenerator(start, direction * (length % 0.5));
    return { re: point.re === 0 ? 0 : point.re, im: point.im === 0 ? 0 : point.im };
  });
}
/** Counterclockwise transport of the g=1 circle center, with at most one turn. */
export function transportedUnityCenterPath(separation: number, progress = 1): ComplexValue[] {
  return propagationTrail({ re: 0.5, im: 0 }, separation, progress, -1);
}
/** From the load to Stub 2, read admittance at p_y = −Γ while moving clockwise. */
export function doubleStubLoadPath(loadReflection: ComplexValue, distance: number, progress = 1): ComplexValue[] {
  return propagationTrail(chartPoint(loadReflection, true), distance, progress);
}
/** Main-line-normalized b for an isolated stub, including its exact pole. */
export function doubleStubSusceptance(z0: number, stubZ0: number, length: number, termination: 'open' | 'short'): number {
  const reduced = length % 0.5;
  if (reduced === 0) return termination === 'short' ? Infinity : 0;
  if (reduced === 0.25) return termination === 'open' ? Infinity : 0;
  const angle = 2 * Math.PI * reduced, sin = Math.sin(angle), cos = Math.cos(angle);
  return termination === 'open' ? z0 / stubZ0 * sin / cos : -z0 / stubZ0 * cos / sin;
}
export function doubleStubIsolatedPoint(z0: number, stubZ0: number, length: number, termination: 'open' | 'short'): ComplexValue {
  const b = doubleStubSusceptance(z0, stubZ0, length, termination);
  return Number.isFinite(b) ? doubleStubChartPoint({ re: 0, im: b }) : { re: 1, im: 0 };
}
export function doubleStubIsolatedPath(z0: number, stubZ0: number, length: number, termination: 'open' | 'short'): ComplexValue[] {
  return Array.from({ length: 121 }, (_, i) => doubleStubIsolatedPoint(z0, stubZ0, length * i / 120, termination));
}
