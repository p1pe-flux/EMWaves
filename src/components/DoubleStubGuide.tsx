import { useI18n } from '../i18n';
import { useState } from 'react';
import type { DoubleStubInput } from '../domain/doubleStub';
import type { StubTermination } from '../domain/singleStub';
import { Formula } from './Formula';
import { DoubleStubConstruction } from './DoubleStubConstruction';
import { DoubleStubDiagram } from './DoubleStubDiagram';
import '../single-stub.css';
import '../double-stub.css';

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
      <Formula display tex={String.raw`y_L=Z_0/Z_L,\qquad y_R=T_{d_1}(y_L)`} />
      <Formula display tex={String.raw`T_a(y)=\frac{y\cos(\beta a)+\iu\sin(\beta a)}{\cos(\beta a)+\iu y\sin(\beta a)}`} />
      <p>{t('Adding the right stub, moving to the left junction and adding the left stub gives', 'Al añadir el stub derecho, avanzar hasta la unión izquierda y añadir el stub izquierdo obtenemos')}</p>
      <Formula display tex={String.raw`y_2=y_R+\iu b_{s2},\qquad y_1=T_{d_2}(y_2),\qquad y_v=y_1+\iu b_{s1}`} />
      <p>{t('The target is ', 'El objetivo es ')}<Formula tex="y_v=1" />{t('. Open and short stubs have the same matching deduction because each contributes only an imaginary admittance. Their length formulas differ.', '. La deducción de adaptación es la misma para stubs abiertos y cortocircuitados porque ambos aportan únicamente admitancia imaginaria. Lo que cambia es su fórmula de longitud.')}</p>

      <h2>{t('Start at the left: undo the first stub', 'Comenzamos por la izquierda: deshacemos el primer stub')}</h2>
      <Formula display tex={String.raw`y_1=1-\iu b_{s1}\quad\Longrightarrow\quad\operatorname{Re}y_1=1`} />
      <p>{t('Before the left stub is added, the line admittance must lie somewhere on the unity-conductance circle. We do not yet know its imaginary part; draw the complete circle of possibilities.', 'Antes de conectar el stub izquierdo, la admitancia de la línea debe estar en el círculo de conductancia unitaria. Todavía no conocemos su parte imaginaria: dibujamos el círculo completo de posibilidades.')}</p>
      <p>{t('Use the same fixed Smith grid and traditional admittance reading as in the single-stub guide:', 'Usamos el mismo diagrama de Smith fijo y la lectura tradicional de admitancia de la guía de un stub:')}</p>
      <Formula display tex={String.raw`p(y)=\frac{y-1}{y+1}=-\Gamma,\qquad\operatorname{Re}y=1\;\Longleftrightarrow\;\left|p-\frac12\right|=\frac12`} />
      <p>{t('The circle has center ', 'El círculo tiene centro ')}<Formula tex="(1/2,0)" />{t(' and radius ', ' y radio ')}<Formula tex="1/2" />{t('. This is a locus of admissible input admittances, not a constant-SWR circle centered at the origin.', '. Es un lugar geométrico de admitancias de entrada admisibles; no es un círculo de ROE centrado en el origen.')}</p>

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
      <Formula display tex={String.raw`y_\ell(a)=T_a(y_L),\qquad p\bigl(y_\ell(a)\bigr)=p(y_L)e^{-\iu\,2\beta a},\qquad 0\le a\le d_1`} />
      <Formula display tex={String.raw`y_R=y_\ell(d_1)=T_{d_1}(y_L)=g+\iu b_R`} />
      <p>{t('The moving reading plane on the circuit follows the same distance. At the end we have obtained ', 'El plano de lectura del circuito acompaña esa misma distancia. Al terminar hemos obtenido ')}<Formula tex="y_R" />{t(' from the load and can draw its constant-conductance circle.', ' desde la carga y ya podemos dibujar su círculo de conductancia constante.')}</p>

      <h2>{t('Intersect the locus with the available conductance', 'Cruzamos el lugar geométrico con la conductancia disponible')}</h2>
      <p>{t('Write the admittance seen from the right junction as ', 'Escribimos la admitancia vista desde la unión derecha como ')}<Formula tex="y_R=g+\iu b_R" />{t('. Stub 2 changes only its susceptance, so all reachable values lie on the constant-conductance circle ', '. El stub 2 sólo cambia la susceptancia, de modo que todos los valores alcanzables están en el círculo de conductancia constante ')}<Formula tex="\operatorname{Re}y_2=g" />.</p>
      <Formula display tex={String.raw`y_2=g+\iu B,\qquad b_{s2}=B-b_R`} />
      <p>{t('Its intersections with the transported circle give every distinct matching branch for these positions. Each branch fixes the right-stub susceptance. Propagate that intersection toward the generator to recover ', 'Las intersecciones con el círculo trasladado proporcionan todas las ramas distintas de adaptación para estas posiciones. Cada rama fija la susceptancia del stub derecho. Propagamos esa intersección hacia el generador para recuperar ')}<Formula tex="y_1" />{t(', then cancel its imaginary part with stub 1:', ' y cancelamos su parte imaginaria con el stub 1:')}</p>
      <Formula display tex={String.raw`b_{s1}=-\operatorname{Im}T_{d_2}(g+\iu B),\qquad y_v=1`} />
      <p>{t('Use Next for each operation: construct the left-hand locus, carry it to stub 2, plot the load, reflect it to admittance, follow the line to the right-hand junction, and find the intersections. Then complete branch 1 before proceeding to branch 2. The relevant construction remains visible while either stub is built.', 'Usa Siguiente para cada operación: construir el lugar geométrico izquierdo, llevarlo al stub 2, representar la carga, reflejarla a admitancia, recorrer la línea hasta la unión derecha y hallar las intersecciones. Después completa la rama 1 antes de continuar con la rama 2. La construcción pertinente permanece visible mientras se obtiene cada stub.')}</p>
    </div>

    <div className="ss-guide__article ds-guide__terminations">
      {([1, 2] as const).map((number) => <fieldset key={number} className="ssl-termination"><legend>{number === 1 ? t('Stub 1 · generator side', 'Stub 1 · lado del generador') : t('Stub 2 · load side', 'Stub 2 · lado de la carga')}</legend>{(['short', 'open'] as const).map((end) => <label key={end}><input type="radio" name={'guide-double-stub-' + number} checked={(number === 1 ? termination1 : termination2) === end} onChange={() => (number === 1 ? setTermination1 : setTermination2)(end)} />{end === 'short' ? t('Short circuit', 'Cortocircuito') : t('Open circuit', 'Circuito abierto')}</label>)}</fieldset>)}
    </div>
    <DoubleStubConstruction input={DOUBLE_STUB_EXAMPLE} termination1={termination1} termination2={termination2} />

    <div className="ss-guide__article">
      <h2>{t('Derive all intersections without a tangent pole', 'Deducimos todas las intersecciones sin un polo de tangente')}</h2>
      <p>{t('Set ', 'Definimos ')}<Formula tex="\theta=\beta\,d_2,\ C=\cos\theta,\ S=\sin\theta" />{t('. Propagating ', '. Al propagar ')}<Formula tex="y_2=g+\iu B" />{t(' gives', ' obtenemos')}</p>
      <Formula display tex={String.raw`\operatorname{Re}y_1=\frac{g}{(C-BS)^2+g^2S^2}`} />
      <p>{t('Require this real part to equal one:', 'Exigimos que esta parte real sea uno:')}</p>
      <Formula display tex={String.raw`(C-BS)^2=g-g^2S^2`} />
      <Formula display tex={String.raw`B_\pm=\frac{C\pm\sqrt{g-g^2S^2}}{S},\qquad S\ne0`} />
      <p>{t('Compute both roots, remove a duplicated root at tangency, and verify each resulting network with the sine–cosine transmission-line model. This retains valid quarter-wave separations without dividing by a tangent that may be infinite.', 'Calculamos las dos raíces, eliminamos la raíz duplicada en la tangencia y verificamos cada red con el modelo de línea seno–coseno. Así se conservan las separaciones válidas de cuarto de onda sin dividir por una tangente que pueda ser infinita.')}</p>

      <h2>{t('The forbidden region and degenerate spacing', 'La región prohibida y las separaciones degeneradas')}</h2>
      <p>{t('For positive conductance and ', 'Para conductancia positiva y ')}<Formula tex="S\ne0" />{t(', a real intersection requires', ', una intersección real requiere')}</p>
      <Formula display tex={String.raw`0<g\le g_{\max}=\frac{1}{\sin^2(\beta d_2)}`} />
      <p>{t('Below the limit there are two intersections. At the limit there is one tangent solution. Above it, the chosen positions cannot match the load: the two circles do not meet. Changing either the separation or the load-to-right-stub distance can move the design out of that forbidden region.', 'Por debajo del límite hay dos intersecciones. En el límite hay una solución tangente. Por encima, las posiciones elegidas no permiten adaptar la carga: los círculos no se cruzan. Cambiar la separación o la distancia entre la carga y el stub derecho puede sacar al diseño de esa región prohibida.')}</p>
      <p>{t('For a zero or half-wavelength separation, ', 'Si la separación es cero o un múltiplo de media longitud de onda, ')}<Formula tex="S=0" />{t('. Both stubs are electrically at the same plane. If ', '. Ambos stubs están eléctricamente en el mismo plano. Si ')}<Formula tex="g\ne1" />{t(', no solution exists. If ', ', no hay solución. Si ')}<Formula tex="g=1" />{t(', there is a continuous family rather than two isolated solutions:', ', existe una familia continua en lugar de dos soluciones aisladas:')}</p>
      <Formula display tex={String.raw`b_{s2}=t,\qquad b_{s1}=-b_R-t,\qquad t\in\mathbb{R}`} />
      <p>{t('An ideal open, short, or purely reactive load absorbs no real power, so these lossless reactive networks cannot match it to a positive real reference impedance.', 'Una carga ideal abierta, en cortocircuito o puramente reactiva no absorbe potencia real, por lo que estas redes reactivas sin pérdidas no pueden adaptarla a una impedancia real positiva.')}</p>

      <h2>{t('Choose the termination of each stub independently', 'Elegimos por separado la terminación de cada stub')}</h2>
      <p>{t('For stub ', 'Para el stub ')}<Formula tex="k\in\{1,2\}" />{t(', normalize its susceptance to the main line, including its own characteristic impedance:', ', normalizamos su susceptancia a la línea principal, incluyendo su propia impedancia característica:')}</p>
      <Formula display tex={String.raw`b_{sk,\mathrm{open}}=\frac{Z_0}{Z_{0sk}}\tan(\beta_{sk}\ell_k),\qquad b_{sk,\mathrm{short}}=-\frac{Z_0}{Z_{0sk}}\cot(\beta_{sk}\ell_k)`} />
      <Formula display tex={String.raw`q_k=b_{sk}\frac{Z_{0sk}}{Z_0},\qquad\beta_{sk}\ell_{k,\mathrm{open}}=\operatorname{atan2}(q_k,1)\bmod\pi`} />
      <Formula display tex={String.raw`\beta_{sk}\ell_{k,\mathrm{short}}=\operatorname{atan2}(1,-q_k)`} />
      <p>{t('Each geometric branch therefore has an open or short realization for each stub: four termination combinations per branch. Choosing the terminations selects the corresponding pair of lengths, without changing the locus or removing a geometric solution.', 'Cada rama geométrica admite una realización abierta o cortocircuitada para cada stub: cuatro combinaciones de terminaciones por rama. La elección de terminaciones selecciona el par de longitudes correspondiente, sin cambiar el lugar geométrico ni eliminar una solución geométrica.')}</p>
      <Formula display tex={String.raw`\ell_k=\ell_{k,i}+m_k\lambda_{sk}/2,\qquad m_1,m_2\in\{0,1,2,\ldots\}`} />
      <p>{t('The two integers are independent. Main-line distances can also include independent half-wavelength repetitions. All displayed electrical results remain unchanged under those periodic equivalents.', 'Los dos enteros son independientes. Las distancias sobre la línea principal también pueden incluir repeticiones independientes de media longitud de onda. Esos equivalentes periódicos conservan todos los resultados eléctricos.')}</p>

      <h2>{t('Worked example: two branches for the same positions', 'Ejemplo: dos ramas para las mismas posiciones')}</h2>
      <Formula display tex={String.raw`Z_0=Z_{0s1}=Z_{0s2}=50\;\Omega,\quad Z_L=100+\iu50\;\Omega,\quad d_1=d_2=\lambda/8`} />
      <Formula display tex={String.raw`y_R=\frac12+\iu\frac12,\qquad B_\pm=1\pm\frac{\sqrt3}{2}`} />
      <Formula display tex={String.raw`b_{s2}=\frac{1\pm\sqrt3}{2},\qquad b_{s1}=1\pm\sqrt3`} />
      <div className="ss-guide__table-wrap"><table className="ss-guide__table">
        <caption>{t('Stub 1 is on the left; stub 2 is on the right. Lengths use each stub’s own wavelength.', 'El stub 1 está a la izquierda y el stub 2 a la derecha. Cada longitud utiliza la longitud de onda de su stub.')}</caption>
        <thead><tr><th>{t('Branch', 'Rama')}</th><th><Formula tex="\ell_{1,\mathrm{short}}/\lambda_{s1}" /></th><th><Formula tex="\ell_{2,\mathrm{short}}/\lambda_{s2}" /></th><th><Formula tex="\ell_{1,\mathrm{open}}/\lambda_{s1}" /></th><th><Formula tex="\ell_{2,\mathrm{open}}/\lambda_{s2}" /></th></tr></thead>
        <tbody><tr><th>1</th><td>0.149427714</td><td>0.194155807</td><td>0.399427714</td><td>0.444155807</td></tr><tr><th>2</th><td>0.444155807</td><td>0.399427714</td><td>0.194155807</td><td>0.149427714</td></tr></tbody>
      </table></div>
      <Formula display tex={String.raw`y_v=1,\qquad Z_v=50\;\Omega,\qquad |\Gamma_v|\approx0,\qquad\mathrm{VSWR}=1`} />
      <p>{t('The backward construction of the rotated conductance locus is also described in the ', 'La construcción hacia atrás del lugar geométrico de conductancia girado también se describe en la ')}<a href="https://www.waves.utoronto.ca/prof/mojahedi/ECE320/Lab%202%20Description%20and%20Procedure.pdf" target="_blank" rel="noreferrer">{t('University of Toronto transmission-line laboratory', 'práctica de líneas de transmisión de la Universidad de Toronto')}</a>{t('. Its stub numbering starts at the load; this guide explicitly numbers from the generator.', '. Allí los stubs se numeran desde la carga; esta guía los numera explícitamente desde el generador.')}</p>
      <a className="guide-link guide-link--primary" href="#/labs/double-stub-matching">{t('Open the double-stub laboratory', 'Abrir el laboratorio de doble stub')} <span aria-hidden="true">→</span></a>
    </div>
  </div>;
}
