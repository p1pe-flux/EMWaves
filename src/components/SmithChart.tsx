import { memo, useId, useMemo, useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { ComplexValue, LineSolution } from '../domain/transmission';
import { loadCurves } from '../domain/smithCurves';
import { Formula } from './Formula';
import { useI18n } from '../i18n';
import './smith-combined-grid.css';

const CENTER = 340;
const RADIUS = 252;
const PHASE_RADIUS = 76;
const resistances = [0.1, 0.2, 0.3, 0.5, 0.7, 1, 1.5, 2, 3, 5, 10, 20];
const reactances = [0.1, 0.2, 0.3, 0.5, 0.7, 1, 1.5, 2, 3, 5, 10];
const major = new Set([0.2, 0.5, 1, 2, 5]);
const project = (point: ComplexValue) => ({ x: CENTER + RADIUS * point.re, y: CENTER - RADIUS * point.im });

function curvePath(points: ComplexValue[]): string {
  return points.map((point, index) => {
    const projected = project(point);
    return (index === 0 ? 'M' : 'L') + projected.x + ',' + projected.y;
  }).join(' ');
}

function regionPath(loops: ComplexValue[][]): string {
  return loops
    .filter((points) => points.length >= 3 && points.every((point) => Number.isFinite(point.re) && Number.isFinite(point.im)))
    .map((points) => curvePath(points) + ' Z')
    .join(' ');
}

function phaseArc(angle: number): string {
  const segments = Math.max(2, Math.ceil(Math.abs(angle) * 24));
  return curvePath(Array.from({ length: segments + 1 }, (_, index) => ({
    re: PHASE_RADIUS / RADIUS * Math.cos(angle * index / segments),
    im: PHASE_RADIUS / RADIUS * Math.sin(angle * index / segments),
  })));
}

function trajectory(gamma: ComplexValue, length: number): string {
  const initialAngle = Math.atan2(gamma.im, gamma.re);
  const magnitude = Math.hypot(gamma.re, gamma.im);
  // After one revolution the trail covers the same circle. Keep rendering
  // bounded even when the user enters a line many wavelengths long.
  const visibleLength = Math.min(length, 0.5);
  const segments = Math.max(2, Math.ceil(visibleLength * 320));
  return Array.from({ length: segments + 1 }, (_, index) => {
    const angle = initialAngle - 4 * Math.PI * visibleLength * index / segments;
    const point = project({ re: magnitude * Math.cos(angle), im: magnitude * Math.sin(angle) });
    return (index === 0 ? 'M' : 'L') + point.x + ',' + point.y;
  }).join(' ');
}

const GridContours = memo(function GridContours({ sign }: { sign: number }) {
    return <>
      {resistances.map((resistance) => (
        <circle
          key={'r' + resistance}
          className={'smith-grid ' + (major.has(resistance) ? 'smith-grid--major' : '')}
          cx={CENTER + sign * RADIUS * resistance / (1 + resistance)}
          cy={CENTER}
          r={RADIUS / (1 + resistance)}
        />
      ))}
      {reactances.flatMap((reactance) => [-1, 1].map((polarity) => (
        <circle
          key={'x' + polarity * reactance}
          className={'smith-grid ' + (major.has(reactance) ? 'smith-grid--major' : '')}
          cx={CENTER + sign * RADIUS}
          cy={CENTER - sign * RADIUS / (polarity * reactance)}
          r={RADIUS / reactance}
        />
      )))}
    </>;
  });

const ChartScale = memo(function ChartScale() {
  return <>
        <circle className="smith-scale" cx={CENTER} cy={CENTER} r={294} fill="none" />
        {Array.from({ length: 100 }, (_, index) => {
          const angle = Math.PI - index / 100 * 2 * Math.PI;
          const majorTick = index % 10 === 0;
          const innerRadius = majorTick ? 283 : index % 5 === 0 ? 287 : 290;
          return (
            <g key={'tick' + index}>
              <line className="smith-tick" x1={CENTER + innerRadius * Math.cos(angle)} y1={CENTER - innerRadius * Math.sin(angle)} x2={CENTER + 294 * Math.cos(angle)} y2={CENTER - 294 * Math.sin(angle)} />
              {majorTick && <text className="smith-scale-label" x={CENTER + 314 * Math.cos(angle)} y={CENTER - 314 * Math.sin(angle)} textAnchor="middle" dominantBaseline="middle">{(index / 200).toFixed(2)}</text>}
            </g>
          );
        })}
  </>;
});

const GridLabels = memo(function GridLabels({ sign }: { sign: number }) {
  return         <>
        {[0, 0.2, 0.5, 1, 2, 5].map((resistance) => (
          <text key={'r-label' + resistance} className="smith-grid-label" x={CENTER + sign * RADIUS * (resistance - 1) / (resistance + 1) + 5 * sign} y={CENTER + 15}>{resistance.toString()}</text>
        ))}
        {[0.2, 0.5, 1, 2, 5].flatMap((reactance) => [-1, 1].map((polarity) => {
          const re = (reactance * reactance - 1) / (reactance * reactance + 1);
          const im = polarity * 2 * reactance / (reactance * reactance + 1);
          return <text key={'x-label' + polarity * reactance} className="smith-reactance-label" x={CENTER + sign * 269 * re} y={CENTER - sign * 269 * im} textAnchor="middle" dominantBaseline="middle">{polarity > 0 ? '+' : '−'}j{reactance.toString()}</text>;
        }))}
        <text className="smith-grid-label" x={CENTER + sign * (RADIUS - 7)} y={CENTER + 16} textAnchor={sign === 1 ? 'end' : 'start'}>∞</text>
        </>;
});

export interface SmithConstruction {
  grid?: 'impedance' | 'admittance' | 'both';
  /** In the combined grid, 0 emphasizes Z and 1 emphasizes Y. Both remain visible. */
  gridFocus?: number;
  /** Filled chart-plane regions; nested loops form holes regardless of winding. */
  regions?: { id: string; loops: ComplexValue[][]; color?: string; opacity?: number; ariaLabel?: string }[];
  markers?: { id: string; label: string; point: ComplexValue; color?: string; opacity?: number }[];
  circles?: { id: string; center: ComplexValue; radius: number; color?: string; dashed?: boolean; opacity?: number }[];
  paths?: { id: string; points: ComplexValue[]; color?: string; dashed?: boolean; opacity?: number; dataSusceptance?: number }[];
  ariaLabel?: string;
}

const RegionOverlay = memo(function RegionOverlay({ loops, id, color, opacity, ariaLabel }: NonNullable<SmithConstruction['regions']>[number]) {
  const d = useMemo(() => regionPath(loops), [loops]);
  return <path data-chart-region={id} d={d} fill={color ?? 'var(--teal)'} fillRule="evenodd"
    fillOpacity={opacity ?? 0.12} stroke="none" pointerEvents="none"
    role={ariaLabel ? 'img' : undefined} aria-label={ariaLabel} aria-hidden={ariaLabel ? undefined : true} />;
});

const PathOverlay = memo(function PathOverlay({ points, id, color, dashed, opacity, dataSusceptance }: NonNullable<SmithConstruction['paths']>[number]) {
  const d = useMemo(() => curvePath(points), [points]);
  return <path data-chart-path={id} data-susceptance={dataSusceptance} d={d} stroke={color ?? 'var(--teal)'}
    strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dashed ? '5 5' : undefined} opacity={opacity} />;
});

