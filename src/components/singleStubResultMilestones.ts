import type { SingleStubConstructionStep } from './singleStubPlayback';

export interface SingleStubStepPosition {
  stepIndex: number;
  completed: boolean;
}

export interface SingleStubResultMilestones {
  branchIndex: number;
  placement: boolean;
  cancellation: boolean;
  stub: boolean;
  verified: boolean;
}

type Milestone = Exclude<keyof SingleStubResultMilestones, 'branchIndex'>;
const phaseMilestone: Partial<Record<SingleStubConstructionStep['phase'], Milestone>> = {
  follow: 'placement',
  cancel: 'cancellation',
  stub: 'stub',
  verify: 'verified',
};

/** Reveal only deductions completed at the current position, without history. */
export function singleStubResultMilestones(steps: readonly SingleStubConstructionStep[], position: SingleStubStepPosition | null): SingleStubResultMilestones[] {
  if (position === null || !Number.isInteger(position.stepIndex) || position.stepIndex < 0) return [];
  const branches = new Map<number, SingleStubResultMilestones>();
  for (let index = 0; index < steps.length; index += 1) {
    if (index > position.stepIndex || (index === position.stepIndex && !position.completed)) break;
    const step = steps[index];
    const milestone = phaseMilestone[step.phase];
    if (milestone === undefined) continue;
    const branch = branches.get(step.branchIndex) ?? {
      branchIndex: step.branchIndex, placement: false, cancellation: false, stub: false, verified: false,
    };
    branch[milestone] = true;
    branches.set(step.branchIndex, branch);
  }
  return [...branches.values()].filter((branch) => branch.placement);
}
