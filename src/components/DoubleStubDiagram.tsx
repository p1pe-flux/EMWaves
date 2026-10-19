import { useId } from 'react';
import type { DoubleStubInput } from '../domain/doubleStub';
import { formatNumber } from '../math/format';
import { useI18n } from '../i18n';
import '../transmission-line-diagram.css';
import '../double-stub.css';

export interface DoubleStubDiagramProps {
  input: DoubleStubInput;
  length1?: number; length2?: number;
  termination1?: 'open' | 'short'; termination2?: 'open' | 'short';
  showStub1?: boolean; showStub2?: boolean;
  attached1?: boolean; attached2?: boolean;
  opacity1?: number; opacity2?: number;
  periodicLength1?: number; periodicLength2?: number;
  /** Zero is the generator-side junction; one is the load-side junction. */
  readingPosition?: number;
  /** During load propagation: zero is the load; one is the Stub 2 plane. */
  loadTraversal?: number;
  /** Keep the target junction visible while reading or moving from the load. */
  showStub2Plane?: boolean;
  abstractLabels?: boolean;
}
const LEFT = 235, RIGHT = 375, TOP = 70, BOTTOM = 150;
const safe = (n: number) => Number.isFinite(n) ? Math.max(0, n) : 0;
export function DoubleStubDiagram({ input, length1 = 0, length2 = 0, termination1 = 'short', termination2 = 'short', showStub1 = true, showStub2 = true, attached1 = true, attached2 = true, opacity1 = 1, opacity2 = 1, periodicLength1 = 0, periodicLength2 = 0, readingPosition = 0, loadTraversal, showStub2Plane = false, abstractLabels = false }: DoubleStubDiagramProps) {
  const { t } = useI18n();
  const id = 'double-stub-' + useId().replaceAll(':', '');
  const height = abstractLabels ? 280 : 350;
  const readingX = loadTraversal === undefined ? LEFT + (RIGHT - LEFT) * Math.max(0, Math.min(1, readingPosition)) : 480 - (480 - RIGHT) * Math.max(0, Math.min(1, loadTraversal));
  const label = input.load.kind === 'open' ? t('Open circuit', 'Circuito abierto') : input.load.kind === 'short' ? t('Short circuit', 'Cortocircuito') : formatNumber(input.load.resistance) + (input.load.reactance === 0 ? '' : (input.load.reactance < 0 ? ' − j' : ' + j') + formatNumber(Math.abs(input.load.reactance))) + ' Ω';
  const stub = (number: 1 | 2, x: number, z0: number, length: number, termination: 'open' | 'short', attached: boolean, opacity: number, periodic: number) => {
    const depth = abstractLabels ? 80 : 27 + Math.min(0.5, safe(length)) / 0.5 * 117, dx = -0.45 * depth;
    const endX = x + dx, upper = TOP + depth, lower = BOTTOM + depth;
    return <g key={number} className={'ds-diagram__stub' + (attached ? '' : ' ds-diagram__stub--detached')} opacity={Math.max(0, Math.min(1, opacity))} data-stub={number} data-stub-length={length} data-total-stub-length={safe(length) + safe(periodic)} data-attached={attached} data-stub-projection="out-of-plane">
      <path className="ds-diagram__face" d={'M' + x + ' ' + TOP + 'V' + BOTTOM + 'L' + endX + ' ' + lower + 'V' + upper + 'Z'} />
      <path className="ds-diagram__occlusion" d={'M' + x + ' ' + TOP + 'L' + endX + ' ' + upper} />
      <path className="ds-diagram__stub-wire" d={'M' + x + ' ' + TOP + 'L' + endX + ' ' + upper + 'M' + x + ' ' + BOTTOM + 'L' + endX + ' ' + lower} />
      <circle cx={x} cy={TOP} r="3.2" /><circle cx={x} cy={BOTTOM} r="3.2" />
      {termination === 'short' ? <path className="ds-diagram__stub-wire" data-termination="short" d={'M' + endX + ' ' + upper + 'V' + lower} /> : <g data-termination="open"><circle className="ds-diagram__open" cx={endX} cy={upper} r="3.5" /><circle className="ds-diagram__open" cx={endX} cy={lower} r="3.5" /></g>}
      <text className="ds-diagram__stub-label" x={endX - 9} y={lower + 21} textAnchor="middle">{'ℓ' + (number === 1 ? '₁' : '₂') + (abstractLabels ? '' : ' = ' + formatNumber(safe(length) + safe(periodic), 4) + 'λ')}{!abstractLabels && <tspan baselineShift="sub" fontSize="11">{'s' + number}</tspan>}</text>
      <text className="ds-diagram__stub-label ds-diagram__impedance" x={abstractLabels ? x - 46 : x + dx / 2 - 15} y={abstractLabels ? 192 : TOP + depth / 2 - 9} textAnchor="end">Z<tspan baselineShift="sub" fontSize="10">{'0s' + number}</tspan>{abstractLabels ? '' : ' = ' + formatNumber(z0) + ' Ω'}</text>
    </g>;
  };
  return <svg className="transmission-line-diagram ds-diagram ss-diagram" viewBox={'0 0 600 ' + height} style={{ aspectRatio: '600 / ' + height }} role="img" aria-label={t('Two shunt stubs: Stub 1 toward the generator and Stub 2 toward the load.', 'Dos stubs en paralelo: Stub 1 hacia el generador y Stub 2 hacia la carga.')} aria-describedby={id + '-desc'} data-stub-1-x={LEFT} data-stub-2-x={RIGHT} data-reading-position={readingPosition} data-load-traversal={loadTraversal} data-abstract-labels={abstractLabels}>
    <desc id={id + '-desc'}>{t('From left to right: generator, Stub 1, a main-line separation d₂, Stub 2, a main-line distance d₁, and the load. Blue stubs project out of the two-conductor line plane. Lengths are schematic.', 'De izquierda a derecha: generador, Stub 1, separación d₂ sobre la línea principal, Stub 2, distancia d₁ y carga. Los stubs azules salen del plano de la línea de dos conductores. El dibujo es esquemático.')}{abstractLabels ? ' ' + t('Colored reference planes label y v before Stub 1, y 1 after Stub 1, y 2 before Stub 2, and y R after Stub 2. Each admittance looks toward the load.', 'Los planos de referencia coloreados indican y v antes del Stub 1, y 1 después del Stub 1, y 2 antes del Stub 2 e y R después del Stub 2. Cada admitancia mira hacia la carga.') : ''}</desc>
    <defs><marker id={id + '-arrow'} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><path d="M0 0L8 3L0 6Z" fill="#55706d" /></marker></defs>
    <path className="transmission-line-diagram__wire" d="M60 86V70H110M60 134V150H110" />
    <circle className="transmission-line-diagram__source" cx="60" cy="110" r="24" />
    <path className="transmission-line-diagram__sine" d="M40 110C47 94 53 94 60 110S73 126 80 110" />
    <text className="transmission-line-diagram__generator-label" x="60" y="186" textAnchor="middle">{t('Generator', 'Generador')}</text>
    <path className="transmission-line-diagram__line" d="M110 70H480M110 150H480" />
    <text className="ds-diagram__main-label" x="150" y="54" textAnchor="middle">{abstractLabels ? 'Z₀' : 'Z₀ = ' + formatNumber(input.z0) + ' Ω'}</text>
    <path className="transmission-line-diagram__load-connection" d="M480 70V90M480 130V150" />
    <rect className="transmission-line-diagram__load" x="471" y="90" width="18" height="40" />
    <text className="transmission-line-diagram__load-symbol" x="505" y="118">Z<tspan dy="4">L</tspan></text>
    {!abstractLabels && <text className="ds-diagram__load-value" x="580" y="183" textAnchor="end">{label}</text>}
    <g className="ds-diagram__dimensions" fill="none">
      <path d={'M480 29H' + RIGHT} markerEnd={'url(#' + id + '-arrow)'} />
      <path d={'M' + RIGHT + ' 24V44M480 24V44'} />
      <path d={'M' + RIGHT + ' 29H' + LEFT} markerEnd={'url(#' + id + '-arrow)'} />
      <path d={'M' + LEFT + ' 24V44'} />
    </g>
    <text className="ds-diagram__dimension-label" x={(RIGHT + 480) / 2} y="18" textAnchor="middle">d<tspan baselineShift="sub" fontSize="12">1</tspan>{!abstractLabels && ' = ' + formatNumber(input.distance, 4) + 'λ'}</text>
    <text className="ds-diagram__dimension-label" x={(LEFT + RIGHT) / 2} y="18" textAnchor="middle">d<tspan baselineShift="sub" fontSize="12">2</tspan>{!abstractLabels && ' = ' + formatNumber(input.separation, 4) + 'λ'}</text>
    <text className="ds-diagram__port-label" x={LEFT + 8} y="55">S₁</text><text className="ds-diagram__port-label" x={RIGHT + 8} y="55">S₂</text>
    {showStub1 && stub(1, LEFT, input.stub1Z0, length1, termination1, attached1, opacity1, periodicLength1)}
    {showStub2 && stub(2, RIGHT, input.stub2Z0, length2, termination2, attached2, opacity2, periodicLength2)}
    {abstractLabels ? [
      { id: 'y-v', subscript: 'v', x: 214, labelX: 204, anchor: 'end' as const, input: true },
      { id: 'y-1', subscript: '1', x: 250, labelX: 267, anchor: 'start' as const, input: false },
      { id: 'y-2', subscript: '2', x: 356, labelX: 331, anchor: 'end' as const, input: false },
      { id: 'y-r', subscript: 'R', x: 411, labelX: 420, anchor: 'start' as const, input: false },
    ].map((port) => <g key={port.id} className={'ds-diagram__admittance-port' + (port.input ? ' ds-diagram__admittance-port--input' : '')} data-port={port.id} data-port-x={port.x} data-port-y="110">
      <path className="ds-diagram__port-plane" d={'M' + port.x + ' ' + TOP + 'V' + BOTTOM} />
      <circle cx={port.x} cy={TOP} r="2.2" /><circle cx={port.x} cy={BOTTOM} r="2.2" />
      <text className="ds-diagram__admittance-label" x={port.labelX} y="112" textAnchor={port.anchor}>y<tspan baselineShift="sub" fontSize="12">{port.subscript}</tspan></text>
    </g>) : <g className="ds-diagram__reading" data-reading-x={readingX}><path d={'M' + readingX + ' 62V158'} /><circle cx={readingX} cy={TOP} r="3.5" /><circle cx={readingX} cy={BOTTOM} r="3.5" /></g>}
    {showStub2Plane && <path className="ds-diagram__stub-plane" data-stub-plane="2" d={'M' + RIGHT + ' 62V158'} />}
  </svg>;
}
