import { useI18n } from '../i18n';
import type { SingleStubInput } from '../domain/singleStub';
import { Formula } from './Formula';
import { SingleStubConstruction } from './SingleStubConstruction';
import { SingleStubDeduction } from './SingleStubDeduction';
import '../single-stub.css';

export const SINGLE_STUB_EXAMPLE: SingleStubInput = {
  z0: 50,
  stubZ0: 50,
  load: { kind: 'impedance', resistance: 100, reactance: 50 },
};

export function SingleStubGuideContent() {
  const { t } = useI18n();
  return (
    <div className="ss-guide">
      <div className="ss-guide__article">
        <p className="ss-guide__lead">{t("A single shunt stub can match a complex load using two lengths: the distance from the load to the junction, and the length of an open or short branch connected there.", "Un único stub en paralelo permite adaptar una carga compleja mediante dos longitudes: la distancia entre la carga y la unión, y la longitud del ramal abierto o en cortocircuito conectado allí.")}</p>
        <p>{t("Work at one design frequency with ideal lossless lines. The main line has characteristic impedance ", "Trabajamos a una frecuencia de diseño con líneas ideales sin pérdidas. La línea principal tiene impedancia característica ")}<Formula tex={'Z_0'} />{t(", phase constant ", ", constante de fase ")}<Formula tex={'\\beta'} />{t(", and wavelength ", " y longitud de onda ")}<Formula tex={'\\lambda'} />{t("; the stub has ", "; el stub tiene ")}<Formula tex={'Z_{0s}'} />{t(", phase constant ", ", constante de fase ")}<Formula tex={'\\beta_s'} />{t(", and wavelength ", " y longitud de onda ")}<Formula tex={'\\lambda_s'} />{t(". Each phase constant measures phase change in radians per unit length. A matched junction sends no reflected wave back toward the generator.", ". Cada constante de fase mide el cambio de fase en radianes por unidad de longitud. Una unión adaptada no devuelve ninguna onda reflejada hacia el generador.")}</p>
      </div>
      <SingleStubDeduction />
      <div className="ss-guide__article">
        <h2>{t("Start with a concrete load", "Comenzamos con una carga concreta")}</h2>
        <p>{t("Use ", "Usamos ")}<Formula tex={'y_L'} />{t(" for the load admittance, ", " para la admitancia de la carga, ")}<Formula tex={'y_\\ell(d)'} />{t(" for the line and load seen at distance ", " para la línea y la carga vistas a una distancia ")}<Formula tex={'d'} />, <Formula tex={'y_{\\mathrm{stub}}'} />{t(" for the stub, and ", " para el stub, y ")}<Formula tex={'y_v'} />{t(" for their combined input at the junction. At the load, ", " para su entrada combinada en la unión. En la carga, ")}<Formula tex={'y_\\ell(0)=y_L'} />.</p>
        <Formula display tex={'Z_0=Z_{0s}=50\\;\\Omega,\\qquad Z_L=(100+\\iu\\,50)\\;\\Omega'} />
        <Formula display tex={'z_L=\\frac{Z_L}{Z_0}=2+\\iu,\\qquad y_L=\\frac{1}{z_L}=0.4-\\iu\\,0.2'} />
        <Formula display tex={'\\Gamma_L=\\frac{z_L-1}{z_L+1}=0.4+\\iu\\,0.2'} />
        <p>{t("The load absorbs some power, but its normalized admittance is not 1. A purely reactive shunt element can change the imaginary part of admittance. We must first use a length of transmission line to make the real part exactly 1.", "La carga absorbe potencia, pero su admitancia normalizada no es 1. Un elemento puramente reactivo en paralelo puede modificar la parte imaginaria de la admitancia. Primero debemos usar un tramo de línea para que la parte real sea exactamente 1.")}</p>
        <p>{t("Start with ", "Comenzamos con ")}<Formula tex={'z_L=Z_L/Z_0'} />{t(" on the standard Smith grid. Reflect that point through the center to obtain the admittance reading ", " en la cuadrícula de Smith habitual. Reflejamos ese punto respecto del centro para obtener la lectura de admitancia ")}<Formula tex={'y_L=1/z_L'} />.</p>
        <p>{t("Next first draws the SWR circle and the ", "Siguiente dibuja primero el círculo de ROE y el círculo ")}<Formula tex={'\\operatorname{Re}y=1'} />{t(" circle while the load point stays fixed. The following Next moves the point clockwise to their first intersection. Choose an open or short stub; each click completes one step and stops. Finish branch 1 before continuing to branch 2. Adjust Movement speed to slow down or accelerate the motion.", " mientras el punto de carga permanece fijo. La siguiente pulsación desplaza el punto en sentido horario hasta la primera intersección. Elige un stub abierto o en cortocircuito; cada pulsación completa un paso y se detiene. Completa la rama 1 antes de continuar con la rama 2. Ajusta Velocidad para ralentizar o acelerar el movimiento.")}</p>
      </div>
      <SingleStubConstruction input={SINGLE_STUB_EXAMPLE} />
      <div className="ss-guide__article">
        <h2>{t("Why the two circles find the answer", "Por qué los dos círculos permiten encontrar la solución")}</h2>
        <p>{t("Propagation on a lossless line preserves ", "La propagación en una línea sin pérdidas conserva ")}<Formula tex={'|\\Gamma|'} />{t(" and rotates its phase clockwise toward the generator. Every possible placement lies on the complete SWR circle centered at the chart origin.", " y gira su fase en sentido horario hacia el generador. Todas las posiciones posibles están sobre el círculo completo de ROE, centrado en el origen del diagrama.")}</p>
        <Formula display tex={'\\Gamma(d)=\\Gamma_L e^{-\\iu\\,2\\beta d}'} />
        <p>{t("A reactive stub adds no conductance, so the junction must lie on ", "Un stub reactivo no añade conductancia; por eso, antes de conectarlo, la unión debe estar sobre ")}<Formula tex={'g=1'} />{t(" before the stub is attached. After reflecting the admittance reading onto the unchanged grid, the unity-conductance circle has center ", ". Tras reflejar la lectura de admitancia en la misma cuadrícula, el círculo de conductancia unitaria tiene centro ")}<Formula tex={'(1/2,0)'} />{t(" and radius ", " y radio ")}<Formula tex={'1/2'} />{t(". Its two intersections with the SWR circle give the two distinct placement branches.", ". Sus dos intersecciones con el círculo de ROE proporcionan las dos ramas de ubicación distintas.")}</p>
        <Formula display tex={'\\Gamma=\\frac{1-y}{1+y},\\qquad y=\\frac{1-\\Gamma}{1+\\Gamma}'} />
        <p>{t("The plotted admittance reading is opposite the impedance reading:", "La lectura de admitancia se encuentra en el punto opuesto a la lectura de impedancia:")}</p>
        <Formula display tex={'p_y=\\frac{y-1}{y+1}=-\\Gamma,\\qquad y=\\frac{1+p_y}{1-p_y}'} />
        <p>{t("Reflecting through the center changes the chart reading while the line distance stays zero. Once the conversion is complete, moving toward the generator rotates this reflected point clockwise on the SWR circle.", "La reflexión respecto del centro cambia la lectura del diagrama, mientras la distancia sobre la línea sigue siendo cero. Completada la conversión, avanzar hacia el generador hace girar este punto reflejado en sentido horario sobre el círculo de ROE.")}</p>

        <h2>{t("Derive the placement equation", "Deducimos la ecuación de ubicación")}</h2>
        <p>{t("Write ", "Escribimos ")}<Formula tex={'y_L=g+\\iu b'} />{t(". A line section of length ", ". Un tramo de línea de longitud ")}<Formula tex={'d'} />{t(" has electrical length ", " tiene longitud eléctrica ")}<Formula tex={'\\beta d'} />{t(", so its transformed admittance is", ", por lo que su admitancia transformada es")}</p>
        <Formula display tex={'y_\\ell(d)=\\frac{y_L\\cos(\\beta d)+\\iu\\sin(\\beta d)}{\\cos(\\beta d)+\\iu y_L\\sin(\\beta d)}'} />
        <p>{t("For ", "Para ")}<Formula tex={'\\cos(\\beta d)\\ne0'} />{t(", divide by the cosine and set ", ", dividimos por el coseno y definimos ")}<Formula tex={'t=\\tan(\\beta d)'} />{t(". Expanding the real part gives", ". Al desarrollar la parte real obtenemos")}</p>
        <Formula display tex={'y_\\ell(d)=\\frac{g+\\iu(b+t)}{1-bt+\\iu gt},\\qquad\\operatorname{Re}y_\\ell(d)=\\frac{g(1+t^2)}{(1-bt)^2+g^2t^2}'} />
        <p>{t("Set this conductance equal to 1 and gather the powers of ", "Igualamos esta conductancia a 1 y agrupamos las potencias de ")}<Formula tex={'t'} />:</p>
        <Formula display tex={'g(1+t^2)=1-2bt+(g^2+b^2)t^2'} />
        <Formula display tex={'(g^2+b^2-g)t^2-2bt+(1-g)=0'} />
        <p>{t("For this example, ", "En este ejemplo, ")}<Formula tex={'g=0.4'} />{t(" and ", " y ")}<Formula tex={'b=-0.2'} />{t(", so", ", por lo tanto")}</p>
        <Formula display tex={t('-0.2t^2+0.4t+0.6=0\\quad\\Longrightarrow\\quad t=3\\;\\text{or}\\;t=-1', '-0.2t^2+0.4t+0.6=0\\quad\\Longrightarrow\\quad t=3\\;\\text{o}\\;t=-1')} />
        <p>{t("A tangent value alone does not fix the electrical length. Choose the representative ", "El valor de la tangente no determina por sí solo la longitud eléctrica. Elegimos el representante ")}<Formula tex={'0\\le\\beta d<\\pi'} />{t(" for each root; add ", " para cada raíz; sumamos ")}<Formula tex={'\\pi'} />{t(" when the principal arctangent is negative. Divide the resulting angle by ", " cuando la arcotangente principal es negativa. Dividimos el ángulo obtenido por ")}<Formula tex={'\\beta'} />{t(" to obtain the distance.", " para obtener la distancia.")}</p>
        <Formula display tex={'\\begin{aligned}\\beta d_1&=\\arctan3,&d_1&=\\frac{\\arctan3}{\\beta},\\\\\\beta d_2&=\\arctan(-1)+\\pi=3\\pi/4,&d_2&=\\frac{3\\pi}{4\\beta}.\\end{aligned}'} />
        <Formula display tex={'d_1/\\lambda=\\frac{\\arctan3}{\\beta\\lambda}=0.198791809,\\qquad d_2/\\lambda=\\frac{3\\pi}{4\\beta\\lambda}=0.375'} />
        <p className="ss-guide__callout">{t("At a quarter wavelength, ", "A un cuarto de longitud de onda, ")}<Formula tex={'\\tan(\\beta d)'} />{t(" has a pole. That placement can still be a valid solution. The solver finds intersections directly in the reflection plane and uses ", " tiene un polo. Esa posición puede seguir siendo una solución válida. El cálculo obtiene las intersecciones directamente en el plano de reflexión y utiliza ")}<Formula tex={'\\operatorname{atan2}'} />{t(" for the rotation angle, so it retains quarter-wave and zero-distance solutions.", " para el ángulo de giro, de modo que conserva las soluciones de cuarto de onda y de distancia cero.")}</p>

        <h2>{t("Choose a termination and calculate the stub", "Elegimos una terminación y calculamos el stub")}</h2>
        <p>{t("At the selected placement, ", "En la posición elegida, ")}<Formula tex={'y_\\ell(d)=1+\\iu b_\\ell'} />{t(". The required normalized stub susceptance is", ". La susceptancia normalizada que debe aportar el stub es")}</p>
        <Formula display tex={'b_s=-b_\\ell,\\qquad y_v=1+\\iu b_\\ell+\\iu b_s=1'} />
        <p>{t("An open or short lossless line supplies that susceptance. Normalize it to the main line's admittance, including the ratio of characteristic impedances:", "Una línea sin pérdidas abierta o en cortocircuito proporciona esa susceptancia. La normalizamos respecto de la admitancia de la línea principal, incluyendo la relación entre las impedancias características:")}</p>
        <Formula display tex={'b_{s,\\mathrm{open}}=\\frac{Z_0}{Z_{0s}}\\tan(\\beta_s\\ell_s)'} />
        <Formula display tex={'b_{s,\\mathrm{short}}=-\\frac{Z_0}{Z_{0s}}\\cot(\\beta_s\\ell_s)'} />
        <p>{t("For a compact angle calculation, define ", "Para calcular el ángulo de forma compacta, definimos ")}<Formula tex={'q=b_s Z_{0s}/Z_0'} />{t(". The stub electrical lengths in the first half wavelength follow from", ". Las longitudes eléctricas del stub en la primera media longitud de onda se obtienen de")}</p>
        <Formula display tex={'\\beta_s\\ell_{s,\\mathrm{open}}=\\operatorname{atan2}(q,1)\\bmod\\pi'} />
        <Formula display tex={'\\beta_s\\ell_{s,\\mathrm{short}}=\\operatorname{atan2}(1,-q)'} />
        <p>{t("Here the positive modulo selects an angle in ", "Aquí, el módulo positivo selecciona un ángulo en ")}<Formula tex={'[0,\\pi)'} />{t(". Divide each angle by ", ". Dividimos cada ángulo por ")}<Formula tex={'\\beta_s'} />{t(" to recover the stub length, then by ", " para recuperar la longitud del stub, y luego por ")}<Formula tex={'\\lambda_s'} />{t(" to express it in wavelengths. Changing the stub impedance changes its length, while the two main-line placement branches stay fixed.", " para expresarla en longitudes de onda. Cambiar la impedancia del stub modifica su longitud, mientras que las dos ramas de ubicación sobre la línea principal permanecen fijas.")}</p>
        <p>{t("At the selected intersection, highlight the constant-susceptance curve ", "En la intersección elegida, resaltamos la curva de susceptancia constante ")}<Formula tex={'\\operatorname{Im}y_\\ell=b_\\ell'} />{t(". The required stub lies on the opposite curve ", ". El stub necesario está sobre la curva opuesta ")}<Formula tex={'\\operatorname{Im}y_{\\mathrm{stub}}=b_s=-b_\\ell'} />{t(", at its intersection with the outer circle ", ", en su intersección con el círculo exterior ")}<Formula tex={'\\operatorname{Re}y_{\\mathrm{stub}}=0'} />{t(". Keep both curves and the previous construction visible while finding the stub length.", ". Conservamos visibles ambas curvas y la construcción anterior mientras determinamos la longitud del stub.")}</p>
        <div className="ss-guide__table-wrap">
          <table className="ss-guide__table">
            <caption>{t("Four canonical matching networks for the example", "Cuatro redes de adaptación canónicas para el ejemplo")}</caption>
            <thead><tr><th>{t("Branch", "Rama")}</th><th><Formula tex={'d/\\lambda'} /></th><th><Formula tex={'y_\\ell(d)'} /></th><th><Formula tex={'b_s'} /></th><th>{t("Short ", "Cortocircuito ")}<Formula tex={'\\ell_s/\\lambda_s'} /></th><th>{t("Open ", "Abierto ")}<Formula tex={'\\ell_s/\\lambda_s'} /></th></tr></thead>
            <tbody><tr><th>1</th><td>0.198791809</td><td><Formula tex={'1+\\iu'} /></td><td>−1</td><td>0.125</td><td>0.375</td></tr><tr><th>2</th><td>0.375</td><td><Formula tex={'1-\\iu'} /></td><td>+1</td><td>0.375</td><td>0.125</td></tr></tbody>
          </table>
        </div>
        <p>{t("All four give ", "Las cuatro proporcionan ")}<Formula tex={'Z_v=50\\;\\Omega'} />, <Formula tex={'\\Gamma_v=0'} />{t(", and ", " y ")}<Formula tex={'\\mathrm{VSWR}=1'} />{t(" at the design frequency.", " a la frecuencia de diseño.")}</p>

        <h2>{t("All independent solutions and periodic equivalents", "Todas las soluciones independientes y sus equivalentes periódicos")}</h2>
        <p>{t("The two placement branches are independent geometric solutions. Each branch can use an open or a short stub. Longer networks repeat those same electrical solutions because a lossless line repeats its input impedance every half wavelength:", "Las dos ramas de ubicación son soluciones geométricas independientes. Cada una puede utilizar un stub abierto o en cortocircuito. Las redes más largas repiten las mismas soluciones eléctricas porque una línea sin pérdidas repite su impedancia de entrada cada media longitud de onda:")}</p>
        <Formula display tex={'d=d_i+n\\lambda/2,\\qquad\\ell_s=\\ell_{s,i}+m\\lambda_s/2'} />
        <Formula display tex={'n,m\\in\\{0,1,2,\\ldots\\}'} />
        <p>{t("The integers are independent: extending the main line does not require extending the stub. The solver shows the distinct representatives in ", "Los enteros son independientes: alargar la línea principal no obliga a alargar el stub. El cálculo muestra los representantes distintos en ")}<Formula tex={'0\\le d/\\lambda<0.5'} />{t(" and ", " y ")}<Formula tex={'0\\le\\ell_s/\\lambda_s<0.5'} />{t(", then lets you add either set of half-wave repetitions.", ", y permite añadir por separado las repeticiones de media onda de cada tramo.")}</p>

        <a className="guide-link guide-link--primary ss-guide__lab-link" href="#/labs/single-stub-matching">{t("Open the single-stub laboratory ", "Abrir el laboratorio de adaptación con un stub ")}<span aria-hidden="true">→</span></a>
      </div>
    </div>
  );
}