interface SmithChartProps {
  solution: LineSolution | null;
  length: number;
  showCurves: boolean;
  showGamma: boolean;
  showSwr: boolean;
  interactive?: boolean;
  pointLabels?: { load: string; input: string };
  onSelectReflection: (gamma: ComplexValue) => void;
  /** Chart-plane overlays; the caller specifies the reading convention. */
  construction?: SmithConstruction;
}

export function SmithChart({ solution: legacySolution, length, showCurves, showGamma, showSwr, interactive = true, pointLabels = { load: 'z_L', input: 'z(l)' }, onSelectReflection, construction }: SmithChartProps) {
  const { t } = useI18n();
  const solution = construction ? null : legacySolution;
  const combinedGrid = construction?.grid === 'both';
  const gridSign = construction?.grid === 'admittance' ? -1 : 1;
  const gridName = gridSign === -1 ? 'Admittance' : 'Impedance';
  const gridFocus = Number.isFinite(construction?.gridFocus) ? Math.min(1, Math.max(0, construction!.gridFocus!)) : 0.5;
  const combinedDescription = t('Combined impedance and admittance Smith chart. Both grids use the same physical reflection coefficient. The coral impedance grid has positive reactance above the real axis; the blue admittance grid has positive susceptance below it.', 'Diagrama de Smith combinado de impedancias y admitancias. Ambas cuadrículas usan el mismo coeficiente de reflexión físico. La cuadrícula coral de impedancia tiene reactancia positiva por encima del eje real; la azul de admitancia tiene susceptancia positiva por debajo.');
  const clipId = 'smith-disk-' + useId().replaceAll(':', '');
  const arrowId = clipId + '-gamma-arrow';
  const draggingPointer = useRef<number | null>(null);
  const loadPoint = solution ? project(solution.loadReflection) : null;
  const inputPoint = solution ? project(solution.inputReflection) : null;
  const distinctPoints = solution !== null && Math.hypot(
    solution.inputReflection.re - solution.loadReflection.re,
    solution.inputReflection.im - solution.loadReflection.im,
  ) > 0.00001;
  const resistance = solution?.normalizedLoad?.re;
  const reactance = solution?.normalizedLoad?.im;
  const curves = useMemo(() => {
    if (!showCurves || resistance === undefined || reactance === undefined) return null;
    const points = loadCurves({ re: resistance, im: reactance });
    return points ? { resistance: curvePath(points.resistance), reactance: curvePath(points.reactance) } : null;
  }, [showCurves, resistance, reactance]);
  const gammaPhase = solution ? Math.atan2(solution.loadReflection.im, solution.loadReflection.re) : 0;
  const hasGamma = showGamma && solution !== null && solution.reflectionMagnitude > 0;
  const showGammaMagnitudeLabel = hasGamma && solution.reflectionMagnitude > 0.16;
  const phaseLabel = project({ re: 96 / RADIUS * Math.cos(gammaPhase / 2), im: 96 / RADIUS * Math.sin(gammaPhase / 2) });
  const phaseRayEnd = project({
    re: (PHASE_RADIUS + 12) / RADIUS * Math.cos(gammaPhase),
    im: (PHASE_RADIUS + 12) / RADIUS * Math.sin(gammaPhase),
  });
  const magnitudeLabel = solution ? project({
    re: solution.loadReflection.re / 2 - Math.sin(gammaPhase) * 38 / RADIUS,
    im: solution.loadReflection.im / 2 + Math.cos(gammaPhase) * 38 / RADIUS,
  }) : null;

  function selectPointer(event: PointerEvent<SVGSVGElement>, start: boolean) {
    if (!interactive || (start && (event.button !== 0 || !event.isPrimary))) return;
    if (!start && draggingPointer.current !== event.pointerId) return;
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    let re = (point.x - CENTER) / RADIUS;
    let im = (CENTER - point.y) / RADIUS;
    const magnitude = Math.hypot(re, im);
    if (start && magnitude > 1.035) return;
    if (magnitude > 1) { re /= magnitude; im /= magnitude; }
    // Make the ideal short, match, and open selectable despite screen-pixel rounding.
    const special = [-1, 0, 1].find((real) => Math.hypot(re - real, im) * RADIUS <= 6);
    if (special !== undefined) { re = special; im = 0; }
    event.preventDefault();
    if (start) {
      draggingPointer.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.focus({ preventScroll: true });
    }
    onSelectReflection({ re, im });
  }

  function releasePointer(event: PointerEvent<SVGSVGElement>) {
    if (draggingPointer.current === event.pointerId) draggingPointer.current = null;
  }

  function moveWithKeyboard(event: KeyboardEvent<SVGSVGElement>) {
    if (!interactive) return;
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1],
    };
    const direction = directions[event.key];
    if (!direction || !solution) return;
    event.preventDefault();
    const increment = event.shiftKey ? 0.05 : 0.01;
    let re = solution.loadReflection.re + direction[0] * increment;
    let im = solution.loadReflection.im + direction[1] * increment;
    const magnitude = Math.hypot(re, im);
    if (magnitude > 1) { re /= magnitude; im /= magnitude; }
    onSelectReflection({ re, im });
  }

  const labelStyle = (point: { x: number; y: number }, offset = 14) => ({
    left: (point.x / 680 * 100) + '%',
    top: (point.y / 680 * 100) + '%',
    transform: point.x > 550 ? 'translate(calc(-100% - ' + offset + 'px), -50%)' : 'translate(' + offset + 'px, -50%)',
  });


  return (
    <div className="smith-chart">
      <svg
        className="smith-chart__svg"
        data-interactive={interactive}
        data-grid={construction?.grid ?? 'impedance'}
        data-grid-focus={combinedGrid ? gridFocus : undefined}
        viewBox="0 0 680 680"
        role="img"
        aria-label={construction?.ariaLabel ?? (combinedGrid ? combinedDescription : interactive ? t('Impedance Smith chart. Drag inside the circle to change the load, or use the arrow keys.', 'Diagrama de Smith de impedancias. Arrastra dentro del círculo para cambiar la carga o usa las flechas del teclado.') : t('Impedance Smith chart showing the fixed load and the impedance at the selected line position.', 'Diagrama de Smith de impedancias con la carga fija y la impedancia en la posición seleccionada de la línea.'))}
        tabIndex={interactive ? 0 : undefined}
        onPointerDown={interactive ? (event) => selectPointer(event, true) : undefined}
        onPointerMove={interactive ? (event) => selectPointer(event, false) : undefined}
        onPointerUp={interactive ? releasePointer : undefined}
        onPointerCancel={interactive ? releasePointer : undefined}
        onLostPointerCapture={interactive ? releasePointer : undefined}
        onKeyDown={interactive ? moveWithKeyboard : undefined}
      >
        <title>{combinedGrid ? t('Combined impedance and admittance Smith chart', 'Diagrama de Smith combinado de impedancias y admitancias') : construction ? t(gridName + ' Smith chart', gridSign === -1 ? 'Diagrama de Smith de admitancias' : 'Diagrama de Smith de impedancias') : t('Normalized impedance Smith chart', 'Diagrama de Smith de impedancia normalizada')}</title>
        {combinedGrid && <desc>{combinedDescription}</desc>}
        <defs>
          <clipPath id={clipId}><circle cx={CENTER} cy={CENTER} r={RADIUS} /></clipPath>
          <marker id={arrowId} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path className="smith-gamma-arrow" d="M0,0 L7,3.5 L0,7 Z" /></marker>
        </defs>
        <circle className="smith-paper" cx={CENTER} cy={CENTER} r={RADIUS} />
        <g clipPath={'url(#' + clipId + ')'} fill="none">
          {construction?.regions?.map((region) => <RegionOverlay key={region.id} {...region} />)}
          {combinedGrid ? [1, -1].map((sign) => {
            const kind = sign === 1 ? 'impedance' : 'admittance';
            return <g key={kind} className={'smith-combined-grid smith-combined-grid--' + kind} data-grid-layer={kind} opacity={1 - 0.42 * (sign === 1 ? gridFocus : 1 - gridFocus)}><GridContours sign={sign} /></g>;
          }) : <GridContours sign={gridSign} />}
          <line className="smith-axis" x1={CENTER - RADIUS} x2={CENTER + RADIUS} y1={CENTER} y2={CENTER} />
          {construction?.circles?.map((circle) => {
            const center = project(circle.center);
            return <circle key={circle.id} data-chart-circle={circle.id} data-center-re={circle.center.re} data-center-im={circle.center.im} data-radius={circle.radius} cx={center.x} cy={center.y} r={RADIUS * circle.radius} stroke={circle.color ?? '#9d8a61'} strokeWidth={2} strokeDasharray={circle.dashed ? '5 5' : undefined} opacity={circle.opacity} />;
          })}
          {construction?.paths?.map((path) => <PathOverlay key={path.id} {...path} />)}
          {curves && <path className="smith-measurement smith-measurement--resistance" d={curves.resistance} />}
          {curves && <path className="smith-measurement smith-measurement--reactance" d={curves.reactance} />}
          {solution && length > 0 && <path className="smith-trajectory" d={trajectory(solution.loadReflection, length)} />}
          {hasGamma && solution && loadPoint && (
            <>
              <line className="smith-gamma-vector" x1={CENTER} y1={CENTER} x2={loadPoint.x} y2={loadPoint.y} markerEnd={'url(#' + arrowId + ')'} />
              {Math.abs(gammaPhase) > 0.00001 && (
                <>
                  <line className="smith-phase-reference" x1={CENTER} y1={CENTER} x2={CENTER + PHASE_RADIUS + 12} y2={CENTER} />
                  {solution.reflectionMagnitude * RADIUS < PHASE_RADIUS + 12 && <line className="smith-phase-reference" x1={loadPoint.x} y1={loadPoint.y} x2={phaseRayEnd.x} y2={phaseRayEnd.y} />}
                  <path className="smith-gamma-phase" d={phaseArc(gammaPhase)} markerEnd={'url(#' + arrowId + ')'} />
                </>
              )}
            </>
          )}
        </g>
        <circle className={'smith-boundary' + (showCurves && resistance === 0 ? ' smith-boundary--resistance' : '')} cx={CENTER} cy={CENTER} r={RADIUS} fill="none" />
        {showSwr && solution && <circle className="smith-swr" cx={CENTER} cy={CENTER} r={RADIUS * solution.reflectionMagnitude} fill="none" />}
        {!combinedGrid && <ChartScale />}
        {!combinedGrid && <GridLabels sign={gridSign} />}
        <circle className="smith-center" cx={CENTER} cy={CENTER} r={3} />
        {loadPoint && <g className={'smith-load' + (showGamma ? ' smith-load--compact' : '')}>{!showGamma && <circle className="smith-point-halo" cx={loadPoint.x} cy={loadPoint.y} r={13} />}<circle className="smith-point" cx={loadPoint.x} cy={loadPoint.y} r={showGamma ? 4 : 6} /></g>}
        {inputPoint && distinctPoints && <g className="smith-input"><circle className="smith-point-halo" cx={inputPoint.x} cy={inputPoint.y} r={13} /><circle className="smith-point" cx={inputPoint.x} cy={inputPoint.y} r={6} /></g>}
        {construction?.markers?.map((marker) => {
          const point = project(marker.point);
          return <g key={marker.id} data-chart-marker={marker.id} data-re={marker.point.re} data-im={marker.point.im} opacity={marker.opacity} style={{ color: marker.color ?? 'var(--teal)' }}><circle cx={point.x} cy={point.y} r={12} fill="currentColor" opacity={0.1} /><circle cx={point.x} cy={point.y} r={5} fill="currentColor" stroke="var(--paper)" strokeWidth={2} /></g>;
        })}
      </svg>
      <div className="smith-label-layer" aria-hidden="true">
        {construction?.markers?.filter((marker) => marker.label).map((marker) => <span key={marker.id} className="smith-point-label" style={{ ...labelStyle(project(marker.point)), color: marker.color ?? 'var(--teal)', opacity: marker.opacity }}><Formula tex={marker.label} /></span>)}
        {showGammaMagnitudeLabel && magnitudeLabel && (
          <span className="smith-gamma-label" style={{ left: (magnitudeLabel.x / 680 * 100) + '%', top: (magnitudeLabel.y / 680 * 100) + '%' }}><Formula tex={'|\\Gamma_L|'} /></span>
        )}
        {hasGamma && Math.abs(gammaPhase) > 0.00001 && (
          <span className="smith-gamma-label" style={{ left: (phaseLabel.x / 680 * 100) + '%', top: (phaseLabel.y / 680 * 100) + '%' }}><Formula tex={'\\phi_L'} /></span>
        )}
        {loadPoint && <span className={'smith-point-label smith-point-label--load' + (showGamma ? ' smith-point-label--compact' : '')} style={labelStyle(loadPoint, showGamma ? 9 : 14)}><Formula tex={pointLabels.load} /></span>}
        {inputPoint && distinctPoints && <span className="smith-point-label smith-point-label--input" style={labelStyle(inputPoint)}><Formula tex={pointLabels.input} /></span>}
      </div>
    </div>
  );
}
