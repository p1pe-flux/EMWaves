import type { LCComponent, LCConnection, LCMatchingTopology } from './lcMatching';
import type { ComplexValue, Load } from './transmission';
import { toLumpedTopology } from './lumpedMatching';
import {
  describeLumpedFeasibility, classifyLumpedFeasibility, classifyLumpedPhysicalLoadFeasibility,
  type LumpedFeasibilityClassification,
} from './lumpedFeasibility';

export type LCFeasibilityRegion = {
  kind: 'area' | 'curve';
  sourceComponent: LCComponent;
  loadComponent: LCComponent;
  sourceConnection: LCConnection;
  loadConnection: LCConnection;
  formula: string;
  boundaryFormula: string;
};
export type LCFeasibilityClassification = LumpedFeasibilityClassification;
export function describeLCFeasibility(topology: LCMatchingTopology): LCFeasibilityRegion {
  return describeLumpedFeasibility(toLumpedTopology(topology));
}
export function classifyLCFeasibility(topology: LCMatchingTopology, impedance: ComplexValue | null): LCFeasibilityClassification {
  return classifyLumpedFeasibility(toLumpedTopology(topology), impedance);
}
export function classifyLCPhysicalLoadFeasibility(topology: LCMatchingTopology, input: { z0: number; load: Load }): LCFeasibilityClassification {
  return classifyLumpedPhysicalLoadFeasibility(toLumpedTopology(topology), input);
}
