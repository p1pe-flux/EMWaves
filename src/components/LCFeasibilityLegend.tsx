import type { LumpedFeasibilityClassification } from '../domain/lumpedFeasibility';
import { useI18n } from '../i18n';
import { Formula } from './Formula';

export function LCFeasibilityLegend({ kind, classification, alreadyMatched = false }: {
  kind: 'area' | 'curve';
  classification: LumpedFeasibilityClassification;
  alreadyMatched?: boolean;
}) {
  const { t } = useI18n();
  const message = alreadyMatched
    ? t('is already matched; no additional network is needed.', 'ya está adaptada; no necesita una red adicional.')
    : classification === 'matchable'
      ? null
      : classification === 'continuous'
        ? t('lies on the admissible curve.', 'está sobre la curva admisible.')
        : classification === 'boundary'
          ? t('lies on an excluded boundary: a component would be zero or infinite.', 'está en una frontera excluida: un componente sería nulo o infinito.')
          : classification === 'unmatchable'
            ? t('absorbs no real power and cannot be matched.', 'no absorbe potencia real y no se puede adaptar.')
            : kind === 'curve'
              ? t('does not lie on the admissible curve.', 'no está sobre la curva admisible.')
              : t('lies outside the matching region.', 'queda fuera de la zona adaptable.');
  return <div className="lc-feasibility" data-feasibility-kind={kind}>
    <div className="lc-grid-legend" aria-label={t('Overlaid Smith chart grids', 'Cuadrículas superpuestas del diagrama de Smith')}>
      <span className="lc-grid-legend__impedance"><i />{t('Impedance', 'Impedancia')} <Formula tex="z" /></span>
      <span className="lc-grid-legend__admittance"><i />{t('Admittance', 'Admitancia')} <Formula tex="y" /></span>
    </div>
    <div className="lc-feasibility__legend">
      <span><i className={'lc-feasibility__swatch lc-feasibility__swatch--' + kind} />{kind === 'area' ? t('Matchable loads', 'Cargas adaptables') : t('Only loads on this curve', 'Sólo cargas sobre esta curva')}</span>
      {kind === 'area' && <span><i className="lc-feasibility__swatch lc-feasibility__swatch--boundary" />{t('Excluded boundary', 'Frontera excluida')}</span>}
    </div>
    {message !== null && <p className="lc-feasibility__status" role="status" data-load-feasibility={classification}><Formula tex="Z_L" /> {message}</p>}
  </div>;
}
