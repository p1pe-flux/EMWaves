import type { QuarterWaveSolution } from '../domain/quarterWave';
import { texNumber } from '../math/format';
import { MatchingBranchSummary } from './MatchingBranchSummary';
import { quarterWaveMilestones, quarterWaveSteps } from './quarterWavePlayback';
import type { QuarterWavePosition } from './quarterWavePlayback';

export function QuarterWaveBranchSummary({ solution, position, periodicDistance = 0, periodicTransformerLength = 0 }: {
  solution: QuarterWaveSolution;
  position: QuarterWavePosition;
  periodicDistance?: number;
  periodicTransformerLength?: number;
}) {
  const milestones = quarterWaveMilestones(quarterWaveSteps(solution.branches.length), position);
  const branches = solution.branches.map((branch, index) => {
    const found = milestones.find((milestone) => milestone.branchIndex === index);
    return {
      index,
      rows: [
        { key: 'distance', tex: found?.placement ? 'd=\\mathbf{' + texNumber(branch.distance + periodicDistance, 6) + '}\\,\\lambda' : null },
        { key: 'transformer-impedance', tex: found?.transformer ? 'Z_t=\\mathbf{' + texNumber(branch.transformerZ0, 6) + '}\\;\\Omega' : null },
        { key: 'transformer-length', tex: found?.length ? '\\ell_t=\\mathbf{' + texNumber(branch.transformerLength + periodicTransformerLength, 6) + '}\\,\\lambda_t' : null },
      ],
    };
  });
  return <MatchingBranchSummary branches={branches} label={solution.status === 'already-matched' ? 'Canonical matched realization' : 'Matching solutions found'} variant="highlighted" />;
}
