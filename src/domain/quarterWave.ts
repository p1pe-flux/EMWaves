import { DomainError, type DomainParameterLabel } from './errors';
import { divideComplex } from '../math/complex';
import { impedanceToReflection, solveLine, type ComplexValue, type Load } from './transmission';

export type QuarterWaveInput = { z0: number; load: Load };

export type QuarterWaveBranch = {
  /** Load-to-transformer distance in main-line wavelengths. */
  distance: number;
  /** Real transformed load resistance, in ohms. */
  resistance: number;
  /** Physical reflection coefficient in the main-line reference. */
  reflection: ComplexValue;
  transformerZ0: number;
  /** Transformer length in its own wavelengths. */
  transformerLength: number;
  /** Final main-line |Γ|. */
  residual: number;
};

export type QuarterWaveSolution = {
  status: 'solved' | 'already-matched' | 'unmatchable';
  normalizedLoad: ComplexValue | null;
  loadReflection: ComplexValue;
  vswr: number;
  branches: QuarterWaveBranch[];
  message: string;
};

export type QuarterWaveEvaluationInput = QuarterWaveInput & {
  distance: number;
  transformerZ0: number;
  transformerLength: number;
};

export type QuarterWaveEvaluation = {
  /** Actual impedances in ohms; null denotes an ideal open circuit. */
  lineImpedance: ComplexValue | null;
  inputImpedance: ComplexValue | null;
  /** The final reflection and VSWR use the main-line Z0 reference. */
  reflection: ComplexValue;
  reflectionMagnitude: number;
  vswr: number;
  /** These coefficients use the transformer's own characteristic impedance. */
  transformerLoadReflection: ComplexValue;
  transformerInputReflection: ComplexValue;
};

const TAU = 2 * Math.PI;
const LAST_CANONICAL_DISTANCE = 0.5 - Number.EPSILON / 4;

function clean(value: number): number { return Object.is(value, -0) ? 0 : value; }

function finite(value: number, label: DomainParameterLabel): void {
  if (!Number.isFinite(value)) throw new DomainError('value.not-finite', { label });
}

function finiteComplex(value: ComplexValue): ComplexValue {
  if (!Number.isFinite(value.re) || !Number.isFinite(value.im)) throw new DomainError('numeric.range');
  return { re: clean(value.re), im: clean(value.im) };
}

function quotient(numerator: ComplexValue, denominator: ComplexValue): ComplexValue {
  return finiteComplex(divideComplex(numerator, denominator));
}

function normalized(value: ComplexValue | null, z0: number): ComplexValue | null {
  if (value === null) return null;
  const result = finiteComplex({ re: value.re / z0, im: value.im / z0 });
  if (value.re > 0 && result.re === 0) throw new DomainError('numeric.range');
  return result;
}

function physical(value: ComplexValue | null, z0: number): ComplexValue | null {
  if (value === null) return null;
  const result = finiteComplex({ re: value.re * z0, im: value.im * z0 });
  if (value.re > 0 && result.re === 0) throw new DomainError('numeric.range');
  return result;
}

function trig(length: number): { sin: number; cos: number } {
  const reduced = length % 0.5;
  if (reduced === 0) return { sin: 0, cos: 1 };
  if (reduced === 0.125) return { sin: Math.SQRT1_2, cos: Math.SQRT1_2 };
  if (reduced === 0.25) return { sin: 1, cos: 0 };
  if (reduced === 0.375) return { sin: Math.SQRT1_2, cos: -Math.SQRT1_2 };
  if (reduced < 0.125) return { sin: Math.sin(TAU * reduced), cos: Math.cos(TAU * reduced) };
  if (reduced <= 0.375) {
    const offset = TAU * (reduced - 0.25);
    return { sin: Math.cos(offset), cos: -Math.sin(offset) };
  }
  const offset = TAU * (reduced - 0.5);
  return { sin: -Math.sin(offset), cos: -Math.cos(offset) };
}

/** Normalized lossless transfer with explicit open/short limits, never tan θ. */
function transfer(z: ComplexValue | null, length: number): ComplexValue | null {
  const { sin, cos } = trig(length);
  if (z === null) return sin === 0 ? null : { re: 0, im: clean(-cos / sin) };
  if (z.re === 0 && z.im === 0) return cos === 0 ? null : { re: 0, im: clean(sin / cos) };
  const scale = Math.max(1, z.re, Math.abs(z.im));
  const r = z.re / scale;
  const x = z.im / scale;
  const denominator = { re: cos / scale - x * sin, im: r * sin };
  const magnitude = Math.hypot(denominator.re, denominator.im);
  if (magnitude === 0) {
    if (z.re > 0) throw new DomainError('numeric.range');
    return null;
  }
  const result = quotient({ re: r * cos, im: x * cos + sin / scale }, denominator);
  // Re z(ℓ) = r_L / |cos θ + j z_L sin θ|² avoids cancellation in
  // the real part of a nearly reactive complex quotient.
  const rootResistance = (Math.sqrt(z.re) / scale) / magnitude;
  result.re = rootResistance * rootResistance;
  if (!Number.isFinite(result.re) || (z.re > 0 && result.re === 0)) throw new DomainError('numeric.range');
  return finiteComplex(result);
}

function reflection(z: ComplexValue | null): ComplexValue {
  return z === null ? { re: 1, im: 0 } : impedanceToReflection(z);
}

