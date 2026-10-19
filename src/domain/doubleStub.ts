import { DomainError, type DomainParameterLabel } from './errors';
import { divideComplex } from '../math/complex';
import { impedanceToReflection, solveLine, type ComplexValue, type Load } from './transmission';
import type { StubTermination } from './singleStub';

/** Generator — stub 1 — d₂ — stub 2 — d₁ — load. */
export type DoubleStubInput = {
  z0: number;
  load: Load;
  /** d₁: main-line wavelengths from the load to the right-hand stub 2. */
  distance: number;
  /** d₂: main-line wavelengths between stub 2 and the left-hand stub 1. */
  separation: number;
  stub1Z0: number;
  stub2Z0: number;
};

export type DoubleStubStubSolution = {
  /** Susceptance normalized to the main line's Y0 = 1/Z0. */
  susceptance: number;
  /** Canonical lengths in this stub's own wavelength, in [0, 1/2). */
  openLength: number;
  shortLength: number;
};

export type DoubleStubBranch = {
  /** Immediately after adding right-hand stub 2, looking toward the load. */
  rightAfter: ComplexValue;
  /** Immediately before adding left-hand stub 1. Its conductance is unity. */
  leftBefore: ComplexValue;
  stub1: DoubleStubStubSolution;
  stub2: DoubleStubStubSolution;
  /** Largest final |Γ| among all four open/short termination combinations. */
  residual: number;
};

export type DoubleStubLocus = { center: ComplexValue; radius: number };

export type DoubleStubSolution = {
  status: 'solved' | 'forbidden' | 'unmatchable' | 'continuous';
  normalizedLoad: ComplexValue | null;
  /** Every admittance uses main-line Y0; null denotes infinite admittance. */
  loadAdmittance: ComplexValue | null;
  loadReflection: ComplexValue;
  rightAdmittance: ComplexValue | null;
  maxConductance: number;
  /** Printed-admittance g = 1 circle transported back to the stub-2 plane. */
  locus: DoubleStubLocus;
  branches: DoubleStubBranch[];
  message: string;
  /** Half-wave family: b1 + b2 equals this normalized susceptance. */
  family?: { totalSusceptance: number };
};

export type DoubleStubEvaluationInput = DoubleStubInput & {
  termination1: StubTermination;
  termination2: StubTermination;
  length1: number;
  length2: number;
};

export type DoubleStubEvaluation = {
  rightAdmittance: ComplexValue | null;
  rightAfter: ComplexValue | null;
  leftBefore: ComplexValue | null;
  totalAdmittance: ComplexValue | null;
  /** Actual input impedance in ohms; null denotes an ideal open circuit. */
  inputImpedance: ComplexValue | null;
  /** Physical voltage reflection coefficient in the main-line reference. */
  reflection: ComplexValue;
  reflectionMagnitude: number;
  vswr: number;
  /** Infinity denotes an exact stub pole, which shorts its junction. */
  stub1Susceptance: number;
  stub2Susceptance: number;
};

const TAU = 2 * Math.PI;
const BOUNDARY_ROUND_OFF = 16 * Number.EPSILON;
const LAST_CANONICAL_LENGTH = 0.5 - Number.EPSILON / 4;

function clean(value: number): number { return Object.is(value, -0) ? 0 : value; }

function finite(value: number, label: DomainParameterLabel): void {
  if (!Number.isFinite(value)) throw new DomainError('value.not-finite', { label });
}

function nonnegative(value: number, label: DomainParameterLabel): void {
  finite(value, label);
  if (value < 0) throw new DomainError('value.negative', { label });
}

function finiteComplex(value: ComplexValue): ComplexValue {
  if (!Number.isFinite(value.re) || !Number.isFinite(value.im)) throw new DomainError('numeric.range-with-separation');
  return { re: clean(value.re), im: clean(value.im) };
}

function quotient(a: ComplexValue, b: ComplexValue): ComplexValue {
  return finiteComplex(divideComplex(a, b));
}

