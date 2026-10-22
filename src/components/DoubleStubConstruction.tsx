import { useEffect, useId, useMemo, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { solveDoubleStub } from '../domain/doubleStub';
import type { DoubleStubInput, DoubleStubSolution } from '../domain/doubleStub';
import type { ComplexValue } from '../domain/transmission';
import { reflectionToImpedance } from '../domain/transmission';
import { complexTex, formatNumber, texNumber } from '../math/format';
import { useI18n, translateMessage } from '../i18n';
import { Formula } from './Formula';
import { SmithChart } from './SmithChart';
import type { SmithConstruction } from './SmithChart';
import { DoubleStubDiagram } from './DoubleStubDiagram';
import { DoubleStubBranchSummary } from './DoubleStubBranchSummary';
import { doubleStubSteps } from './doubleStubPlayback';
import { useStepPlayback } from './useStepPlayback';
import type { DoubleStubStep, DoubleStubStepPosition } from './doubleStubPlayback';
import { StepExplanation } from './StepExplanation';
import { doubleStubAdditionPath, doubleStubChartPoint, doubleStubCirclePath, doubleStubIsolatedPath, doubleStubIsolatedPoint, doubleStubLoadPath, doubleStubPropagationPath, conductanceCircle, transportedUnityCircle, transportedUnityCenterPath } from './doubleStubGeometry';
import { easeProgress, reflectThroughCenter } from './singleStubConstructionGeometry';
import '../styles/single-stub.css';
import '../styles/double-stub.css';

export interface DoubleStubConstructionProps {
  input: DoubleStubInput;
  solution?: DoubleStubSolution;
  termination1?: 'open' | 'short'; termination2?: 'open' | 'short';
  periodicLength1?: number; periodicLength2?: number;
  onStepChange?: (position: DoubleStubStepPosition) => void;
}
const CORAL = '#a95c3f', BLUE = '#547eb1', GREEN = '#3e806a', GOLD = '#a08149';
const clamp = (p: number) => Math.max(0, Math.min(1, p));
const TITLES: Record<string, string> = {
  matched: 'Comenzar en la entrada adaptada',
  'left-circle': 'Dibujar la conductancia unitaria en el Stub 1',
  transport: 'Transportar el círculo completo hacia el Stub 2',
  load: 'Representar la impedancia de carga y su círculo de ROE',
  admittance: 'Reflejar respecto del centro para leer la admitancia',
  'load-line': 'Avanzar desde la carga hasta el Stub 2',
  intersections: 'Encontrar las admitancias posibles en el Stub 2',
  stub2: 'Construir el Stub 2 y alcanzar la intersección',
  propagate: 'Volver hacia el generador hasta el Stub 1',
  stub1: 'Construir el Stub 1 que cancela la susceptancia',
  verify: 'Conectar el Stub 1 y verificar la adaptación',
};
function partial(points: ComplexValue[], progress: number): ComplexValue[] {
  const position = clamp(progress) * (points.length - 1), i = Math.floor(position);
  if (i >= points.length - 1) return points;
  const a = points[i], b = points[i + 1], f = position - i;
  return [...points.slice(0, i + 1), { re: a.re + f * (b.re - a.re), im: a.im + f * (b.im - a.im) }];
}

interface DoubleStubLessonContext {
  input: DoubleStubInput;
  solution: DoubleStubSolution;
  step: DoubleStubStep;
  stage: number;
  progress: number;
  completed: boolean;
  currentLoadY: ComplexValue | null;
  current: ComplexValue;
  diagramLength1: number;
  diagramLength2: number;
  handoff: boolean;
  periodicLength1: number;
  periodicLength2: number;
  locale: 'en' | 'es';
  t: (english: string, spanish: string) => string;
  headingId?: string;
  playing?: boolean;
}

/** Render the same complete lesson for the live state and the size measurements. */
function renderDoubleStubLesson({ input, solution, step, stage, progress, completed, currentLoadY, current,
  diagramLength1, diagramLength2, handoff, periodicLength1, periodicLength2, locale, t, headingId, playing = false }: DoubleStubLessonContext): ReactNode {
  const phase = step.phase, p = easeProgress(progress), solved = solution.status === 'solved';
  const branchStage = stage >= doubleStubSteps(0).length;
  const right = solution.rightAdmittance;
  const branch = solution.branches[step.branchIndex];
  const continuous = solution.status === 'continuous';
  const forbidden = solution.status === 'forbidden';
  const coincidentPlanes = solution.maxConductance === Infinity;
  const statusTitle = continuous ? t('The two stubs share one electrical plane', 'Los dos stubs comparten un plano eléctrico')
    : forbidden ? t('No finite matching intersection', 'No hay una intersección finita de adaptación')
      : t('This ideal load cannot be matched', 'Esta carga ideal no se puede adaptar');
  let commonExplanation: ReactNode = null;
  if (phase === 'matched') commonExplanation = <><p>{t('The backward calculation starts at the desired match at the generator-side junction. It determines what the line and Stub 2 must present before Stub 1 is connected.', 'El cálculo de atrás hacia adelante parte de la adaptación deseada en la unión del lado del generador. Determina qué admitancia deben presentar la línea y el Stub 2 antes de conectar el Stub 1.')}</p><Formula display tex={'y_v=1,\\qquad y_v=y_1+\\mathrm{j}b_1'} /><p>{t('A reactive stub adds susceptance without changing conductance. The admittance before Stub 1 must therefore have unit conductance; its imaginary part is the contribution that Stub 1 must cancel.', 'Un stub reactivo añade susceptancia sin modificar la conductancia. Por eso, la admitancia antes del Stub 1 debe tener conductancia unitaria; su parte imaginaria es la contribución que debe cancelar el Stub 1.')}</p></>;
  else if (phase === 'left-circle') commonExplanation = <><p>{t('Every admittance that Stub 1 can match lies on the unit-conductance circle. Its real part already satisfies the matching condition, while its susceptance may vary.', 'Todas las admitancias que puede adaptar el Stub 1 están sobre el círculo de conductancia unitaria. Su parte real ya satisface la condición de adaptación, mientras que su susceptancia puede variar.')}</p><Formula display tex={'y_1=1+\\mathrm{j}b,\\qquad\\operatorname{Re}y_1=1'} /><p>{t('Each position on this circle requires the opposite susceptance from Stub 1 and therefore a corresponding stub length.', 'Cada posición de este círculo requiere que el Stub 1 aporte la susceptancia opuesta y, por tanto, tenga la longitud correspondiente.')}</p></>;
  else if (phase === 'transport') commonExplanation = <><p>{t('Propagating the unit-conductance locus toward the load gives the admissible admittances at the generator-side input of Stub 2. Every point rotates counterclockwise by an angle proportional to the distance between the stubs, moving the circle center while preserving its radius.', 'La propagación del lugar geométrico de conductancia unitaria hacia la carga determina las admitancias admisibles en la entrada del Stub 2, del lado del generador. Todos sus puntos giran en sentido antihorario un ángulo proporcional a la distancia entre los stubs, desplazando el centro del círculo y conservando su radio.')}</p><Formula display tex={'\\ell=' + texNumber(input.separation * p, 6) + '\\,\\lambda,\\qquad\\Delta\\phi=+2\\beta\\ell'} /><Formula display tex={'c(\\ell)=\\tfrac12 e^{\\mathrm{j}2\\beta\\ell},\\qquad r=\\tfrac12'} /></>;
  else if (phase === 'load') commonExplanation = <><p>{t('Normalizing the load to the main-line characteristic impedance gives its position on the diagram. Its constant-SWR circle contains the values reached by propagation along the lossless line.', 'Al normalizar la carga respecto de la impedancia característica de la línea principal se obtiene su posición en el diagrama. Su círculo de ROE constante contiene los valores que se alcanzan por propagación a lo largo de la línea sin pérdidas.')}</p><Formula display tex={'z_L=Z_L/Z_0=' + complexTex(solution.normalizedLoad, 5)} /><Formula display tex={'\\Gamma_L=' + complexTex(solution.loadReflection, 5)} /><p>{t('The radius is set by the load reflection magnitude, which lossless propagation preserves.', 'El radio viene dado por el módulo de la reflexión en la carga, que se conserva durante la propagación sin pérdidas.')}</p></>;
  else if (phase === 'admittance') commonExplanation = <><p>{t('Taking the reciprocal of the normalized load impedance gives its admittance. The diametrically opposite point reads this reciprocal on the same grid, so the parallel stub contribution can be expressed as a sum of admittances.', 'La inversa de la impedancia normalizada de la carga da su admitancia. El punto diametralmente opuesto permite leer esa inversa sobre el mismo diagrama y expresar la contribución del stub en paralelo como una suma de admitancias.')}</p><Formula display tex={'y_L=1/z_L=' + complexTex(solution.loadAdmittance, 5)} /></>;
  else if (phase === 'load-line') commonExplanation = <><p>{input.distance === 0 ? <>{t('Stub 2 is already at the load, so its load-side admittance equals ', 'El Stub 2 ya está en la carga, por lo que su admitancia del lado de la carga es igual a ')}<Formula tex="y_L" />{t('. Stub 2 therefore adds its susceptance directly to the load admittance.', '. Por tanto, el Stub 2 añade su susceptancia directamente a la admitancia de la carga.')}</> : t('The main-line section transforms the load admittance into the value seen at the load side of Stub 2. Propagation toward the generator rotates the reflection clockwise while preserving its magnitude.', 'El tramo de línea principal transforma la admitancia de la carga en el valor visto hacia la carga desde el Stub 2. La propagación hacia el generador hace girar la reflexión en sentido horario y conserva su módulo.')}</p><Formula display tex={'y(\\ell)=\\frac{y_L\\cos(\\beta\\ell)+\\mathrm{j}\\sin(\\beta\\ell)}{\\cos(\\beta\\ell)+\\mathrm{j}y_L\\sin(\\beta\\ell)}'} /><Formula display tex={'\\ell=' + texNumber(input.distance * p, 6) + '\\,\\lambda,\\qquad ' + (p >= 1 || input.distance === 0 ? 'y_R=' : 'y(\\ell)=') + complexTex(currentLoadY, 5)} />{completed && <p>{t('This is ', 'Esta es ')}<Formula tex="y_R" />{t(': the admittance seen immediately to the load side of Stub 2, before adding that stub.', ': la admitancia vista inmediatamente hacia la carga desde el Stub 2, antes de añadir ese stub.')}</p>}</>;
  let explanation: ReactNode;
  if (commonExplanation) explanation = commonExplanation;
  else if (!solved) explanation = continuous ? <><p>{t('At an integer half-wave separation, both stubs act at one electrical plane. Unit conductance already satisfies the real part of the matching condition, so any split that cancels the total susceptance is a solution.', 'Con una separación de un múltiplo entero de media onda, ambos stubs actúan en un mismo plano eléctrico. La conductancia unitaria ya satisface la parte real de la condición de adaptación, por lo que cualquier reparto que cancele la susceptancia total es una solución.')}</p><Formula display tex={'b_2=t,\\qquad b_1=' + texNumber(solution.family?.totalSusceptance ?? 0, 5) + '-t'} /><Formula display tex={'q_k=(Z_{0sk}/Z_0)b_k,\\qquad\\ell_k=\\frac{\\Theta_k(q_k)}{\\beta_{sk}}+m_k\\frac{\\lambda_{sk}}{2}'} /><Formula display tex={'\\Theta_{\\mathrm{open}}(q)=[\\operatorname{atan2}(q,1)]_{\\pi}'} /><Formula display tex={'\\Theta_{\\mathrm{short}}(q)=[\\operatorname{atan2}(1,-q)]_{\\pi}'} /><p>{t('The open or short termination determines the electrical angle needed for each susceptance. The brackets select its representative in [0, π); independent half-wave additions repeat each stub’s input admittance.', 'La terminación abierta o cortocircuitada determina el ángulo eléctrico necesario para cada susceptancia. Los corchetes seleccionan su representante en [0, π); las adiciones independientes de media onda repiten la admitancia de entrada de cada stub.')}</p></>
            : forbidden ? <><p>{coincidentPlanes ? translateMessage(solution.message, locale) : t('Stub 2 can change only the imaginary part of the right-side admittance. Its constant-conductance circle misses the circle transported from Stub 1.', 'El Stub 2 solo puede cambiar la parte imaginaria de la admitancia derecha. Su círculo de conductancia constante no alcanza el círculo transportado desde el Stub 1.')}</p><Formula display tex={(coincidentPlanes ? '\\sin(\\beta d_2)=0,\\qquad ' : '') + 'g_R=' + texNumber(right?.re ?? Infinity, 5) + (coincidentPlanes ? ',\\quad g_R\\ne1' : ',\\qquad g_{\\max}=' + texNumber(solution.maxConductance, 5))} /><p>{t('Changing the separation changes the admissible locus; changing the distance from the load to Stub 2 changes the available conductance. Either can restore an intersection.', 'La separación modifica el lugar geométrico admisible; la distancia entre la carga y el Stub 2 modifica la conductancia disponible. Cualquiera de ellas puede restablecer una intersección.')}</p></>
              : <p>{t('An ideal open, short, or purely reactive load absorbs no real power. Lossless lines and reactive stubs cannot turn it into a positive matched resistance.', 'Una carga abierta, en corto o puramente reactiva no absorbe potencia real. Las líneas sin pérdidas y los stubs reactivos no la pueden convertir en una resistencia positiva adaptada.')}</p>;
  else if (phase === 'intersections') explanation = <><p>{t('The main-line section of length ', 'El tramo de línea principal de longitud ')}<Formula tex="d_1" />{t(' presents ', ' presenta ')}<Formula tex="y_R" />{t('. Stub 2 can change only its susceptance, so its reachable admittances lie on this constant-conductance circle. An intersection with the transported locus also guarantees unit conductance at Stub 1.', '. El Stub 2 solo puede modificar su susceptancia, por lo que las admitancias alcanzables están sobre este círculo de conductancia constante. Una intersección con el lugar geométrico transportado garantiza además conductancia unitaria en el Stub 1.')}</p><Formula display tex={'y_R=' + complexTex(right, 5) + ',\\qquad\\operatorname{Re}y_2=\\operatorname{Re}y_R'} /><p>{solution.branches.length === 1 ? t('Tangency satisfies both conditions at a single admittance, giving one distinct pair of stub susceptances.', 'La tangencia satisface ambas condiciones en una única admitancia y da un solo par distinto de susceptancias de los stubs.') : t('The two intersections give different intermediate admittances and different stub lengths. Both pairs satisfy the same matching condition at the fixed positions.', 'Las dos intersecciones dan admitancias intermedias y longitudes de stub diferentes. Ambos pares satisfacen la misma condición de adaptación en las posiciones fijadas.')}</p></>;
  else if (phase === 'stub2') explanation = handoff ? <p>{t('The other intersection gives a second pair of stub susceptances for the same load and fixed positions. This alternative reaches unit conductance at Stub 1 through a different intermediate admittance.', 'La otra intersección da un segundo par de susceptancias de los stubs para la misma carga y las mismas posiciones. Esta alternativa alcanza conductancia unitaria en el Stub 1 a través de una admitancia intermedia diferente.')}</p> : <><p>{t('Stub 2 must supply the susceptance difference between the load-side admittance and the selected intersection. Its characteristic impedance and open or short termination determine the length that produces this contribution, so the line section between the stubs presents unit conductance at Stub 1.', 'El Stub 2 debe aportar la diferencia de susceptancia entre la admitancia del lado de la carga y la intersección elegida. Su impedancia característica y su terminación abierta o cortocircuitada determinan la longitud que produce esa contribución, de modo que el tramo entre los stubs presente conductancia unitaria en el Stub 1.')}</p><Formula display tex={'b_2=' + texNumber(branch.stub2.susceptance, 5) + ',\\qquad y_2=y_R+\\mathrm{j}b_2'} /><Formula display tex={'\\ell_2=' + texNumber(diagramLength2 + periodicLength2, 6) + '\\,\\lambda_{s2}'} /></>;
  else if (phase === 'propagate') explanation = <><p>{t('The admittance with Stub 2 connected propagates toward the generator through separation ', 'La admitancia con el Stub 2 conectado se propaga hacia el generador a través de la separación ')}<Formula tex="d_2" />{t('. Clockwise rotation returns it to the original unit-conductance circle, because its starting value was chosen on the transported locus. Only the remaining susceptance must be cancelled.', '. El giro horario la lleva al círculo original de conductancia unitaria porque el valor inicial se eligió sobre el lugar geométrico transportado. Solo queda cancelar su susceptancia.')}</p><Formula display tex={'\\ell=' + texNumber(input.separation * p, 6) + '\\,\\lambda,\\qquad\\Delta\\phi=-2\\beta\\ell'} /><Formula display tex={(p < 1 ? 'y(\\ell)=' : 'y_1=') + complexTex(reflectionToImpedance(current), 5)} /></>;
  else if (phase === 'stub1') explanation = <><p>{t('Stub 1 must provide the opposite susceptance to cancel the imaginary part at the generator-side junction. Its characteristic impedance and termination determine the required length; the contribution is normalized to the main line so it can be added to the line admittance.', 'El Stub 1 debe aportar la susceptancia opuesta para cancelar la parte imaginaria en la unión del generador. Su impedancia característica y su terminación determinan la longitud necesaria; la contribución se normaliza respecto de la línea principal para sumarla a la admitancia de la línea.')}</p><Formula display tex={'b_1=-\\operatorname{Im}y_1=' + texNumber(branch.stub1.susceptance, 5)} /><Formula display tex={'\\ell_1=' + texNumber(diagramLength1 + periodicLength1, 6) + '\\,\\lambda_{s1}'} /></>;
  else {
    const y = { re: branch.leftBefore.re, im: branch.leftBefore.im + branch.stub1.susceptance * p };
    const scale = Math.max(1, Math.abs(y.re), Math.abs(y.im));
    const r = y.re / scale, x = y.im / scale, denominator = r * r + x * x;
    const z = { re: input.z0 / scale * r / denominator, im: -input.z0 / scale * x / denominator };
    explanation = <><p>{t('Adding Stub 1 cancels the remaining imaginary admittance while preserving unit conductance. The combined input therefore equals the main-line characteristic impedance and its reflection vanishes.', 'Al añadir el Stub 1 se cancela la parte imaginaria restante de la admitancia y se conserva la conductancia unitaria. La entrada conjunta queda igual a la impedancia característica de la línea principal y desaparece la reflexión.')}</p><Formula display tex={'y_v=y_1+\\mathrm{j}b_1=' + complexTex(y, 6)} /><Formula display tex={'Z_v=' + complexTex(z, 5) + '\\;\\Omega,\\qquad|\\Gamma_v|=' + texNumber(Math.hypot(current.re, current.im), 7)} />{completed && <p>{step.branchIndex < solution.branches.length - 1 ? t('This pair of stub lengths matches the load. The other intersection gives an alternative pair that satisfies the same input condition.', 'Este par de longitudes de stub adapta la carga. La otra intersección da un par alternativo que satisface la misma condición de entrada.') : t('The two stub susceptances and the intervening line sections together present the main-line impedance at the generator-side junction.', 'Las susceptancias de ambos stubs y los tramos de línea intermedios presentan en conjunto la impedancia de la línea principal en la unión del generador.')}</p>}</>;
  }
  return <>
    <span className="section-kicker">{t('STEP', 'PASO')} {stage + 1}{branchStage ? t(' · BRANCH ', ' · RAMA ') + (step.branchIndex + 1) : ''}</span>
    <h4 id={headingId}>{!solved && phase === 'intersections' ? statusTitle : t(step.title, TITLES[phase])}</h4>
    <div key={step.key} aria-live={playing ? 'off' : 'polite'}>{explanation}</div>
    {solved && <div className="ds-construction__legend"><span style={{ '--legend-color': GREEN } as CSSProperties}>{t('Unit conductance at Stub 1', 'Conductancia unitaria en el Stub 1')}</span><span style={{ '--legend-color': BLUE } as CSSProperties}>{t('Transported locus at Stub 2', 'Lugar geométrico transportado al Stub 2')}</span><span style={{ '--legend-color': CORAL } as CSSProperties}>{t('Constant conductance from the load', 'Conductancia constante desde la carga')}</span></div>}
  </>;
}

export function DoubleStubConstruction({ input, solution: providedSolution, termination1 = 'short', termination2 = 'short', periodicLength1 = 0, periodicLength2 = 0, onStepChange }: DoubleStubConstructionProps) {
  const { locale, t } = useI18n();
  const inputKey = JSON.stringify(input);
  const calculation = useMemo(() => {
    if (providedSolution !== undefined) return { solution: providedSolution, error: null };
    try { return { solution: solveDoubleStub(input), error: null }; }
    catch (error) { return { solution: null, error: error instanceof Error ? error : 'Check the electrical parameters.' }; }
  }, [input, providedSolution]);
  const solution = calculation.solution;
  const steps = useMemo(() => doubleStubSteps(solution?.branches.length ?? 0), [solution]);
  const { stage, progress, playing, speed, setSpeed, reducedMotion, completed,
    canNext, canPrevious, next: advanceNext, previous: advancePrevious, restart } = useStepPlayback(steps, inputKey + '|' + termination1 + '|' + termination2);
  const step = steps[stage];
  const section = useRef<HTMLElement>(null);
  const id = 'double-stub-construction-' + useId().replaceAll(':', '');
  const stubPaths = useMemo(() => solution?.branches.map((branch) => ({
    first: doubleStubIsolatedPath(input.z0, input.stub1Z0, termination1 === 'open' ? branch.stub1.openLength : branch.stub1.shortLength, termination1),
    second: doubleStubIsolatedPath(input.z0, input.stub2Z0, termination2 === 'open' ? branch.stub2.openLength : branch.stub2.shortLength, termination2),
  })) ?? [], [solution, termination1, termination2, input.z0, input.stub1Z0, input.stub2Z0]);
  const fixedGeometry = useMemo(() => {
    if (!solution) return null;
    const right = solution.rightAdmittance;
    const rightCircle = right ? conductanceCircle(right.re) : null;
    return {
      unity: doubleStubCirclePath({ re: 0.5, im: 0 }, 0.5),
      swr: doubleStubCirclePath({ re: 0, im: 0 }, Math.hypot(solution.loadReflection.re, solution.loadReflection.im)),
      load: doubleStubLoadPath(solution.loadReflection, input.distance),
      rightCircle: rightCircle ? doubleStubCirclePath(rightCircle.center, rightCircle.radius) : [],
      branches: solution.branches.map((branch) => ({
        addition: doubleStubAdditionPath(right!, branch.stub2.susceptance),
        propagation: doubleStubPropagationPath(branch.rightAfter, input.separation),
      })),
    };
  }, [solution, input.distance, input.separation]);
  const lessonMeasurements = useMemo(() => {
    if (!solution) return [];
    return steps.flatMap((measurementStep, measurementStage) => {
      const branch = solution.branches[measurementStep.branchIndex];
      const length1 = branch ? termination1 === 'open' ? branch.stub1.openLength : branch.stub1.shortLength : 0;
      const length2 = branch ? termination2 === 'open' ? branch.stub2.openLength : branch.stub2.shortLength : 0;
      const snapshots = ['transport', 'load-line', 'propagate', 'stub2', 'stub1', 'verify'].includes(measurementStep.phase) ? [0.5, 1] : [1];
      if (measurementStep.phase === 'stub2' && measurementStep.branchIndex > 0) snapshots.unshift(0.1);
      return snapshots.map((measurementProgress) => {
        const y = branch && measurementStep.phase === 'verify'
          ? { re: branch.leftBefore.re, im: branch.leftBefore.im + branch.stub1.susceptance * easeProgress(measurementProgress) }
          : branch?.leftBefore ?? null;
        return renderDoubleStubLesson({
          input, solution, step: measurementStep, stage: measurementStage, progress: measurementProgress,
          completed: measurementProgress === 1, currentLoadY: solution.rightAdmittance,
          current: y ? doubleStubChartPoint(y) : { re: 0, im: 0 },
          diagramLength1: length1, diagramLength2: length2,
          handoff: measurementStep.phase === 'stub2' && measurementStep.branchIndex > 0 && measurementProgress < 0.34,
          periodicLength1, periodicLength2, locale, t,
        });
      });
    });
  }, [input, solution, steps, termination1, termination2, periodicLength1, periodicLength2, locale, t]);
  useEffect(() => { onStepChange?.({ stepIndex: stage, completed }); }, [stage, completed, onStepChange]);

  if (!solution) return <div className="ss-empty" role="status">{translateMessage(calculation.error ?? '', locale)}</div>;
  const solved = solution.status === 'solved', phase = step.phase, p = easeProgress(progress);
  const commonSteps = doubleStubSteps(0), commonCount = commonSteps.length;
  const commonIndex = (name: string) => commonSteps.findIndex((s) => s.phase === name);
  const atOrAfter = (name: string) => stage >= commonIndex(name);
  const branchStage = stage >= commonCount;
  const right = solution.rightAdmittance;
  const rightPoint = doubleStubChartPoint(right);
  const rightCircle = right ? conductanceCircle(right.re) : null;
  const targetCircle = solution.locus;
  const chart: SmithConstruction = { grid: 'impedance', markers: [], circles: [], paths: [], ariaLabel: t('Backward double-stub matching on the fixed standard Smith grid.', 'Adaptación con dos stubs de atrás hacia adelante sobre el diagrama de Smith habitual.') };
  const transported = phase === 'transport' ? transportedUnityCircle(input.separation, p) : targetCircle;
  const commonComplete = atOrAfter('intersections');
  const loadTraversal = phase === 'load' || phase === 'admittance' ? 0 : phase === 'load-line' ? p : undefined;
  const loadTravelProgress = phase === 'load-line' ? p : atOrAfter('intersections') ? 1 : 0;
  const loadPath = loadTravelProgress === 1 ? fixedGeometry!.load : doubleStubLoadPath(solution.loadReflection, input.distance, loadTravelProgress);
  const loadPoint = loadPath.at(-1)!;
  const yLoadPoint = doubleStubChartPoint(solution.loadAdmittance);
  const currentLoadY = reflectionToImpedance(loadPoint);
  const lessonContext = { input, solution, step, stage, progress, completed, currentLoadY,
    periodicLength1, periodicLength2, locale, t, headingId: id + '-step', playing };

  if (atOrAfter('left-circle')) {
    chart.paths!.push({ id: 'left-unity', points: phase === 'left-circle' && p < 1 ? doubleStubCirclePath({ re: 0.5, im: 0 }, 0.5, p) : fixedGeometry!.unity, color: GREEN, opacity: atOrAfter('transport') ? 0.3 : 1 });
  }
  if (atOrAfter('transport')) {
    chart.circles!.push({ id: 'transported-unity', center: transported.center, radius: transported.radius, color: BLUE });
    if (phase === 'transport') {
      chart.paths!.push({ id: 'circle-center-trajectory', points: transportedUnityCenterPath(input.separation, p), color: BLUE, dashed: true, opacity: 0.55 });
      chart.markers!.push({ id: 'transported-center', label: '', point: transported.center, color: BLUE });
    }
  }
  if (atOrAfter('load')) {
    chart.paths!.push({ id: 'load-swr', points: phase === 'load' && p < 1 ? doubleStubCirclePath({ re: 0, im: 0 }, Math.hypot(solution.loadReflection.re, solution.loadReflection.im), p) : fixedGeometry!.swr, color: GOLD, dashed: true, opacity: 0.55 });
  }
  if (phase === 'load') {
    chart.markers!.push({ id: 'load-impedance', label: 'z_L', point: solution.loadReflection, color: CORAL });
  } else if (phase === 'admittance') {
    if (progress < 1) {
      chart.paths!.push({ id: 'load-reading-diameter', points: [solution.loadReflection, yLoadPoint], color: CORAL, dashed: true, opacity: 0.45 });
      chart.markers!.push({ id: 'load-impedance-reference', label: p < 0.5 ? '' : 'z_L', point: solution.loadReflection, color: CORAL, opacity: 0.45 });
    }
    chart.markers!.push({ id: 'load-admittance-reading', label: p < 0.5 ? 'z_L' : 'y_L', point: reflectThroughCenter(solution.loadReflection, p), color: CORAL });
  }
  if (atOrAfter('load-line')) {
    chart.paths!.push({ id: 'load-to-right', points: loadPath, color: CORAL });
    if (Math.hypot(yLoadPoint.re - loadPoint.re, yLoadPoint.im - loadPoint.im) > 0.025) chart.markers!.push({ id: 'original-load-admittance', label: 'y_L', point: yLoadPoint, color: CORAL, opacity: 0.6 });
    if (phase === 'load-line') {
      const label = p >= 1 || input.distance === 0 ? 'y_R' : Math.hypot(yLoadPoint.re - loadPoint.re, yLoadPoint.im - loadPoint.im) < 0.025 ? 'y_L' : 'y(\\ell)';
      chart.markers!.push({ id: 'load-line-reading', label, point: loadPoint, color: CORAL });
    }
  }
  if (commonComplete && rightCircle) {
    chart.paths!.push({ id: 'right-conductance', points: phase === 'intersections' && p < 1 ? doubleStubCirclePath(rightCircle.center, rightCircle.radius, p) : fixedGeometry!.rightCircle, color: CORAL });
  }
  if (commonComplete) {
    chart.markers!.push({ id: 'right-load-admittance', label: 'y_R', point: rightPoint, color: CORAL });
  }
  if (phase === 'matched' || phase === 'left-circle' || phase === 'transport') chart.markers!.push({ id: 'matched-input', label: 'y_v=1', point: { re: 0, im: 0 }, color: GREEN });
  function reveal() { const top = section.current?.getBoundingClientRect().top; if (top !== undefined && (top < 0 || top > 32)) section.current?.scrollIntoView({ block: 'start', behavior: 'auto' }); }
  function next() { if (canNext) { reveal(); advanceNext(); } }
  function previous() { if (canPrevious) { reveal(); advancePrevious(); } }
  const playback = <div className="ss-playback"><div className="ss-playback__buttons"><span className="ss-step-count">{stage + 1} / {steps.length}</span><button type="button" aria-disabled={!canPrevious} onClick={previous}>{t('Previous', 'Anterior')}</button><button type="button" className="ss-playback__next" aria-disabled={!canNext} onClick={next}>{t('Next', 'Siguiente')}</button><button type="button" onClick={restart}>{t('Restart', 'Reiniciar')}</button></div><label className="ss-speed" htmlFor={id + '-speed'}><span>{t('Movement speed', 'Velocidad')}</span><output>{formatNumber(speed, 2)}×</output><input id={id + '-speed'} aria-label={t('Movement speed', 'Velocidad')} type="range" min="0.25" max="4" step="0.25" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} /></label></div>;
  if (!solved) {
    return <section ref={section} className="ds-construction ss-construction" data-status={solution.status} data-stage={stage} data-stage-name={phase} data-stage-progress={progress.toFixed(3)} data-playing={playing}>
      <div className="ss-construction__toolbar" style={{ marginTop: 0, justifyContent: 'flex-end' }}>{playback}</div>
      <div className="ss-construction__body"><div className="ss-construction__visual"><SmithChart solution={null} length={0} showCurves={false} showGamma={false} showSwr={false} interactive={false} onSelectReflection={() => {}} construction={chart} /></div>
        <div className="ss-construction__details"><DoubleStubDiagram input={input} showStub1={false} showStub2={false} termination1={termination1} termination2={termination2} readingPosition={phase === 'transport' ? p : atOrAfter('load') ? 1 : 0} loadTraversal={loadTraversal} showStub2Plane={atOrAfter('admittance')} /><div className="ss-construction__lesson ds-construction__status" role="status"><StepExplanation measurements={lessonMeasurements} active={renderDoubleStubLesson({
            ...lessonContext, current: { re: 0, im: 0 }, diagramLength1: 0, diagramLength2: 0, handoff: false,
          })} />
        </div></div></div>
    </section>;
  }
  const branch = solution.branches[step.branchIndex], first = solution.branches[0];
  const length1 = termination1 === 'open' ? branch.stub1.openLength : branch.stub1.shortLength;
  const length2 = termination2 === 'open' ? branch.stub2.openLength : branch.stub2.shortLength;
  const paths = stubPaths[step.branchIndex];
  const handoff = phase === 'stub2' && step.branchIndex > 0 && progress < 0.34;
  const local = phase === 'stub2' && step.branchIndex > 0 ? clamp((progress - 0.34) / 0.66) : progress;
  const build2 = phase === 'stub2' ? easeProgress(clamp(local / 0.55)) : branchStage ? 1 : 0;
  const addition2 = phase === 'stub2' ? easeProgress(clamp((local - 0.55) / 0.45)) : branchStage ? 1 : 0;
  const propagation = phase === 'propagate' ? p : phase === 'stub1' || phase === 'verify' ? 1 : 0;
  const build1 = phase === 'stub1' ? p : phase === 'verify' ? 1 : 0;
  const addition1 = phase === 'verify' ? p : 0;
  let current = { re: 0, im: 0 }, currentLabel = 'y_v=1', readingPosition = 0;
  let diagramLength1 = length1 * build1, diagramLength2 = length2 * build2;
  let show1 = phase === 'stub1' || phase === 'verify', show2 = branchStage;
  let attached1 = phase === 'verify', attached2 = addition2 > 0;
  let opacity1 = 1, opacity2 = 1;
  solution.branches.forEach((candidate, i) => {
    if (!commonComplete || (branchStage && i !== step.branchIndex)) return;
    const target = doubleStubChartPoint(candidate.rightAfter);
    const junction = phase === 'stub2' && !handoff ? doubleStubChartPoint({ re: right!.re, im: right!.im + candidate.stub2.susceptance * addition2 }) : null;
    const overlap = junction !== null && Math.hypot(target.re - junction.re, target.im - junction.im) < 0.025;
    const label = phase === 'intersections' || (phase === 'stub2' && !overlap) ? 'P_' + (i + 1) : '';
    chart.markers!.push({ id: 'intersection-' + (i + 1), label, point: target, color: BLUE, opacity: phase === 'intersections' ? clamp((p - 0.65) / 0.35) : 1 });
  });
  if (phase === 'transport') readingPosition = p;
  if (phase === 'intersections') readingPosition = 1;
  if (branchStage && !handoff) {
    readingPosition = 1 - propagation;
    const added = addition2 === 1 ? fixedGeometry!.branches[step.branchIndex].addition : doubleStubAdditionPath(right!, branch.stub2.susceptance, addition2);
    chart.paths!.push({ id: 'stub-2-addition', points: added, color: BLUE });
    chart.paths!.push({ id: 'stub-2-boundary', points: partial(paths.second, build2), color: BLUE, opacity: phase === 'stub2' ? 1 : 0.5 });
    chart.markers!.push({ id: 'stub-2-input', label: 'y_{s2}', point: doubleStubIsolatedPoint(input.z0, input.stub2Z0, diagramLength2, termination2), color: BLUE });
    current = added.at(-1)!; currentLabel = addition2 > 0.02 ? 'y_2' : '';
    if (phase !== 'stub2') {
      const rotation = propagation === 1 ? fixedGeometry!.branches[step.branchIndex].propagation : doubleStubPropagationPath(branch.rightAfter, input.separation, propagation);
      chart.paths!.push({ id: 'between-stubs', points: rotation, color: GOLD });
      chart.circles!.push({ id: 'between-stubs-swr', center: { re: 0, im: 0 }, radius: Math.hypot(rotation[0].re, rotation[0].im), color: GOLD, dashed: true, opacity: 0.45 });
      chart.markers!.push({ id: 'right-after-stub', label: 'y_2', point: doubleStubChartPoint(branch.rightAfter), color: BLUE, opacity: propagation > 0.08 ? 0.65 : 0 });
      current = rotation.at(-1)!; currentLabel = phase === 'propagate' && p < 1 ? 'y(\\ell)' : 'y_1';
    }
    if (show1) {
      chart.paths!.push({ id: 'stub-1-boundary', points: partial(paths.first, build1), color: BLUE, opacity: phase === 'stub1' ? 1 : 0.6 });
      chart.markers!.push({ id: 'stub-1-input', label: 'y_{s1}', point: doubleStubIsolatedPoint(input.z0, input.stub1Z0, diagramLength1, termination1), color: BLUE });
    }
    if (phase === 'verify') {
      const cancellation = doubleStubAdditionPath(branch.leftBefore, branch.stub1.susceptance, addition1);
      chart.paths!.push({ id: 'stub-1-cancellation', points: cancellation, color: GREEN });
      chart.markers!.push({ id: 'left-before-stub', label: 'y_1', point: doubleStubChartPoint(branch.leftBefore), color: CORAL, opacity: addition1 > 0.1 ? 0.65 : 0 });
      current = cancellation.at(-1)!; currentLabel = addition1 > 0.08 ? 'y_v' : 'y_1';
    }
  } else if (handoff) {
    const oldLength1 = termination1 === 'open' ? first.stub1.openLength : first.stub1.shortLength;
    const oldLength2 = termination2 === 'open' ? first.stub2.openLength : first.stub2.shortLength;
    if (progress < 0.12) {
      const undo = 1 - easeProgress(progress / 0.12), path = doubleStubAdditionPath(first.leftBefore, first.stub1.susceptance, undo);
      chart.paths!.push({ id: 'undo-first-stub', points: path, color: GREEN });
      current = path.at(-1)!; currentLabel = 'y_v';
      show1 = true; diagramLength1 = oldLength1; opacity1 = undo; attached1 = true;
      diagramLength2 = oldLength2; attached2 = true; readingPosition = 0;
    } else if (progress < 0.24) {
      const back = 1 - easeProgress((progress - 0.12) / 0.12), path = doubleStubPropagationPath(first.rightAfter, input.separation, back);
      chart.paths!.push({ id: 'return-to-right', points: path, color: GOLD });
      current = path.at(-1)!; currentLabel = 'y_1'; readingPosition = 1 - back;
      diagramLength2 = oldLength2; attached2 = true;
    } else {
      const undo = 1 - easeProgress((progress - 0.24) / 0.1), path = doubleStubAdditionPath(right!, first.stub2.susceptance, undo);
      chart.paths!.push({ id: 'remove-first-stub-2', points: path, color: BLUE });
      current = path.at(-1)!; currentLabel = 'y_2'; readingPosition = 1;
      diagramLength2 = oldLength2; opacity2 = undo; attached2 = false;
    }
  }
  if (branchStage) chart.markers!.push({ id: 'tracked-double-stub', label: currentLabel, point: current, color: phase === 'verify' || handoff ? GREEN : CORAL });

  return <section ref={section} className="ds-construction ss-construction" aria-label={t('Backward double-stub matching construction', 'Construcción de adaptación con dos stubs de atrás hacia adelante')} aria-busy={playing} data-status={solution.status} data-stage={stage} data-stage-name={phase} data-branch={step.branchIndex} data-stage-progress={progress.toFixed(3)} data-playing={playing}>
    <div className="ss-construction__toolbar" style={{ marginTop: 0 }}><DoubleStubBranchSummary solution={solution} position={{ stepIndex: stage, completed }} termination1={termination1} termination2={termination2} periodicLength1={periodicLength1} periodicLength2={periodicLength2} />{playback}</div>
    <div className="ss-construction__body"><div className="ss-construction__visual"><div className="ss-construction__chart"><SmithChart solution={null} length={0} showCurves={false} showGamma={false} showSwr={false} interactive={false} onSelectReflection={() => {}} construction={chart} /></div></div><div className="ss-construction__details"><div className="ss-construction__circuit"><DoubleStubDiagram input={input} length1={diagramLength1} length2={diagramLength2} termination1={termination1} termination2={termination2} showStub1={show1} showStub2={show2} attached1={attached1} attached2={attached2} opacity1={opacity1} opacity2={opacity2} periodicLength1={periodicLength1} periodicLength2={periodicLength2} readingPosition={readingPosition} loadTraversal={loadTraversal} showStub2Plane={atOrAfter('admittance')} /></div><div className="ss-construction__lesson" role="region" aria-labelledby={id + '-step'} tabIndex={0}><StepExplanation measurements={lessonMeasurements} active={renderDoubleStubLesson({
        ...lessonContext, current, diagramLength1, diagramLength2, handoff,
      })} /></div></div></div>
    {reducedMotion && <p className="ss-motion-note">{t('Reduced motion is enabled: each Next shows the completed step.', 'El movimiento reducido está activado: cada pulsación de Siguiente muestra el paso completo.')}</p>}
  </section>;
}
