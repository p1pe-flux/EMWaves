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
      </div>
      <SingleStubConstruction input={SINGLE_STUB_EXAMPLE} />
      <div className="ss-guide__article">
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