/** Exact electrical endpoints; nearby finite lengths retain their finite values. */
function trig(length: number): { sin: number; cos: number } {
  const reduced = length % 0.5;
  if (reduced === 0) return { sin: 0, cos: 1 };
  if (reduced === 0.25) return { sin: 1, cos: 0 };
  if (reduced === 0.125) return { sin: Math.SQRT1_2, cos: Math.SQRT1_2 };
  if (reduced === 0.375) return { sin: Math.SQRT1_2, cos: -Math.SQRT1_2 };
  if (reduced < 0.125) return { sin: Math.sin(TAU * reduced), cos: Math.cos(TAU * reduced) };
  if (reduced <= 0.375) {
    const offset = TAU * (reduced - 0.25);
    return { sin: Math.cos(offset), cos: -Math.sin(offset) };
  }
  const offset = TAU * (reduced - 0.5);
  return { sin: -Math.sin(offset), cos: -Math.cos(offset) };
}

function stubRatio(z0: number, stubZ0: number, label: DomainParameterLabel): number {
  finite(stubZ0, label);
  if (stubZ0 <= 0) throw new DomainError('value.not-positive', { label });
  const ratio = z0 / stubZ0;
  if (!Number.isFinite(ratio) || ratio <= 0) throw new DomainError('numeric.range-with-separation');
  return ratio;
}

function loadAdmittance(z: ComplexValue | null): ComplexValue | null {
  if (z === null) return { re: 0, im: 0 };
  if (z.re === 0 && z.im === 0) return null;
  const value = quotient({ re: 1, im: 0 }, z);
  if (z.re > 0 && value.re === 0) throw new DomainError('numeric.range-with-separation');
  return value;
}

/** T(y,s), toward the generator, with explicit ideal infinite-admittance limits. */
function transfer(y: ComplexValue | null, distance: number): ComplexValue | null {
  const { sin, cos } = trig(distance);
  if (sin === 0) return y === null ? null : { ...y };
  if (y === null) return { re: 0, im: clean(-cos / sin) };
  if (y.re === 0 && y.im === 0) return cos === 0 ? null : { re: 0, im: clean(sin / cos) };
  const scale = Math.max(1, y.re, Math.abs(y.im));
  const g = y.re / scale, b = y.im / scale;
  const denominator = { re: cos / scale - b * sin, im: g * sin };
  const magnitude = Math.hypot(denominator.re, denominator.im);
  if (magnitude === 0) {
    if (y.re > 0) throw new DomainError('numeric.range-with-separation');
    return null;
  }
  const value = quotient({ re: g * cos, im: b * cos + sin / scale }, denominator);
  // Re T(y,s) = g / |cos θ + jy sin θ|². Avoid cancellation in the quotient.
  const rootConductance = (Math.sqrt(y.re) / scale) / magnitude;
  value.re = rootConductance * rootConductance;
  if (!Number.isFinite(value.re) || (y.re > 0 && value.re === 0)) throw new DomainError('numeric.range-with-separation');
  return finiteComplex(value);
}

function stubSusceptance(ratio: number, length: number, termination: StubTermination): number {
  if (termination !== 'open' && termination !== 'short') throw new DomainError('stub.invalid-termination');
  nonnegative(length, 'Stub length');
  const { sin, cos } = trig(length);
  if (termination === 'open' ? cos === 0 : sin === 0) return Infinity;
  const value = ratio * (termination === 'open' ? sin / cos : -cos / sin);
  if (!Number.isFinite(value)) throw new DomainError('numeric.range-with-separation');
  return clean(value);
}

function addStub(y: ComplexValue | null, b: number): ComplexValue | null {
  return y === null || b === Infinity ? null : finiteComplex({ re: y.re, im: y.im + b });
}

function physicalImpedance(y: ComplexValue | null, z0: number): ComplexValue | null {
  if (y === null) return { re: 0, im: 0 };
  if (y.re === 0 && y.im === 0) return null;
  const value = quotient({ re: z0, im: 0 }, y);
  if (y.re > 0 && value.re === 0) throw new DomainError('numeric.range-with-separation');
  return value;
}

function physicalReflection(y: ComplexValue | null): ComplexValue {
  if (y === null) return { re: -1, im: 0 };
  const point = impedanceToReflection(y);
  return { re: clean(-point.re), im: clean(-point.im) };
}

