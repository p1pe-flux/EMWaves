import { DomainError, type DomainParameterLabel } from './errors';
import { divideComplex } from '../math/complex';
import { impedanceToReflection, solveLine, type ComplexValue, type Load } from './transmission';

export type StubTermination = 'open' | 'short';

export type SingleStubInput = { z0: number; stubZ0: number; load: Load };

export type SingleStubBranch = {
  /** Distance from the load toward the generator, in main-line wavelengths. */
  distance: number;
  /** Normalized to Y0 = 1/Z0. */
  lineAdmittance: ComplexValue;
  /** Physical voltage reflection coefficient at the attachment point. */
  reflection: ComplexValue;
  /** Normalized stub susceptance, b_s = Z0 B_s. */
  requiredSusceptance: number;
  /** Lengths in the stub's own wavelengths, in [0, 1/2). */
  openLength: number;
  shortLength: number;
  /** Maximum final |Γ| of the open and short realizations. */
  residual: number;
};

export type SingleStubSolution = {
  status: 'solved' | 'already-matched' | 'unmatchable';
  /** null represents an ideal open load. */
  normalizedLoad: ComplexValue | null;
  /** Normalized to Y0; null represents infinite admittance. */
  loadAdmittance: ComplexValue | null;
  loadReflection: ComplexValue;
  vswr: number;
  branches: SingleStubBranch[];
  message: string;
};

export type SingleStubEvaluationInput = SingleStubInput & {
  termination: StubTermination;
  distance: number;
  stubLength: number;
};

export type SingleStubEvaluation = {
  /** All admittances are normalized to main-line Y0; null means infinite. */
  lineAdmittance: ComplexValue | null;
  /** Infinity identifies an ideal stub pole, which shorts the junction. */
  stubSusceptance: number;
  totalAdmittance: ComplexValue | null;
  /** Actual impedance in ohms; null means an ideal open circuit. */
  totalImpedance: ComplexValue | null;
  reflection: ComplexValue;
  reflectionMagnitude: number;
  vswr: number;
};

const TAU = 2 * Math.PI;
const MAX_CANONICAL_LENGTH = 0.5 - Number.EPSILON / 4;

function finite(value: number, label: DomainParameterLabel): void {
  if (!Number.isFinite(value)) throw new DomainError('value.not-finite', { label });
}

function validateStubImpedance(z0: number, stubZ0: number): number {
  finite(stubZ0, 'Stub characteristic impedance');
  if (stubZ0 <= 0) throw new DomainError('value.not-positive', { label: 'Stub characteristic impedance' });
  const ratio = z0 / stubZ0;
  if (!Number.isFinite(ratio) || ratio <= 0) throw new DomainError('numeric.range');
  return ratio;
}

