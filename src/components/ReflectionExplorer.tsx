import { useId, useMemo, useState } from 'react';
import { reflectionToImpedance, solveLine } from '../domain/transmission';
import type { ComplexValue } from '../domain/transmission';
import { reflectionGeometry } from '../domain/reflectionGeometry';
import { texNumber } from '../math/format';
import { Formula } from './Formula';
import { SmithChart } from './SmithChart';
import { useI18n } from '../i18n';
import '../styles/reflection-explorer.css';

export interface ReflectionExplorerProps {
  z?: ComplexValue | null;
  onChangeZ?: (z: ComplexValue) => void;
}

function numericTex(value: number): string {
  const magnitude = Math.abs(value);
  if (magnitude !== 0 && (magnitude < 0.001 || magnitude >= 100000)) {
    const [mantissa, exponent] = value.toExponential(3).split('e');
    return Number(mantissa) + '\\times 10^{' + Number(exponent) + '}';
  }
  return texNumber(value, 4);
}

export function ReflectionExplorer({ z, onChangeZ }: ReflectionExplorerProps) {
  const { t } = useI18n();
  const prefix = 'reflection-explorer-' + useId().replaceAll(':', '');
  const [localZ, setLocalZ] = useState<ComplexValue | null>({ re: 2, im: 1 });
  const value = z === undefined ? localZ : z;
  const editable = z === undefined || onChangeZ !== undefined;
  const [showCurves, setShowCurves] = useState(true);
  const [showGamma, setShowGamma] = useState(false);
  const [showSwr, setShowSwr] = useState(false);
  const { magnitude, phase } = reflectionGeometry(value);
  const solution = useMemo(() => solveLine({
    z0: 1,
    load: value === null ? { kind: 'open' } : { kind: 'impedance', resistance: value.re, reactance: value.im },
    lengthInWavelengths: 0,
  }), [value?.re, value?.im, value === null]);
  function selectReflection(nextGamma: ComplexValue) {
    if (!editable) return;
    const nextZ = reflectionToImpedance(nextGamma);
    if (z === undefined) setLocalZ(nextZ);
    if (nextZ !== null) onChangeZ?.(nextZ);
  }

  return (
    <section className="reflection-explorer" aria-labelledby={prefix + '-title'}>
      <header className="reflection-explorer__heading">
        <h3 id={prefix + '-title'}>{t('Read the Smith chart', 'Leer el diagrama de Smith')}</h3>
        <p>{t('The normalized load impedance determines the magnitude and phase of the reflection coefficient.', 'La impedancia normalizada de la carga determina el módulo y la fase del coeficiente de reflexión.')}</p>
      </header>
      <div className="reflection-explorer__toggles" aria-label={t('Smith chart readings', 'Lecturas del diagrama de Smith')}>
        <button type="button" aria-pressed={showCurves} aria-controls={prefix + '-circles-help'} onClick={() => setShowCurves((visible) => !visible)}>{t('Show circles', 'Mostrar círculos')}</button>
        <button type="button" aria-pressed={showGamma} aria-controls={prefix + '-gamma-help'} onClick={() => setShowGamma((visible) => !visible)}>{t('Show gamma', 'Mostrar Γ')}</button>
        <button type="button" aria-pressed={showSwr} aria-controls={prefix + '-swr-help'} onClick={() => setShowSwr((visible) => !visible)}>{t('Show SWR circle', 'Mostrar círculo de ROE')}</button>
      </div>
      <div className="reflection-explorer__explanations" hidden={!showCurves && !showGamma && !showSwr}>
        <section className="reflection-explorer__explanation" id={prefix + '-circles-help'} hidden={!showCurves} aria-labelledby={prefix + '-circles-title'}>
          <h4 id={prefix + '-circles-title'}>{t('Reading', 'Lectura de')} <Formula tex={'z'} /></h4>
          <Formula display tex={'z=r+\\iu x,\\qquad r=\\frac{R}{Z_0},\\qquad x=\\frac{X}{Z_0}.'} />
          <p>{t('Here', 'Aquí')} <Formula tex={'r=\\operatorname{Re}z'} /> {t('is the normalized resistance and', 'es la resistencia normalizada y')} <Formula tex={'x=\\operatorname{Im}z'} /> {t('is the normalized reactance, with', 'es la reactancia normalizada, con')} <Formula tex={'Z=R+\\iu X'} />.</p>
          <p>{t('The', 'El')} <span className="reflection-explorer__reading--resistance">{t('brown circle', 'círculo marrón')}</span> {t('has constant', 'mantiene constante')} <Formula tex={'r'} />, {t('whose value is given by the resistance scale on the horizontal axis.', 'cuyo valor se indica en la escala de resistencias del eje horizontal.')} {t('The', 'La')} <span className="reflection-explorer__reading--reactance">{t('blue curve', 'curva azul')}</span> {t('has constant', 'mantiene constante')} <Formula tex={'x'} />, {t('identified by the signed reactance labels beside the disk boundary.', 'identificada por las etiquetas de reactancia con signo junto al borde del disco.')} {t('Their intersection represents the load impedance', 'Su intersección representa la impedancia de la carga')} <Formula tex={'z=r+\\iu x'} />.</p>
        </section>
        <section className="reflection-explorer__explanation" id={prefix + '-gamma-help'} hidden={!showGamma} aria-labelledby={prefix + '-gamma-title'}>
          <h4 id={prefix + '-gamma-title'}>{t('Reading', 'Lectura de')} <Formula tex={'\\Gamma'} /></h4>
          <p>{t("The vector runs from the chart's center", "El vector parte del centro del diagrama")} (<Formula tex={'\\Gamma=0'} />) {t('to the load point. Its length divided by the unit-circle radius gives the magnitude', 'y llega al punto de la carga. Su longitud dividida por el radio del círculo unidad da el módulo')} <Formula tex={'|\\Gamma|'} />.</p>
          <p>{t('The argument', 'El argumento')} <Formula tex={'\\arg\\Gamma'} /> {t('is the signed angle from the positive horizontal axis to this vector: counterclockwise is positive, clockwise is negative. It is expressed in radians.', 'es el ángulo con signo desde el semieje horizontal positivo hasta este vector: el sentido antihorario es positivo y el horario es negativo. Se expresa en radianes.')}</p>
          <p className="reflection-explorer__case">{t('At the matched load', 'Para la carga adaptada')} <Formula tex={'z=1'} />, {t('the point is at the center:', 'el punto está en el centro:')} <Formula tex={'|\\Gamma|=0'} /> {t('and the argument is undefined.', 'y el argumento no está definido.')}</p>
        </section>
        <section className="reflection-explorer__explanation" id={prefix + '-swr-help'} hidden={!showSwr} aria-labelledby={prefix + '-swr-title'}>
          <h4 id={prefix + '-swr-title'}>{t('SWR circle', 'Círculo de ROE')}</h4>
          <p>{t('The SWR circle contains all points with the same magnitude', 'El círculo de ROE contiene todos los puntos con el mismo módulo')} <Formula tex={'|\\Gamma|'} />. {t('Propagation along a lossless line changes the phase while preserving this magnitude and the SWR.', 'La propagación por una línea sin pérdidas cambia la fase, pero conserva este módulo y la ROE.')}</p>
        </section>
      </div>
      <div className="reflection-explorer__chart">
        <SmithChart solution={solution} length={0} showCurves={showCurves} showGamma={showGamma} showSwr={showSwr} onSelectReflection={selectReflection} />
      </div>
      <div className="reflection-explorer__readings" aria-label={t('Impedance and reflection readings', 'Lecturas de impedancia y reflexión')}>
        <span className="reflection-explorer__reading--resistance"><i /><Formula tex={'r=' + (value === null ? '\\text{—}' : numericTex(value.re))} /></span>
        <span className="reflection-explorer__reading--reactance"><i /><Formula tex={'x=' + (value === null ? '\\text{—}' : numericTex(value.im))} /></span>
        <span><Formula tex={'|\\Gamma|=' + numericTex(magnitude)} /></span>
        <span><Formula tex={phase === null ? '\\arg\\Gamma=\\text{' + t('Undefined', 'Indefinido') + '}' : '\\arg\\Gamma=' + numericTex(phase) + '\\;\\mathrm{rad}'} /></span>
      </div>
    </section>
  );
}
