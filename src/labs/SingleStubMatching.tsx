import { useI18n, translateMessage } from '../i18n';
import { useMemo, useState } from 'react';
import { SingleStubConstruction } from '../components/SingleStubConstruction';
import { StubParameters } from '../components/StubParameters';
import { ParameterField } from '../components/ParameterField';
import { ResetParametersButton } from '../components/ResetParametersButton';
import { solveSingleStub, type SingleStubInput, type StubTermination } from '../domain/singleStub';
import '../styles/single-stub-lab.css';

export default function SingleStubMatching() {
  const { locale, t } = useI18n();
  const [z0Text, setZ0Text] = useState('50');
  const [stubZ0Text, setStubZ0Text] = useState('50');
  const [linked, setLinked] = useState(true);
  const [rText, setRText] = useState('100');
  const [xText, setXText] = useState('50');
  const [termination, setTermination] = useState<StubTermination>('short');
  const [revision, setRevision] = useState(0);

  const { input, solution, error } = useMemo(() => {
    try {
      if (!z0Text.trim() || (!linked && !stubZ0Text.trim()) || !rText.trim() || !xText.trim()) throw new RangeError('Enter all electrical parameters to calculate a match.');
      const input: SingleStubInput = {
        z0: Number(z0Text), stubZ0: Number(linked ? z0Text : stubZ0Text),
        load: { kind: 'impedance', resistance: Number(rText), reactance: Number(xText) },
      };
      return { input, solution: solveSingleStub(input), error: null };
    } catch (error) {
      return { input: null, solution: null, error: error instanceof Error ? error : 'Check the electrical parameters.' };
    }
  }, [z0Text, stubZ0Text, linked, rText, xText]);

  const constructionKey = [z0Text, stubZ0Text, linked, rText, xText, revision].join('|');

  function reset() {
    setZ0Text('50'); setStubZ0Text('50'); setLinked(true); setRText('100'); setXText('50');
    setTermination('short');
    setRevision((current) => current + 1);
  }

  return <div className="ssl-layout">
    <aside className="control-column">
      <section className="panel parameters-panel parameters-panel--compact" aria-labelledby="single-stub-parameters">
        <div className="panel-heading"><h2 id="single-stub-parameters">{t("Parameters", "Parámetros")}</h2><ResetParametersButton onClick={reset} /></div>
        <div className="parameter-grid">
          <ParameterField wide tex="Z_0" label={t("Main-line impedance", "Impedancia de la línea principal")} value={z0Text} min={0} onChange={setZ0Text} />
          <ParameterField tex="R_L" label={t("Load resistance", "Resistencia de la carga")} value={rText} min={0} onChange={setRText} />
          <ParameterField tex="X_L" label={t("Load reactance", "Reactancia de la carga")} value={xText} onChange={setXText} />
        </div>
        <div className="parameter-stub-grid">
          <StubParameters id="single-stub" mainZ0={z0Text} stubZ0={stubZ0Text} linked={linked} termination={termination}
            onStubZ0Change={setStubZ0Text} onLinkedChange={(nextLinked) => { setLinked(nextLinked); if (!nextLinked) setStubZ0Text(z0Text); }} onTerminationChange={setTermination} />
        </div>
        {error && <p className="input-error" role="alert">{translateMessage(error, locale)}</p>}
      </section>
    </aside>

    <div className="ssl-workspace">
      {input && solution && <SingleStubConstruction key={constructionKey + '|' + termination} input={input} solution={solution} termination={termination} showTerminationControl={false} />}
    </div>
  </div>;
}
