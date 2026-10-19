import type { LCMatchingSolution } from '../domain/lcMatching';
import type { LumpedMatchingSolution } from '../domain/lumpedMatching';
import { useI18n } from '../i18n';
import { texNumber } from '../math/format';
import { MatchingBranchSummary } from './MatchingBranchSummary';
import { lcMatchingResultMilestones } from './lcMatchingPlayback';
import type { LCMatchingConstructionStep, LCMatchingStepPosition } from './lcMatchingPlayback';

export interface LCMatchingBranchSummaryProps {
  solution: LCMatchingSolution | LumpedMatchingSolution;
  steps: readonly LCMatchingConstructionStep[];
  position: LCMatchingStepPosition;
}

/** SI input; the displayed component units remain nH and pF throughout the app. */
export function formattedLCValue(component: 'L' | 'C', value: number, index?: number) {
  const scaled = value * (component === 'L' ? 1e9 : 1e12);
  const unit = component === 'L' ? 'nH' : 'pF';
  const digits = scaled !== 0 && Math.abs(scaled) < 0.001 ? Math.min(16, 3 - Math.floor(Math.log10(Math.abs(scaled)))) : 5;
  const number = texNumber(scaled, digits);
  const symbol = component + (index === undefined ? '' : '_' + index);
  return { value: scaled, unit, label: symbol + ' = ' + Number(scaled.toPrecision(6)) + ' ' + unit, tex: symbol + '=\\mathbf{' + number + '}\\,\\mathrm{' + unit + '}' };
}

export function LCMatchingStatusSummary({ message }: { message: string }) {
  const { t } = useI18n();
  return <MatchingBranchSummary variant="highlighted" branches={[{ index: 0, title: t('Solution', 'Solución'), rows: [], message }]} />;
}

export function LCMatchingBranchSummary({ solution, steps, position }: LCMatchingBranchSummaryProps) {
  const { t } = useI18n();
  if (solution.status !== 'solved') {
    const message = solution.status === 'continuous'
      ? t('Continuous family of solutions', 'Familia continua de soluciones')
      : solution.status === 'already-matched'
        ? t('The load is already matched', 'La carga ya está adaptada')
        : t('No positive, finite pair for this topology', 'No existe un par positivo y finito para esta topología');
    return <LCMatchingStatusSummary message={message} />;
  }
  const milestones = lcMatchingResultMilestones(steps, position);
  return <MatchingBranchSummary variant="highlighted" branches={solution.branches.map((branch, index) => {
    const found = milestones.get(index);
    const elements = 'elements' in branch ? branch.elements : [branch.stages[1], branch.stages[0]].map(stage => ({
      component: stage.component, value: stage.component === 'L' ? branch.inductance : branch.capacitance,
    }));
    return { index, title: t('Solution', 'Solución'), rows: elements.map((element, elementIndex) => ({
      key: 'element-' + (elementIndex + 1),
      tex: (elementIndex === 0 ? found?.source : found?.load) ? formattedLCValue(element.component, element.value, elementIndex + 1).tex : null,
    })) };
  })} />;
}