function vswr(y: ComplexValue | null): number {
  if (y === null || y.re === 0) return Infinity;
  const scale = Math.max(1, y.re, Math.abs(y.im));
  const plus = Math.hypot(1 / scale + y.re / scale, y.im / scale);
  const minus = Math.hypot(1 / scale - y.re / scale, y.im / scale);
  const root = (plus + minus) / 2 * (scale / Math.sqrt(y.re));
  return Math.max(1, root * root);
}

/** The printed g = 1 circle rotated counterclockwise toward the load by 4πs/λ. */
export function doubleStubLocus(separation: number): DoubleStubLocus {
  nonnegative(separation, 'Stub separation');
  const reduced = separation % 0.5;
  if (reduced === 0) return { center: { re: 0.5, im: 0 }, radius: 0.5 };
  if (reduced === 0.125) return { center: { re: 0, im: 0.5 }, radius: 0.5 };
  if (reduced === 0.25) return { center: { re: -0.5, im: 0 }, radius: 0.5 };
  if (reduced === 0.375) return { center: { re: 0, im: -0.5 }, radius: 0.5 };
  const phase = 4 * Math.PI * reduced;
  return { center: { re: clean(0.5 * Math.cos(phase)), im: clean(0.5 * Math.sin(phase)) }, radius: 0.5 };
}

/** Infinity at half-wave separations; those require a separate g = 1 test. */
export function doubleStubMaxConductance(separation: number): number {
  nonnegative(separation, 'Stub separation');
  const { sin } = trig(separation);
  return sin === 0 ? Infinity : (1 / Math.abs(sin)) ** 2;
}

function prepare(input: DoubleStubInput) {
  const line = solveLine({ z0: input.z0, load: input.load, lengthInWavelengths: 0 });
  nonnegative(input.distance, 'Load-to-stub-2 distance');
  nonnegative(input.separation, 'Stub separation');
  const ratio1 = stubRatio(input.z0, input.stub1Z0, 'Stub 1 characteristic impedance');
  const ratio2 = stubRatio(input.z0, input.stub2Z0, 'Stub 2 characteristic impedance');
  if (input.load.kind === 'impedance' && input.load.resistance > 0 && line.normalizedLoad?.re === 0) throw new DomainError('numeric.range-with-separation');
  const yLoad = loadAdmittance(line.normalizedLoad);
  const rightAdmittance = transfer(yLoad, input.distance);
  return { line, yLoad, rightAdmittance, ratio1, ratio2 };
}

/** Evaluate from the load: add stub 2, traverse separation, then add stub 1. */
export function evaluateDoubleStub(input: DoubleStubEvaluationInput): DoubleStubEvaluation {
  const { rightAdmittance, ratio1, ratio2 } = prepare(input);
  const stub2Susceptance = stubSusceptance(ratio2, input.length2, input.termination2);
  const stub1Susceptance = stubSusceptance(ratio1, input.length1, input.termination1);
  const rightAfter = addStub(rightAdmittance, stub2Susceptance);
  const leftBefore = transfer(rightAfter, input.separation);
  const totalAdmittance = addStub(leftBefore, stub1Susceptance);
  const reflection = physicalReflection(totalAdmittance);
  return {
    rightAdmittance, rightAfter, leftBefore, totalAdmittance,
    inputImpedance: physicalImpedance(totalAdmittance, input.z0), reflection,
    reflectionMagnitude: totalAdmittance === null || totalAdmittance.re === 0 ? 1 : Math.min(1, Math.hypot(reflection.re, reflection.im)),
    vswr: vswr(totalAdmittance), stub1Susceptance, stub2Susceptance,
  };
}

function stubSolution(susceptance: number, ratio: number): DoubleStubStubSolution {
  const ownSusceptance = susceptance / ratio;
  if (!Number.isFinite(ownSusceptance)) throw new DomainError('numeric.range-with-separation');
  const angle = Math.atan2(ownSusceptance, 1);
  const openLength = Math.min((angle < 0 ? angle + Math.PI : angle) / TAU, LAST_CANONICAL_LENGTH);
  const shortLength = Math.min(Math.atan2(1, -ownSusceptance) / TAU, LAST_CANONICAL_LENGTH);
  return { susceptance: clean(susceptance), openLength: clean(openLength), shortLength };
}

