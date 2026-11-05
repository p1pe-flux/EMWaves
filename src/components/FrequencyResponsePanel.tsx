import { useId, useMemo, useState } from 'react';
import type { PointerEvent } from 'react';
import { useI18n } from '../i18n';
import {
  frequencyResponseSampleCount,
  sampleFrequencyResponse,
  type FrequencyResponseBranch,
} from '../domain/frequencyResponse';
import { Formula } from './Formula';
import { ParameterField } from './ParameterField';
import '../styles/frequency-response.css';

export interface FrequencyResponsePanelProps {
  branches: FrequencyResponseBranch[];
  designFrequencyHz: number;
  emptyMessage?: string;
}

interface PlotSettings {
  designFrequencyHz: number;
  startHz: number;
  stopHz: number;
}

const plot = { width: 680, height: 310, left: 46, right: 20, top: 16, bottom: 38 };
const graphWidth = plot.width - plot.left - plot.right;
const graphHeight = plot.height - plot.top - plot.bottom;

function frequencyText(hz: number, locale: string): string {
  const mhz = hz / 1e6;
  return new Intl.NumberFormat(locale, { maximumSignificantDigits: 6 }).format(mhz);
}

function defaultFrequencyText(hz: number): string {
  if (!Number.isFinite(hz) || hz <= 0) return '';
  return String(Number((hz / 1e6).toPrecision(8)));
}

function useBranchLabel(branches: FrequencyResponseBranch[]) {
  const { t } = useI18n();
  return (branch: FrequencyResponseBranch) => branch.labelIndex === 0
    ? t('Input', 'Entrada')
    : branches.length === 1 ? t('Solution', 'Solución') : t('Branch ', 'Rama ') + branch.labelIndex;
}

/** The network is already solved at f0; this view only evaluates that fixed network. */
export function FrequencyResponsePlot({ branches, settings }: { branches: FrequencyResponseBranch[]; settings: PlotSettings }) {
  const { locale, t } = useI18n();
  const id = useId();
  const label = useBranchLabel(branches);
  const { designFrequencyHz, startHz, stopHz } = settings;
  const [readoutText, setReadoutText] = useState(() => defaultFrequencyText(Math.max(startHz, Math.min(stopHz, designFrequencyHz))));
  const readoutHz = Number(readoutText) * 1e6;
  const validReadout = readoutText.trim() !== '' && Number.isFinite(readoutHz) && readoutHz >= startHz && readoutHz <= stopHz;
  const curves = useMemo(() => {
    try {
      const points = frequencyResponseSampleCount(branches, { designFrequencyHz, startHz, stopHz });
      return branches.map((branch) => ({
        branch,
        samples: sampleFrequencyResponse(branch.evaluate, { designFrequencyHz, startHz, stopHz, points }),
      }));
    } catch {
      return null;
    }
  }, [branches, designFrequencyHz, startHz, stopHz]);
  const x = (hz: number) => plot.left + (hz - startHz) / (stopHz - startHz) * graphWidth;
  const y = (magnitude: number) => plot.top + (1 - magnitude) * graphHeight;
  const insideDesign = designFrequencyHz >= startHz && designFrequencyHz <= stopHz;

  if (!curves) return <p className="input-error" role="alert">{t('This frequency range is too wide to resolve reliably or exceeds the numerical range of the model. Narrow the sweep.', 'Este intervalo de frecuencias es demasiado amplio para resolverlo de forma fiable o supera el alcance numérico del modelo. Reduce el intervalo del barrido.')}</p>;

  function readPointer(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width) return;
    const graphX = (event.clientX - bounds.left) / bounds.width * plot.width;
    const ratio = Math.max(0, Math.min(1, (graphX - plot.left) / graphWidth));
    setReadoutText(defaultFrequencyText(startHz + ratio * (stopHz - startHz)));
  }

  return <div className="frequency-response__results">
    <div className="frequency-response__legend" aria-label={t('Frequency response curves', 'Curvas de respuesta en frecuencia')}>
      {branches.map((branch, index) => <span key={branch.id}><i className={'frequency-response__swatch frequency-response__swatch--' + index} />{label(branch)}</span>)}
    </div>
    <div className="frequency-response__chart">
      <div className="frequency-response__ordinate"><Formula tex="|\Gamma|" /></div>
      <svg viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label={t('Reflection magnitude as a function of frequency', 'Módulo de reflexión en función de la frecuencia')} aria-describedby={id + '-description'} data-design-frequency-hz={designFrequencyHz} onPointerMove={readPointer}>
        <desc id={id + '-description'}>{t('Frequency sweep from ', 'Barrido de frecuencia desde ')}{frequencyText(startHz, locale)}{t(' to ', ' hasta ')}{frequencyText(stopHz, locale)} MHz. {t('The vertical scale is reflection magnitude, from zero to one.', 'La escala vertical es el módulo de reflexión, de cero a uno.')}</desc>
        {[0, .25, .5, .75, 1].map((value) => <g key={value} className="frequency-response__tick">
          <line x1={plot.left} x2={plot.width - plot.right} y1={y(value)} y2={y(value)} />
          <text x={plot.left - 10} y={y(value) + 4} textAnchor="end">{new Intl.NumberFormat(locale).format(value)}</text>
        </g>)}
        {[0, .25, .5, .75, 1].map((value) => {
          const hz = startHz + value * (stopHz - startHz);
          return <g key={value} className="frequency-response__tick">
            <line x1={x(hz)} x2={x(hz)} y1={plot.top} y2={plot.height - plot.bottom} />
            <text x={x(hz)} y={plot.height - 12} textAnchor="middle">{new Intl.NumberFormat(locale, { maximumSignificantDigits: 4 }).format(hz / 1e6)}</text>
          </g>;
        })}
        <line className="frequency-response__axis" x1={plot.left} x2={plot.width - plot.right} y1={y(0)} y2={y(0)} />
        <line className="frequency-response__axis" x1={plot.left} x2={plot.left} y1={y(0)} y2={y(1)} />
        {insideDesign && <g className="frequency-response__design-marker">
          <line x1={x(designFrequencyHz)} x2={x(designFrequencyHz)} y1={plot.top} y2={y(0)} />
          <text x={x(designFrequencyHz) + 5} y={plot.top + 13}>f₀</text>
        </g>}
        {curves.map(({ branch, samples }, index) => <path key={branch.id} data-response-branch={branch.id} className={'frequency-response__curve frequency-response__curve--' + index} d={samples.map((point, sampleIndex) => (sampleIndex === 0 ? 'M' : 'L') + x(point.frequencyHz).toFixed(3) + ',' + y(point.magnitude).toFixed(3)).join(' ')} />)}
        {validReadout && <g className="frequency-response__readout-marker">
          <line x1={x(readoutHz)} x2={x(readoutHz)} y1={plot.top} y2={y(0)} />
          {branches.map((branch, index) => <circle key={branch.id} className={'frequency-response__point frequency-response__point--' + index} cx={x(readoutHz)} cy={y(branch.evaluate(readoutHz / designFrequencyHz))} r="4" />)}
        </g>}
      </svg>
      <div className="frequency-response__abscissa">{t('Frequency', 'Frecuencia')} (MHz)</div>
    </div>
    <div className="frequency-response__readout">
      <ParameterField tex="f" label={t('Readout frequency', 'Frecuencia de lectura')} unit="MHz" value={readoutText} min={startHz / 1e6} onChange={setReadoutText} />
      {validReadout ? <output aria-live="polite" className="frequency-response__readout-values">{branches.map((branch) => <span key={branch.id} data-response-readout={branch.id} data-frequency-hz={readoutHz} data-magnitude={branch.evaluate(readoutHz / designFrequencyHz)}>{label(branch)}: <Formula tex={'|\\Gamma| = ' + branch.evaluate(readoutHz / designFrequencyHz).toFixed(5)} /></span>)}</output> : <p className="frequency-response__note">{t('Choose a readout frequency within the sweep.', 'Elige una frecuencia de lectura dentro del barrido.')}</p>}
    </div>
  </div>;
}

