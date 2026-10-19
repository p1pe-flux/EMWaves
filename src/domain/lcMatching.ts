import type { ComplexValue, Load } from './transmission';
import {
  applyLumpedStage, evaluateLumpedMatching, solveLumpedMatching, toLumpedMatchingInput,
  type LumpedMatchingSolution,
} from './lumpedMatching';

export type LCComponent = 'L' | 'C';
export type LCConnection = 'series' | 'parallel';

export type LCMatchingTopology = {
  /** Component order along the circuit, from the generator toward the load. */
  order: 'LC' | 'CL';
  inductorConnection: LCConnection;
  capacitorConnection: LCConnection;
};

export type LCMatchingInput = LCMatchingTopology & {
  z0: number;
  frequencyHz: number;
  load: Load;
};

export type LCMatchingStage = {
  component: LCComponent;
  connection: LCConnection;
  /** Signed series reactance X/Z0, or signed parallel susceptance B Z0. */
  normalizedValue: number;
  /** Impedance after this element, normalized to Z0; null is an ideal open. */
  impedance: ComplexValue | null;
  reflection: ComplexValue;
};

export type LCMatchingBranch = {
  /** Henries. Both physical component values are positive and finite. */
  inductance: number;
  /** Farads. */
  capacitance: number;
  /** The network is evaluated from the load toward the generator. */
  stages: [LCMatchingStage, LCMatchingStage];
  residual: number;
};

export type LCMatchingFamily = {
  connection: LCConnection;
  /** Strict lower bound: q > minimum. q is x_L for series and -b_L for parallel. */
  minimum: number;
  /** The imaginary part of z_L (series) or y_L (parallel). */
  loadImaginary: number;
};

export type LCMatchingSolution = {
  status: 'solved' | 'no-solution' | 'continuous' | 'already-matched' | 'unmatchable';
  normalizedLoad: ComplexValue | null;
  loadReflection: ComplexValue;
  branches: LCMatchingBranch[];
  message: string;
  family?: LCMatchingFamily;
};

export type LCMatchingEvaluationInput = LCMatchingInput & {
  inductance: number;
  capacitance: number;
};

export type LCMatchingEvaluation = {
  normalizedInput: ComplexValue | null;
  /** Ohms; null is an ideal open circuit. */
  inputImpedance: ComplexValue | null;
  reflection: ComplexValue;
  reflectionMagnitude: number;
  vswr: number;
  stages: [LCMatchingStage, LCMatchingStage];
};

/** Compatibility name retained for existing construction and numerical clients. */
export const applyLCStage = applyLumpedStage;

export function evaluateLCMatching(input: LCMatchingEvaluationInput): LCMatchingEvaluation {
  const canonical = toLumpedMatchingInput(input);
  const values: [number, number] = input.order === 'LC' ? [input.inductance, input.capacitance] : [input.capacitance, input.inductance];
  const evaluated = evaluateLumpedMatching({ ...canonical, values });
  const stages = evaluated.stages.map(({ elementIndex: _index, ...stage }) => stage) as [LCMatchingStage, LCMatchingStage];
  return { ...evaluated, stages };
}

function legacyMessage(result: LumpedMatchingSolution, input: LCMatchingInput): string {
  if (result.status === 'no-solution') return 'This topology cannot match this load with one positive, finite inductor and one positive, finite capacitor. Change the connections or their order.';
  if (result.status === 'solved') return 'A positive, finite inductor and capacitor match this load with the selected topology.';
  if (result.status === 'already-matched') return 'The load is already matched. This mixed topology needs a zero or infinite component, so it has no positive, finite L–C pair.';
  if (result.status === 'continuous') return input.inductorConnection === 'series'
    ? 'This series topology has a continuous family of matches. Choose any normalized inductive reactance q above the indicated lower bound; the capacitor cancels the remaining reactance.'
    : 'This parallel topology has a continuous family of matches. Choose any normalized inductive susceptance magnitude q above the indicated lower bound; the capacitor cancels the remaining susceptance.';
  return result.message;
}

/** Backward-compatible L–C API, backed by the generalized two-element solver. */
export function solveLCMatching(input: LCMatchingInput): LCMatchingSolution {
  const result = solveLumpedMatching(toLumpedMatchingInput(input));
  const branches: LCMatchingBranch[] = result.branches.map(branch => {
    const inductor = branch.elements.find(element => element.component === 'L')!;
    const capacitor = branch.elements.find(element => element.component === 'C')!;
    const stages = branch.stages.map(({ elementIndex: _index, ...stage }) => stage) as [LCMatchingStage, LCMatchingStage];
    return { inductance: inductor.value, capacitance: capacitor.value, stages, residual: branch.residual };
  });
  const family = result.family ? {
    connection: result.family.connection,
    minimum: Math.max(0, result.family.connection === 'series' ? -result.family.loadImaginary : result.family.loadImaginary),
    loadImaginary: result.family.loadImaginary,
  } : undefined;
  const { family: _family, ...rest } = result;
  return { ...rest, branches, message: legacyMessage(result, input), ...(family ? { family } : {}) };
}