export function solveDoubleStub(input: DoubleStubInput): DoubleStubSolution {
  const { line, yLoad, rightAdmittance, ratio1, ratio2 } = prepare(input);
  const base = {
    normalizedLoad: line.normalizedLoad, loadAdmittance: yLoad, loadReflection: line.loadReflection, rightAdmittance,
    maxConductance: doubleStubMaxConductance(input.separation), locus: doubleStubLocus(input.separation), branches: [] as DoubleStubBranch[],
  };
  if (input.load.kind !== 'impedance' || input.load.resistance === 0) {
    return { ...base, status: 'unmatchable', message: 'A lossless reactive network cannot match a load that absorbs no real power. Use a load with R > 0.' };
  }
  if (rightAdmittance === null || rightAdmittance.re <= 0) throw new DomainError('numeric.range-with-separation');
  const { re: g, im: b0 } = rightAdmittance;
  const { sin, cos } = trig(input.separation);
  if (sin === 0) {
    if (Math.abs(g - 1) <= BOUNDARY_ROUND_OFF * Math.max(1, g)) {
      return { ...base, status: 'continuous', family: { totalSusceptance: clean(-b0) }, message: 'A half-wavelength separation repeats the same admittance. There is a continuous family of matches: b1 + b2 = -Im(yR).' };
    }
    return { ...base, status: 'forbidden', message: 'At a half-wavelength separation, the two stubs cannot change conductance. Matching requires Re(yR) = 1.' };
  }

  const scaledConductance = Math.sqrt(g) * Math.abs(sin);
  const discriminant = 1 - scaledConductance * scaledConductance;
  if (discriminant < -BOUNDARY_ROUND_OFF) {
    return { ...base, status: 'forbidden', message: 'The conductance at stub 2 exceeds the matching limit for this separation. Change the separation or the load-to-stub-2 distance.' };
  }
  const tangent = Math.abs(discriminant) <= BOUNDARY_ROUND_OFF;
  const root = tangent ? 0 : Math.sqrt(g) * Math.sqrt(discriminant);
  let totals: number[];
  if (tangent) totals = [cos / sin];
  else {
    // Use the large numerator directly and rationalize the small one. This
    // retains the zero-susceptance branch when g = 1 near half-wave spacing.
    const numerator = cos >= 0 ? cos + root : cos - root;
    const large = numerator / sin;
    const small = ((g - 1) * (g * sin * sin - cos * cos)) / (sin * numerator);
    totals = [large, small].sort((a, b) => a - b);
  }
  const branches = totals.map((total): DoubleStubBranch => {
    if (!Number.isFinite(total)) throw new DomainError('numeric.range-with-separation');
    const stub2 = stubSolution(total - b0, ratio2);
    const rightAfter = finiteComplex({ re: g, im: b0 + stub2.susceptance });
    const leftBefore = transfer(rightAfter, input.separation);
    if (leftBefore === null) throw new DomainError('numeric.range-with-separation');
    const stub1 = stubSolution(-leftBefore.im, ratio1);
    let residual = 0;
    for (const termination1 of ['open', 'short'] as const) {
      for (const termination2 of ['open', 'short'] as const) {
        const evaluation = evaluateDoubleStub({ ...input, termination1, termination2,
          length1: termination1 === 'open' ? stub1.openLength : stub1.shortLength,
          length2: termination2 === 'open' ? stub2.openLength : stub2.shortLength });
        residual = Math.max(residual, evaluation.reflectionMagnitude);
      }
    }
    if (!Number.isFinite(residual) || residual > 1e-7) throw new DomainError('numeric.range-with-separation');
    return { rightAfter, leftBefore, stub1, stub2, residual };
  });
  return { ...base, status: 'solved', branches, message: tangent
    ? 'The two matching branches meet at tangency, leaving one distinct solution.'
    : 'Two distinct double-stub matching branches are available. Stub 2 is applied first from the load, then stub 1 completes the match toward the generator. Each stub length repeats every half of its own wavelength.' };
}
