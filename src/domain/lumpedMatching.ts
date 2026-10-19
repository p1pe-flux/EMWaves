import { DomainError, type DomainParameterLabel } from './errors';
import { impedanceToReflection, solveLine, type ComplexValue, type Load } from './transmission';
import { classifyLumpedPhysicalLoadFeasibility } from './lumpedFeasibility';
import type { LCMatchingInput, LCMatchingTopology } from './lcMatching';

export type LumpedComponent = 'L' | 'C';
export type LumpedConnection = 'series' | 'parallel';
export type LumpedElement = { component: LumpedComponent; connection: LumpedConnection };
export type LumpedMatchingTopology = { /** Generator to load. */ elements: [LumpedElement, LumpedElement] };
export type LumpedMatchingInput = LumpedMatchingTopology & { z0: number; frequencyHz: number; load: Load };
export type LumpedElementValue = LumpedElement & { /** Henries for L, farads for C. */ value: number; normalizedValue: number };
export type LumpedMatchingStage = LumpedElement & {
  elementIndex: 0 | 1;
  normalizedValue: number;
  impedance: ComplexValue | null;
  reflection: ComplexValue;
};
export type LumpedMatchingBranch = {
  /** Generator to load, matching the parameter panel and schematic. */
  elements: [LumpedElementValue, LumpedElementValue];
  /** Evaluation proceeds from the load to the generator: indices 1, 0. */
  stages: [LumpedMatchingStage, LumpedMatchingStage];
  residual: number;
};
export type LumpedMatchingFamily = {
  connection: LumpedConnection;
  loadImaginary: number;
  totalNormalizedValue: number;
  signs: [1 | -1, 1 | -1];
  /** q is the positive normalized magnitude of source-side element 0. */
  minimum: number;
  /** Strict upper bound; null means no upper bound. Both bounds are excluded. */
  maximum: number | null;
};
export type LumpedMatchingSolution = {
  status: 'solved' | 'no-solution' | 'continuous' | 'already-matched' | 'unmatchable';
  normalizedLoad: ComplexValue | null;
  loadReflection: ComplexValue;
  branches: LumpedMatchingBranch[];
  message: string;
  family?: LumpedMatchingFamily;
};
export type LumpedMatchingEvaluationInput = LumpedMatchingInput & { values: [number, number] };
export type LumpedMatchingEvaluation = {
  normalizedInput: ComplexValue | null;
  inputImpedance: ComplexValue | null;
  reflection: ComplexValue;
  reflectionMagnitude: number;
  vswr: number;
  stages: [LumpedMatchingStage, LumpedMatchingStage];
};

export function toLumpedTopology(topology: LCMatchingTopology | LumpedMatchingTopology): LumpedMatchingTopology {
  if ('elements' in topology) {
    if (!Array.isArray(topology.elements) || topology.elements.length !== 2) throw new DomainError('lumped.invalid-element-count');
    for (const element of topology.elements) {
      if (element.component !== 'L' && element.component !== 'C') throw new DomainError('lumped.invalid-component');
      assertConnection(element.connection);
    }
    return { elements: topology.elements.map(element => ({ ...element })) as [LumpedElement, LumpedElement] };
  }
  if (topology.order !== 'LC' && topology.order !== 'CL') throw new DomainError('lumped.invalid-order');
  assertConnection(topology.inductorConnection);
  assertConnection(topology.capacitorConnection);
  const inductor: LumpedElement = { component: 'L', connection: topology.inductorConnection };
  const capacitor: LumpedElement = { component: 'C', connection: topology.capacitorConnection };
  return { elements: topology.order === 'LC' ? [inductor, capacitor] : [capacitor, inductor] };
}

export function toLumpedMatchingInput(input: LCMatchingInput | LumpedMatchingInput): LumpedMatchingInput {
  return { ...toLumpedTopology(input), z0: input.z0, frequencyHz: input.frequencyHz, load: input.load };
}

