import type { DoubleStubSolution } from '../domain/doubleStub';
import type { StubTermination } from '../domain/singleStub';
import { texNumber } from '../math/format';
import { MatchingBranchSummary } from './MatchingBranchSummary';
import { doubleStubResultMilestones, type DoubleStubStepPosition } from './doubleStubPlayback';

export interface DoubleStubBranchSummaryProps {
  solution: DoubleStubSolution;
  position: DoubleStubStepPosition;
  termination1: StubTermination;
  termination2: StubTermination;
  periodicLength1?: number;
  periodicLength2?: number;
}

export function DoubleStubBranchSummary({ solution, position, termination1, termination2, periodicLength1 = 0, periodicLength2 = 0 }: DoubleStubBranchSummaryProps) {
  if (solution.status !== 'solved') return null;
  const milestones = doubleStubResultMilestones(solution, position);
  const branches = solution.branches.map((branch, index) => {
    const found = milestones.find((milestone) => milestone.branchIndex === index);
    const length1 = termination1 === 'open' ? branch.stub1.openLength : branch.stub1.shortLength;
    const length2 = termination2 === 'open' ? branch.stub2.openLength : branch.stub2.shortLength;
    return {
      index,
      rows: [
        { key: 'stub-1-length', tex: found?.stub1 ? '\\ell_1=\\mathbf{' + texNumber(length1 + periodicLength1, 6) + '}\\,\\lambda_{s1}' : null },
        { key: 'stub-2-length', tex: found?.stub2 ? '\\ell_2=\\mathbf{' + texNumber(length2 + periodicLength2, 6) + '}\\,\\lambda_{s2}' : null },
      ],
    };
  });
  return <MatchingBranchSummary branches={branches} variant="highlighted" />;
}
