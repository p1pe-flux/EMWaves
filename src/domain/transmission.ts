import { DomainError, type DomainParameterLabel, type DomainValueLabel } from './errors';
import { divideComplex, multiplyComplex, type ComplexValue } from '../math/complex';
export type { ComplexValue } from '../math/complex';

export type Load =
  | { kind: 'impedance'; resistance: number; reactance: number }
  | { kind: 'open' }
  | { kind: 'short' };

export type LineInput = {
  z0: number;
  load: Load;
  lengthInWavelengths: number;
};

export type LineSolution = {
  /** Normalized impedance; null represents an ideal open circuit. */
  normalizedLoad: ComplexValue | null;
  loadReflection: ComplexValue;
  inputReflection: ComplexValue;
  /** Ohms; null represents an infinite impedance. */
  inputImpedance: ComplexValue | null;
  reflectionMagnitude: number;
  /** Infinity for a fully reflecting load. */
  vswr: number;
  /** Decibels; Infinity for a perfectly matched load. */
  returnLossDb: number;
};

// Exact quarter/half-wave rotations acquire errors of a few machine epsilons.
const ROUND_OFF = 8 * Number.EPSILON;

function assertFinite(value: number, label: DomainParameterLabel): void {
  if (!Number.isFinite(value)) {
    throw new DomainError('value.not-finite', { label });
  }
}

function assertComplex(value: ComplexValue, label: DomainValueLabel): void {
  assertFinite(value.re, `${label}: real part`);
  assertFinite(value.im, `${label}: imaginary part`);
}

/** Convert a passive, normalized impedance z = Z/Z0 to its reflection coefficient. */
export function impedanceToReflection(z: ComplexValue): ComplexValue {
  assertComplex(z, 'Normalized impedance');
  if (z.re < 0) throw new DomainError('value.negative', { label: 'Resistance' });

  // Scale before subtraction/addition, so large finite impedances do not overflow.
  const scale = Math.max(1, z.re, Math.abs(z.im));
  const numerator = { re: z.re / scale - 1 / scale, im: z.im / scale };
  const denominator = { re: z.re / scale + 1 / scale, im: z.im / scale };
  return divideComplex(numerator, denominator);
}

/** Convert Γ to normalized impedance. The pole Γ = 1 is an ideal open circuit. */
export function reflectionToImpedance(gamma: ComplexValue): ComplexValue | null {
  assertComplex(gamma, 'Reflection coefficient');
  if (Math.hypot(gamma.re, gamma.im) > 1 + ROUND_OFF) {
    throw new DomainError('reflection.outside-passive-disk');
  }
  if (Math.hypot(1 - gamma.re, gamma.im) <= ROUND_OFF) return null;

  const value = divideComplex({ re: 1 + gamma.re, im: gamma.im }, { re: 1 - gamma.re, im: -gamma.im });
  // Accepted Γ is passive. Near Γ=1, roundoff in its disk coordinates is
  // amplified by 1/|1−Γ|², so the apparent negative resistance need not be tiny.
  value.re = Math.max(0, value.re);
  assertComplex(value, 'Calculated impedance');
  return value;
}

/** Direct transfer preserves finite loads when their rounded Γ lies on |Γ|=1. */
function lineImpedanceAt(z: ComplexValue | null, length: number): ComplexValue | null {
  const reduced = length % 0.5;
  if (reduced === 0) return z === null ? null : { ...z };
  let sin: number;
  let cos: number;
  if (reduced === 0.125 || reduced === 0.375) {
    sin = Math.SQRT1_2;
    cos = reduced === 0.125 ? Math.SQRT1_2 : -Math.SQRT1_2;
  } else if (reduced === 0.25) {
    sin = 1;
    cos = 0;
  } else if (reduced < 0.125) {
    sin = Math.sin(2 * Math.PI * reduced);
    cos = Math.cos(2 * Math.PI * reduced);
  } else if (reduced <= 0.375) {
    const offset = 2 * Math.PI * (reduced - 0.25);
    sin = Math.cos(offset);
    cos = -Math.sin(offset);
  } else {
    const offset = 2 * Math.PI * (reduced - 0.5);
    sin = -Math.sin(offset);
    cos = -Math.cos(offset);
  }
  if (z === null) return { re: 0, im: -cos / sin };
  if (z.re === 0 && z.im === 0) return cos === 0 ? null : { re: 0, im: sin / cos };
  const scale = Math.max(1, z.re, Math.abs(z.im));
  const r = z.re / scale, x = z.im / scale;
  const denominator = { re: cos / scale - x * sin, im: r * sin };
  const magnitude = Math.hypot(denominator.re, denominator.im);
  if (magnitude === 0) {
    if (z.re > 0) throw new DomainError('numeric.range');
    return null;
  }
  const result = divideComplex({ re: r * cos, im: x * cos + sin / scale }, denominator);
  const rootResistance = (Math.sqrt(z.re) / scale) / magnitude;
  result.re = rootResistance * rootResistance;
  assertComplex(result, 'Input impedance outside the numeric range');
  if (z.re > 0 && result.re === 0) throw new DomainError('numeric.range');
  return result;
}

