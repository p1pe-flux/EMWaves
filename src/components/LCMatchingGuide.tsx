import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import type { LumpedMatchingInput, LumpedMatchingTopology } from '../domain/lumpedMatching';
import { describeLumpedFeasibility } from '../domain/lumpedFeasibility';
import { Formula } from './Formula';
import { LCMatchingConstruction } from './LCMatchingConstruction';
import { LCMatchingDiagram } from './LCMatchingDiagram';
import { LCNetworkOptions } from './LCNetworkOptions';
import '../single-stub.css';

export const LC_MATCHING_EXAMPLE: LumpedMatchingInput = {
  z0: 50, frequencyHz: 1e9,
  load: { kind: 'impedance', resistance: 100, reactance: 50 },
  elements: [{ component: 'L', connection: 'series' }, { component: 'C', connection: 'parallel' }],
};

export function LCMatchingGuideContent() {
  const { t } = useI18n();
  const [topology, setTopology] = useState<LumpedMatchingTopology>({ elements: [{ component: 'L', connection: 'series' }, { component: 'C', connection: 'parallel' }] });
  const [example, setExample] = useState<'high' | 'low' | 'll' | 'cc'>('high');
  const input = useMemo<LumpedMatchingInput>(() => ({
    ...LC_MATCHING_EXAMPLE, ...topology,
    load: example === 'high' ? { kind: 'impedance', resistance: 100, reactance: 50 }
      : example === 'low' ? { kind: 'impedance', resistance: 25, reactance: 10 }
      : { kind: 'impedance', resistance: 25, reactance: example === 'll' ? -50 : 50 },
  }), [topology, example]);
  const feasibility = useMemo(() => describeLumpedFeasibility(input), [input]);
  return <div className="ss-guide lc-guide">
    <div className="ss-guide__article">
      <p>{t('Two reactive elements can transform the input resistance and cancel the remaining reactance. Choose an inductor or capacitor independently at each position, then choose each series or parallel connection. This allows L–C, C–L, L–L and C–C networks. The solver retains that circuit and finds its positive, finite realizations.', 'Dos elementos reactivos pueden transformar la resistencia de entrada y cancelar la reactancia restante. Elegimos un inductor o un capacitor por separado en cada posición y después su conexión en serie o en paralelo. Así se permiten redes L–C, C–L, L–L y C–C. El solver conserva ese circuito y obtiene sus realizaciones positivas y finitas.')}</p>
      <LCMatchingDiagram input={input} abstractLabels progress={[1, 1]} />
      <p>{t('The physical order is generator → element 1 → element 2 → load. The subscripts identify positions: two inductors are ', 'El orden físico es generador → elemento 1 → elemento 2 → carga. Los subíndices identifican las posiciones: dos inductores son ')}<Formula tex="L_1,L_2" />{t(' and two capacitors are ', ' y dos capacitores son ')}<Formula tex="C_1,C_2" />{t('. Calculate from the load toward the generator, adding element 2 first and element 1 second.', '. Calculamos desde la carga hacia el generador: primero añadimos el elemento 2 y después el elemento 1.')}</p>

      <h2>{t('Series adds impedance; parallel adds admittance', 'En serie sumamos impedancias; en paralelo, admitancias')}</h2>
      <Formula display tex={String.raw`z=\frac{Z}{Z_0},\qquad y=\frac{1}{z}=Z_0Y,\qquad\omega=2\pi f`} />
      <p>{t('A series reactive element preserves resistance and changes reactance. A parallel reactive element preserves conductance and changes susceptance:', 'Un elemento reactivo en serie conserva la resistencia y cambia la reactancia. Un elemento reactivo en paralelo conserva la conductancia y cambia la susceptancia:')}</p>
      <Formula display tex={String.raw`z_{\mathrm{after}}=z_{\mathrm{before}}+\iu x_s,\qquad y_{\mathrm{after}}=y_{\mathrm{before}}+\iu b_p`} />
      <p>{t('The target is the same in either reading:', 'El objetivo es el mismo con cualquiera de las lecturas:')}</p>
      <Formula display tex={String.raw`z_v=1\quad\Longleftrightarrow\quad y_v=1,\qquad Z_v=Z_0,\qquad\Gamma_v=0`} />
      <p>{t('The following signs distinguish an inductor from a capacitor. A negative calculated inductance or capacitance is not a realization of the selected component.', 'Los signos siguientes distinguen un inductor de un capacitor. Una inductancia o capacitancia calculada negativa no es una realización del componente elegido.')}</p>
      <div className="ss-guide__table-wrap"><table className="ss-guide__table">
        <thead><tr><th>{t('Element', 'Elemento')}</th><th>{t('Series reactance', 'Reactancia en serie')}</th><th>{t('Parallel susceptance', 'Susceptancia en paralelo')}</th></tr></thead>
        <tbody>
          <tr><th><Formula tex="L" /></th><td><Formula tex="x_L=\omega L/Z_0>0" /></td><td><Formula tex="b_L=-Z_0/(\omega L)<0" /></td></tr>
          <tr><th><Formula tex="C" /></th><td><Formula tex="x_C=-1/(\omega C Z_0)<0" /></td><td><Formula tex="b_C=\omega C Z_0>0" /></td></tr>
        </tbody>
      </table></div>

      <h2>{t('Begin with the element next to the load', 'Comenzar con el elemento junto a la carga')}</h2>
      <p>{t('The last element added toward the generator must cancel the imaginary part at a point whose real part is one. This determines the geometric locus that the load-side element has to reach. There is no transmission-line rotation: these movements follow constant-resistance or constant-conductance circles.', 'El último elemento añadido hacia el generador debe cancelar la parte imaginaria en un punto cuya parte real sea uno. Esto determina el lugar geométrico al que debe llegar el elemento junto a la carga. No hay un giro por una línea de transmisión: estos movimientos siguen círculos de resistencia o conductancia constante.')}</p>
      <p>{t('Plot ', 'Representamos ')}<Formula tex="z_L" />{t(' on the combined diagram. The coral impedance grid and the blue admittance grid are visible together: the same physical point gives both readings. Use resistance and reactance for a series element, or conductance and susceptance for a parallel element. Changing the reading shifts the emphasis between grids while the point and circuit stay fixed.', ' en el diagrama combinado. La cuadrícula coral de impedancia y la azul de admitancia se ven a la vez: el mismo punto físico permite ambas lecturas. Usamos resistencia y reactancia para un elemento en serie, o conductancia y susceptancia para uno en paralelo. Al cambiar la lectura, el énfasis pasa de una cuadrícula a la otra mientras el punto y el circuito permanecen fijos.')}</p>
      <Formula display tex={String.raw`\Gamma=\frac{z-1}{z+1}=\frac{1-y}{1+y},\qquad y=\frac{1}{z}`} />
      <p>{t('Draw the loci before moving a component. The normalized impedance circle ', 'Dibujamos los lugares geométricos antes de recorrer el camino de un componente. El círculo de impedancia normalizada ')}<Formula tex="\operatorname{Re}z=1" />{t(' has center ', ' tiene centro ')}<Formula tex="(+1/2,0)" />{t(' and the admittance circle ', ' y el círculo de admitancia ')}<Formula tex="\operatorname{Re}y=1" />{t(' has center ', ' tiene centro ')}<Formula tex="(-1/2,0)" />{t('; both have radius 1/2. These positions stay fixed throughout the combined reading, as in ', '; ambos tienen radio 1/2. Estas posiciones se mantienen durante toda la lectura combinada, como en ')}<a href="https://www.mathworks.com/help/rf/ug/designing-matching-networks-part-2-single-stub-transmission-lines.html" target="_blank" rel="noreferrer">{t('the YZ-chart construction', 'la construcción con diagrama YZ')}</a>.</p>

      <h2>{t('Parallel next to the load, series next to the generator', 'Paralelo junto a la carga, serie junto al generador')}</h2>
      <p>{t('Write ', 'Escribimos ')}<Formula tex="y_L=g+\iu b" />{t('. Add the load-side susceptance so that ', '. Añadimos la susceptancia del lado de la carga de modo que ')}<Formula tex="y_1=g+\iu B" />{t('. The source-side series element then requires ', '. El elemento en serie del lado del generador requiere después ')}<Formula tex="\operatorname{Re}(1/y_1)=1" />:</p>
      <Formula display tex={String.raw`\frac{g}{g^2+B^2}=1\quad\Longrightarrow\quad B_\pm=\pm\sqrt{g-g^2}`} />
      <Formula display tex={String.raw`b_p=B_\pm-b,\qquad z_1=1-\iu\frac{B_\pm}{g},\qquad x_s=\frac{B_\pm}{g}`} />
      <p>{t('Real intersections require ', 'Para tener intersecciones reales hace falta ')}<Formula tex="0<g\le1" />{t('. Evaluate both signs, then retain only the component types and positive finite values allowed by the chosen topology.', '. Evaluamos ambos signos y conservamos sólo los tipos de componentes y los valores positivos y finitos permitidos por la topología elegida.')}</p>

      <h2>{t('Series next to the load, parallel next to the generator', 'Serie junto a la carga, paralelo junto al generador')}</h2>
      <p>{t('Now write ', 'Ahora escribimos ')}<Formula tex="z_L=r+\iu x" />{t('. The first element produces ', '. El primer elemento produce ')}<Formula tex="z_1=r+\iu T" />{t('. The final parallel element needs ', '. El último elemento en paralelo necesita ')}<Formula tex="\operatorname{Re}(1/z_1)=1" />:</p>
      <Formula display tex={String.raw`\frac{r}{r^2+T^2}=1\quad\Longrightarrow\quad T_\pm=\pm\sqrt{r-r^2}`} />
      <Formula display tex={String.raw`x_s=T_\pm-x,\qquad y_1=1-\iu\frac{T_\pm}{r},\qquad b_p=\frac{T_\pm}{r}`} />
      <p>{t('Here the real-intersection condition is ', 'Aquí la condición de intersección real es ')}<Formula tex="0<r\le1" />{t('. Selecting L and C fixes the permitted reactance and susceptance signs, so not every algebraic root is physically realizable with that selection.', '. La elección de L y C fija los signos permitidos de reactancia y susceptancia; por eso no todas las raíces algebraicas se pueden realizar con esa selección.')}</p>
      <p>{t('The standard two-element L-network construction is described in ', 'La construcción habitual de redes de adaptación en L con dos elementos se describe en ')}<a href="https://web.ece.ucsb.edu/~long/ece145a/Notes5_Matching_networks.pdf" target="_blank" rel="noreferrer">{t('UCSB’s impedance-matching notes', 'los apuntes de adaptación de impedancias de UCSB')}</a>{t('. The equations above also retain the imaginary part of a complex load.', '. Las ecuaciones anteriores conservan también la parte imaginaria de una carga compleja.')}</p>

      <h2>{t('Choose the two elements', 'Elegir los dos elementos')}</h2>
      <p>{t('Use ', 'Usamos ')}<Formula tex="Z_0=50\;\Omega,\quad f=1\;\mathrm{GHz}" />{t('. Choose each element independently. The capacitive load below admits L–L mixed connections; its inductive conjugate admits C–C. The two other loads illustrate L–C and C–L configurations.', '. Elegimos cada elemento por separado. La carga capacitiva siguiente admite conexiones mixtas L–L; su conjugada inductiva admite C–C. Las otras dos cargas ilustran configuraciones L–C y C–L.')}</p>
      <div className="ss-construction__selectors" role="group" aria-label={t('Example load', 'Carga del ejemplo')}>
        <button type="button" aria-pressed={example === 'high'} onClick={() => setExample('high')}><Formula tex="Z_L=100+\iu50\;\Omega" /></button>
        <button type="button" aria-pressed={example === 'low'} onClick={() => setExample('low')}><Formula tex="Z_L=25+\iu10\;\Omega" /></button>
        <button type="button" aria-pressed={example === 'll'} onClick={() => setExample('ll')}><Formula tex="Z_L=25-\iu50\;\Omega" /></button>
        <button type="button" aria-pressed={example === 'cc'} onClick={() => setExample('cc')}><Formula tex="Z_L=25+\iu50\;\Omega" /></button>
      </div>
      <LCNetworkOptions value={topology} onChange={setTopology} />
      <p>{t('The green region shows where the original load must lie for this topology to admit two positive, finite components. It appears as soon as you choose the connections and order. Dashed boundaries are excluded: they require a zero or infinite component. With both connections the same, only a matching curve is highlighted. For the selected topology:', 'La zona verde muestra dónde debe estar la carga original para que esta topología admita dos componentes positivos y finitos. Aparece al elegir las conexiones y el orden. Las fronteras discontinuas están excluidas: exigen un componente nulo o infinito. Con ambas conexiones iguales, se resalta sólo la curva admisible. Para la topología elegida:')}</p>
      <Formula display tex="z_L=r+\iu x" />
      <Formula display tex={feasibility.formula} />
      <p>{t('The region and the original load remain at the same physical positions when changing between impedance and admittance readings. The region describes the possible starting loads, even while the intermediate input moves through the construction. Frequency changes the component values, but not this normalized load region.', 'La zona y la carga original conservan sus posiciones físicas al cambiar entre las lecturas de impedancia y admitancia. La zona describe las cargas de partida posibles, incluso cuando la entrada intermedia se mueve durante la construcción. La frecuencia cambia los valores de los componentes, pero no esta zona de cargas normalizadas.')}</p>
      <p>{t('Use Next to obtain the load-side component first and the source-side component second. Each L or C result appears after its corresponding operation finishes. Previous reverses that construction and hides results from later steps.', 'Usa Siguiente para obtener primero el componente del lado de la carga y después el del lado del generador. Cada resultado de L o C aparece al terminar su operación. Anterior invierte esa construcción y oculta los resultados de pasos posteriores.')}</p>
    </div>
    <LCMatchingConstruction input={input} />
    <div className="ss-guide__article">
      <h2>{t('Both elements in series or both in parallel', 'Ambos elementos en serie o ambos en paralelo')}</h2>
      <p>{t('Two series elements preserve resistance, so the load must satisfy ', 'Dos elementos en serie conservan la resistencia, por eso la carga debe satisfacer ')}<Formula tex="r=1" />{t('. Two parallel elements preserve conductance and require ', '. Dos elementos en paralelo conservan la conductancia y necesitan ')}<Formula tex="g=1" />{t('. Their signed normalized contributions must add to the opposite imaginary part:', '. Sus contribuciones normalizadas con signo deben sumar la parte imaginaria opuesta:')}</p>
      <Formula display tex={t(String.raw`x_1+x_2=-\operatorname{Im}z_L\quad(\text{series}),\qquad b_1+b_2=-\operatorname{Im}y_L\quad(\text{parallel})`, String.raw`x_1+x_2=-\operatorname{Im}z_L\quad(\text{serie}),\qquad b_1+b_2=-\operatorname{Im}y_L\quad(\text{paralelo})`)} />
      <p>{t('Write the imaginary part of the load as ', 'Escribimos la parte imaginaria de la carga como ')}<Formula tex="h" />{t(' and let ', ' y usamos ')}<Formula tex="\sigma_k\in\{-1,+1\}" />{t(' be the contribution sign dictated by each selected type and connection. Use a positive magnitude ', ' para el signo que exige el tipo y la conexión de cada elemento. Con una magnitud positiva ')}<Formula tex="q" />{t(' for element 1:', ' para el elemento 1:')}</p>
      <Formula display tex={String.raw`u_1=\sigma_1q,\qquad u_2=-h-\sigma_1q,\qquad q>0,\quad\sigma_2u_2>0`} />
      <p>{t('Here u is x for series elements and b for parallel elements. For two components of the same type, the load must have the opposite imaginary sign and the split is bounded:', 'Aquí u es x para elementos en serie y b para elementos en paralelo. Con dos componentes del mismo tipo, la carga debe tener el signo imaginario opuesto y el reparto está acotado:')}</p>
      <Formula display tex={String.raw`0<q<-\sigma_1h,\qquad-\sigma_1h>0`} />
      <p>{t('For opposite component types, the family is unbounded above:', 'Con tipos opuestos de componentes, la familia no tiene cota superior:')}</p>
      <Formula display tex={String.raw`q>\max(0,-\sigma_1h)`} />
      <p>{t('The strict limits keep both values positive and finite. For example, two series inductors can cancel a capacitive load with r=1 by sharing the required positive reactance. The laboratory explains these continuous families without selecting an arbitrary pair. With one series and one parallel element, a fixed choice of both types and positions has at most one discrete solution, labeled simply “Solution”.', 'Los límites estrictos mantienen ambos valores positivos y finitos. Por ejemplo, dos inductores en serie pueden cancelar una carga capacitiva con r=1 repartiendo la reactancia positiva necesaria. El laboratorio explica estas familias continuas sin elegir un par arbitrario. Con un elemento en serie y otro en paralelo, una elección fija de ambos tipos y posiciones tiene como máximo una solución discreta, rotulada simplemente «Solución».')}</p>
      <p>{t('Ideal open, short, and purely reactive loads absorb no real power and cannot be matched to a positive resistance by this lossless LC network. A matched load needs no extra network. This model describes one design frequency, without component losses or parasitic elements.', 'Las cargas ideales abiertas, en corto o puramente reactivas no absorben potencia real y no se pueden adaptar a una resistencia positiva con esta red LC sin pérdidas. Una carga ya adaptada no necesita una red adicional. El modelo describe una frecuencia de diseño, sin pérdidas ni elementos parásitos de los componentes.')}</p>
      <a className="guide-link guide-link--primary" href="#/labs/lc-matching">{t('Open the LC matching laboratory', 'Abrir el laboratorio de adaptación con L y C')} <span aria-hidden="true">→</span></a>
    </div>
  </div>;
}
