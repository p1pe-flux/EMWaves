import type { QuarterWaveInput } from '../domain/quarterWave';
import { useI18n } from '../i18n';
import { Formula } from './Formula';
import { QuarterWaveConstruction } from './QuarterWaveConstruction';
import { QuarterWaveDiagram } from './QuarterWaveDiagram';
import '../styles/quarter-wave.css';

export const QUARTER_WAVE_EXAMPLE: QuarterWaveInput = {
  z0: 50,
  load: { kind: 'impedance', resistance: 100, reactance: 50 },
};

export function QuarterWaveGuideContent() {
  const { t } = useI18n();
  return (
    <div className="qw-guide ss-guide">
      <div className="qw-guide__article">
        <p>{t("A quarter-wave transformer matches a real resistance by inserting a section of transmission line with a suitable characteristic impedance. For a complex load, first use a length of the main line to obtain a real resistance, then transform that resistance to the main-line impedance.", "Un transformador de cuarto de onda adapta una resistencia real insertando un tramo de línea de transmisión con una impedancia característica adecuada. Para una carga compleja, primero usa un tramo de la línea principal para obtener una resistencia real y luego transforma esa resistencia en la impedancia de la línea principal.")}</p>
        <p>{t("The main line has characteristic impedance ", "La línea principal tiene impedancia característica ")}<Formula tex={'Z_0'} />{t(", phase constant ", ", constante de fase ")}<Formula tex={'\\beta'} />{t(", and wavelength ", ", y longitud de onda ")}<Formula tex={'\\lambda'} />{t(". The transformer section has its own ", ". El tramo transformador tiene sus propios valores de ")}<Formula tex={'Z_t'} />, <Formula tex={'\\beta_t'} />{t(", and ", ", y ")}<Formula tex={'\\lambda_t'} />{t(". Electrical length is ", ". La longitud eléctrica es ")}<Formula tex={'\\beta d'} />{t(" in the main line and ", " en la línea principal y ")}<Formula tex={'\\beta_t\\ell_t'} />{t(" in the transformer.", " en el transformador.")}</p>
        <figure className="qw-guide__circuit">
          <QuarterWaveDiagram z0={50} loadLabel="Z_L" distance={0.2} transformerZ0={75} transformerLength={0.25} showTransformer abstractLabels />
          <figcaption><Formula tex={'Z_\\ell(d)'} />{t(" is seen at the transformer's load-side junction, looking through the main-line section of length ", " se observa en la unión del transformador del lado de la carga, mirando a través del tramo de línea principal de longitud ")}<Formula tex={'d'} />{t(" toward ", " hacia ")}<Formula tex={'Z_L'} />. <Formula tex={'Z_v'} />{t(" is seen at the generator-side junction, looking through the transformer and load. The blue series section has characteristic impedance ", " se observa en la unión del lado del generador, mirando a través del transformador y la carga. El tramo azul en serie tiene impedancia característica ")}<Formula tex={'Z_t'} />{t(" and length ", " y longitud ")}<Formula tex={'\\ell_t'} />.</figcaption>
        </figure>

        <h2>{t("Why a quarter wavelength matches a real resistance", "Por qué un cuarto de longitud de onda adapta una resistencia real")}</h2>
        <p>{t("Let the transformer terminate in a positive real resistance ", "Supongamos que el transformador termina en una resistencia real positiva ")}<Formula tex={'R'} />{t(". Its input impedance follows the lossless-line sine–cosine formula:", ". Su impedancia de entrada sigue la fórmula seno–coseno de una línea sin pérdidas:")}</p>
        <Formula display tex={'Z_v(\\ell_t)=Z_t\\frac{R\\cos(\\beta_t\\ell_t)+\\iu Z_t\\sin(\\beta_t\\ell_t)}{Z_t\\cos(\\beta_t\\ell_t)+\\iu R\\sin(\\beta_t\\ell_t)}'} />
        <p>{t("Choose a quarter wavelength in the transformer. Then ", "Elige un cuarto de longitud de onda en el transformador. Entonces ")}<Formula tex={'\\beta_t\\ell_t=\\pi/2'} />{t(", so the cosine vanishes and the sine equals one:", ", por lo que el coseno se anula y el seno vale uno:")}</p>
        <Formula display tex={'Z_v=Z_t\\frac{\\iu Z_t}{\\iu R}=\\frac{Z_t^2}{R}'} />
        <p>{t("To make this input equal to ", "Para que esta entrada sea igual a ")}<Formula tex={'Z_0'} />{t(", choose the positive characteristic impedance", ", elige la impedancia característica positiva")}</p>
        <Formula display tex={'Z_t=\\sqrt{Z_0R},\\qquad\\ell_t=\\lambda_t/4'} />
        <p>{t("The section inverts impedance: a resistance above its own characteristic impedance becomes one below it. The quarter wavelength belongs to the transformer medium; it need not have the same physical length as a quarter wavelength in the main line.", "El tramo invierte la impedancia: una resistencia mayor que su propia impedancia característica pasa a ser menor que ella. El cuarto de longitud de onda corresponde al medio del transformador; no necesariamente tiene la misma longitud física que un cuarto de longitud de onda en la línea principal.")}</p>

        <h2>{t("First make a complex load real", "Primero convierte una carga compleja en real")}</h2>
        <p>{t("For a complex load, the main-line section of length ", "Para una carga compleja, el tramo de línea principal de longitud ")}<Formula tex={'d'} />{t(" provides", " produce")}</p>
        <Formula display tex={'Z_\\ell(d)=Z_0\\frac{Z_L\\cos(\\beta d)+\\iu Z_0\\sin(\\beta d)}{Z_0\\cos(\\beta d)+\\iu Z_L\\sin(\\beta d)}'} />
        <p>{t("Choose a placement where ", "Elige una ubicación donde ")}<Formula tex={'\\operatorname{Im}Z_\\ell(d)=0'} />{t(". On the impedance Smith chart, these are the intersections of the load's SWR circle with the real axis. For a load with positive resistance, each intersection gives a positive resistance that the quarter-wave section can match.", ". En el diagrama de Smith de impedancias, estas son las intersecciones del círculo de ROE de la carga con el eje real. Para una carga con resistencia positiva, cada intersección da una resistencia positiva que el tramo de cuarto de onda puede adaptar.")}</p>
        <Formula display tex={'\\Gamma_\\ell(d)=\\Gamma_L e^{-\\iu\\,2\\beta d},\\qquad |\\Gamma_\\ell(d)|=|\\Gamma_L|'} />
        <p>{t("If ", "Si ")}<Formula tex={'\\phi_L=\\arg\\Gamma_L'} />{t(", a real-axis intersection satisfies ", ", una intersección con el eje real satisface ")}<Formula tex={'\\phi_L-2\\beta d=k\\pi'} />{t(" for an integer ", " para un entero ")}<Formula tex={'k'} />{t(". Choose the two distances within the first half wavelength:", ". Elige las dos distancias dentro de la primera media longitud de onda:")}</p>
        <Formula display tex={'d=\\frac{\\phi_L-k\\pi}{2\\beta},\\qquad 0\\le d/\\lambda<1/2'} />
        <p>{t("One intersection has positive real reflection and the other has negative real reflection. With ", "Una intersección tiene un coeficiente de reflexión real positivo y la otra, uno negativo. Con ")}<Formula tex={'\\rho=|\\Gamma_L|'} />{t(" and ", " y ")}<Formula tex={'S=(1+\\rho)/(1-\\rho)'} />{t(", their resistances are", ", sus resistencias son")}</p>
        <Formula display tex={'R_+=Z_0S,\\qquad R_-=Z_0/S'} />

        <h2>{t("A worked complex-load example", "Un ejemplo resuelto con carga compleja")}</h2>
        <Formula display tex={'Z_0=50\\;\\Omega,\\qquad Z_L=(100+\\iu\\,50)\\;\\Omega'} />
        <Formula display tex={'z_L=2+\\iu,\\qquad\\Gamma_L=0.4+\\iu\\,0.2,\\qquad\\phi_L=\\arctan(1/2)'} />
        <p>{t("Moving clockwise first reaches the positive real axis, then the negative real axis. The electrical lengths are", "Al avanzar en sentido horario se llega primero al eje real positivo y luego al negativo. Las longitudes eléctricas son")}</p>
        <Formula display tex={'\\beta d_1=\\phi_L/2,\\qquad\\beta d_2=(\\phi_L+\\pi)/2'} />
        <p>{t("Each real resistance requires its own transformer impedance. Both transformer sections have length ", "Cada resistencia real requiere su propia impedancia de transformador. Ambos tramos transformadores tienen longitud ")}<Formula tex={'\\ell_t/\\lambda_t=0.25'} />.</p>
        <div className="qw-guide__table-wrap">
          <table className="qw-guide__table">
            <caption>{t("Two quarter-wave matching networks for the same load", "Dos redes de adaptación de cuarto de onda para la misma carga")}</caption>
            <thead><tr><th>{t("Branch", "Rama")}</th><th><Formula tex={'d/\\lambda'} /></th><th><Formula tex={'R=Z_\\ell(d)'} /></th><th><Formula tex={'Z_t=\\sqrt{Z_0R}'} /></th><th><Formula tex={'\\ell_t/\\lambda_t'} /></th></tr></thead>
            <tbody>
              <tr><th>1</th><td>0.0368959044</td><td>130.9016994 Ω</td><td>80.9016994 Ω</td><td>0.25</td></tr>
              <tr><th>2</th><td>0.2868959044</td><td>19.0983006 Ω</td><td>30.9016994 Ω</td><td>0.25</td></tr>
            </tbody>
          </table>
        </div>
        <p>{t("Use Next to follow one completed step at a time, first for branch 1 and then for branch 2. Previous reverses the current step. Movement speed changes the rate of motion.", "Usa Siguiente para avanzar un paso completo a la vez, primero en la rama 1 y luego en la rama 2. Anterior revierte el paso actual. Velocidad cambia la rapidez del movimiento.")}</p>
      </div>

      <QuarterWaveConstruction input={QUARTER_WAVE_EXAMPLE} />

      <div className="qw-guide__article">
        <h2>{t("Independent solutions and longer equivalents", "Soluciones independientes y equivalentes más largos")}</h2>
        <p>{t("The two real-axis intersections give the two distinct placement branches. Adding a half wavelength to either line section repeats its input impedance, so each branch also represents the family", "Las dos intersecciones con el eje real dan las dos ramas distintas de ubicación. Agregar media longitud de onda a cualquiera de los tramos repite su impedancia de entrada, de modo que cada rama también representa la familia")}</p>
        <Formula display tex={'d=d_i+n\\lambda/2,\\qquad\\ell_t=(1/4+m/2)\\lambda_t,\\qquad n,m\\in\\{0,1,2,\\ldots\\}'} />
        <Formula display tex={'\\beta_t\\ell_t=\\pi/2+m\\pi'} />
        <p>{t("The integers are independent. Main-line extensions preserve the selected resistance, and odd-quarter-wavelength transformer sections preserve its inversion.", "Los enteros son independientes. Las extensiones de la línea principal conservan la resistencia seleccionada, y los tramos transformadores de un número impar de cuartos de longitud de onda conservan su inversión.")}</p>
        <p>{t("A positive real load can be transformed directly with ", "Una carga real positiva se puede transformar directamente con ")}<Formula tex={'d=0'} />{t(". An already matched load needs no transformer. An ideal open, short, or purely reactive load absorbs no real power, so lossless line sections cannot match it to a positive real impedance. These designs apply at the frequency used to define the electrical lengths.", ". Una carga ya adaptada no necesita transformador. Una carga ideal abierta, en cortocircuito o puramente reactiva no absorbe potencia real, por lo que los tramos sin pérdidas no pueden adaptarla a una impedancia real positiva. Estos diseños se aplican a la frecuencia utilizada para definir las longitudes eléctricas.")}</p>
        <a className="guide-link guide-link--primary qw-guide__lab-link" href="#/labs/quarter-wave-transformer">{t("Open the quarter-wave laboratory ", "Abrir el laboratorio de cuarto de onda ")}<span aria-hidden="true">→</span></a>
      </div>
    </div>
  );
}
