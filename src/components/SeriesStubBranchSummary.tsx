import { solveSeriesStub } from '../domain/seriesStub';
import type { StubTermination } from '../domain/singleStub';
import { texNumber } from '../math/format';
import { MatchingBranchSummary } from './MatchingBranchSummary';
import { seriesStubResultMilestones } from './seriesStubPlayback';
import type { SeriesStubConstructionStep, SeriesStubStepPosition } from './seriesStubPlayback';

export interface SeriesStubBranchSummaryProps {
  solution: ReturnType<typeof solveSeriesStub>;
  steps: readonly SeriesStubConstructionStep[];
  position: SeriesStubStepPosition;
  termination: StubTermination;
}

export function SeriesStubBranchSummary({ solution, steps, position, termination }: SeriesStubBranchSummaryProps) {
  if (solution.status !== 'solved') return null;
  const milestones = seriesStubResultMilestones(steps, position);
  return <MatchingBranchSummary variant="highlighted" branches={solution.branches.map((branch, index) => {
    const found = milestones.get(index);
    return { index, rows: [
      { key: 'distance', tex: found?.placement ? 'd=\\mathbf{' + texNumber(branch.distance, 6) + '}\\,\\lambda' : null },
      { key: 'stub-length', tex: found?.stub ? '\\ell_s=\\mathbf{' + texNumber(termination === 'open' ? branch.openLength : branch.shortLength, 6) + '}\\,\\lambda_s' : null },
    ] };
  })} />;
}
