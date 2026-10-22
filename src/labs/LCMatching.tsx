import { useMemo, useState } from 'react';
import { LCMatchingConstruction } from '../components/LCMatchingConstruction';
import { LCMatchingStatusSummary } from '../components/LCMatchingBranchSummary';
import { LCNetworkOptions } from '../components/LCNetworkOptions';
import { ParameterField } from '../components/ParameterField';
import { ResetParametersButton } from '../components/ResetParametersButton';
import { solveLumpedMatching, type LumpedMatchingInput, type LumpedMatchingTopology } from '../domain/lumpedMatching';
import { translateMessage, useI18n } from '../i18n';
import '../styles/single-stub-lab.css';

const defaultTopology: LumpedMatchingTopology = {
  elements: [
    { component: 'L', connection: 'series' },
    { component: 'C', connection: 'parallel' },
  ],
};

export default function LCMatching() {
  const { locale, t } = useI18n();
  const [z0Text, setZ0Text] = useState('50');
  const [frequencyText, setFrequencyText] = useState('1000');
  const [rText, setRText] = useState('100');
  const [xText, setXText] = useState('50');
  const [topology, setTopology] = useState<LumpedMatchingTopology>(defaultTopology);
  const [revision, setRevision] = useState(0);

  const { input, solution, error } = useMemo(() => {
    try {
      if (!z0Text.trim() || !frequencyText.trim() || !rText.trim() || !xText.trim()) {
        throw new RangeError('Enter all electrical parameters to calculate a match.');
      }
      const input: LumpedMatchingInput = {
        z0: Number(z0Text),
        frequencyHz: Number(frequencyText) * 1e6,
        load: { kind: 'impedance', resistance: Number(rText), reactance: Number(xText) },
        ...topology,
      };
      return { input, solution: solveLumpedMatching(input), error: null };
    } catch (error) {
      return { input: null, solution: null, error: error instanceof Error ? error : 'Check the electrical parameters.' };
    }
  }, [z0Text, frequencyText, rText, xText, topology]);

  const constructionKey = [z0Text, frequencyText, rText, xText, ...topology.elements.flatMap(({ component, connection }) => [component, connection]), revision].join('|');

  function reset() {
    setZ0Text('50'); setFrequencyText('1000'); setRText('100'); setXText('50');
    setTopology(defaultTopology);
    setRevision((current) => current + 1);
  }

  return <div className="ssl-layout">
    <aside className="control-column">
      <section className="panel parameters-panel parameters-panel--compact" aria-labelledby="lc-matching-parameters">
        <div className="panel-heading"><h2 id="lc-matching-parameters">{t('Parameters', 'Parámetros')}</h2><ResetParametersButton onClick={reset} /></div>
        <div className="parameter-grid">
          <ParameterField tex="Z_0" label={t('Reference impedance', 'Impedancia de referencia')} value={z0Text} min={0} onChange={setZ0Text} />
          <ParameterField tex="f" label={t('Frequency', 'Frecuencia')} unit="MHz" value={frequencyText} min={0} onChange={setFrequencyText} />
          <ParameterField tex="R_L" label={t('Load resistance', 'Resistencia de la carga')} value={rText} min={0} onChange={setRText} />
          <ParameterField tex="X_L" label={t('Load reactance', 'Reactancia de la carga')} value={xText} onChange={setXText} />
        </div>
        <LCNetworkOptions value={topology} onChange={setTopology} />
        {error && <p className="input-error" role="alert">{translateMessage(error, locale)}</p>}
      </section>
    </aside>
    <div className="ssl-workspace">
      {input && solution ? <LCMatchingConstruction key={constructionKey} input={input} solution={solution} /> : <section className="ss-construction lc-matching-construction"><div className="ss-construction__toolbar"><LCMatchingStatusSummary message={t('Enter valid electrical parameters to calculate a solution.', 'Introduce parámetros eléctricos válidos para calcular una solución.')} /></div></section>}
    </div>
  </div>;
}
