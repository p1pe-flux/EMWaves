import { useId, useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { Load } from '../domain/transmission';
import { formatNumber } from '../math/format';
import { useI18n } from '../i18n';
import '../styles/transmission-line-diagram.css';

export interface TransmissionLineStub {
  z0: number | null;
  lengthInWavelengths: number;
  termination: 'open' | 'short';
  attached?: boolean;
  opacity?: number;
  periodicLength?: number;
}

export interface TransmissionLineDiagramProps {
  lengthInWavelengths: number;
  distanceInWavelengths: number;
  z0: number | null;
  load: Load | null;
  onDistanceChange: (distanceInWavelengths: number) => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  stub?: TransmissionLineStub;
  /** Keep the matching schematic the same size before its stub is introduced. */
  reserveStubSpace?: boolean;
  showAdmittancePorts?: boolean;
  distanceSymbol?: 'ℓ' | 'd';
  positionLabel?: string;
  showTotalLength?: boolean;
  loadLabel?: string;
  periodicDistance?: number;
  abstractLabels?: boolean;
}

const LINE_START = 110;
const LINE_END = 480;

function numberLabel(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const magnitude = Math.abs(value);
  if (magnitude !== 0 && (magnitude < 0.001 || magnitude >= 10000)) {
    const [mantissa, exponent] = value.toExponential(2).split('e');
    return Number(mantissa) + 'e' + Number(exponent);
  }
  return formatNumber(value, 3);
}

function impedanceLabel(load: Load | null): string {
  if (load === null) return '—';
  if (load.kind === 'open') return '∞ Ω';
  if (load.kind === 'short') return '0 Ω';
  if (!Number.isFinite(load.resistance) || load.resistance < 0 || !Number.isFinite(load.reactance)) return '—';
  const real = numberLabel(load.resistance);
  const imaginary = numberLabel(Math.abs(load.reactance));
  if (load.reactance === 0) return real + ' Ω';
  const reactance = (load.reactance < 0 ? '−' : '+') + 'j' + imaginary;
  return (load.resistance === 0 ? (load.reactance < 0 ? '−' : '') + 'j' + imaginary : real + reactance) + ' Ω';
}

export function TransmissionLineDiagram({ lengthInWavelengths, distanceInWavelengths, z0, load, onDistanceChange, disabled = false, compact = false, className = '', stub, reserveStubSpace = false, showAdmittancePorts = false, distanceSymbol = 'ℓ', positionLabel = 'Position on the transmission line', showTotalLength = true, loadLabel: overrideLoadLabel, periodicDistance = 0, abstractLabels = false }: TransmissionLineDiagramProps) {
  const { t } = useI18n();
  const accessiblePositionLabel = positionLabel === 'Position on the transmission line' ? t(positionLabel, 'Posición sobre la línea de transmisión') : positionLabel === 'Stub placement' ? t(positionLabel, 'Posición del stub') : positionLabel;
  const prefix = 'transmission-line-' + useId().replaceAll(':', '');
  const marker = useRef<SVGGElement>(null);
  const dragging = useRef<number | null>(null);
  const validLength = Number.isFinite(lengthInWavelengths) && lengthInWavelengths >= 0;
  const length = validLength ? lengthInWavelengths : 0;
  const distance = Number.isFinite(distanceInWavelengths) ? Math.max(0, Math.min(length, distanceInWavelengths)) : 0;
  const interactive = !disabled && validLength && length > 0;
  const markerX = LINE_END - (length > 0 ? distance / length : 0) * (LINE_END - LINE_START);
  const upperRail = compact ? 40 : 70;
  const lowerRail = compact ? 120 : 150;
  const lineY = (upperRail + lowerRail) / 2;
  const sourceRadius = compact ? 22 : 24;
  const loadTop = lineY - 20;
  const loadBottom = lineY + 20;
  const matchingLayout = distanceSymbol === 'd';
  const measureY = matchingLayout ? lowerRail + 70 : stub ? lowerRail + 250 : compact ? 160 : 234;
  const z0Label = z0 !== null && Number.isFinite(z0) && z0 > 0 ? numberLabel(z0) + ' Ω' : '—';
  const loadLabel = overrideLoadLabel ?? impedanceLabel(load);
  const lengthLabel = !validLength ? 'L = —' : length === 1 ? 'L = λ' : 'L = ' + numberLabel(length) + 'λ';
  const extraDistance = Number.isFinite(periodicDistance) && periodicDistance >= 0 ? periodicDistance : 0;
  const totalDistance = distance + extraDistance;
  const stubLength = stub && Number.isFinite(stub.lengthInWavelengths) ? Math.max(0, Math.min(0.5, stub.lengthInWavelengths)) : 0;
  const extraStubLength = stub?.periodicLength !== undefined && Number.isFinite(stub.periodicLength) && stub.periodicLength >= 0 ? stub.periodicLength : 0;
  const totalStubLength = stubLength + extraStubLength;
  const stubAttached = stub?.attached ?? true;
  // Both conductors project along the same fixed depth vector. The schematic
  // minimum depth keeps the branch's input and termination readable at ℓs = 0.
  const depthScale = 0.55 + 0.45 * stubLength / 0.5;
  const depthX = 80 * depthScale;
  const depthY = 160 * depthScale;
  const stubEndX = markerX - depthX;
  const stubUpperEndY = upperRail + depthY;
  const stubLowerEndY = lowerRail + depthY;
  const stubEndY = lineY + depthY;
  const crossoverX = markerX - (lowerRail - upperRail) / 2;
  const stubValue = stub?.z0 !== null && stub?.z0 !== undefined && Number.isFinite(stub.z0) && stub.z0 > 0 ? numberLabel(stub.z0) + ' Ω' : '—';
  const stubLabelOnRight = !showAdmittancePorts && markerX < 220;
  const stubLabelX = markerX - depthX / 2 + (stubLabelOnRight ? 30 : -30);
  const stubImpedanceY = matchingLayout ? Math.min(lineY + depthY / 2 + 10, measureY - 45) : lineY + depthY / 2 + 10;
  const stubDimensionX = Math.max(abstractLabels ? 30 : 105, stubEndX);
  const stubTerminationLabelX = Math.max(60, stubEndX);
  const totalPortX = markerX - 20;
  const linePortX = Math.min(markerX + 20, LINE_END);
  const directPortLabels = abstractLabels && showAdmittancePorts;
  const circuitLabelX = stub || showAdmittancePorts ? 205 : 295;
  const totalPortLabelY = Math.max(30, upperRail - 15);
  const stubPortLabelX = Math.max(140, Math.min(520, markerX + (directPortLabels ? 20 : 45)));
  const stubPortLabelY = lowerRail + (markerX > 400 && !compact && loadLabel ? 75 : 45);
  const dimensionY = matchingLayout ? (stub ? lowerRail + 260 : measureY + 60) : stub ? lowerRail + 310 : compact ? 196 : 288;
  // Reserve the full stub depth while it animates, so movement does not resize the canvas.
  // The deduction's fixed schematic can fit its actual projected depth.
  const matchingContentBottom = Math.max(
    measureY + 8,
    stub || reserveStubSpace ? (abstractLabels && !reserveStubSpace ? stubLowerEndY : lowerRail + 160) + 53 : lowerRail + 36,
    showTotalLength ? dimensionY + 26 : 0,
  );
  const height = matchingLayout ? Math.ceil(matchingContentBottom + (showAdmittancePorts ? 35 : 20)) : stub ? (compact ? showTotalLength ? 480 : 410 : showTotalLength ? 510 : 450) : compact ? 228 : 320;
  const distanceText = abstractLabels ? distanceSymbol : distanceSymbol === 'd' ? 'd = ' + formatNumber(totalDistance, 5) + 'λ' : distanceSymbol;
  const diagramTitle = stub ? t('Lossless transmission line with a single shunt ' + stub.termination + '-circuited stub', 'Línea de transmisión sin pérdidas con un stub en paralelo ' + (stub.termination === 'short' ? 'en cortocircuito' : 'abierto')) : t('Lossless transmission line from generator to load', 'Línea de transmisión sin pérdidas desde el generador hasta la carga');

  function changeDistance(next: number) {
    if (!interactive || !Number.isFinite(next)) return;
    const bounded = Math.max(0, Math.min(length, next));
    // Preserve the exact endpoints, including line lengths smaller than 0.001λ.
    const rounded = bounded === 0 || bounded === length ? bounded : Number(bounded.toPrecision(12));
    onDistanceChange(Math.max(0, Math.min(length, rounded)));
  }

  function selectPosition(event: PointerEvent<SVGSVGElement>, start: boolean) {
    if (!interactive || (start && (event.button !== 0 || !event.isPrimary || dragging.current !== null))) return;
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    if (start && (point.x < LINE_START - 8 || point.x > LINE_END + 8 || point.y < upperRail - 12 || point.y > lowerRail + 15)) return;
    if (start) {
      dragging.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      marker.current?.focus({ preventScroll: true });
    }
    event.preventDefault();
    const fraction = Math.max(0, Math.min(1, (LINE_END - point.x) / (LINE_END - LINE_START)));
    changeDistance(fraction * length);
  }

  function releasePointer(event: PointerEvent<SVGSVGElement>) {
    if (dragging.current === event.pointerId) dragging.current = null;
  }

  function movePosition(event: KeyboardEvent<SVGGElement>) {
    if (!interactive) return;
    const step = event.shiftKey ? 0.05 : 0.001;
    const increments: Record<string, number> = { ArrowLeft: step, ArrowUp: step, ArrowRight: -step, ArrowDown: -step };
    if (event.key !== 'Home' && event.key !== 'End' && increments[event.key] === undefined) return;
    event.preventDefault();
    changeDistance(event.key === 'Home' ? 0 : event.key === 'End' ? length : distance + increments[event.key]);
  }

  return (
    <svg className={('transmission-line-diagram' + (compact ? ' transmission-line-diagram--compact' : '') + (stub ? ' transmission-line-diagram--with-stub' : '') + ' ' + className).trim()} style={stub || matchingLayout ? { aspectRatio: '600 / ' + height } : undefined} viewBox={'0 0 600 ' + height} role="group" aria-label={diagramTitle} aria-describedby={prefix + '-description'} data-line-start={LINE_START} data-line-end={LINE_END} data-line-y={lineY} data-line-top={upperRail} data-line-bottom={lowerRail} data-line-length={validLength ? length : undefined} data-distance={distance} data-total-distance={totalDistance} data-disabled={!interactive} data-compact={compact} data-stub-present={stub !== undefined} data-stub-projection={stub ? 'out-of-plane' : undefined} data-stub-end-upper-x={stub ? stubEndX : undefined} data-stub-end-upper-y={stub ? stubUpperEndY : undefined} data-stub-end-lower-x={stub ? stubEndX : undefined} data-stub-end-lower-y={stub ? stubLowerEndY : undefined} data-stub-length={stub ? stubLength : undefined} data-total-stub-length={stub ? totalStubLength : undefined} data-attached={stub ? stubAttached : undefined} onPointerDown={(event) => selectPosition(event, true)} onPointerMove={(event) => { if (dragging.current === event.pointerId) selectPosition(event, false); }} onPointerUp={releasePointer} onPointerCancel={releasePointer} onLostPointerCapture={releasePointer}>
      <desc id={prefix + '-description'}>{t('The sinusoidal generator is on the left and the load is on the right. Characteristic impedance: ', 'El generador sinusoidal está a la izquierda y la carga a la derecha. Impedancia característica: ')}{abstractLabels ? t('Z zero', 'Z cero') : z0Label}. {t('Load: ', 'Carga: ')}{abstractLabels ? 'Z L' : loadLabel}. {t('Distance ', 'La distancia ')}{distanceSymbol === 'd' ? 'd' : 'ell'}{t(' starts at zero at the load and increases toward the generator. The moving arrow begins at the load and ends at the selected section. ', ' comienza en cero en la carga y aumenta hacia el generador. La flecha móvil parte de la carga y termina en la sección seleccionada. ')}{interactive ? t('Drag the teal marker, or focus it and use arrow keys. Home returns to the load; End selects the generator.', 'Arrastra el marcador verde azulado o selecciónalo y usa las flechas del teclado. Inicio vuelve a la carga; Fin selecciona el generador.') : abstractLabels ? '' : t('The position control is disabled.', 'El control de posición está deshabilitado.')}{stub ? t(' The blue ' + stub.termination + ' stub projects out of the main-line plane ', ' El stub azul ' + (stub.termination === 'short' ? 'en cortocircuito' : 'abierto') + ' sobresale del plano de la línea principal ') + (stubAttached ? t('and is connected in parallel at the selected junction. ', 'y está conectado en paralelo en la unión seleccionada. ') : t('and is shown detached until it is attached at the selected junction. ', 'y se muestra separado hasta conectarlo en la unión seleccionada. ')) + (abstractLabels ? t('Its length is ell s.', 'Su longitud es ell s.') : t('Its length is ', 'Su longitud es ') + formatNumber(totalStubLength, 5) + t(' stub wavelengths.', ' longitudes de onda del stub.')) : ''}</desc>
      <defs><marker id={prefix + '-distance-arrow'} markerWidth="8" markerHeight="6" refX="7" refY="3" markerUnits="userSpaceOnUse" orient="auto"><path className="transmission-line-diagram__distance-head" d="M0 0L8 3L0 6Z" /></marker>{showAdmittancePorts && !directPortLabels && <marker id={prefix + '-port-arrow'} markerWidth="8" markerHeight="6" refX="7" refY="3" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L8 3L0 6Z" fill="currentColor" /></marker>}</defs>
      <path className="transmission-line-diagram__wire" d={'M60 ' + (lineY - sourceRadius) + 'V' + upperRail + 'H110M60 ' + (lineY + sourceRadius) + 'V' + lowerRail + 'H110'} />
      <circle className="transmission-line-diagram__source" cx="60" cy={lineY} r={sourceRadius} />
      <path className="transmission-line-diagram__sine" d={'M40 ' + lineY + 'C47 ' + (lineY - 16) + ' 53 ' + (lineY - 16) + ' 60 ' + lineY + 'S73 ' + (lineY + 16) + ' 80 ' + lineY} />
      {!compact && !(showAdmittancePorts && markerX < 150) && <text className="transmission-line-diagram__generator-label" x="60" y={stub && stubEndX < LINE_START ? upperRail - 30 : 186} textAnchor="middle">{t('Generator', 'Generador')}</text>}
      <path className="transmission-line-diagram__line" d={'M110 ' + upperRail + 'H480M110 ' + lowerRail + 'H480'} />
      <text className="transmission-line-diagram__circuit-label" x={circuitLabelX} y={compact ? 27 : 56} textAnchor="middle">{compact || abstractLabels ? 'Z₀' : 'Z₀ = ' + z0Label}</text>
      <path className="transmission-line-diagram__load-connection" d={'M480 ' + upperRail + 'V' + loadTop + 'M480 ' + loadBottom + 'V' + lowerRail} />
      <rect className="transmission-line-diagram__load" x="471" y={loadTop} width="18" height="40" />
      <text className="transmission-line-diagram__load-symbol" x="505" y={lineY + 8}>Z<tspan dy="4">L</tspan></text>
      {!compact && <text className="transmission-line-diagram__load-value" x="580" y="186" textAnchor="end">{loadLabel}</text>}
      <g className="transmission-line-diagram__position-marker" ref={marker} data-position={distance} data-control="stub-placement" role={abstractLabels ? undefined : 'slider'} tabIndex={abstractLabels ? undefined : interactive ? 0 : -1} aria-label={accessiblePositionLabel} aria-orientation={abstractLabels ? undefined : 'horizontal'} aria-disabled={abstractLabels ? undefined : !interactive} aria-valuemin={abstractLabels ? undefined : 0} aria-valuemax={abstractLabels ? undefined : length} aria-valuenow={abstractLabels ? undefined : distance} aria-valuetext={abstractLabels ? accessiblePositionLabel : numberLabel(totalDistance) + t(' wavelengths from the load toward the generator', ' longitudes de onda desde la carga hacia el generador')} onKeyDown={movePosition}>
        {!(showAdmittancePorts && abstractLabels) && <><path className="transmission-line-diagram__position" d={markerX >= 471
          ? 'M' + markerX + ' ' + (upperRail - 6) + 'V' + (loadTop - 4) + 'M' + markerX + ' ' + (loadBottom + 4) + 'V' + (lowerRail + 14)
          : 'M' + markerX + ' ' + (upperRail - 6) + 'V' + (lowerRail + 14)} />
        <circle className="transmission-line-diagram__position-dot" cx={markerX} cy={upperRail} r="4.5" />
        <circle className="transmission-line-diagram__position-dot" cx={markerX} cy={lowerRail} r="4.5" /></>}
        <path className="transmission-line-diagram__section-tick" d={'M' + markerX + ' ' + (measureY - 8) + 'V' + (measureY + 8)} />
      </g>
      {stub && <g className={'transmission-line-diagram__stub' + (!stubAttached ? ' transmission-line-diagram__stub--detached' : '')} style={{ opacity: Math.max(0, Math.min(1, stub.opacity ?? 1)) }} data-stub-junction-x={markerX} data-stub-center-x={stubEndX} data-stub-projection="out-of-plane" data-stub-termination={stub.termination} data-stub-end-upper-x={stubEndX} data-stub-end-upper-y={stubUpperEndY} data-stub-end-lower-x={stubEndX} data-stub-end-lower-y={stubLowerEndY}>
        <path className="transmission-line-diagram__stub-face" d={'M' + markerX + ' ' + upperRail + 'L' + markerX + ' ' + lowerRail + 'L' + stubEndX + ' ' + stubLowerEndY + 'L' + stubEndX + ' ' + stubUpperEndY + 'Z'} />
        <path className="transmission-line-diagram__stub-depth-cue" d={'M' + markerX + ' ' + lineY + 'L' + stubEndX + ' ' + stubEndY} />
        <path className="transmission-line-diagram__stub-crossover" d={'M' + (crossoverX + 3.5) + ' ' + (lowerRail - 7) + 'L' + (crossoverX - 3.5) + ' ' + (lowerRail + 7)} data-stub-crossover="true" />
        <path className="transmission-line-diagram__stub-wire" d={'M' + markerX + ' ' + upperRail + 'L' + stubEndX + ' ' + stubUpperEndY} data-stub-conductor="upper" />
        <path className="transmission-line-diagram__stub-wire" d={'M' + markerX + ' ' + lowerRail + 'L' + stubEndX + ' ' + stubLowerEndY} data-stub-conductor="lower" />
        <circle className="transmission-line-diagram__stub-node" cx={markerX} cy={upperRail} r="3.5" />
        <circle className="transmission-line-diagram__stub-node" cx={markerX} cy={lowerRail} r="3.5" />
        {stub.termination === 'short' ? <path className="transmission-line-diagram__stub-wire" d={'M' + stubEndX + ' ' + stubUpperEndY + 'L' + stubEndX + ' ' + stubLowerEndY} data-termination-symbol="short" /> : <g data-termination-symbol="open"><circle className="transmission-line-diagram__stub-open" cx={stubEndX} cy={stubUpperEndY} r="3.5" /><circle className="transmission-line-diagram__stub-open" cx={stubEndX} cy={stubLowerEndY} r="3.5" /></g>}
        {!directPortLabels && <text className="transmission-line-diagram__stub-impedance" x={stubLabelX} y={stubImpedanceY} textAnchor={stubLabelOnRight ? 'start' : 'end'}>{abstractLabels ? 'Z₀ₛ' : 'Z₀ₛ = ' + stubValue}</text>}
        <text className="transmission-line-diagram__stub-length-label" x={stubDimensionX} y={stubLowerEndY + 30} textAnchor="middle">{abstractLabels ? 'ℓₛ' : 'ℓₛ = ' + formatNumber(totalStubLength, 5) + 'λₛ'}</text>
        <text className="transmission-line-diagram__stub-termination-label" x={stubTerminationLabelX} y={stubLowerEndY + 53} textAnchor="middle">{stub.termination === 'short' ? t('Short circuit', 'Cortocircuito') : t('Open circuit', 'Circuito abierto')}</text>
      </g>}
      {showAdmittancePorts && <g className="transmission-line-diagram__ports">
        <g className="transmission-line-diagram__port transmission-line-diagram__port--total" data-port="y-v" data-junction-x={markerX} data-port-x={totalPortX} data-port-y={lineY} data-port-anchor-x={totalPortX} data-port-anchor-y={lineY} data-look-dx="1" data-look-dy="0">
          <path className="transmission-line-diagram__port-plane" d={'M' + totalPortX + ' ' + upperRail + 'V' + lowerRail} data-port-plane="true" />
          <circle className="transmission-line-diagram__port-node" cx={totalPortX} cy={upperRail} r="2.5" /><circle className="transmission-line-diagram__port-node" cx={totalPortX} cy={lowerRail} r="2.5" />
          {!directPortLabels && <path className="transmission-line-diagram__port-leader" d={'M' + totalPortX + ' ' + (totalPortLabelY + 10) + 'L' + (totalPortX - 18) + ' ' + (lineY - 18) + 'L' + (totalPortX - 18) + ' ' + lineY + 'L' + totalPortX + ' ' + lineY} markerEnd={'url(#' + prefix + '-port-arrow)'} data-port-leader="true" />}
          <circle className="transmission-line-diagram__port-anchor" cx={totalPortX} cy={lineY} r="2.5" />
          <text x={totalPortX} y={totalPortLabelY} textAnchor="middle">y<tspan baselineShift="sub">v</tspan></text>
        </g>
        <g className="transmission-line-diagram__port transmission-line-diagram__port--line" data-port="y-ell" data-junction-x={markerX} data-port-x={linePortX} data-port-y={lineY} data-port-anchor-x={linePortX} data-port-anchor-y={lineY} data-look-dx="1" data-look-dy="0">
          <path className="transmission-line-diagram__port-plane" d={'M' + linePortX + ' ' + upperRail + 'V' + lowerRail} data-port-plane="true" />
          <circle className="transmission-line-diagram__port-node" cx={linePortX} cy={upperRail} r="2.5" /><circle className="transmission-line-diagram__port-node" cx={linePortX} cy={lowerRail} r="2.5" />
          {!directPortLabels && <path className="transmission-line-diagram__port-leader" d={'M' + (linePortX - 18) + ' ' + lineY + 'L' + linePortX + ' ' + lineY} markerEnd={'url(#' + prefix + '-port-arrow)'} data-port-leader="true" />}
          <circle className="transmission-line-diagram__port-anchor" cx={linePortX} cy={lineY} r="2.5" />
          <text x={directPortLabels ? linePortX : linePortX + 14} y={directPortLabels ? totalPortLabelY : lineY - 17} textAnchor={directPortLabels ? 'middle' : undefined}>y<tspan baselineShift="sub">ℓ</tspan></text>
        </g>
        {stub && <g className="transmission-line-diagram__port transmission-line-diagram__port--stub" data-port="y-stub" data-junction-x={markerX} data-port-x={markerX} data-port-y={lineY} data-port-anchor-x={markerX} data-port-anchor-y={lineY} data-look-dx="-1" data-look-dy="2">
          <path className="transmission-line-diagram__port-plane" d={'M' + markerX + ' ' + upperRail + 'V' + lowerRail} data-port-plane="true" />
          {!directPortLabels && <path className="transmission-line-diagram__port-leader" d={'M' + (stubPortLabelX - 9) + ' ' + (stubPortLabelY - 10) + 'L' + (markerX + 40) + ' ' + (lineY + 35) + 'L' + markerX + ' ' + lineY} markerEnd={'url(#' + prefix + '-port-arrow)'} data-port-leader="true" />}
          <circle className="transmission-line-diagram__port-anchor" cx={markerX} cy={lineY} r="2.5" />
          <text x={stubPortLabelX} y={stubPortLabelY}>y<tspan baselineShift="sub">stub</tspan></text>
        </g>}
      </g>}
      <g className="transmission-line-diagram__distance-measure" data-origin={LINE_END} data-position={markerX} data-y={measureY}>
        <path className="transmission-line-diagram__load-origin" d={'M480 ' + (lowerRail + 14) + 'V' + (measureY + (matchingLayout ? 4 : 11))} />
        {distance > 0 && <path className="transmission-line-diagram__distance-arrow" d={'M480 ' + measureY + 'H' + markerX} markerEnd={LINE_END - markerX >= 14 ? 'url(#' + prefix + '-distance-arrow)' : undefined} />}
        <circle className="transmission-line-diagram__origin-dot" cx={LINE_END} cy={measureY} r="2.8" />
        {(LINE_END - markerX > 45 || distanceSymbol === 'd') && <text className={'transmission-line-diagram__distance-label' + (distanceSymbol === 'd' && !abstractLabels ? ' transmission-line-diagram__distance-value' : '')} x={(LINE_END + markerX) / 2} y={measureY - 11} textAnchor="middle">{distanceText}</text>}
      </g>
      {showTotalLength && <><path className="transmission-line-diagram__length" d={'M110 ' + dimensionY + 'H480M110 ' + (dimensionY - 6) + 'V' + (dimensionY + 6) + 'M480 ' + (dimensionY - 6) + 'V' + (dimensionY + 6)} /><text className="transmission-line-diagram__length-label" x="295" y={dimensionY + 26} textAnchor="middle">{lengthLabel}</text></>}
    </svg>
  );
}
