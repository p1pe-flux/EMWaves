import { useId } from 'react';
import { impedanceToReflection } from '../domain/transmission';
import { useI18n } from '../i18n';
import { Formula } from './Formula';
import { lcConstantRealLocus, lcReciprocal } from './lcMatchingGeometry';
import { SmithChart } from './SmithChart';
import '../styles/lc-smith-reading.css';

const examples = [
  { id: 'A', impedance: { re: 1, im: 1 } },
  { id: 'B', impedance: { re: 1, im: -1 } },
].map((example) => ({
  ...example,
  admittance: lcReciprocal(example.impedance)!,
  reflection: impedanceToReflection(example.impedance),
}));

const impedanceCircle = lcConstantRealLocus(1, 'impedance');
const admittanceCircle = lcConstantRealLocus(.5, 'admittance');

/** A fixed reading key for the LC guide, using the shared physical YZ chart. */
export function LCDoubleSmithReading() {
  const { t } = useI18n();
  const id = useId();

  return <section className="lc-smith-reading" data-lc-smith-reading aria-labelledby={id + '-heading'}>
    <h2 id={id + '-heading'}>{t('How to read the combined Smith chart', 'Cómo leer el diagrama doble de Smith')}</h2>
    <p>{t('The combined chart superimposes two grids: coral for normalized impedance and blue for normalized admittance. Each physical point can be read in either grid.', 'El diagrama doble superpone dos cuadrículas: coral para la impedancia normalizada y azul para la admitancia normalizada. Cada punto físico puede leerse con cualquiera de las dos cuadrículas.')}</p>
    <Formula display tex={String.raw`z=r+\iu x,\qquad y=g+\iu b=\frac{1}{z}`} />
    <p><Formula tex="r" />{t(' is resistance and ', ' es la resistencia y ')}<Formula tex="x" />{t(' is reactance; ', ' es la reactancia; ')}<Formula tex="g" />{t(' is conductance and ', ' es la conductancia y ')}<Formula tex="b" />{t(' is susceptance. All four quantities are normalized. In particular, ', ' es la susceptancia. Las cuatro magnitudes están normalizadas. En particular, ')}<Formula tex="b" />{t(' is the imaginary part of admittance. Taking the reciprocal gives:', ' es la parte imaginaria de la admitancia. Al tomar el recíproco obtenemos:')}</p>
    <Formula display tex={String.raw`b=-\frac{x}{r^2+x^2}`} />
    <p>{t('Reactance and susceptance therefore have opposite signs at the same point. Reading admittance keeps the point fixed because both readings share the same physical reflection coefficient:', 'Por eso, la reactancia y la susceptancia tienen signos opuestos en el mismo punto. Al leer admitancia, el punto permanece fijo porque ambas lecturas comparten el mismo coeficiente de reflexión físico:')}</p>
    <Formula display tex={String.raw`\Gamma=\frac{z-1}{z+1}=\frac{1-y}{1+y}`} />

    <div className="lc-smith-reading__examples-layout">
      <figure className="lc-smith-reading__figure">
        <SmithChart solution={null} length={0} showCurves={false} showGamma={false} showSwr={false} interactive={false} onSelectReflection={() => {}}
          construction={{
            grid: 'both', gridFocus: .5,
            ariaLabel: t('Combined Smith chart: point A above the real axis is inductive; point B below the real axis is capacitive. Each point has an impedance reading on the coral grid and an admittance reading on the blue grid.', 'Diagrama doble de Smith: el punto A, por encima del eje real, es inductivo; el punto B, por debajo del eje real, es capacitivo. Cada punto tiene una lectura de impedancia en la cuadrícula coral y otra de admitancia en la cuadrícula azul.'),
            circles: [
              { id: 'lc-reading-resistance', ...impedanceCircle, color: 'var(--coral)', opacity: .8 },
              { id: 'lc-reading-conductance', ...admittanceCircle, color: 'var(--blue)', dashed: true, opacity: .8 },
            ],
            markers: examples.map((example) => ({ id: 'lc-reading-' + example.id, label: example.id, point: example.reflection, color: 'var(--ink)' })),
          }} />
        <figcaption className="lc-smith-reading__legend">
          <span><i className="lc-smith-reading__swatch lc-smith-reading__swatch--z" aria-hidden="true" /><Formula tex="r=1" />{t(' (impedance)', ' (impedancia)')}</span>
          <span><i className="lc-smith-reading__swatch lc-smith-reading__swatch--y" aria-hidden="true" /><Formula tex="g=\tfrac12" />{t(' (admittance)', ' (admitancia)')}</span>
        </figcaption>
      </figure>
      <div className="lc-smith-reading__examples">
        {examples.map((example) => {
          const above = example.impedance.im > 0;
          return <div key={example.id} className="lc-smith-reading__example" data-lc-reading-example={example.id}
            data-z-real={example.impedance.re} data-z-imaginary={example.impedance.im}
            data-y-real={example.admittance.re} data-y-imaginary={example.admittance.im}
            data-gamma-real={example.reflection.re} data-gamma-imaginary={example.reflection.im}>
            <p className="lc-smith-reading__example-title"><strong>{example.id}</strong>{above ? t(' — inductive', ' — inductivo') : t(' — capacitive', ' — capacitivo')}</p>
            <p className="lc-smith-reading__example-value lc-smith-reading__example-value--z"><Formula tex={'z_' + example.id + '=1' + (above ? '+' : '-') + '\\iu'} /></p>
            <p className="lc-smith-reading__example-value lc-smith-reading__example-value--y"><Formula tex={'y_' + example.id + '=\\tfrac12' + (above ? '-' : '+') + '\\iu\\tfrac12'} /></p>
            <p>{above
              ? t('Above the real axis, positive reactance and negative susceptance describe the same inductive point.', 'Por encima del eje real, la reactancia positiva y la susceptancia negativa describen el mismo punto inductivo.')
              : t('Below the real axis, negative reactance and positive susceptance describe the same capacitive point.', 'Por debajo del eje real, la reactancia negativa y la susceptancia positiva describen el mismo punto capacitivo.')}</p>
          </div>;
        })}
      </div>
    </div>
    <p>{t('Both examples lie on the coral constant-resistance circle ', 'Ambos ejemplos están sobre el círculo coral de resistencia constante ')}<Formula tex="r=1" />{t(' and the blue constant-conductance circle ', ' y el círculo azul de conductancia constante ')}<Formula tex="g=\tfrac12" />{t('. The two readings belong to the same marked point.', '. Las dos lecturas corresponden al mismo punto marcado.')}</p>

    <table className="lc-smith-reading__table">
      <caption>{t('Signs in the combined chart', 'Signos en el diagrama doble')}</caption>
      <thead><tr><th scope="col">{t('Region', 'Zona')}</th><th scope="col"><Formula tex="x" /></th><th scope="col"><Formula tex="b" /></th><th scope="col">{t('Behavior', 'Comportamiento')}</th></tr></thead>
      <tbody>
        <tr><th scope="row">{t('Upper half', 'Mitad superior')}</th><td><Formula tex="x>0" /></td><td><Formula tex="b<0" /></td><td>{t('Inductive', 'Inductivo')}</td></tr>
        <tr><th scope="row">{t('Lower half', 'Mitad inferior')}</th><td><Formula tex="x<0" /></td><td><Formula tex="b>0" /></td><td>{t('Capacitive', 'Capacitivo')}</td></tr>
        <tr><th scope="row">{t('Real axis', 'Eje real')}</th><td><Formula tex="x=0" /></td><td><Formula tex="b=0" /></td><td>{t('Resistive', 'Resistivo')}</td></tr>
      </tbody>
    </table>
    <p>{t('For an element in series, read ', 'Para un elemento en serie, leemos ')}<Formula tex="z" />{t(' on the coral grid and change ', ' en la cuadrícula coral y modificamos ')}<Formula tex="x" />{t(' while keeping ', ' conservando ')}<Formula tex="r" />{t('. For an element in parallel, read ', '. Para un elemento en paralelo, leemos ')}<Formula tex="y" />{t(' on the blue grid and change ', ' en la cuadrícula azul y modificamos ')}<Formula tex="b" />{t(' while keeping ', ' conservando ')}<Formula tex="g" />.</p>
  </section>;
}
