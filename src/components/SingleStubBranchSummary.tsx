import type { SingleStubSolution, StubTermination } from '../domain/singleStub';
import { texNumber } from '../math/format';
import { MatchingBranchSummary } from './MatchingBranchSummary';
import type { SingleStubConstructionStep } from './singleStubPlayback';
import { singleStubResultMilestones, type SingleStubStepPosition } from './singleStubResultMilestones';

export interface SingleStubBranchSummaryProps {
  solution: SingleStubSolution;
  steps: readonly SingleStubConstructionStep[];
  position: SingleStubStepPosition;
  termination: StubTermination;
  periodicDistance?: number;
  periodicStubLength?: number;
}

export function SingleStubBranchSummary({ solution, steps, position, termination, periodicDistance = 0, periodicStubLength = 0 }: SingleStubBranchSummaryProps) {
  if (solution.status !== 'solved') return null;
  const milestones = singleStubResultMilestones(steps, position);
  const branches = solution.branches.map((branch, index) => {
    const found = milestones.find((milestone) => milestone.branchIndex === index);
    const stubLength = termination === 'open' ? branch.openLength : branch.shortLength;
    return {
      index,
      rows: [
        { key: 'distance', tex: found?.placement ? 'd=\\mathbf{' + texNumber(branch.distance + periodicDistance, 6) + '}\\,\\lambda' : null },
        { key: 'stub-length', tex: found?.stub ? '\\ell_s=\\mathbf{' + texNumber(stubLength + periodicStubLength, 6) + '}\\,\\lambda_s' : null },
      ],
    };
  });
  return <MatchingBranchSummary label="Matching solutions found" branches={branches} variant="highlighted" />;
}