function clean(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function quotient(numerator: ComplexValue, denominator: ComplexValue): ComplexValue {
  const value = divideComplex(numerator, denominator);
  if (!Number.isFinite(value.re) || !Number.isFinite(value.im)) {
    throw new DomainError('numeric.range');
  }
  return { re: clean(value.re), im: clean(value.im) };
}

function reciprocal(value: ComplexValue): ComplexValue | null {
  if (value.re === 0 && value.im === 0) return null;
  return quotient({ re: 1, im: 0 }, value);
}

function admittanceReflection(value: ComplexValue | null): ComplexValue {
  if (value === null) return { re: -1, im: 0 };
  const inverted = impedanceToReflection(value);
  return { re: clean(-inverted.re), im: clean(-inverted.im) };
}

function trig(length: number): { sin: number; cos: number } {
  const reduced = length % 0.5;
  if (reduced === 0) return { sin: 0, cos: 1 };
  if (reduced === 0.125) return { sin: Math.SQRT1_2, cos: Math.SQRT1_2 };
  if (reduced === 0.25) return { sin: 1, cos: 0 };
  if (reduced === 0.375) return { sin: Math.SQRT1_2, cos: -Math.SQRT1_2 };
  // Evaluate around the nearest electrical endpoint. Only exact endpoints are
  // poles; a finite neighboring length must retain its finite susceptance.
  if (reduced < 0.125) {
    const angle = TAU * reduced;
    return { sin: Math.sin(angle), cos: Math.cos(angle) };
  }
  if (reduced <= 0.375) {
    const offset = TAU * (reduced - 0.25);
    return { sin: Math.cos(offset), cos: -Math.sin(offset) };
  }
  const offset = TAU * (reduced - 0.5);
  return { sin: -Math.sin(offset), cos: -Math.cos(offset) };
}

/** Direct sin/cos transformation avoids tangent poles and Γ-to-y cancellation. */
function lineAdmittanceAt(z: ComplexValue | null, distance: number): ComplexValue | null {
  const { sin, cos } = trig(distance);
  if (z === null) return cos === 0 ? null : { re: 0, im: clean(sin / cos) };
  if (z.re === 0 && z.im === 0) return sin === 0 ? null : { re: 0, im: clean(-cos / sin) };

  const scale = Math.max(1, z.re, Math.abs(z.im));
  const r = z.re / scale;
  const x = z.im / scale;
  const denominator = { re: r * cos, im: x * cos + sin / scale };
  const denominatorMagnitude = Math.hypot(denominator.re, denominator.im);
  if (denominatorMagnitude === 0) {
    if (z.re > 0) throw new DomainError('numeric.range');
    return null;
  }
  const value = quotient({ re: cos / scale - x * sin, im: r * sin }, denominator);
  // Re(y(d)) = r_L / |z_L cos θ + j sin θ|². Use that identity rather
  // than subtract nearly equal terms in the complex quotient's real part.
  const rootConductance = (Math.sqrt(z.re) / scale) / denominatorMagnitude;
  value.re = rootConductance * rootConductance;
  if (!Number.isFinite(value.re)) throw new DomainError('numeric.range');
  return value;
}

function canonicalFraction(angle: number, period: number): number {
  const remainder = angle % period;
  const positive = remainder < 0 ? remainder + period : remainder;
  // A negative angle less than one ulp from zero can round to the period.
  // Keep its representative just below 1/2 rather than duplicating zero.
  return Math.min(clean(positive / TAU), MAX_CANONICAL_LENGTH);
}

function stableVswr(admittance: ComplexValue | null): number {
  if (admittance === null || admittance.re === 0) return Infinity;
  const { re: g, im: b } = admittance;
  const scale = Math.max(1, g, Math.abs(b));
  const plus = Math.hypot(1 / scale + g / scale, b / scale);
  const minus = Math.hypot(1 / scale - g / scale, b / scale);
  const root = (plus + minus) / 2 * (scale / Math.sqrt(g));
  return Math.max(1, root * root);
}

/** Evaluate any manually chosen lossless shunt-stub arrangement. */
export function evaluateSingleStub(input: SingleStubEvaluationInput): SingleStubEvaluation {
  const { z0, stubZ0, load, distance, stubLength, termination } = input;
  finite(distance, 'Distance from the load');
  finite(stubLength, 'Stub length');
  if (distance < 0 || stubLength < 0) throw new DomainError('network.negative-lengths');
  if (termination !== 'open' && termination !== 'short') throw new DomainError('stub.invalid-termination');
  const line = solveLine({ z0, load, lengthInWavelengths: 0 });
  const ratio = validateStubImpedance(z0, stubZ0);
  const lineAdmittance = lineAdmittanceAt(line.normalizedLoad, distance);
  const { sin, cos } = trig(stubLength);
  const pole = termination === 'open' ? cos === 0 : sin === 0;
  const stubSusceptance = pole ? Infinity : clean(ratio * (termination === 'open' ? sin / cos : -cos / sin));
  if (!pole && !Number.isFinite(stubSusceptance)) throw new DomainError('numeric.range');

  const totalAdmittance = pole || lineAdmittance === null ? null
    : { re: lineAdmittance.re, im: clean(lineAdmittance.im + stubSusceptance) };
  if (totalAdmittance !== null && !Number.isFinite(totalAdmittance.im)) throw new DomainError('numeric.range');
  const normalizedImpedance = totalAdmittance === null ? { re: 0, im: 0 } : reciprocal(totalAdmittance);
  const totalImpedance = normalizedImpedance === null ? null
    : { re: clean(normalizedImpedance.re * z0), im: clean(normalizedImpedance.im * z0) };
  if (totalImpedance !== null && (!Number.isFinite(totalImpedance.re) || !Number.isFinite(totalImpedance.im))) {
    throw new DomainError('numeric.range');
  }
  const reflection = admittanceReflection(totalAdmittance);
  const reflectionMagnitude = totalAdmittance === null || totalAdmittance.re === 0
    ? 1 : Math.min(1, Math.hypot(reflection.re, reflection.im));
  return { lineAdmittance, stubSusceptance, totalAdmittance, totalImpedance, reflection, reflectionMagnitude, vswr: stableVswr(totalAdmittance) };
}

/**
 * All nonperiodic shunt-stub branches. The line position and each stub length
 * repeat independently after half of their respective guided wavelength.
 */
export function solveSingleStub(input: SingleStubInput): SingleStubSolution {
  const { z0, stubZ0, load } = input;
  const line = solveLine({ z0, load, lengthInWavelengths: 0 });
  const ratio = validateStubImpedance(z0, stubZ0);
  const normalizedLoad = line.normalizedLoad;
  const loadAdmittance = normalizedLoad === null ? { re: 0, im: 0 } : reciprocal(normalizedLoad);
  const base = { normalizedLoad, loadAdmittance, loadReflection: line.loadReflection, vswr: line.vswr, branches: [] as SingleStubBranch[] };

  if (load.kind !== 'impedance' || load.resistance === 0) {
    return { ...base, status: 'unmatchable', message: 'A lossless reactive network cannot match a load that absorbs no real power. Use a load with R > 0.' };
  }
  if (load.resistance === z0 && load.reactance === 0) {
    return { ...base, status: 'already-matched', message: 'The load is already matched. No stub is needed; its position is arbitrary. A zero-susceptance open stub has length 0 modulo λs/2, and a short stub has length λs/4 modulo λs/2.' };
  }
  if (normalizedLoad === null || normalizedLoad.re <= 0) throw new DomainError('numeric.range');

  const { re: r, im: x } = normalizedLoad;
  const scale = Math.max(1, r, Math.abs(x));
  const magnitude = Math.hypot((r - 1) / scale, x / scale) * (scale / Math.sqrt(r));
  if (!Number.isFinite(magnitude) || magnitude === 0) throw new DomainError('numeric.range');

  const branches = [-1, 1].map((sign): SingleStubBranch => {
    const target = admittanceReflection({ re: 1, im: sign * magnitude });
    const angularDistance = Math.atan2(line.loadReflection.im, line.loadReflection.re) - Math.atan2(target.im, target.re);
    // Γ rotates through twice the electrical angle of the transmission line.
    const distance = canonicalFraction(angularDistance / 2, Math.PI);
    const lineAdmittance = lineAdmittanceAt(normalizedLoad, distance);
    if (lineAdmittance === null) throw new DomainError('numeric.range');
    const requiredSusceptance = clean(-lineAdmittance.im);
    const stubValue = requiredSusceptance / ratio;
    if (!Number.isFinite(stubValue)) throw new DomainError('numeric.range');
    const openLength = canonicalFraction(Math.atan2(stubValue, 1), Math.PI);
    const shortLength = Math.atan2(1, -stubValue) / TAU;
    const open = evaluateSingleStub({ ...input, termination: 'open', distance, stubLength: openLength });
    const short = evaluateSingleStub({ ...input, termination: 'short', distance, stubLength: shortLength });
    const residual = Math.max(open.reflectionMagnitude, short.reflectionMagnitude);
    if (!Number.isFinite(residual) || residual > 1e-7) throw new DomainError('numeric.range');
    return { distance, lineAdmittance, reflection: admittanceReflection(lineAdmittance), requiredSusceptance, openLength, shortLength, residual };
  }).sort((a, b) => a.distance - b.distance);

  return { ...base, status: 'solved', branches, message: 'Two distinct attachment positions occur in each half wavelength of the main line. Each has an open and a short stub realization; line position and stub length repeat independently every half wavelength.' };
}
