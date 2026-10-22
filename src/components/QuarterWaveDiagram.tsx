import { useId } from 'react';
import { formatNumber } from '../math/format';
import { useI18n } from '../i18n';
import '../styles/transmission-line-diagram.css';
import '../styles/quarter-wave.css';

export interface QuarterWaveDiagramProps {
  z0: number;
  loadLabel: string;
  distance: number;
  transformerZ0: number | null;
  transformerLength: number;
  showTransformer?: boolean;
  periodicDistance?: number;
  periodicTransformerLength?: number;
  abstractLabels?: boolean;
  activeTransformerProgress?: number;
}

const LINE_START = 110;
const LINE_END = 480;
const UPPER_RAIL = 70;
const LOWER_RAIL = 150;
const LINE_Y = 110;
const TRANSFORMER_WIDTH = 120;
const DISTANCE_SPAN = 160;
const finiteLength = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;

/** A transformer is a series line section; it has no shunt branch. */
export function QuarterWaveDiagram({ z0, loadLabel, distance, transformerZ0, transformerLength, showTransformer = true, periodicDistance = 0, periodicTransformerLength = 0, abstractLabels = false, activeTransformerProgress }: QuarterWaveDiagramProps) {
  const { t } = useI18n();
  const prefix = 'quarter-wave-diagram-' + useId().replaceAll(':', '');
  const baseDistance = Math.min(0.5, finiteLength(distance));
  const baseTransformerLength = finiteLength(transformerLength);
  const totalDistance = baseDistance + finiteLength(periodicDistance);
  const totalTransformerLength = baseTransformerLength + finiteLength(periodicTransformerLength);
  const junctionX = LINE_END - baseDistance / 0.5 * DISTANCE_SPAN;
  const transformerStart = junctionX - TRANSFORMER_WIDTH;
  const transformerCenter = (transformerStart + junctionX) / 2;
  const distanceSpan = LINE_END - junctionX;
  const validZ0 = Number.isFinite(z0) && z0 > 0;
  const validTransformerZ0 = transformerZ0 !== null && Number.isFinite(transformerZ0) && transformerZ0 > 0;
  const z0Text = abstractLabels ? 'Z₀' : 'Z₀ = ' + (validZ0 ? formatNumber(z0, 3) + ' Ω' : '—');
  const transformerText = abstractLabels || !validTransformerZ0 ? 'Zₜ' : 'Zₜ = ' + formatNumber(transformerZ0!, 3) + ' Ω';
  const distanceText = abstractLabels ? 'd' : 'd = ' + formatNumber(totalDistance, 5) + 'λ';
  const lengthText = abstractLabels ? 'ℓₜ' : 'ℓₜ = ' + formatNumber(totalTransformerLength, 5) + 'λₜ';
  const readingProgress = activeTransformerProgress === undefined ? undefined : Math.max(0, Math.min(1, Number.isFinite(activeTransformerProgress) ? activeTransformerProgress : 0));
  const readingX = junctionX - TRANSFORMER_WIDTH * (readingProgress ?? 1);
  const description = t(
    'The generator is on the left and the load ' + (abstractLabels ? 'Z L' : loadLabel) + ' is on the right. ' + (showTransformer ? 'A blue transformer section is inserted in series between the main-line feed and the line section looking toward the load. The transformer has characteristic impedance ' + (abstractLabels || !validTransformerZ0 ? 'Z t' : formatNumber(transformerZ0!, 3) + ' ohms') + ' and length ' + (abstractLabels ? 'ell t' : formatNumber(totalTransformerLength, 5) + ' transformer wavelengths') + '. ' : 'The main line is shown before the transformer is inserted. ') + 'Distance ' + (abstractLabels ? 'd' : formatNumber(totalDistance, 5) + ' main-line wavelengths') + ' is measured from the load to the selected junction. The drawing is schematic; the labeled lengths set the electrical dimensions.',
    'El generador está a la izquierda y la carga ' + (abstractLabels ? 'Z subíndice L' : loadLabel) + ' está a la derecha. ' + (showTransformer ? 'Un tramo azul de transformador se inserta en serie entre la alimentación de la línea principal y el tramo que mira hacia la carga. El transformador tiene impedancia característica ' + (abstractLabels || !validTransformerZ0 ? 'Z subíndice t' : formatNumber(transformerZ0!, 3) + ' ohmios') + ' y longitud ' + (abstractLabels ? 'ele subíndice t' : formatNumber(totalTransformerLength, 5) + ' longitudes de onda del transformador') + '. ' : 'Se muestra la línea principal antes de insertar el transformador. ') + 'La distancia ' + (abstractLabels ? 'd' : formatNumber(totalDistance, 5) + ' longitudes de onda de la línea principal') + ' se mide desde la carga hasta la unión seleccionada. El dibujo es esquemático; las longitudes indicadas definen las dimensiones eléctricas.',
  );

  return (
    <svg className="transmission-line-diagram qw-diagram ss-diagram" style={{ aspectRatio: '600 / 270' }} viewBox="0 0 600 270" role="img" aria-label={t('Series quarter-wave transformer between a generator feed and the load line', 'Transformador de cuarto de onda en serie entre el generador y la línea de carga')} aria-describedby={prefix + '-description'} data-line-start={LINE_START} data-line-end={LINE_END} data-line-top={UPPER_RAIL} data-line-bottom={LOWER_RAIL} data-line-y={LINE_Y} data-distance={baseDistance} data-total-distance={totalDistance} data-transformer-present={showTransformer} data-transformer-start={showTransformer ? transformerStart : undefined} data-transformer-end={showTransformer ? junctionX : undefined} data-transformer-length={showTransformer ? baseTransformerLength : undefined} data-total-transformer-length={showTransformer ? totalTransformerLength : undefined} data-disabled="true">
      <desc id={prefix + '-description'}>{description}</desc>
      <defs>
        <marker id={prefix + '-distance-arrow'} markerWidth="8" markerHeight="6" refX="7" refY="3" markerUnits="userSpaceOnUse" orient="auto"><path className="transmission-line-diagram__distance-head" d="M0 0L8 3L0 6Z" /></marker>
        <marker id={prefix + '-transformer-arrow'} markerWidth="7" markerHeight="6" refX="3.5" refY="3" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path className="qw-diagram__dimension-head" d="M0 0L7 3L0 6Z" /></marker>
      </defs>
      <path className="transmission-line-diagram__wire" d="M60 86V70H110M60 134V150H110" />
      <circle className="transmission-line-diagram__source" cx="60" cy={LINE_Y} r="24" />
      <path className="transmission-line-diagram__sine" d="M40 110C47 94 53 94 60 110S73 126 80 110" />
      <text className="transmission-line-diagram__generator-label" x="60" y="186" textAnchor="middle">{t('Generator', 'Generador')}</text>
      <path className="transmission-line-diagram__line" d="M110 70H480M110 150H480" />
      <text className="qw-diagram__feed-label" x="150" y="54" textAnchor="middle">{z0Text}</text>
      <path className="transmission-line-diagram__load-connection" d="M480 70V90M480 130V150" />
      <rect className="transmission-line-diagram__load" x="471" y="90" width="18" height="40" />
      <text className="transmission-line-diagram__load-symbol" x="505" y="118">Z<tspan dy="4">L</tspan></text>
      {!abstractLabels && <text className="qw-diagram__load-value" x="580" y="184" textAnchor="end">{loadLabel}</text>}
      {showTransformer && <g className="qw-diagram__transformer" data-series-section="transformer">
        <rect className="qw-diagram__section-face" x={transformerStart} y={UPPER_RAIL} width={TRANSFORMER_WIDTH} height={LOWER_RAIL - UPPER_RAIL} />
        <path className="qw-diagram__section-wire" d={'M' + transformerStart + ' 70H' + junctionX + 'M' + transformerStart + ' 150H' + junctionX} />
        {readingProgress === undefined && <><path className="qw-diagram__input-plane" d={'M' + transformerStart + ' 62V162'} data-input-plane="transformer-input" /><circle className="qw-diagram__input-node" cx={transformerStart} cy={UPPER_RAIL} r="3.5" /><circle className="qw-diagram__input-node" cx={transformerStart} cy={LOWER_RAIL} r="3.5" /><text className="qw-diagram__reading-label" x={transformerStart - 9} y="28" textAnchor="end">Z<tspan baselineShift="sub">v</tspan></text></>}
        <text className="qw-diagram__transformer-label" x={transformerCenter} y="54" textAnchor="middle">{transformerText}</text>
        <g className="qw-diagram__transformer-dimension" data-dimension="transformer-length">
          <path d={'M' + transformerStart + ' 164V212M' + junctionX + ' 164V212'} />
          <path d={'M' + (transformerStart + 4) + ' 205H' + (junctionX - 4)} markerStart={'url(#' + prefix + '-transformer-arrow)'} markerEnd={'url(#' + prefix + '-transformer-arrow)'} />
          <text x={transformerCenter} y="250" textAnchor="middle">{lengthText}</text>
        </g>
      </g>}
      {showTransformer && distanceSpan >= 65 && <text className="qw-diagram__load-line-label" x={(junctionX + LINE_END) / 2} y="54" textAnchor="middle">Z₀</text>}
      <g className="qw-diagram__junction" data-junction-x={junctionX}>
        <path d={'M' + junctionX + ' 62V162'} />
        <circle cx={junctionX} cy={UPPER_RAIL} r="3.5" /><circle cx={junctionX} cy={LOWER_RAIL} r="3.5" />
        <text className="qw-diagram__junction-label" x={junctionX + 9} y="28">Z<tspan baselineShift="sub">ℓ</tspan><tspan baselineShift="baseline">(d)</tspan></text>
      </g>
      {showTransformer && readingProgress !== undefined && <g className="qw-diagram__reading-plane" data-transformer-reading-progress={readingProgress} data-transformer-reading-x={readingX}>
        <path className="qw-diagram__input-plane" d={'M' + readingX + ' 62V162'} data-input-plane="transformer-reading" />
        <circle className="qw-diagram__input-node" cx={readingX} cy={UPPER_RAIL} r="3.5" /><circle className="qw-diagram__input-node" cx={readingX} cy={LOWER_RAIL} r="3.5" />
        <text className="qw-diagram__reading-label" x={readingX - 9} y="28" textAnchor="end">{readingProgress >= 1 ? <>Z<tspan baselineShift="sub">v</tspan></> : <>Z<tspan baselineShift="super">(t)</tspan><tspan baselineShift="baseline">(ℓ)</tspan></>}</text>
      </g>}
      <g className="qw-diagram__distance-measure" data-dimension="load-distance" data-origin={LINE_END} data-position={junctionX} data-y="224">
        <path className="transmission-line-diagram__load-origin" d="M480 164V229" />
        <path className="qw-diagram__distance-tick" d={'M' + junctionX + ' 216V232'} />
        {distanceSpan > 0 && <path className="transmission-line-diagram__distance-arrow" d={'M480 224H' + junctionX} markerEnd={distanceSpan >= 14 ? 'url(#' + prefix + '-distance-arrow)' : undefined} />}
        <circle className="transmission-line-diagram__origin-dot" cx={LINE_END} cy="224" r="2.8" />
        <text className="qw-diagram__distance-label" x="590" y="234" textAnchor="end">{distanceText}</text>
      </g>
    </svg>
  );
}