function clean(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function finite(value: number, label: DomainParameterLabel): void {
  if (!Number.isFinite(value)) throw new DomainError('value.not-finite', { label });
}

function positive(value: number, label: DomainParameterLabel): void {
  finite(value, label);
  if (value <= 0) throw new DomainError('value.not-positive', { label });
}

function assertConnection(connection: LumpedConnection): void {
  if (connection !== 'series' && connection !== 'parallel') {
    throw new DomainError('lumped.invalid-connection');
  }
}

/** A scaled reciprocal retains exact opens and shorts without large substitutes. */
function reciprocal(value: ComplexValue): ComplexValue | null {
  const scale = Math.max(Math.abs(value.re), Math.abs(value.im));
  if (scale === 0) return null;
  const real = value.re / scale;
  const imaginary = value.im / scale;
  const denominator = real * real + imaginary * imaginary;
  const result = { re: clean((real / denominator) / scale), im: clean((-imaginary / denominator) / scale) };
  if (!Number.isFinite(result.re) || !Number.isFinite(result.im)
    || (value.re > 0 && result.re === 0)) throw new DomainError('numeric.range');
  return result;
}

function reflection(impedance: ComplexValue | null): ComplexValue {
  return impedance === null ? { re: 1, im: 0 } : impedanceToReflection(impedance);
}

/**
 * Add a signed series reactance or parallel susceptance, normalized to Z0.
 * A zero value is the identity, which also makes this suitable for animation.
 */
export function applyLumpedStage(impedance: ComplexValue | null, connection: LumpedConnection, normalizedValue: number): ComplexValue | null {
  assertConnection(connection);
  finite(normalizedValue, 'Normalized element value');
  if (impedance !== null) {
    finite(impedance.re, 'Normalized impedance: real part');
    finite(impedance.im, 'Normalized impedance: imaginary part');
    if (impedance.re < 0) throw new DomainError('value.negative', { label: 'Resistance' });
  }
  if (normalizedValue === 0) return impedance === null ? null : { re: clean(impedance.re), im: clean(impedance.im) };
  if (connection === 'series') {
    if (impedance === null) return null;
    const im = clean(impedance.im + normalizedValue);
    if (!Number.isFinite(im)) throw new DomainError('numeric.range');
    return { re: clean(impedance.re), im };
  }
  if (impedance !== null && impedance.re === 0 && impedance.im === 0) return { re: 0, im: 0 };
  const admittance = impedance === null ? { re: 0, im: 0 } : reciprocal(impedance)!;
  const im = clean(admittance.im + normalizedValue);
  if (!Number.isFinite(im)) throw new DomainError('numeric.range');
  return reciprocal({ re: admittance.re, im });
}

/** Positive products/quotients; use logs only to avoid intermediate overflow. */
function productRatio(numerator: number[], denominator: number[]): number {
  let value = numerator.reduce((product, factor) => product * factor, 1)
    / denominator.reduce((product, factor) => product * factor, 1);
  if (!Number.isFinite(value) || value === 0) {
    value = Math.exp(numerator.reduce((sum, factor) => sum + Math.log(factor), 0)
      - denominator.reduce((sum, factor) => sum + Math.log(factor), 0));
  }
  if (!Number.isFinite(value) || value <= 0) throw new DomainError('numeric.range');
  return value;
}


type BinaryValue = { coefficient: bigint; exponent: number };
const binaryBuffer = new DataView(new ArrayBuffer(8));

/** An exact integer times a power of two for each supplied IEEE-754 value. */
function binaryValue(value: number): BinaryValue {
  binaryBuffer.setFloat64(0, Math.abs(value));
  const bits = binaryBuffer.getBigUint64(0);
  const exponent = Number((bits >> 52n) & 0x7ffn);
  const fraction = bits & ((1n << 52n) - 1n);
  return exponent === 0 ? { coefficient: fraction, exponent: -1074 }
    : { coefficient: fraction | (1n << 52n), exponent: exponent - 1075 };
}

/** Exact sign and zero of R² + X² - R Z0, without a tolerance or normalization drift. */
function parallelDiscriminant(resistance: number, reactance: number, z0: number): BinaryValue {
  const r = binaryValue(resistance);
  const x = binaryValue(reactance);
  const reference = binaryValue(z0);
  const exponent = Math.min(2 * r.exponent, 2 * x.exponent, r.exponent + reference.exponent);
  const coefficient = (r.coefficient * r.coefficient << BigInt(2 * r.exponent - exponent))
    + (x.coefficient * x.coefficient << BigInt(2 * x.exponent - exponent))
    - (r.coefficient * reference.coefficient << BigInt(r.exponent + reference.exponent - exponent));
  return { coefficient, exponent };
}

/** sqrt(R² + X² - R Z0) / Z0, retaining a tiny positive distance from g = 1. */
function parallelRoot(discriminant: BinaryValue, z0: number): number | null {
  if (discriminant.coefficient < 0n) return null;
  if (discriminant.coefficient === 0n) return 0;
  const shift = Math.max(0, discriminant.coefficient.toString(2).length - 54);
  const coefficient = Number(discriminant.coefficient >> BigInt(shift));
  const reference = binaryValue(z0);
  const exponent = discriminant.exponent + shift - 2 * reference.exponent;
  const halfExponent = Math.floor(exponent / 2);
  const base = Math.sqrt(coefficient * (exponent - 2 * halfExponent === 0 ? 1 : 2)) / Number(reference.coefficient);
  const baseExponent = Math.floor(Math.log2(base));
  const mantissa = base / 2 ** baseExponent;
  const resultExponent = halfExponent + baseExponent;
  const root = resultExponent === -1075 ? (mantissa / 2) * Number.MIN_VALUE : mantissa * 2 ** resultExponent;
  if (!Number.isFinite(root) || root === 0) throw new DomainError('numeric.range');
  return root;
}

/**
 * A resonant intermediate node can amplify a component's last-bit rounding.
 * Verify that the returned physical L/C values can support the match accuracy,
 * rather than accepting a lucky cancellation in normalized floating-point values.
 */
function assertComponentPrecision(evaluated: LumpedMatchingEvaluation): void {
  const [first, second] = evaluated.stages;
  if (first.impedance === null || second.impedance === null) throw new DomainError('numeric.range');
  const firstMagnitude = Math.hypot(first.impedance.re, first.impedance.im);
  const finalMagnitude = Math.hypot(second.impedance.re, second.impedance.im);
  // |dz/db| = |z|²; for a subsequent shunt element, |dz_out/dz_in| = |z_out/z_in|².
  const sensitivity = second.connection === 'series' ? firstMagnitude * firstMagnitude
    : (finalMagnitude / firstMagnitude) ** 2;
  const roundingBound = 16 * Number.EPSILON
    * (Math.abs(second.normalizedValue) + Math.abs(first.normalizedValue) * sensitivity);
  if (!Number.isFinite(roundingBound) || roundingBound > 1e-7) throw new DomainError('numeric.range');
}


export function normalizedElementSign(element: LumpedElement): 1 | -1 {
  return (element.component === 'L') === (element.connection === 'series') ? 1 : -1;
}

function validate(input: LumpedMatchingInput): ReturnType<typeof solveLine> {
  positive(input.frequencyHz, 'Frequency');
  if (!Number.isFinite(2 * Math.PI * input.frequencyHz)) throw new DomainError('numeric.range');
  if (!Array.isArray(input.elements) || input.elements.length !== 2) throw new DomainError('lumped.invalid-element-count');
  for (const element of input.elements) {
    if (element.component !== 'L' && element.component !== 'C') throw new DomainError('lumped.invalid-component');
    assertConnection(element.connection);
  }
  const line = solveLine({ z0: input.z0, load: input.load, lengthInWavelengths: 0 });
  if (input.load.kind === 'impedance' && line.normalizedLoad !== null
    && ((input.load.resistance > 0 && line.normalizedLoad.re === 0)
      || (input.load.reactance !== 0 && line.normalizedLoad.im === 0))) throw new DomainError('numeric.range');
  return line;
}

function contribution(input: LumpedMatchingInput, element: LumpedElement, value: number): number {
  const omega = 2 * Math.PI * input.frequencyHz;
  if (element.component === 'L') return element.connection === 'series'
    ? productRatio([omega, value], [input.z0]) : -productRatio([input.z0], [omega, value]);
  return element.connection === 'series' ? -productRatio([1], [omega, value, input.z0])
    : productRatio([omega, value, input.z0], [1]);
}

function realize(input: LumpedMatchingInput, element: LumpedElement, value: number): number | null {
  if (!(normalizedElementSign(element) * value > 0)) return null;
  const magnitude = Math.abs(value);
  const omega = 2 * Math.PI * input.frequencyHz;
  if (element.component === 'L') return element.connection === 'series'
    ? productRatio([input.z0, magnitude], [omega]) : productRatio([input.z0], [omega, magnitude]);
  return element.connection === 'series' ? productRatio([1], [omega, input.z0, magnitude])
    : productRatio([magnitude], [omega, input.z0]);
}

function vswr(impedance: ComplexValue | null): number {
  if (impedance === null || impedance.re === 0) return Infinity;
  const scale = Math.max(1, impedance.re, Math.abs(impedance.im));
  const plus = Math.hypot(impedance.re / scale + 1 / scale, impedance.im / scale);
  const minus = Math.hypot(impedance.re / scale - 1 / scale, impedance.im / scale);
  const root = (plus + minus) / 2 * (scale / Math.sqrt(impedance.re));
  return Math.max(1, root * root);
}

/** Evaluate positive finite component values in physical source-to-load order. */
export function evaluateLumpedMatching(input: LumpedMatchingEvaluationInput): LumpedMatchingEvaluation {
  const line = validate(input);
  if (!Array.isArray(input.values) || input.values.length !== 2) throw new DomainError('lumped.missing-values');
  input.values.forEach((value, index) => positive(value, index === 0 ? 'Element 1 value' : 'Element 2 value'));
  let normalizedInput = line.normalizedLoad;
  const stage = (elementIndex: 0 | 1): LumpedMatchingStage => {
    const element = input.elements[elementIndex];
    const normalizedValue = contribution(input, element, input.values[elementIndex]);
    normalizedInput = applyLumpedStage(normalizedInput, element.connection, normalizedValue);
    return { ...element, elementIndex, normalizedValue, impedance: normalizedInput, reflection: reflection(normalizedInput) };
  };
  const stages: [LumpedMatchingStage, LumpedMatchingStage] = [stage(1), stage(0)];
  const final = normalizedInput;
  const inputImpedance = final === null ? null : { re: clean(final.re * input.z0), im: clean(final.im * input.z0) };
  if (inputImpedance !== null && (!Number.isFinite(inputImpedance.re) || !Number.isFinite(inputImpedance.im))) throw new DomainError('numeric.range');
  const finalReflection = stages[1].reflection;
  return {
    normalizedInput: final, inputImpedance, reflection: finalReflection,
    reflectionMagnitude: final === null || final.re === 0 ? 1 : Math.min(1, Math.hypot(finalReflection.re, finalReflection.im)),
    vswr: vswr(final), stages,
  };
}

const LUMPED_NO_SOLUTION = 'The selected two elements cannot match this load with positive, finite values. Change their types, connections, or positions.';

/** All realizations of the selected pair, including bounded and unbounded families. */
export function solveLumpedMatching(input: LumpedMatchingInput): LumpedMatchingSolution {
  const line = validate(input);
  const normalizedLoad = line.normalizedLoad;
  const base = { normalizedLoad, loadReflection: line.loadReflection, branches: [] as LumpedMatchingBranch[] };
  if (input.load.kind !== 'impedance' || input.load.resistance === 0) return {
    ...base, status: 'unmatchable',
    message: 'A lossless reactive network cannot match a load that absorbs no real power. Use a load with R > 0.',
  };
  if (normalizedLoad === null || normalizedLoad.re <= 0) throw new DomainError('numeric.range');
  const [sourceElement, loadElement] = input.elements;
  const signs: [1 | -1, 1 | -1] = [normalizedElementSign(sourceElement), normalizedElementSign(loadElement)];
  if (sourceElement.connection === loadElement.connection) {
    const connection = sourceElement.connection;
    const familyExists = connection === 'series' ? input.load.resistance === input.z0
      : parallelDiscriminant(input.load.resistance, input.load.reactance, input.z0).coefficient === 0n;
    if (!familyExists) return { ...base, status: 'no-solution', message: LUMPED_NO_SOLUTION };
    const loadImaginary = clean(connection === 'series' ? input.load.reactance / input.z0 : -input.load.reactance / input.load.resistance);
    const totalNormalizedValue = clean(-loadImaginary);
    const sameSign = signs[0] === signs[1];
    if (sameSign && !(signs[0] * totalNormalizedValue > 0)) {
      return { ...base, status: input.load.reactance === 0 ? 'already-matched' : 'no-solution', message: input.load.reactance === 0
        ? 'The load is already matched. Two reactive elements of the same type and connection cannot cancel each other with positive, finite values.' : LUMPED_NO_SOLUTION };
    }
    const minimum = sameSign ? 0 : Math.max(0, signs[0] * totalNormalizedValue);
    const maximum = sameSign ? signs[0] * totalNormalizedValue : null;
    return { ...base, status: 'continuous', family: { connection, loadImaginary, totalNormalizedValue, signs, minimum, maximum },
      message: maximum === null
        ? 'This topology has a continuous family of positive, finite matches. Split the required reactive contribution using the indicated strict lower bound.'
        : 'This topology has a continuous family of positive, finite matches. Split the required reactive contribution between the two elements within the indicated open interval.',
    };
  }
  if (input.load.resistance === input.z0 && input.load.reactance === 0) return { ...base, status: 'already-matched',
    message: 'The load is already matched. This mixed topology needs a zero or infinite component, so it has no positive, finite pair.' };
  if (classifyLumpedPhysicalLoadFeasibility(input, input) !== 'matchable') return { ...base, status: 'no-solution', message: LUMPED_NO_SOLUTION };
  const value = loadElement.connection === 'series' ? normalizedLoad : reciprocal(normalizedLoad)!;
  const root = loadElement.connection === 'parallel'
    ? parallelRoot(parallelDiscriminant(input.load.resistance, input.load.reactance, input.z0), input.z0)
    : value.re <= 1 ? Math.sqrt(value.re) * Math.sqrt(1 - value.re) : null;
  if (root === null) return { ...base, status: 'no-solution', message: LUMPED_NO_SOLUTION };
  if (!Number.isFinite(root)) throw new DomainError('numeric.range');
  const branches: LumpedMatchingBranch[] = [];
  for (const sign of [1, -1]) {
    const sourceValue = loadElement.connection === 'parallel' ? sign * root / Math.sqrt(normalizedLoad.re) : sign * root / value.re;
    const target = loadElement.connection === 'parallel' ? value.re * sourceValue : sign * root;
    const loadValue = target - value.im;
    const sourcePhysical = realize(input, sourceElement, sourceValue);
    const loadPhysical = realize(input, loadElement, loadValue);
    if (sourcePhysical === null || loadPhysical === null) continue;
    const evaluated = evaluateLumpedMatching({ ...input, values: [sourcePhysical, loadPhysical] });
    if (!Number.isFinite(evaluated.reflectionMagnitude) || evaluated.reflectionMagnitude > 1e-7) throw new DomainError('numeric.range');
    assertComponentPrecision(evaluated);
    branches.push({ elements: [
      { ...sourceElement, value: sourcePhysical, normalizedValue: sourceValue },
      { ...loadElement, value: loadPhysical, normalizedValue: loadValue },
    ], stages: evaluated.stages, residual: evaluated.reflectionMagnitude });
  }
  return branches.length === 0 ? { ...base, status: 'no-solution', message: LUMPED_NO_SOLUTION }
    : { ...base, status: 'solved', branches, message: 'The selected two elements match this load with positive, finite values.' };
}