function stableVswr(z: ComplexValue | null): number {
  if (z === null || z.re === 0) return Infinity;
  const scale = Math.max(1, z.re, Math.abs(z.im));
  const plus = Math.hypot(z.re / scale + 1 / scale, z.im / scale);
  const minus = Math.hypot(z.re / scale - 1 / scale, z.im / scale);
  const root = (plus + minus) / 2 * (scale / Math.sqrt(z.re));
  return Math.max(1, root * root);
}

/** Lossless line, measured from the load toward the generator; exp(+jωt) convention. */
export function solveLine({ z0, load, lengthInWavelengths }: LineInput): LineSolution {
  assertFinite(z0, 'Characteristic impedance');
  assertFinite(lengthInWavelengths, 'Line length');
  if (z0 <= 0) throw new DomainError('value.not-positive', { label: 'Characteristic impedance' });
  if (lengthInWavelengths < 0) throw new DomainError('value.negative', { label: 'Line length' });

  let normalizedLoad: ComplexValue | null;
  let loadReflection: ComplexValue;
  if (load.kind === 'open') {
    normalizedLoad = null;
    loadReflection = { re: 1, im: 0 };
  } else if (load.kind === 'short') {
    normalizedLoad = { re: 0, im: 0 };
    loadReflection = { re: -1, im: 0 };
  } else {
    assertFinite(load.resistance, 'Resistance');
    assertFinite(load.reactance, 'Reactance');
    if (load.resistance < 0) throw new DomainError('value.negative', { label: 'Resistance' });
    normalizedLoad = { re: load.resistance / z0, im: load.reactance / z0 };
    assertComplex(normalizedLoad, 'Normalized impedance outside the numeric range');
    if ((load.resistance > 0 && normalizedLoad.re === 0) || (load.reactance !== 0 && normalizedLoad.im === 0)) {
      throw new DomainError('numeric.range');
    }
    loadReflection = impedanceToReflection(normalizedLoad);
  }

  // The impedance repeats every λ/2. Reduce before multiplying to avoid angle overflow.
  const phase = -4 * Math.PI * (lengthInWavelengths % 0.5);
  const cos = Math.cos(phase);
  const sin = Math.sin(phase);
  const rotation = { re: Math.abs(cos) < ROUND_OFF ? 0 : cos, im: Math.abs(sin) < ROUND_OFF ? 0 : sin };
  const inputReflection = multiplyComplex(loadReflection, rotation);
  const normalizedInput = lineImpedanceAt(normalizedLoad, lengthInWavelengths);
  const inputImpedance = normalizedInput === null
    ? null
    : multiplyComplex(normalizedInput, z0);
  if (inputImpedance !== null) {
    assertComplex(inputImpedance, 'Input impedance outside the numeric range');
    if (normalizedInput!.re > 0 && inputImpedance.re === 0) throw new DomainError('numeric.range');
  }

  const fullyReflecting = normalizedLoad === null || normalizedLoad.re === 0;
  const reflectionMagnitude = fullyReflecting ? 1 : Math.min(1, Math.hypot(loadReflection.re, loadReflection.im));
  const vswr = stableVswr(normalizedLoad);
  const returnLossDb = reflectionMagnitude === 0 ? Infinity : -20 * Math.log10(reflectionMagnitude);

  return {
    normalizedLoad,
    loadReflection,
    inputReflection,
    inputImpedance,
    reflectionMagnitude,
    vswr,
    returnLossDb: Object.is(returnLossDb, -0) ? 0 : returnLossDb,
  };
}
