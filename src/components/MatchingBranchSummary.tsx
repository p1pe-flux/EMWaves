import { useI18n } from '../i18n';
import { Formula } from './Formula';
import '../matching-branch-summary.css';

export interface MatchingBranchSummaryBranch {
  index: number;
  title?: string;
  message?: string;
  rows: { key: string; tex: string | null }[];
}

export interface MatchingBranchSummaryProps {
  branches: MatchingBranchSummaryBranch[];
  label?: string;
  variant?: 'standard' | 'highlighted';
}

export function MatchingBranchSummary({ branches, label = 'Matching solutions found', variant = 'standard' }: MatchingBranchSummaryProps) {
  const { t } = useI18n();
  const summaryLabel = label === 'Matching solutions found' ? t(label, 'Soluciones de adaptación encontradas') : label === 'Canonical matched realization' ? t(label, 'Realización canónica adaptada') : label;
  return (
    <div className={'matching-branch-summary' + (variant === 'highlighted' ? ' matching-branch-summary--highlighted' : '')} aria-label={summaryLabel} aria-live="polite">
      {branches.map((branch) => (
        <section className="matching-branch-summary__branch" key={branch.index} data-summary-branch={branch.index} data-summary-count={variant === 'highlighted' ? branch.rows.length : undefined} aria-label={branch.title ?? t('Branch ', 'Rama ') + (branch.index + 1) + t(' solution', ': solución')}>
          <h4>{branch.title ?? <>{t('Branch ', 'Rama ')}{branch.index + 1}</>}</h4>
          {branch.message !== undefined ? <p className="matching-branch-summary__message" role="status">{branch.message}</p> : <div className="matching-branch-summary__values">
            {branch.rows.map((row) => <span key={row.key} data-summary-field={row.key} data-found={variant === 'highlighted' ? row.tex !== null : undefined}>{row.tex !== null && <Formula tex={row.tex} />}</span>)}
          </div>}
        </section>
      ))}
    </div>
  );
}