export function FrequencyResponsePanel({ branches, designFrequencyHz, emptyMessage }: FrequencyResponsePanelProps) {
  const { t } = useI18n();
  const id = useId();
  const [startText, setStartText] = useState(() => defaultFrequencyText(designFrequencyHz * .5));
  const [stopText, setStopText] = useState(() => defaultFrequencyText(designFrequencyHz * 1.5));
  const startHz = Number(startText) * 1e6;
  const stopHz = Number(stopText) * 1e6;
  const valid = [startText, stopText].every((value) => value.trim() !== '')
    && Number.isFinite(startHz) && Number.isFinite(stopHz) && startHz > 0 && stopHz > startHz
    && Number.isFinite(designFrequencyHz) && designFrequencyHz > 0;

  return <section className="frequency-response" aria-labelledby={id + '-heading'}>
    <div className="frequency-response__heading"><h2 id={id + '-heading'}>{t('Frequency response', 'Respuesta en frecuencia')}</h2><Formula tex="|\Gamma(f)|" /></div>
    {branches.length === 0 ? <p className="frequency-response__note">{emptyMessage ?? t('No discrete matching network is available for these parameters.', 'No hay una red de adaptación discreta para estos parámetros.')}</p>
      : <>
        <p className="frequency-response__intro">{branches.every((branch) => branch.labelIndex === 0)
          ? <>{t('With a fixed load and a lossless line, ', 'Con una carga fija y una línea sin pérdidas, ')}<Formula tex="|\Gamma|" />{t(' is independent of frequency; the line alone does not match the load.', ' es independiente de la frecuencia; la línea por sí sola no adapta la carga.')}</>
          : <>{t('Match at ', 'Adapta en ')}<Formula tex="f_0" />{t(' and sweep frequency while keeping the network fixed.', ' y barre la frecuencia manteniendo fija la red.')}</>}</p>
        <div className="frequency-response__controls">
          <ParameterField tex="f_{\min}" label={t('Sweep start frequency', 'Frecuencia inicial del barrido')} unit="MHz" value={startText} min={0} onChange={setStartText} />
          <ParameterField tex="f_{\max}" label={t('Sweep stop frequency', 'Frecuencia final del barrido')} unit="MHz" value={stopText} min={0} onChange={setStopText} />
        </div>
        {!valid && <p className="input-error" role="alert">{t('Enter positive frequencies with the final frequency greater than the initial frequency.', 'Introduce frecuencias positivas, con la frecuencia final mayor que la inicial.')}</p>}
        {valid && <FrequencyResponsePlot branches={branches} settings={{ designFrequencyHz, startHz, stopHz }} />}
      </>}
  </section>;
}
