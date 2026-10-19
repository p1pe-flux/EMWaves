import { useState } from 'react';
import { useI18n } from '../i18n';
import type { SeriesStubInput } from '../domain/seriesStub';
import type { StubTermination } from '../domain/singleStub';
import { Formula } from './Formula';
import { SeriesStubConstruction } from './SeriesStubConstruction';
import { SeriesStubDiagram } from './SeriesStubDiagram';
import '../single-stub.css';

export const SERIES_STUB_EXAMPLE: SeriesStubInput = {
  z0: 50, stubZ0: 50,
  load: { kind: 'impedance', resistance: 100, reactance: 50 },
};

export function SeriesStubGuideContent() {
  const { t } = useI18n();
  const [termination, setTermination] = useState<StubTermination>('short');
  return <div className="ss-guide series-guide">
    <div className="ss-guide__article">
      <p>{t('A series stub supplies a reactance in the current path. First choose where the load and line present the required resistance; then choose the stub length that cancels the remaining reactance. Both open and short terminations follow the same matching deduction.', 'Un stub en serie aporta una reactancia en el camino de la corriente. Primero elegimos dónde la carga y la línea presentan la resistencia necesaria; después obtenemos la longitud del stub que cancela la reactancia restante. La misma deducción sirve para una terminación abierta o cortocircuitada.')}</p>
      <SeriesStubDiagram input={SERIES_STUB_EXAMPLE} termination={termination} abstractLabels />
      <p>{t('The upper conductor passes through the two input terminals of the blue stub. The lower main-line conductor remains continuous. The load-side line impedance is ', 'El conductor superior pasa por los dos terminales de entrada del stub azul. El conductor inferior de la línea principal permanece continuo. La impedancia de la línea vista hacia la carga es ')}<Formula tex="z_\ell(d)" />{t('; the stub contributes ', '; el stub aporta ')}<Formula tex="z_{\mathrm{stub}}" />{t('; their combined input is ', '; la entrada conjunta es ')}<Formula tex="z_v" />.</p>

      <h2>{t('Why the real part must equal one', 'Por qué la parte real debe ser uno')}</h2>
      <p>{t('Normalize all impedances to the main-line reference. Series elements carry the same current, so their voltage drops and impedances add:', 'Normalizamos todas las impedancias respecto de la línea principal. Los elementos en serie llevan la misma corriente, por lo que se suman sus caídas de tensión y sus impedancias:')}</p>
      <Formula display tex={String.raw`z_L=\frac{Z_L}{Z_0},\qquad z_\ell(d)=\frac{Z_\ell(d)}{Z_0},\qquad z_{\mathrm{stub}}=\frac{Z_{\mathrm{stub}}}{Z_0}`} />
      <Formula display tex={String.raw`z_v=z_\ell(d)+z_{\mathrm{stub}}=z_\ell(d)+\iu x_s`} />
      <p>{t('An ideal open or short stub is purely reactive. It can change the imaginary part but cannot change the resistance at its attachment plane. Therefore a match requires', 'Un stub ideal abierto o cortocircuitado es puramente reactivo. Puede cambiar la parte imaginaria, pero no la resistencia en el plano de conexión. Por eso, para adaptar necesitamos')}</p>
      <Formula display tex={String.raw`z_v=1\quad\Longrightarrow\quad\operatorname{Re}z_\ell(d)=1,\qquad x_s=-\operatorname{Im}z_\ell(d)`} />
      <p>{t('The coral line point therefore has the form ', 'El punto coral de la línea tiene entonces la forma ')}<Formula tex="1+\iu x" />{t('. The blue stub contributes ', '. El stub azul aporta ')}<Formula tex="-\iu x" />{t(', leaving the green matched input at the chart center.', ', y deja la entrada adaptada verde en el centro del diagrama.')}</p>

      <h2>{t('Find both placements on the diagram', 'Encontrar ambas ubicaciones en el diagrama')}</h2>
      <p>{t('Plot the normalized load impedance directly on the standard Smith grid. All of this construction uses impedance and physical reflection coordinates; no conversion to an admittance reading is needed.', 'Representamos directamente la impedancia normalizada de la carga sobre la cuadrícula habitual de Smith. Toda esta construcción usa impedancia y las coordenadas físicas de reflexión; no hace falta convertir la lectura a admitancia.')}</p>
      <Formula display tex={String.raw`\Gamma_L=\frac{z_L-1}{z_L+1},\qquad \Gamma(d)=\Gamma_L e^{-\iu\,2\beta d}`} />
      <p>{t('Draw the complete constant-SWR circle and the circle of unit resistance. Drawing the circles and following them are separate steps:', 'Dibujamos el círculo completo de ROE constante y el de resistencia unitaria. Dibujar los círculos y recorrerlos son pasos separados:')}</p>
      <Formula display tex={String.raw`|\Gamma|=|\Gamma_L|,\qquad\operatorname{Re}z=1\;\Longleftrightarrow\;\left|\Gamma-\frac12\right|=\frac12`} />
      <p>{t('Their two intersections are the possible attachment planes in the first half wavelength. Move clockwise toward the generator to the first one, obtain its stub, and verify it before constructing the second branch.', 'Sus dos intersecciones son los planos de conexión posibles en la primera media longitud de onda. Avanzamos en sentido horario hacia el generador hasta el primero, obtenemos su stub y verificamos la adaptación antes de construir la segunda rama.')}</p>
      <Formula display tex={String.raw`z_i=1\pm\iu A,\qquad A=\sqrt{\frac{(r-1)^2+x^2}{r}},\qquad z_L=r+\iu x`} />
      <Formula display tex={String.raw`\Gamma_i=\frac{z_i-1}{z_i+1},\qquad 2\beta d_i=\left[\arg\Gamma_L-\arg\Gamma_i\right]_{2\pi}`} />
      <p>{t('The brackets select the angle in ', 'Los corchetes seleccionan el ángulo en ')}<Formula tex="[0,2\pi)" />{t('. The two distances are sorted from the load, with ', '. Ordenamos las dos distancias desde la carga, con ')}<Formula tex="0\le d_i<\lambda/2" />.</p>

      <h2>{t('Derive the placement equation', 'Deducir la ecuación de ubicación')}</h2>
      <Formula display tex={String.raw`z_\ell(d)=\frac{z_L\cos(\beta d)+\iu\sin(\beta d)}{\cos(\beta d)+\iu z_L\sin(\beta d)}`} />
      <p>{t('For ', 'Para ')}<Formula tex="z_L=r+\iu x" />{t(', taking the real part gives', ', la parte real es')}</p>
      <Formula display tex={String.raw`\operatorname{Re}z_\ell(d)=\frac{r}{[\cos(\beta d)-x\sin(\beta d)]^2+r^2\sin^2(\beta d)}`} />
      <p>{t('Set the result to one and introduce ', 'Igualamos el resultado a uno y definimos ')}<Formula tex="t=\tan(\beta d)" />:</p>
      <Formula display tex={String.raw`(r^2+x^2-r)t^2-2xt+(1-r)=0`} />
      <p>{t('Each real tangent root has an angular branch, selected within the first half wavelength. A quarter-wave placement can correspond to an infinite tangent. The solver therefore uses the circle intersections and atan2 angles instead of relying on this quadratic numerically.', 'Cada raíz real de la tangente tiene una rama angular, que elegimos dentro de la primera media longitud de onda. Una ubicación de cuarto de onda puede corresponder a una tangente infinita. Por eso el solver usa las intersecciones de círculos y ángulos atan2, en lugar de depender numéricamente de esta cuadrática.')}</p>

      <h2>{t('Build the open or short series stub', 'Construir el stub en serie abierto o en corto')}</h2>
      <p>{t('Only the length formula changes with the termination. Include the stub’s own characteristic impedance when normalizing its input reactance:', 'Con la terminación cambia únicamente la fórmula de longitud. Al normalizar la reactancia de entrada incluimos la impedancia característica propia del stub:')}</p>
      <Formula display tex={String.raw`x_{s,\mathrm{short}}=\frac{Z_{0s}}{Z_0}\tan(\beta_s\ell_s),\qquad x_{s,\mathrm{open}}=-\frac{Z_{0s}}{Z_0}\cot(\beta_s\ell_s)`} />
      <p>{t('These series-stub relations and the real-resistance matching condition are developed in ', 'Estas relaciones del stub en serie y la condición de adaptación de la resistencia se desarrollan en ')}<a href="https://courses.ece.vt.edu/ece3105/chp2_lssn6.html" target="_blank" rel="noreferrer">{t('Virginia Tech’s transmission-line lesson', 'la lección de líneas de transmisión de Virginia Tech')}</a>.</p>
      <Formula display tex={String.raw`q=x_s\frac{Z_0}{Z_{0s}},\qquad\beta_s\ell_{s,\mathrm{short}}=[\operatorname{atan2}(q,1)]_\pi`} />
      <Formula display tex={String.raw`\beta_s\ell_{s,\mathrm{open}}=\operatorname{atan2}(1,-q)`} />
      <p>{t('Choose the representative ', 'Elegimos el representante ')}<Formula tex="0\le\ell_s<\lambda_s/2" />{t('. The stub alone lies on the outer boundary, where the real part of its input impedance is zero. During its construction the earlier circles and reactance curves stay visible. After connection, the total impedance follows the unit-resistance circle to the center.', '. El stub aislado está sobre el borde exterior, donde la parte real de su impedancia de entrada es cero. Durante su construcción permanecen visibles los círculos y las curvas de reactancia anteriores. Al conectarlo, la impedancia total recorre el círculo de resistencia unitaria hasta el centro.')}</p>
      <Formula display tex={String.raw`z_v=1,\qquad Z_v=Z_0,\qquad\Gamma_v=\frac{z_v-1}{z_v+1}=0`} />

      <h2>{t('Construct the worked example', 'Construir el ejemplo')}</h2>
      <Formula display tex={String.raw`Z_0=Z_{0s}=50\;\Omega,\qquad Z_L=100+\iu50\;\Omega`} />
      <p>{t('Use Next to complete one operation at a time. First construct branch 1 and then branch 2. Each upper result block appears only when its placement or stub length has been obtained. Changing the termination restarts the construction with the corresponding length formula.', 'Usa Siguiente para completar una operación cada vez. Primero construimos la rama 1 y después la rama 2. Cada valor superior aparece sólo cuando se obtiene su ubicación o su longitud de stub. Cambiar la terminación reinicia la construcción con la fórmula de longitud correspondiente.')}</p>
    </div>
    <SeriesStubConstruction input={SERIES_STUB_EXAMPLE} termination={termination} onTerminationChange={setTermination} />
    <div className="ss-guide__article">
      <h2>{t('Periodic families and limiting cases', 'Familias periódicas y casos límite')}</h2>
      <Formula display tex={String.raw`d=d_i+n\frac{\lambda}{2},\qquad\ell_s=\ell_{s,i}+m\frac{\lambda_s}{2},\qquad n,m\in\{0,1,2,\ldots\}`} />
      <p>{t('These independent repetitions preserve the electrical match. The laboratory displays the fundamental lengths; the main line and the stub retain their own wavelengths.', 'Estas repeticiones independientes conservan la adaptación eléctrica. El laboratorio muestra las longitudes fundamentales; la línea principal y el stub mantienen sus propias longitudes de onda.')}</p>
      <p>{t('An already matched load allows arbitrary placement and zero series reactance: a zero-length short stub or a quarter-wave open stub. Ideal open, short, and purely reactive loads absorb no real power and cannot be matched by this lossless network.', 'Una carga ya adaptada admite ubicación arbitraria y reactancia serie nula: un stub en corto de longitud cero o uno abierto de un cuarto de onda. Las cargas ideales abiertas, en corto o puramente reactivas no absorben potencia real y no se pueden adaptar con esta red sin pérdidas.')}</p>
      <p>{t('An infinite series-stub input impedance opens the current path. That explicit pole has ', 'Una impedancia de entrada infinita del stub en serie abre el camino de corriente. Ese polo explícito tiene ')}<Formula tex="\Gamma_v=+1" />{t(' and infinite VSWR.', ' y ROE infinita.')}</p>
      <a className="guide-link guide-link--primary" href="#/labs/series-stub-matching">{t('Open the series-stub laboratory', 'Abrir el laboratorio de stub en serie')} <span aria-hidden="true">→</span></a>
    </div>
  </div>;
}
