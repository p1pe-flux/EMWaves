import { useId } from 'react';
import type { SeriesStubInput } from '../domain/seriesStub';
import type { StubTermination } from '../domain/singleStub';
import { useI18n } from '../i18n';
import { formatNumber } from '../math/format';
import '../series-stub.css';

export interface SeriesStubDiagramProps {
  input: SeriesStubInput;
  termination?: StubTermination;
  distance?: number;
  stubLength?: number;
  attached?: boolean;
  showStub?: boolean;
  stubOpacity?: number;
  attachmentProgress?: number;
  abstractLabels?: boolean;
}

const bounded = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(0.5, value)) : 0;

/** A floating two-terminal stub interrupts only the upper main-line conductor. */
export function SeriesStubDiagram({ input, termination = 'short', distance = 0.125, stubLength = 0.125, attached = true, showStub = true, stubOpacity = 1, attachmentProgress, abstractLabels = false }: SeriesStubDiagramProps) {
  const { t } = useI18n();
  const prefix = 'series-stub-diagram-' + useId().replaceAll(':', '');
  const d = bounded(distance);
  const length = bounded(stubLength);
  const right = 480 - 640 * d;
  const left = right - 34;
  const connection = showStub ? Math.max(0, Math.min(1, attachmentProgress ?? (attached ? 1 : 0))) : 0;
  const detachedOffset = 14 * (1 - connection);
  const top = 150;
  const bottom = 230;
  const sourceY = 190;
  const depthScale = 0.4 + 0.6 * length / 0.5;
  const depthX = 42 * depthScale;
  const depthY = 112 * depthScale;
  const stubY = top - detachedOffset;
  const endY = stubY - depthY;
  const firstEndX = left - depthX;
  const secondEndX = right - depthX;
  const lengthLabelOnRight = !abstractLabels && right < 260;
  const load = input.load;
  const loadLabel = load.kind === 'open' ? t('Open circuit', 'Circuito abierto') : load.kind === 'short' ? t('Short circuit', 'Cortocircuito') : formatNumber(load.resistance, 3) + (load.reactance === 0 ? '' : (load.reactance < 0 ? ' − j' : ' + j') + formatNumber(Math.abs(load.reactance), 3)) + ' Ω';
  const title = t('Transmission line with a series stub', 'Línea de transmisión con un stub en serie');
  return <svg className="transmission-line-diagram ss-diagram series-stub-diagram" viewBox="0 0 600 335" role="img" aria-label={title} aria-describedby={prefix + '-description'} data-stub-topology="series" data-stub-present={showStub} data-stub-projection={showStub ? 'out-of-plane' : undefined} data-stub-termination={showStub ? termination : undefined} data-attached={showStub && connection === 1} data-attachment-progress={connection} data-line-start="110" data-line-end="480" data-line-top={top} data-line-bottom={bottom} data-distance={d} data-stub-length={showStub ? length : undefined} data-series-terminal-left={left} data-series-terminal-right={right}>
    <desc id={prefix + '-description'}>{t('Sinusoidal generator on the left, load on the right. ', 'Generador sinusoidal a la izquierda, carga a la derecha. ')}{showStub ? t('The two adjacent input terminals of the blue stub are inserted in the upper conductor. The lower conductor remains continuous. The stub projects obliquely out of the main-line plane. ', 'Los dos terminales de entrada contiguos del stub azul se insertan en el conductor superior. El conductor inferior permanece continuo. El stub se proyecta oblicuamente fuera del plano de la línea principal. ') : ''}{showStub && connection < 1 ? t('The isolated stub is shown above its connection until the connection step. ', 'El stub aislado se muestra sobre su conexión hasta el paso de conexión. ') : ''}{t('Distance d is measured from the load to the right input terminal.', 'La distancia d se mide desde la carga hasta el terminal de entrada derecho.')}</desc>
    <defs><marker id={prefix + '-arrow'} markerWidth="8" markerHeight="6" refX="7" refY="3" markerUnits="userSpaceOnUse" orient="auto"><path className="transmission-line-diagram__distance-head" d="M0 0L8 3L0 6Z" /></marker></defs>
    <path className="transmission-line-diagram__wire" d="M60 166V150H110M60 214V230H110" />
    <circle className="transmission-line-diagram__source" cx="60" cy={sourceY} r="24" />
    <path className="transmission-line-diagram__sine" d="M40 190C47 174 53 174 60 190S73 206 80 190" />
    <text className="transmission-line-diagram__generator-label" x="60" y="265" textAnchor="middle">{t('Generator', 'Generador')}</text>
    <path className="transmission-line-diagram__line" data-main-conductor="upper" data-series-gap={showStub && connection > 0} d={showStub && connection > 0 ? 'M110 150H' + left + 'M' + right + ' 150H480' : 'M110 150H480'} />
    <path className="series-stub__return" data-main-conductor="lower" data-continuous="true" d="M110 230H480" />
    <text className="transmission-line-diagram__circuit-label" x="295" y="256" textAnchor="middle">Z<tspan baselineShift="sub" fontSize="16">0</tspan>{!abstractLabels && ' = ' + formatNumber(input.z0, 3) + ' Ω'}</text>
    <path className="transmission-line-diagram__load-connection" d="M480 150V170M480 210V230" />
    <rect className="transmission-line-diagram__load" x="471" y="170" width="18" height="40" />
    <text className="transmission-line-diagram__load-symbol" x="505" y="198">Z<tspan dy="4">L</tspan></text>
    {!abstractLabels && <text className="transmission-line-diagram__load-value" x="580" y="263" textAnchor="end">{loadLabel}</text>}
    <path className="series-stub__plane" data-line-reading-plane={right} d={'M' + right + ' 143V230'} />
    {showStub && <g opacity={Math.max(0, Math.min(1, stubOpacity))} data-series-stub="true" data-stub-termination={termination}>
      <path className="transmission-line-diagram__stub-face" d={'M' + left + ' ' + stubY + 'L' + right + ' ' + stubY + 'L' + secondEndX + ' ' + endY + 'L' + firstEndX + ' ' + endY + 'Z'} />
      {connection > 0 && <path className="transmission-line-diagram__stub-wire" opacity={connection} d={'M' + left + ' 150V' + stubY + 'M' + right + ' 150V' + stubY} />}
      <path className="transmission-line-diagram__stub-wire" data-stub-conductor="first" d={'M' + left + ' ' + stubY + 'L' + firstEndX + ' ' + endY} />
      <path className="transmission-line-diagram__stub-wire" data-stub-conductor="second" d={'M' + right + ' ' + stubY + 'L' + secondEndX + ' ' + endY} />
      <circle className="series-stub__input" data-series-input-terminal="left" cx={left} cy={stubY} r="3.5" />
      <circle className="series-stub__input" data-series-input-terminal="right" cx={right} cy={stubY} r="3.5" />
      {termination === 'short' ? <path className="transmission-line-diagram__stub-wire" data-stub-end="short" d={'M' + firstEndX + ' ' + endY + 'H' + secondEndX} /> : <g data-stub-end="open"><circle className="transmission-line-diagram__stub-open" cx={firstEndX} cy={endY} r="4" /><circle className="transmission-line-diagram__stub-open" cx={secondEndX} cy={endY} r="4" /></g>}
      <text className="transmission-line-diagram__stub-length-label" x={lengthLabelOnRight ? right + 12 : (left + right) / 2 - depthX / 2 - 20} y={stubY - depthY / 2 + 7} textAnchor={lengthLabelOnRight ? 'start' : 'end'}>ℓ<tspan baselineShift="sub" fontSize="15">s</tspan>{!abstractLabels && <>{' = ' + formatNumber(length, 5) + 'λ'}<tspan baselineShift="sub" fontSize="15">s</tspan></>}</text>
      <text className="transmission-line-diagram__stub-impedance" x={(firstEndX + secondEndX) / 2} y={endY - 16} textAnchor="middle">Z<tspan baselineShift="sub" fontSize="14">0s</tspan>{!abstractLabels && ' = ' + formatNumber(input.stubZ0, 3) + ' Ω'}</text>
      {abstractLabels && <text className="series-stub__port series-stub__port--stub" x={right + 10} y={stubY - depthY / 2}>z<tspan baselineShift="sub">stub</tspan></text>}
    </g>}
    {abstractLabels && <><text className="series-stub__port series-stub__port--input" x={left - 12} y="182" textAnchor="end">z<tspan baselineShift="sub">v</tspan></text><text className="series-stub__port series-stub__port--line" x={right + 12} y="182">z<tspan baselineShift="sub">ℓ</tspan></text></>}
    <g className="transmission-line-diagram__distance-measure" data-origin="480" data-position={right}>
      <path className="transmission-line-diagram__load-origin" d="M480 240V304" />
      <path className="transmission-line-diagram__section-tick" d={'M' + right + ' 288V304'} />
      {d > 0 && <path className="transmission-line-diagram__distance-arrow" d={'M480 296H' + right} markerEnd={480 - right >= 14 ? 'url(#' + prefix + '-arrow)' : undefined} />}
      <circle className="transmission-line-diagram__origin-dot" cx="480" cy="296" r="2.8" />
      <text className="transmission-line-diagram__distance-label transmission-line-diagram__distance-value" x={(480 + right) / 2} y="285" textAnchor="middle">{abstractLabels ? 'd' : 'd = ' + formatNumber(d, 5) + 'λ'}</text>
    </g>
  </svg>;
}
