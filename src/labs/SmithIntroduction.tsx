import { useEffect, useMemo, useRef, useState } from 'react';
import { Formula } from '../components/Formula';
import { ParameterField } from '../components/ParameterField';
import { ResetParametersButton } from '../components/ResetParametersButton';
import { SmithChart } from '../components/SmithChart';
import { TransmissionLineDiagram } from '../components/TransmissionLineDiagram';
import { reflectionToImpedance, solveLine } from '../domain/transmission';
import { advanceLinePosition, clampLinePosition, parseLineLength } from '../domain/lineTraversal';
import type { ComplexValue, Load } from '../domain/transmission';
import { complexTex, formatNumber, reflectionPhaseRadians, reflectionPolarTex, texNumber } from '../math/format';
import { useI18n, translateMessage } from '../i18n';
import '../styles/lab-controls.css';
import '../styles/line-traversal.css';

function Icon({ name, size = 18 }: { name: 'reset' | 'play' | 'pause' | 'arrow'; size?: number }) {
  const paths = {
    reset: <><path d="M3 10a9 9 0 1 1 2.6 8.4" /><path d="M3 4v6h6" /></>,
    play: <path d="m8 5 11 7-11 7Z" />,
    pause: <><path d="M8 5v14M16 5v14" /></>,
    arrow: <><path d="M5 12h14m-5-5 5 5-5 5" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function SmithIntroduction() {
  const { locale, t } = useI18n();
  const [z0Text, setZ0Text] = useState('50');
  const [resistanceText, setResistanceText] = useState('100');
  const [reactanceText, setReactanceText] = useState('50');
  const [kind, setKind] = useState<Load['kind']>('impedance');
  const [lineLengthText, setLineLengthText] = useState('1');
  const [length, setLength] = useState(0);
  const [showCurves, setShowCurves] = useState(false);
  const [showGamma, setShowGamma] = useState(false);
  const [showSwr, setShowSwr] = useState(false);
  const [playing, setPlaying] = useState(false);
  const animationTime = useRef<number | null>(null);
  const z0 = Number(z0Text);
  const line = useMemo(() => {
    try { return { totalLength: parseLineLength(lineLengthText), error: null }; }
    catch (problem) { return { totalLength: null, error: problem instanceof Error ? problem : 'Check the line length.' }; }
  }, [lineLengthText]);
  const totalLength = line.totalLength ?? 0;

  const { solution, load, error } = useMemo(() => {
    try {
      if (line.error) throw line.error;
      if (!z0Text.trim() || (kind === 'impedance' && (!resistanceText.trim() || !reactanceText.trim()))) {
        throw new Error('Enter the values to plot the load on the chart.');
      }
      const load: Load = kind === 'impedance'
        ? { kind, resistance: Number(resistanceText), reactance: Number(reactanceText) }
        : { kind };
      return { solution: solveLine({ z0, load, lengthInWavelengths: length }), load, error: null };
    } catch (problem) {
      return { solution: null, load: null, error: problem instanceof Error ? problem : 'Check the load values.' };
    }
  }, [z0Text, z0, resistanceText, reactanceText, kind, length, line.error]);

  useEffect(() => {
    if (!playing || error || totalLength === 0) return;
    let frame: number;
    animationTime.current = null;
    function animate(time: number) {
      const elapsed = animationTime.current === null ? 0 : Math.min(time - animationTime.current, 100);
      animationTime.current = time;
      setLength((current) => advanceLinePosition(current, totalLength, elapsed));
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); animationTime.current = null; };
  }, [playing, error, totalLength]);

  useEffect(() => { if (length >= totalLength || error) setPlaying(false); }, [length, totalLength, error]);

  function reset() {
    setPlaying(false); setZ0Text('50'); setResistanceText('100'); setReactanceText('50');
    setKind('impedance'); setLineLengthText('1'); setLength(0); setShowCurves(false); setShowGamma(false); setShowSwr(false);
  }

  function chooseLineLength(text: string) {
    setPlaying(false);
    setLineLengthText(text);
    try { setLength(parseLineLength(text)); } catch { /* Keep the last position while the length is being edited. */ }
  }

  function choosePosition(distance: number) {
    setPlaying(false);
    setLength(clampLinePosition(distance, totalLength));
  }

  function selectReflection(gamma: ComplexValue) {
    if (!Number.isFinite(z0) || z0 <= 0) return;
    setPlaying(false);
    const impedance = reflectionToImpedance(gamma);
    if (impedance === null) { setKind('open'); return; }
    setKind('impedance');
    setResistanceText(String(Number(Math.max(0, impedance.re * z0).toPrecision(12))));
    setReactanceText(String(Number((impedance.im * z0).toPrecision(12))));
  }

  const phase = solution ? reflectionPhaseRadians(solution.loadReflection) : null;
  const inputTex = solution ? complexTex(solution.inputImpedance) : '\\text{—}';
  const normalizedInputTex = solution ? complexTex(solution.inputImpedance === null ? null : {
    re: solution.inputImpedance.re / z0,
    im: solution.inputImpedance.im / z0,
  }) : '\\text{—}';
  const inputReflectionTex = solution ? reflectionPolarTex(solution.inputReflection) : '\\text{—}';
  const togglePlay = () => {
    if (!playing && length >= totalLength) setLength(0);
    setPlaying((current) => !current);
  };

  return (
    <div className="laboratory-layout">
      <aside className="control-column">
        <section className="panel parameters-panel parameters-panel--compact" aria-labelledby="parameters-title">
          <div className="panel-heading"><h2 id="parameters-title">{t('Parameters', 'Parámetros')}</h2><ResetParametersButton onClick={reset} /></div>
          <div className="parameter-grid">
            <ParameterField wide id="z0" label={t('Characteristic impedance', 'Impedancia característica')} tex="Z_0" min={0.001} value={z0Text} onChange={(value) => { setPlaying(false); setZ0Text(value); }} />
            <ParameterField label={t('Load resistance', 'Resistencia de la carga')} tex="R_L" min={0} disabled={kind !== 'impedance'} value={resistanceText} onChange={(value) => { setPlaying(false); setResistanceText(value); }} />
            <ParameterField label={t('Load reactance', 'Reactancia de la carga')} tex="X_L" disabled={kind !== 'impedance'} value={reactanceText} onChange={(value) => { setPlaying(false); setReactanceText(value); }} />
            <ParameterField wide id="total-line-length" label={t('Total line length', 'Longitud total de la línea')} tex="L" min={0} unit="λ" value={lineLengthText} onChange={chooseLineLength} />
          </div>
          {kind !== 'impedance' && <button className="text-button" onClick={() => setKind('impedance')}>{t('Enter another impedance', 'Introducir otra impedancia')} <Icon name="arrow" size={14} /></button>}
          {error && <p className="input-error" role="alert">{translateMessage(error, locale)}</p>}
        </section>

      </aside>

      <div className="lab-visual-workspace">
        <div className="lab-visual-workspace__toolbar">
            <div className="chart-actions">
              <button className="lab-control" aria-label={showCurves ? t('Hide curves', 'Ocultar curvas') : t('Show curves', 'Mostrar curvas')} aria-pressed={showCurves} disabled={!solution} onClick={() => setShowCurves((visible) => !visible)}>{t('Curves', 'Curvas')}</button>
              <button className="lab-control" aria-label={showGamma ? t('Hide gamma', 'Ocultar Γ') : t('Show gamma', 'Mostrar Γ')} aria-pressed={showGamma} disabled={!solution} onClick={() => setShowGamma((visible) => !visible)}>Γ</button>
              <button className="lab-control" aria-label={showSwr ? t('Hide SWR circle', 'Ocultar círculo de ROE') : t('Show SWR circle', 'Mostrar círculo de ROE')} aria-pressed={showSwr} disabled={!solution} onClick={() => setShowSwr((visible) => !visible)}>{t('SWR', 'ROE')}</button>
            </div>
          <div className="line-traversal__controls">
            <button className="lab-control lab-control--primary" onClick={togglePlay} disabled={!solution || totalLength === 0} aria-label={playing ? t('Pause animation', 'Pausar animación') : t('Animate line traversal', 'Animar el recorrido de la línea')} title={playing ? t('Pause', 'Pausar') : t('Animate', 'Animar')}><Icon name={playing ? 'pause' : 'play'} size={14} />{playing ? t('Pause', 'Pausar') : t('Animate', 'Animar')}</button>
            <button className="lab-control" aria-label={t('Restart from the load', 'Reiniciar desde la carga')} onClick={() => choosePosition(0)} disabled={!solution}><Icon name="reset" size={14} />{t('Restart', 'Reiniciar')}</button>
          </div>
        </div>
        <section className="panel chart-panel" aria-label={t('Smith chart', 'Diagrama de Smith')}>
          <SmithChart solution={solution} length={length} showCurves={showCurves} showGamma={showGamma} showSwr={showSwr} pointLabels={{ load: 'z_L', input: 'z(\\ell)' }} onSelectReflection={selectReflection} />
          <div className="chart-measurements" aria-label={t('Load measurements', 'Medidas de la carga')}>
            <span className={'measurement-resistance' + (showCurves && solution ? '' : ' chart-measurement--hidden')} aria-hidden={!showCurves || !solution}>
              {solution?.normalizedLoad ? <><i /><Formula tex={'r_L = ' + texNumber(solution.normalizedLoad.re)} /></> : <Formula tex={'z_L \\to \\infty'} />}
            </span>
            <span className={'measurement-reactance' + (showCurves && solution?.normalizedLoad ? '' : ' chart-measurement--hidden')} aria-hidden={!showCurves || !solution?.normalizedLoad}>
              <i /><Formula tex={'x_L = ' + (solution?.normalizedLoad ? texNumber(solution.normalizedLoad.im) : '\\text{—}')} />
            </span>
            <span className={showGamma && solution ? '' : 'chart-measurement--hidden'} aria-hidden={!showGamma || !solution}>
              <Formula tex={'|\\Gamma_L| = ' + (solution ? texNumber(solution.reflectionMagnitude) : '\\text{—}')} />
            </span>
            <span className={showGamma && solution ? '' : 'chart-measurement--hidden'} aria-hidden={!showGamma || !solution}>
              <Formula tex={phase === null ? '\\phi_L\\text{' + t(' undefined', ' indefinida') + '}' : '\\phi_L = ' + texNumber(phase) + '\\,\\mathrm{rad}'} />
            </span>
          </div>
          <div className="chart-legend"><span><i className="legend-dot legend-dot--load" />{t('Load', 'Carga')} <Formula tex={"z_L"} /></span><span><i className="legend-dot legend-dot--input" />{t('Selected', 'Seleccionada')} <Formula tex={'z(\\ell)'} /></span><span className="scale-caption">{t('Outer scale:', 'Escala exterior:')} <Formula tex={"l/\\lambda"} /></span></div>
        </section>

        <section className="panel line-traversal" aria-label={t('Transmission line', 'Línea de transmisión')}>
          <TransmissionLineDiagram compact lengthInWavelengths={totalLength} distanceInWavelengths={length} z0={solution ? z0 : null} load={load} onDistanceChange={choosePosition} disabled={!solution} />
          <div className="line-traversal__heading"><label htmlFor="line-length">{t('Distance from load', 'Distancia desde la carga')}</label><Formula tex={'\\ell=' + texNumber(length, 6) + '\\,\\lambda'} /></div>
          <div className="slider-row">
            <div className="slider-wrap"><input id="line-length" aria-valuetext={formatNumber(length, 6) + t(' wavelengths from the load', ' longitudes de onda desde la carga')} type="range" min="0" max={totalLength} step="any" value={Math.min(length, totalLength)} disabled={!solution || totalLength === 0} style={{ backgroundSize: (totalLength > 0 ? length / totalLength * 100 : 0) + '% 100%' }} onChange={(event) => choosePosition(Number(event.target.value))} /><div className="slider-ticks"><span>L</span><span>3L/4</span><span>L/2</span><span>L/4</span><span>0</span></div></div>
          </div>
          <div className="line-traversal__readings" aria-label={t('Values at the selected line position', 'Valores en la posición seleccionada de la línea')}>
            <Formula tex={'Z(\\ell)=' + (solution?.inputImpedance?.im ? '\\left(' + inputTex + '\\right)' : inputTex) + '\\;\\Omega'} display />
            <Formula tex={'z(\\ell)=' + normalizedInputTex} display />
            <Formula tex={'\\Gamma(\\ell)=' + inputReflectionTex} display />
            <Formula tex={'\\mathrm{VSWR}=' + (solution ? texNumber(solution.vswr) : '\\text{—}')} display />
          </div>
          {solution && <p className="line-traversal__explanation">{t('Along a lossless line, the phase of the reflection coefficient changes with distance, while its magnitude and the SWR remain constant. The impedance repeats every half wavelength.', 'En una línea sin pérdidas, la fase del coeficiente de reflexión cambia con la distancia, mientras su módulo y la ROE permanecen constantes. La impedancia se repite cada media longitud de onda.')}</p>}
        </section>
      </div>
    </div>
  );
}
