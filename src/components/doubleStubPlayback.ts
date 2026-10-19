import type { DoubleStubSolution } from '../domain/doubleStub';

export type DoubleStubPhase = 'matched' | 'left-circle' | 'transport' | 'load' | 'admittance' | 'load-line' | 'intersections' | 'stub2' | 'propagate' | 'stub1' | 'verify';
export interface DoubleStubStepPosition { stepIndex: number; completed: boolean }
export interface DoubleStubStep {
  key: string; phase: DoubleStubPhase; title: string; branchIndex: number; duration: number;
}
const COMMON: ReadonlyArray<[DoubleStubPhase, string, number]> = [
  ['matched', 'Start at the matched input', 900],
  ['left-circle', 'Draw the unity-conductance circle at Stub 1', 2400],
  ['transport', 'Transport the whole circle toward Stub 2', 3400],
  ['load', 'Plot the load impedance', 1800],
  ['admittance', 'Read the load admittance through the chart center', 2400],
  ['load-line', 'Follow the SWR circle from the load to Stub 2', 3200],
  ['intersections', 'Find the possible admittances at Stub 2', 2800],
];
const BRANCH: ReadonlyArray<[DoubleStubPhase, string, number]> = [
  ['stub2', 'Build Stub 2 and reach the selected intersection', 4400],
  ['propagate', 'Return toward the generator to Stub 1', 3000],
  ['stub1', 'Build the cancelling Stub 1', 3200],
  ['verify', 'Attach Stub 1 and verify the match', 2800],
];
export function doubleStubSteps(branchCount = 2): DoubleStubStep[] {
  return [
    ...COMMON.map(([phase, title, duration]) => ({ key: phase, phase, title, duration, branchIndex: 0 })),
    ...Array.from({ length: Math.max(0, branchCount) }, (_, branchIndex) => BRANCH.map(([phase, title, duration]) => ({
      key: phase + '-' + branchIndex, phase, title, branchIndex,
      duration: phase === 'stub2' && branchIndex > 0 ? duration + 2200 : duration,
    }))).flat(),
  ];
}
export function doubleStubResultMilestones(solution: DoubleStubSolution, position: DoubleStubStepPosition): { branchIndex: number; stub1: boolean; stub2: boolean }[] {
  const stages = doubleStubSteps(solution.branches.length);
  const earned = (index: number) => position.stepIndex > index || (position.stepIndex === index && position.completed);
  return solution.branches.map((_, branchIndex) => ({
    branchIndex,
    stub1: earned(stages.findIndex((s) => s.branchIndex === branchIndex && s.phase === 'stub1')),
    stub2: earned(stages.findIndex((s) => s.branchIndex === branchIndex && s.phase === 'stub2')),
  }));
}