function rotate(gamma: ComplexValue, length: number): ComplexValue {
  const reduced = length % 0.5;
  if (reduced === 0) return finiteComplex({ ...gamma });
  if (reduced === 0.125) return finiteComplex({ re: gamma.im, im: -gamma.re });
  if (reduced === 0.25) return finiteComplex({ re: -gamma.re, im: -gamma.im });
  if (reduced === 0.375) return finiteComplex({ re: -gamma.im, im: gamma.re });
  const phase = -4 * Math.PI * reduced;
  return finiteComplex({ re: gamma.re * Math.cos(phase) - gamma.im * Math.sin(phase), im: gamma.re * Math.sin(phase) + gamma.im * Math.cos(phase) });
}

function vswr(z: ComplexValue | null): number {
  if (z === null || z.re === 0) return Infinity;
  const scale = Math.max(1, z.re, Math.abs(z.im));
  const plus = Math.hypot(1 / scale + z.re / scale, z.im / scale);
  const minus = Math.hypot(1 / scale - z.re / scale, z.im / scale);
  const root = (plus + minus) / 2 * (scale / Math.sqrt(z.re));
  return Math.max(1, root * root);
}

function distanceTo(loadAngle: number, targetAngle: number): number {
  const difference = (loadAngle - targetAngle) % TAU;
  const clockwise = difference < 0 ? difference + TAU : difference;
  return Math.min(clean(clockwise / (4 * Math.PI)), LAST_CANONICAL_DISTANCE);
}

function baseLine(input: QuarterWaveInput) {
  const line = solveLine({ ...input, lengthInWavelengths: 0 });
  if (input.load.kind === 'impedance' && input.load.resistance > 0 && line.normalizedLoad?.re === 0) {
    throw new DomainError('numeric.range');
  }
  return line;
}

/** Evaluate a main-line section followed by a transformer of arbitrary length. */
export function evaluateQuarterWave(input: QuarterWaveEvaluationInput): QuarterWaveEvaluation {
  const { z0, distance, transformerZ0, transformerLength } = input;
  const line = baseLine(input);
  finite(distance, 'Load-to-transformer distance');
  finite(transformerLength, 'Transformer length');
  finite(transformerZ0, 'Transformer characteristic impedance');
  if (distance < 0 || transformerLength < 0) throw new DomainError('transformer.negative-lengths');
  if (transformerZ0 <= 0) throw new DomainError('value.not-positive', { label: 'Transformer characteristic impedance' });

  const lineImpedance = physical(transfer(line.normalizedLoad, distance), z0);
  const transformerLoad = normalized(lineImpedance, transformerZ0);
  const transformerInput = transfer(transformerLoad, transformerLength);
  const inputImpedance = physical(transformerInput, transformerZ0);
  const mainInput = normalized(inputImpedance, z0);
  const finalReflection = reflection(mainInput);
  const reflectionMagnitude = mainInput === null || mainInput.re === 0 ? 1 : Math.min(1, Math.hypot(finalReflection.re, finalReflection.im));
  const transformerLoadReflection = reflection(transformerLoad);
  return {
    lineImpedance, inputImpedance, reflection: finalReflection, reflectionMagnitude, vswr: vswr(mainInput),
    transformerLoadReflection, transformerInputReflection: rotate(transformerLoadReflection, transformerLength),
  };
}

/** Both real-axis intersections in the first half wavelength of the main line. */
export function solveQuarterWave(input: QuarterWaveInput): QuarterWaveSolution {
  const line = baseLine(input);
  const base = { normalizedLoad: line.normalizedLoad, loadReflection: line.loadReflection, vswr: vswr(line.normalizedLoad) };
  if (input.load.kind !== 'impedance' || input.load.resistance === 0) {
    return { ...base, status: 'unmatchable', branches: [], message: 'A lossless network cannot match a load that absorbs no real power. Use a load with R > 0.' };
  }
  if (input.load.resistance === input.z0 && input.load.reactance === 0) {
    return {
      ...base, status: 'already-matched',
      branches: [{ distance: 0, resistance: input.z0, reflection: { re: 0, im: 0 }, transformerZ0: input.z0, transformerLength: 0.25, residual: 0 }],
      message: 'The load is already matched. Its placement is arbitrary, and a section with Zt = Z0 preserves the match at any length. The displayed quarter-wave section is one canonical realization.',
    };
  }
  const radius = Math.hypot(line.loadReflection.re, line.loadReflection.im);
  if (radius === 0) throw new DomainError('numeric.range');
  const angle = Math.atan2(line.loadReflection.im, line.loadReflection.re);
  const branches = [1, -1].map((sign): QuarterWaveBranch => {
    const distance = distanceTo(angle, sign === 1 ? 0 : Math.PI);
    const transformed = physical(transfer(line.normalizedLoad, distance), input.z0);
    if (transformed === null || transformed.re <= 0) throw new DomainError('numeric.range');
    const resistance = transformed.re;
    const transformerZ0 = Math.sqrt(input.z0) * Math.sqrt(resistance);
    if (!Number.isFinite(transformerZ0) || transformerZ0 <= 0) throw new DomainError('numeric.range');
    const evaluated = evaluateQuarterWave({ ...input, distance, transformerZ0, transformerLength: 0.25 });
    if (!Number.isFinite(evaluated.reflectionMagnitude) || evaluated.reflectionMagnitude > 1e-7) throw new DomainError('numeric.range');
    return { distance, resistance, reflection: { re: sign * radius, im: 0 }, transformerZ0, transformerLength: 0.25, residual: evaluated.reflectionMagnitude };
  }).sort((a, b) => a.distance - b.distance);
  return { ...base, status: 'solved', branches, message: 'Move to either real-axis intersection, then use a quarter-wave transformer with Zt = √(Z0 Ri). Main-line positions and transformer lengths repeat independently every half of their respective wavelength.' };
}
