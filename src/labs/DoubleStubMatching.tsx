import { useMemo, useState } from 'react';
import { Formula } from '../components/Formula';
import { ParameterField } from '../components/ParameterField';
import { ResetParametersButton } from '../components/ResetParametersButton';
import { DoubleStubConstruction } from '../components/DoubleStubConstruction';
import { solveDoubleStub, type DoubleStubInput } from '../domain/doubleStub';
import type { StubTermination } from '../domain/singleStub';
import { translateMessage, useI18n } from '../i18n';
import '../single-stub-lab.css';

interface StubSettings { z0: string; linked: boolean; termination: StubTermination; }

function StubControls({ index, mainZ0, settings, onElectricalChange, onTerminationChange }: {
  index: 1 | 2; mainZ0: string; settings: StubSettings;
  onElectricalChange: (settings: StubSettings) => void;
  onTerminationChange: (termination: StubTermination) => void;
}) {
  const { t } = useI18n();
  const title = index === 1 ? t('Stub 1 — generator side', 'Stub 1 — lado del generador') : t('Stub 2 — load side', 'Stub 2 — lado de la carga');
  return <section className="parameter-stub parameter-stub--wide" aria-labelledby={'double-stub-' + index + '-parameters'}>
    <h3 id={'double-stub-' + index + '-parameters'} title={title}>{t('Stub ' + index, 'Stub ' + index)}</h3>
    <label className="parameter-check"><input type="checkbox" aria-label={t('Stub ' + index + ': same as main line', 'Stub ' + index + ': igual a la línea principal')} checked={settings.linked} onChange={(event) => onElectricalChange({ ...settings, linked: event.target.checked, z0: event.target.checked ? settings.z0 : mainZ0 })} /><span>{t('Same as ', 'Igual a ')}<Formula tex="Z_0" /></span></label>
    <ParameterField label={t('Stub ' + index + ' impedance', 'Impedancia del stub ' + index)} tex={'Z_{0s' + index + '}'} value={settings.linked ? mainZ0 : settings.z0} min={0} disabled={settings.linked} onChange={(z0) => onElectricalChange({ ...settings, z0 })} />
    <fieldset className="parameter-termination"><legend className="parameter-visually-hidden">{t('Stub ' + index + ' termination', 'Terminación del stub ' + index)}</legend>{(['short', 'open'] as const).map((end) => <label key={end}><input type="radio" aria-label={end === 'short' ? t('Short circuit', 'Cortocircuito') : t('Open circuit', 'Circuito abierto')} name={'double-stub-' + index + '-termination'} checked={settings.termination === end} onChange={() => onTerminationChange(end)} />{end === 'short' ? t('Short', 'Corto') : t('Open', 'Abierto')}</label>)}</fieldset>
  </section>;
}

export default function DoubleStubMatching() {
  const { locale, t } = useI18n();
  const [z0Text, setZ0Text] = useState('50');
  const [rText, setRText] = useState('100');
  const [xText, setXText] = useState('50');
  const [distanceText, setDistanceText] = useState('0.125');
  const [separationText, setSeparationText] = useState('0.125');
  const [stub1, setStub1] = useState<StubSettings>({ z0: '50', linked: true, termination: 'short' });
  const [stub2, setStub2] = useState<StubSettings>({ z0: '50', linked: true, termination: 'short' });
  const [revision, setRevision] = useState(0);

  const { input, solution, error } = useMemo(() => {
    try {
      if ([z0Text, rText, xText, distanceText, separationText, stub1.linked ? z0Text : stub1.z0, stub2.linked ? z0Text : stub2.z0].some((value) => !value.trim())) throw new RangeError('Enter all electrical parameters to calculate a match.');
      const input: DoubleStubInput = {
        z0: Number(z0Text), load: { kind: 'impedance', resistance: Number(rText), reactance: Number(xText) },
        distance: Number(distanceText), separation: Number(separationText),
        stub1Z0: Number(stub1.linked ? z0Text : stub1.z0), stub2Z0: Number(stub2.linked ? z0Text : stub2.z0),
      };
      return { input, solution: solveDoubleStub(input), error: null };
    } catch (error) {
      return { input: null, solution: null, error: error instanceof Error ? error : 'Check the electrical parameters.' };
    }
  }, [z0Text, rText, xText, distanceText, separationText, stub1.linked, stub1.z0, stub2.linked, stub2.z0]);

  const constructionKey = [z0Text, rText, xText, distanceText, separationText, stub1.linked, stub1.z0, stub1.termination, stub2.linked, stub2.z0, stub2.termination, revision].join('|');

  function reset() {
    setZ0Text('50'); setRText('100'); setXText('50'); setDistanceText('0.125'); setSeparationText('0.125');
    setStub1({ z0: '50', linked: true, termination: 'short' }); setStub2({ z0: '50', linked: true, termination: 'short' });
    setRevision((current) => current + 1);
  }

  return <div className="dsm-layout ssl-layout">
    <aside className="control-column"><section className="panel parameters-panel parameters-panel--compact" aria-labelledby="double-stub-parameters">
      <div className="panel-heading"><h2 id="double-stub-parameters">{t('Parameters', 'Parámetros')}</h2><ResetParametersButton onClick={reset} /></div>
      <div className="parameter-grid">
      <ParameterField wide tex="Z_0" label={t('Main-line impedance', 'Impedancia de la línea principal')} value={z0Text} min={0} onChange={setZ0Text} />
      <ParameterField tex="R_L" label={t('Load resistance', 'Resistencia de la carga')} value={rText} min={0} onChange={setRText} />
      <ParameterField tex="X_L" label={t('Load reactance', 'Reactancia de la carga')} value={xText} onChange={setXText} />
      <ParameterField tex="d_1" label={t('Load to stub 2 distance d₁', 'Distancia d₁ de la carga al stub 2')} value={distanceText} unit="λ" min={0} onChange={setDistanceText} />
      <ParameterField tex="d_2" label={t('Stub separation d₂', 'Separación d₂ entre stubs')} value={separationText} unit="λ" min={0} onChange={setSeparationText} />
      </div>
      <div className="parameter-stub-grid">
      <StubControls index={1} mainZ0={z0Text} settings={stub1} onElectricalChange={setStub1} onTerminationChange={(termination) => setStub1((current) => ({ ...current, termination }))} />
      <StubControls index={2} mainZ0={z0Text} settings={stub2} onElectricalChange={setStub2} onTerminationChange={(termination) => setStub2((current) => ({ ...current, termination }))} />
      </div>
      {error && <p className="input-error" role="alert">{translateMessage(error, locale)}</p>}
    </section></aside>
    <div className="ssl-workspace">{input && solution && <DoubleStubConstruction key={constructionKey} input={input} solution={solution} termination1={stub1.termination} termination2={stub2.termination} />}</div>
  </div>;
}
