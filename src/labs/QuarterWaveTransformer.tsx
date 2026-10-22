import { useMemo, useState } from 'react';
import { QuarterWaveConstruction } from '../components/QuarterWaveConstruction';
import { ParameterField } from '../components/ParameterField';
import { ResetParametersButton } from '../components/ResetParametersButton';
import { solveQuarterWave } from '../domain/quarterWave';
import type { QuarterWaveInput } from '../domain/quarterWave';
import { translateMessage, useI18n } from '../i18n';
import '../styles/single-stub-lab.css';
import '../styles/quarter-wave.css';

export default function QuarterWaveTransformer() {
  const { locale, t } = useI18n();
  const [z0Text, setZ0Text] = useState('50');
  const [rText, setRText] = useState('100');
  const [xText, setXText] = useState('50');
  const [revision, setRevision] = useState(0);
  const { input, solution, error } = useMemo(() => {
    try {
      if (!z0Text.trim() || !rText.trim() || !xText.trim()) throw new RangeError('Enter all electrical parameters to calculate a match.');
      const input: QuarterWaveInput = { z0: Number(z0Text), load: { kind: 'impedance', resistance: Number(rText), reactance: Number(xText) } };
      return { input, solution: solveQuarterWave(input), error: null };
    } catch (error) {
      return { input: null, solution: null, error: error instanceof Error ? error : 'Check the electrical parameters.' };
    }
  }, [z0Text, rText, xText]);
  const constructionKey = [z0Text, rText, xText, revision].join('|');
  function reset() {
    setZ0Text('50'); setRText('100'); setXText('50');
    setRevision((current) => current + 1);
  }
  return <div className="qw-layout ssl-layout">
    <aside className="control-column"><section className="panel parameters-panel parameters-panel--compact" aria-labelledby="quarter-wave-parameters">
      <div className="panel-heading"><h2 id="quarter-wave-parameters">{t('Parameters', 'Parámetros')}</h2><ResetParametersButton onClick={reset} /></div>
      <div className="parameter-grid">
        <ParameterField wide tex="Z_0" label={t('Main-line impedance', 'Impedancia de la línea principal')} value={z0Text} min={0} onChange={setZ0Text} />
        <ParameterField tex="R_L" label={t('Load resistance', 'Resistencia de carga')} value={rText} min={0} onChange={setRText} />
        <ParameterField tex="X_L" label={t('Load reactance', 'Reactancia de carga')} value={xText} onChange={setXText} />
      </div>
      {error && <p className="input-error" role="alert">{translateMessage(error, locale)}</p>}
    </section></aside>
    <div className="ssl-workspace">{input && solution && <QuarterWaveConstruction key={constructionKey} input={input} solution={solution} />}</div>
  </div>;
}
