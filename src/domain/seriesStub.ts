import { DomainError, type DomainParameterLabel } from './errors';
import { divideComplex } from '../math/complex';
import type { StubTermination } from './singleStub';
import { impedanceToReflection, solveLine, type ComplexValue, type Load } from './transmission';

export type { StubTermination } from './singleStub';

export type SeriesStubInput = { z0: number; stubZ0: number; load: Load };

export type SeriesStubBranch = {
  /** Distance from the load toward the generator, in main-line wavelengths. */
  distance: number;
  /** Impedance normalized to the main-line Z0. */
  lineImpedance: ComplexValue;
  /** Physical voltage reflection coefficient at the attachment point. */
  reflection: ComplexValue;
  /** Normalized series reactance, x_s = X_s/Z0. */
  requiredReactance: number;
  /** Lengths in the stub's own wavelengths, in [0, 1/2). */
  openLength: number;
  shortLength: number;
  /** Maximum final |Γ| of the open and short realizations. */
  residual: number;
};

export type SeriesStubSolution = {
  status: 'solved' | 'already-matched' | 'unmatchable';
  /** null represents an ideal open load. */
  normalizedLoad: ComplexValue | null;
  loadReflection: ComplexValue;
  vswr: number;
  branches: SeriesStubBranch[];
  message: string;
};

export type SeriesStubEvaluationInput = SeriesStubInput & {
  termination: StubTermination;
  distance: number;
  stubLength: number;
};

