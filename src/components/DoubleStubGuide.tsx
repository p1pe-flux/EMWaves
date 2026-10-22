import { useI18n } from '../i18n';
import { useState } from 'react';
import type { DoubleStubInput } from '../domain/doubleStub';
import type { StubTermination } from '../domain/singleStub';
import { Formula } from './Formula';
import { DoubleStubConstruction } from './DoubleStubConstruction';
import { DoubleStubDiagram } from './DoubleStubDiagram';
import '../styles/single-stub.css';
import '../styles/double-stub.css';

export const DOUBLE_STUB_EXAMPLE: DoubleStubInput = {
  z0: 50, stub1Z0: 50, stub2Z0: 50,
  load: { kind: 'impedance', resistance: 100, reactance: 50 },
  distance: 0.125, separation: 0.125,
};

export function DoubleStubGuideContent() {
  const { t } = useI18n();
  const [termination1, setTermination1] = useState<StubTermination>('short');
  const [termination2, setTermination2] = useState<StubTermination>('short');
  return <div className="ss-guide ds-guide">
    <div className="ss-guide__article">
      <p>{t('Two reactive shunt stubs can match a load while their attachment positions stay fixed. Work backward from the matched input to discover the locus that the second stub must reach, then construct each solution from the load.', 'Dos stubs reactivos en paralelo pueden adaptar una carga manteniendo fijas sus posiciones de conexión. Partimos de la entrada adaptada para descubrir el lugar geométrico al que debe llegar el segundo stub y luego construimos cada solución desde la carga.')}</p>
      <p>{t('Number the stubs from left to right: stub 1 is closest to the generator, and stub 2 is closest to the load. The distance from the load to stub 2 is ', 'Numeramos los stubs de izquierda a derecha: el stub 1 está cerca del generador y el stub 2 cerca de la carga. La distancia entre la carga y el stub 2 es ')}<Formula tex="d_1" />{t('; the separation between the stubs is ', '; la separación entre los stubs es ')}<Formula tex="d_2" />{t('. Both distances belong to the main line, with phase constant ', '. Ambas distancias corresponden a la línea principal, con constante de fase ')}<Formula tex="\beta" />{t(' and wavelength ', ' y longitud de onda ')}<Formula tex="\lambda" />.</p>
    </div>
    <div className="ds-guide__circuit">
      <DoubleStubDiagram input={DOUBLE_STUB_EXAMPLE} termination1={termination1} termination2={termination2} abstractLabels />
    </div>
    <div className="ss-guide__article">
      <h2>{t('Define the admittances at each junction', 'Definimos las admitancias de cada unión')}</h2>
      <p>{t('Normalize every admittance to the main-line value ', 'Normalizamos todas las admitancias respecto de la línea principal: ')}<Formula tex="Y_0=1/Z_0" />{t('. First move the load through the line section ', '. Primero trasladamos la carga a través del tramo ')}<Formula tex="d_1" />{t(' to obtain the load-side admittance at stub 2:', ' para obtener la admitancia vista hacia la carga en el stub 2:')}</p>
      <Formula display tex={String.raw`y_L=\frac{Z_0}{Z_L}`} />
      <Formula display tex={String.raw`y_R=\frac{y_L\cos(\beta d_1)+\iu\sin(\beta d_1)}{\cos(\beta d_1)+\iu y_L\sin(\beta d_1)}`} />
      <p>{t('Adding the right stub, moving to the left junction and adding the left stub gives', 'Al añadir el stub derecho, avanzar hasta la unión izquierda y añadir el stub izquierdo obtenemos')}</p>
      <Formula display tex={String.raw`y_2=y_R+\iu b_{s2}`} />
      <Formula display tex={String.raw`y_1=\frac{y_2\cos(\beta d_2)+\iu\sin(\beta d_2)}{\cos(\beta d_2)+\iu y_2\sin(\beta d_2)}`} />
      <Formula display tex={String.raw`y_v=y_1+\iu b_{s1}`} />
      <p>{t('The target is ', 'El objetivo es ')}<Formula tex="y_v=1" />{t('. Open and short stubs have the same matching deduction because each contributes only an imaginary admittance. Their length formulas differ.', '. La deducción de adaptación es la misma para stubs abiertos y cortocircuitados porque ambos aportan únicamente admitancia imaginaria. Lo que cambia es su fórmula de longitud.')}</p>

      <h2>{t('Start at the left: undo the first stub', 'Comenzamos por la izquierda: deshacemos el primer stub')}</h2>
      <Formula display tex={String.raw`y_1=1-\iu b_{s1}\quad\Longrightarrow\quad\operatorname{Re}y_1=1`} />
      <p>{t('Before the left stub is added, the line admittance must lie somewhere on the unity-conductance circle. We do not yet know its imaginary part; draw the complete circle of possibilities.', 'Antes de conectar el stub izquierdo, la admitancia de la línea debe estar en el círculo de conductancia unitaria. Todavía no conocemos su parte imaginaria: dibujamos el círculo completo de posibilidades.')}</p>
      <p>{t('Use the same fixed Smith grid and traditional admittance reading as in the single-stub guide:', 'Usamos el mismo diagrama de Smith fijo y la lectura tradicional de admitancia de la guía de un stub:')}</p>
      <Formula display tex={String.raw`p(y)=\frac{y-1}{y+1}=-\Gamma,\qquad\operatorname{Re}y=1\;\Longleftrightarrow\;\left|p-\frac12\right|=\frac12`} />
      <p>{t('The circle has center ', 'El círculo tiene centro ')}<Formula tex="(1/2,0)" />{t(' and radius ', ' y radio ')}<Formula tex="1/2" />{t('. This is a locus of admissible input admittances.', '. Es un lugar geométrico de admitancias de entrada admisibles.')}</p>

      <h2>{t('Carry that circle to the right-hand stub', 'Trasladamos ese círculo al stub derecho')}</h2>
      <p>{t('Now work backward through the separation ', 'Ahora recorremos hacia atrás la separación ')}<Formula tex="d_2" />{t(', from stub 1 toward stub 2 and the load. Each point rotates counterclockwise around the Smith-chart origin through ', ', desde el stub 1 hacia el stub 2 y la carga. Cada punto gira en sentido antihorario alrededor del origen del diagrama un ángulo ')}<Formula tex="2\beta d_2" />{t('. Rotate the whole circle, including its center; do not translate it horizontally.', '. Debe girar el círculo completo, incluido su centro; no se trata de desplazarlo horizontalmente.')}</p>
      <Formula display tex={String.raw`p_2=p_1e^{\iu\,2\beta d_2},\qquad\left|p_2-\frac12e^{\iu\,2\beta d_2}\right|=\frac12`} />
      <p>{t('This rotated circle is the required geometric locus at stub 2. Any admittance on it becomes a unity-conductance admittance when propagated back to the left junction.', 'Este círculo girado es el lugar geométrico requerido en el stub 2. Cualquier admitancia sobre él se convierte en una admitancia de conductancia unitaria al propagarse de nuevo hacia la unión izquierda.')}</p>
      <p>{t('For ', 'Para ')}<Formula tex="d_2=\lambda/8" />{t(', the backward rotation is ', ', el giro hacia la carga es ')}<Formula tex="2\beta d_2=\pi/2" />{t(': the circle center moves from ', ': el centro pasa de ')}<Formula tex="(1/2,0)" />{t(' to ', ' a ')}<Formula tex="(0,1/2)" />.</p>

      <h2>{t('Construct the load-side admittance before intersecting', 'Construimos la admitancia del lado de la carga antes de cruzar')}</h2>
      <p>{t('Keep the transported locus visible. In a separate step, place the normalized load impedance ', 'Conservamos visible el lugar geométrico trasladado. En otro paso representamos la impedancia normalizada de la carga ')}<Formula tex="z_L" />{t(' on the standard grid and draw its SWR circle while the load point stays fixed:', ' sobre la cuadrícula estándar y dibujamos su círculo de ROE manteniendo fijo el punto de carga:')}</p>
      <Formula display tex={String.raw`z_L=Z_L/Z_0,\qquad p_z=\frac{z_L-1}{z_L+1}=\Gamma_L`} />
      <p>{t('Next reflect that point through the chart center to read the load admittance on the same grid. This changes the reading at the load plane; the circuit stays fixed.', 'Después reflejamos ese punto respecto del centro del diagrama para leer la admitancia de la carga sobre la misma cuadrícula. Cambia la lectura en el plano de carga; el circuito permanece fijo.')}</p>
      <Formula display tex={String.raw`y_L=1/z_L,\qquad p(y_L)=-p_z=-\Gamma_L`} />
      <p>{t('Once the reflection finishes, keep ', 'Una vez terminada la reflexión, conservamos ')}<Formula tex="y_L" />{t(' and remove the impedance marker and conversion segment. In the following step, follow the existing SWR circle clockwise toward the generator through ', ' y retiramos el marcador de impedancia y el segmento de conversión. En el paso siguiente recorremos el círculo de ROE ya dibujado en sentido horario hacia el generador una distancia ')}<Formula tex="d_1" />{t(' to the right-hand junction:', ' hasta la unión derecha:')}</p>
      <Formula display tex={String.raw`y_\ell(a)=\frac{y_L\cos(\beta a)+\iu\sin(\beta a)}{\cos(\beta a)+\iu y_L\sin(\beta a)}`} />
      <Formula display tex={String.raw`p\bigl(y_\ell(a)\bigr)=p(y_L)e^{-\iu\,2\beta a},\qquad 0\le a\le d_1`} />
      <Formula display tex={String.raw`y_R=y_\ell(d_1)=g+\iu b_R`} />
      <p>{t('The moving reading plane on the circuit follows the same distance. At the end we have obtained ', 'El plano de lectura del circuito acompaña esa misma distancia. Al terminar hemos obtenido ')}<Formula tex="y_R" />{t(' from the load and can draw its constant-conductance circle.', ' desde la carga y ya podemos dibujar su círculo de conductancia constante.')}</p>

      <h2>{t('Intersect the locus with the available conductance', 'Cruzamos el lugar geométrico con la conductancia disponible')}</h2>
      <p>{t('Write the admittance seen from the right junction as ', 'Escribimos la admitancia vista desde la unión derecha como ')}<Formula tex="y_R=g+\iu b_R" />{t('. Stub 2 changes only its susceptance, so all reachable values lie on the constant-conductance circle ', '. El stub 2 sólo cambia la susceptancia, de modo que todos los valores alcanzables están en el círculo de conductancia constante ')}<Formula tex="\operatorname{Re}y_2=g" />.</p>
      <Formula display tex={String.raw`y_2=g+\iu B,\qquad b_{s2}=B-b_R`} />
      <p>{t('Its intersections with the transported circle give every distinct matching branch for these positions. Each branch fixes the right-stub susceptance. Propagate that intersection toward the generator to recover ', 'Las intersecciones con el círculo trasladado proporcionan todas las ramas distintas de adaptación para estas posiciones. Cada rama fija la susceptancia del stub derecho. Propagamos esa intersección hacia el generador para recuperar ')}<Formula tex="y_1" />{t(', then cancel its imaginary part with stub 1:', ' y cancelamos su parte imaginaria con el stub 1:')}</p>
      <Formula display tex={String.raw`y_1=\frac{(g+\iu B)\cos(\beta d_2)+\iu\sin(\beta d_2)}{\cos(\beta d_2)+\iu(g+\iu B)\sin(\beta d_2)}`} />
      <Formula display tex={String.raw`b_{s1}=-\operatorname{Im}y_1,\qquad y_v=1`} />
      <p>{t('Use Next for each operation: construct the left-hand locus, carry it to stub 2, plot the load, reflect it to admittance, follow the line to the right-hand junction, and find the intersections. Then complete branch 1 before proceeding to branch 2. The relevant construction remains visible while either stub is built.', 'Usa Siguiente para cada operación: construir el lugar geométrico izquierdo, llevarlo al stub 2, representar la carga, reflejarla a admitancia, recorrer la línea hasta la unión derecha y hallar las intersecciones. Después completa la rama 1 antes de continuar con la rama 2. La construcción pertinente permanece visible mientras se obtiene cada stub.')}</p>
    </div>

    <div className="ss-guide__article ds-guide__terminations">
      {([1, 2] as const).map((number) => <fieldset key={number} className="ssl-termination"><legend>{number === 1 ? t('Stub 1 · generator side', 'Stub 1 · lado del generador') : t('Stub 2 · load side', 'Stub 2 · lado de la carga')}</legend>{(['short', 'open'] as const).map((end) => <label key={end}><input type="radio" name={'guide-double-stub-' + number} checked={(number === 1 ? termination1 : termination2) === end} onChange={() => (number === 1 ? setTermination1 : setTermination2)(end)} />{end === 'short' ? t('Short circuit', 'Cortocircuito') : t('Open circuit', 'Circuito abierto')}</label>)}</fieldset>)}
    </div>
    <DoubleStubConstruction input={DOUBLE_STUB_EXAMPLE} termination1={termination1} termination2={termination2} />

    <div className="ss-guide__article">
      <a className="guide-link guide-link--primary" href="#/labs/double-stub-matching">{t('Open the double-stub laboratory', 'Abrir el laboratorio de doble stub')} <span aria-hidden="true">→</span></a>
    </div>
  </div>;
}