export type SeriesStubEvaluation = {
  /** Impedance normalized to main-line Z0; null means an ideal open. */
  lineImpedance: ComplexValue | null;
  /** Infinity identifies an ideal stub pole, which opens the series junction. */
  stubReactance: number;
  /** Normalized to main-line Z0; null means an ideal open. */
  totalNormalizedImpedance: ComplexValue | null;
  /** Actual impedance in ohms; null means an ideal open. */
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
  const ratio = stubZ0 / z0;
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

/**
 * Center each octant before evaluating trigonometry. Exact quarter-wave poles
 * stay exact, while a finite length even 1e-17 from zero keeps its reactance.
 */
function trig(length: number): { sin: number; cos: number } {
  const reduced = length % 0.5;
  if (reduced === 0) return { sin: 0, cos: 1 };
  if (reduced === 0.125) return { sin: Math.SQRT1_2, cos: Math.SQRT1_2 };
  if (reduced === 0.25) return { sin: 1, cos: 0 };
  if (reduced === 0.375) return { sin: Math.SQRT1_2, cos: -Math.SQRT1_2 };
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

/** Direct sin/cos transformation avoids tangent poles and Γ-to-z cancellation. */
function lineImpedanceAt(z: ComplexValue | null, distance: number): ComplexValue | null {
  const { sin, cos } = trig(distance);
  if (z === null) return sin === 0 ? null : { re: 0, im: clean(-cos / sin) };
  if (z.re === 0 && z.im === 0) return cos === 0 ? null : { re: 0, im: clean(sin / cos) };
  if (sin === 0) return { ...z };

  const scale = Math.max(1, z.re, Math.abs(z.im));
  const r = z.re / scale;
  const x = z.im / scale;
  const denominator = { re: cos / scale - x * sin, im: r * sin };
  const denominatorMagnitude = Math.hypot(denominator.re, denominator.im);
  if (denominatorMagnitude === 0) {
    if (z.re > 0) throw new DomainError('numeric.range');
    return null;
  }
  const value = quotient({ re: r * cos, im: x * cos + sin / scale }, denominator);
  // Re(z(d)) = r_L / |cos θ + j z_L sin θ|². This avoids
  // cancellation between the two terms in a complex quotient's real part.
  const rootResistance = (Math.sqrt(z.re) / scale) / denominatorMagnitude;
  value.re = rootResistance * rootResistance;
  if (!Number.isFinite(value.re)) throw new DomainError('numeric.range');
  return value;
}

function canonicalFraction(angle: number): number {
  const remainder = angle % Math.PI;
  const positive = remainder < 0 ? remainder + Math.PI : remainder;
  // A negative angle within one ulp of zero may round up to the period.
  return Math.min(clean(positive / TAU), MAX_CANONICAL_LENGTH);
}

function stableVswr(impedance: ComplexValue | null): number {
  if (impedance === null || impedance.re === 0) return Infinity;
  const { re: r, im: x } = impedance;
  const scale = Math.max(1, r, Math.abs(x));
  const plus = Math.hypot(1 / scale + r / scale, x / scale);
  const minus = Math.hypot(1 / scale - r / scale, x / scale);
  const root = (plus + minus) / 2 * (scale / Math.sqrt(r));
  return Math.max(1, root * root);
}

/** Evaluate a lossless series-stub arrangement without changing its geometry. */
export function evaluateSeriesStub(input: SeriesStubEvaluationInput): SeriesStubEvaluation {
  const { z0, stubZ0, load, distance, stubLength, termination } = input;
  finite(distance, 'Distance from the load');
  finite(stubLength, 'Stub length');
  if (distance < 0 || stubLength < 0) throw new DomainError('network.negative-lengths');
  if (termination !== 'open' && termination !== 'short') throw new DomainError('stub.invalid-termination');
  const line = solveLine({ z0, load, lengthInWavelengths: 0 });
  const ratio = validateStubImpedance(z0, stubZ0);
  const lineImpedance = lineImpedanceAt(line.normalizedLoad, distance);
  const { sin, cos } = trig(stubLength);
  const pole = termination === 'short' ? cos === 0 : sin === 0;
  const stubReactance = pole ? Infinity : clean(ratio * (termination === 'short' ? sin / cos : -cos / sin));
  if (!pole && !Number.isFinite(stubReactance)) throw new DomainError('numeric.range');

  const totalNormalizedImpedance = pole || lineImpedance === null ? null
    : { re: lineImpedance.re, im: clean(lineImpedance.im + stubReactance) };
  if (totalNormalizedImpedance !== null && !Number.isFinite(totalNormalizedImpedance.im)) throw new DomainError('numeric.range');
  const totalImpedance = totalNormalizedImpedance === null ? null
    : { re: clean(totalNormalizedImpedance.re * z0), im: clean(totalNormalizedImpedance.im * z0) };
  if (totalImpedance !== null && (!Number.isFinite(totalImpedance.re) || !Number.isFinite(totalImpedance.im))) {
    throw new DomainError('numeric.range');
  }
  const reflection = totalNormalizedImpedance === null ? { re: 1, im: 0 } : impedanceToReflection(totalNormalizedImpedance);
  const reflectionMagnitude = totalNormalizedImpedance === null || totalNormalizedImpedance.re === 0
    ? 1 : Math.min(1, Math.hypot(reflection.re, reflection.im));
  return { lineImpedance, stubReactance, totalNormalizedImpedance, totalImpedance, reflection, reflectionMagnitude, vswr: stableVswr(totalNormalizedImpedance) };
}

/**
 * Synthesize both intersections of the SWR circle and Re(z)=1 on the standard
 * impedance grid. Main-line positions and stub lengths repeat independently.
 */
export function solveSeriesStub(input: SeriesStubInput): SeriesStubSolution {
  const { z0, stubZ0, load } = input;
  const line = solveLine({ z0, load, lengthInWavelengths: 0 });
  const ratio = validateStubImpedance(z0, stubZ0);
  const normalizedLoad = line.normalizedLoad;
  const base = { normalizedLoad, loadReflection: line.loadReflection, vswr: stableVswr(normalizedLoad), branches: [] as SeriesStubBranch[] };

  if (load.kind !== 'impedance' || load.resistance === 0) {
    return { ...base, status: 'unmatchable', message: 'A lossless reactive network cannot match a load that absorbs no real power. Use a load with R > 0.' };
  }
  if (load.resistance === z0 && load.reactance === 0) {
    return { ...base, status: 'already-matched', message: 'The load is already matched. No series stub is needed; its position is arbitrary. A zero-reactance short stub has length 0 modulo λs/2, and an open stub has length λs/4 modulo λs/2.' };
  }
  if (normalizedLoad === null || normalizedLoad.re <= 0) throw new DomainError('numeric.range');

  const { re: r, im: x } = normalizedLoad;
  const rootResistance = Math.sqrt(r);
  const magnitude = Math.hypot((r - 1) / rootResistance, x / rootResistance);
  if (!Number.isFinite(magnitude) || magnitude === 0) throw new DomainError('numeric.range');

  const branches = [-1, 1].map((sign): SeriesStubBranch => {
    const target = impedanceToReflection({ re: 1, im: sign * magnitude });
    const angularDistance = Math.atan2(line.loadReflection.im, line.loadReflection.re) - Math.atan2(target.im, target.re);
    // Physical Γ rotates clockwise through twice the line's electrical angle.
    const distance = canonicalFraction(angularDistance / 2);
    const lineImpedance = lineImpedanceAt(normalizedLoad, distance);
    if (lineImpedance === null) throw new DomainError('numeric.range');
    const requiredReactance = clean(-lineImpedance.im);
    const shortLength = canonicalFraction(Math.atan2(requiredReactance, ratio));
    const openLength = canonicalFraction(Math.atan2(ratio, -requiredReactance));
    const open = evaluateSeriesStub({ ...input, termination: 'open', distance, stubLength: openLength });
    const short = evaluateSeriesStub({ ...input, termination: 'short', distance, stubLength: shortLength });
    const residual = Math.max(open.reflectionMagnitude, short.reflectionMagnitude);
    if (!Number.isFinite(residual) || residual > 1e-7) throw new DomainError('numeric.range');
    return { distance, lineImpedance, reflection: impedanceToReflection(lineImpedance), requiredReactance, openLength, shortLength, residual };
  }).sort((a, b) => a.distance - b.distance);

  return { ...base, status: 'solved', branches, message: 'Two distinct attachment positions occur in each half wavelength of the main line. Each has an open and a short stub realization; line position and stub length repeat independently every half wavelength.' };
}
