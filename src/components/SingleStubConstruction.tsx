import { useI18n, translateMessage } from '../i18n';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { evaluateSingleStub, solveSingleStub } from '../domain/singleStub';
import type { SingleStubEvaluation, SingleStubInput, SingleStubSolution, StubTermination } from '../domain/singleStub';
import type { ComplexValue } from '../domain/transmission';
import { complexTex, formatNumber, texNumber } from '../math/format';
import { Formula } from './Formula';
import { SmithChart } from './SmithChart';
import type { SmithConstruction } from './SmithChart';
import { SingleStubDiagram } from './SingleStubDiagram';
import { SingleStubBranchSummary } from './SingleStubBranchSummary';
import { admittanceReflection, chartCancellationPath, chartPoint, constantSusceptancePath, easeProgress, reflectThroughCenter, reflectionAdmittance, rotateTowardGenerator, rotationPath } from './singleStubConstructionGeometry';
import { getSingleStubConstructionSteps, type SingleStubConstructionStep } from './singleStubPlayback';
import { StepExplanation } from './StepExplanation';
import { useStepPlayback } from './useStepPlayback';
import type { SingleStubStepPosition } from './singleStubResultMilestones';
import '../single-stub.css';

export interface SingleStubConstructionProps {
  input: SingleStubInput;
  solution?: SingleStubSolution;
  termination?: StubTermination;
  showTerminationControl?: boolean;
  onTerminationChange?: (termination: StubTermination) => void;
  onStepChange?: (position: SingleStubStepPosition) => void;
  periodicDistance?: number;
  periodicStubLength?: number;
}

const SPANISH_STEP_TITLES: Record<string, string> = {
  "Plot the load impedance": "Representar la impedancia de la carga",
  "Reflect through the center to read admittance": "Reflejar respecto del centro para leer admitancia",
  "Draw the SWR and unity-conductance circles": "Dibujar los círculos de ROE y conductancia unitaria",
  "Follow SWR to Re(y) = 1": "Seguir la ROE hasta Re(y) = 1",
  "Determine required stub admittance": "Determinar la admitancia necesaria del stub",
  "Build the isolated stub": "Construir el stub aislado",
  "Attach and verify": "Conectar y verificar"
};

const CORAL = '#a95c3f';
const GREEN = '#3e806a';
const GOLD = '#a08149';
const BLUE = '#547eb1';
const clamp = (value: number) => Math.max(0, Math.min(1, value));

function circleArc(center: ComplexValue, radius: number, progress: number): ComplexValue[] {
  return Array.from({ length: 97 }, (_, index) => {
    const angle = 2 * Math.PI * progress * index / 96;
    return { re: center.re + radius * Math.cos(angle), im: center.im + radius * Math.sin(angle) };
  });
}

function revealPath(points: ComplexValue[], progress: number): ComplexValue[] {
  const position = clamp(progress) * (points.length - 1);
  const index = Math.floor(position);
  if (index >= points.length - 1) return points;
  const fraction = position - index;
  const first = points[index];
  const second = points[index + 1];
  return [...points.slice(0, index + 1), { re: first.re + (second.re - first.re) * fraction, im: first.im + (second.im - first.im) * fraction }];
}

function mainReferencedStubPoint(input: SingleStubInput, distance: number, stubLength: number, termination: StubTermination): ComplexValue {
  const { stubSusceptance } = evaluateSingleStub({ ...input, distance, stubLength, termination });
  return Number.isFinite(stubSusceptance)
    ? chartPoint(admittanceReflection({ re: 0, im: stubSusceptance }), true)
    : { re: 1, im: 0 };
}

function loadText(input: SingleStubInput, t: (english: string, spanish: string) => string): string {
  if (input.load.kind === 'open') return t('Open circuit', 'Circuito abierto');
  if (input.load.kind === 'short') return t('Short circuit', 'Cortocircuito');
  const { resistance, reactance } = input.load;
  return formatNumber(resistance) + (reactance === 0 ? '' : (reactance < 0 ? ' − j' : ' + j') + formatNumber(Math.abs(reactance))) + ' Ω';
}

function singleStubDistance(result: SingleStubSolution, step: SingleStubConstructionStep, progress: number): number {
  const branch = result.branches[Math.min(Math.max(0, step.branchIndex), result.branches.length - 1)];
  if (step.phase === 'z_load' || step.phase === 'load' || step.phase === 'circles') return 0;
  if (step.phase !== 'follow') return branch.distance;
  const second = step.branchIndex === 1;
  if (second && progress < 0.3) {
    return result.branches[0].distance * (progress < 0.12 ? 1 : 1 - easeProgress((progress - 0.12) / 0.18));
  }
  return branch.distance * easeProgress(second ? clamp((progress - 0.3) / 0.7) : progress);
}

function singleStubVerificationReadings(z0: number, lineSusceptance: number, cancellationProgress: number, verified: SingleStubEvaluation) {
  const liveTotalAdmittance = { re: 1, im: lineSusceptance * (1 - cancellationProgress) };
  const liveReflection = admittanceReflection(liveTotalAdmittance);
  const liveMagnitude = Math.hypot(liveReflection.re, liveReflection.im);
  const reciprocalMagnitude = 1 / Math.hypot(1, liveTotalAdmittance.im);
  const liveImpedance = cancellationProgress >= 1 ? verified!.totalImpedance : {
    re: z0 * reciprocalMagnitude * reciprocalMagnitude,
    im: -z0 * (liveTotalAdmittance.im * reciprocalMagnitude) * reciprocalMagnitude,
  };
  const liveVswr = (1 + liveMagnitude) / (1 - liveMagnitude);
  return { liveTotalAdmittance, liveImpedance, liveMagnitude, liveVswr };
}

interface SingleStubLessonContext {
  result: SingleStubSolution;
  step: SingleStubConstructionStep;
  stepIndex: number;
  selectedTermination: StubTermination;
  t: (english: string, spanish: string) => string;
  headingId?: string;
  ariaLive?: 'off' | 'polite';
  readings: ReturnType<typeof singleStubVerificationReadings> & {
    distance: number;
    currentAdmittance: ComplexValue | null;
    stubLength: number;
    actionProgress: number;
    cancellationProgress: number;
    verified: SingleStubEvaluation;
  };
}

function renderSingleStubLesson({ result, step, stepIndex, selectedTermination, t, headingId, ariaLive, readings }: SingleStubLessonContext): ReactNode {
  const phase = step.phase;
  const isSecondBranch = step.branchIndex === 1;
  const branch = result.branches[Math.min(Math.max(0, step.branchIndex), result.branches.length - 1)];
  const { distance, currentAdmittance, stubLength, actionProgress, cancellationProgress, verified, liveTotalAdmittance, liveImpedance, liveMagnitude, liveVswr } = readings;
  let explanation: ReactNode;
  switch (phase) {
  case 'z_load':
    explanation = <>
      <p>{t('The load impedance is normalized to the line characteristic impedance. A matched load has ', 'La impedancia de la carga se normaliza respecto de la impedancia característica de la línea. Una carga adaptada cumple ')}<Formula tex="z_L=1" />.</p>
      <Formula display tex={'z_L=\\frac{Z_L}{Z_0}=' + complexTex(result.normalizedLoad, 4)} />
    </>;
    break;
  case 'load':
    explanation = <>
      <p>{t('The normalized load admittance is the reciprocal of its normalized impedance. Admittances add when the stub is connected in parallel.', 'La admitancia normalizada de la carga es el recíproco de su impedancia normalizada. Las admitancias se suman al conectar el stub en paralelo.')}</p>
      <Formula display tex={'y_L=1/z_L=' + complexTex(result.loadAdmittance, 4)} />
      <Formula display tex={'p_y=-\\Gamma_L,\\qquad d=0'} />
    </>;
    break;
  case 'circles':
    explanation = <>
      <p>{t('The stub is connected where the line conductance equals the reference conductance. At that section, only the imaginary part remains to be compensated.', 'El stub se conecta donde la conductancia de la línea es igual a la conductancia de referencia. En esa sección solo queda por compensar la parte imaginaria.')}</p>
      <Formula display tex={'|\\Gamma|=|\\Gamma_L|,\\qquad\\operatorname{Re}y=1'} />
      <p>{t('The intersections ', 'Las intersecciones ')}<Formula tex={'\\mathrm{P}_1'} />{t(' and ', ' y ')}<Formula tex={'\\mathrm{P}_2'} />{t(' identify the locations that satisfy this condition.', ' identifican las ubicaciones que cumplen esta condición.')}</p>
      <div className="ss-legend"><span><i style={{ background: GOLD }} />{t('Constant SWR', 'ROE constante')}</span><span><i style={{ background: BLUE }} />{t('Unity conductance', 'Conductancia unitaria')}</span></div>
    </>;
    break;
  case 'follow':
    explanation = <>
      <p>{isSecondBranch
        ? t('The second location P₂ also has unit normalized conductance, with a different susceptance. It gives another line distance and stub length that match the same load.', 'La segunda ubicación P₂ también tiene conductancia normalizada unitaria, con una susceptancia distinta. Se obtiene otra combinación de distancia y longitud de stub que adapta la misma carga.')
        : t('The line section transforms the load admittance. The distance d is chosen so that, at P₁, the normalized conductance is one and the stub only needs to compensate the susceptance.', 'El tramo de línea transforma la admitancia de la carga. La distancia d se elige para que, en P₁, la conductancia normalizada sea uno y el stub solo deba compensar la susceptancia.')}</p>
      <Formula display tex={'d/\\lambda=' + texNumber(distance, 6) + ',\\qquad y_\\ell(d)=' + complexTex(currentAdmittance, 4)} />
      <Formula display tex={'\\operatorname{Re}y_\\ell(d)' + t('=1\\quad\\text{at the selected intersection}', '=1\\quad\\text{en la intersección elegida}')} />
      <div className="ss-legend"><span><i style={{ background: GOLD }} />{t('Constant SWR', 'ROE constante')}</span><span><i style={{ background: BLUE }} />{t('Unity conductance', 'Conductancia unitaria')}</span></div>
    </>;
    break;
  case 'cancel':
    explanation = <>
      <p>{t('At the connection section, the line admittance is ', 'En la sección de conexión, la admitancia de la línea es ')}<Formula tex={'y_\\ell(d)=' + complexTex(branch.lineAdmittance, 4)} />{t(' and its susceptance is ', ' y su susceptancia es ')}<Formula tex={'b_\\ell=\\operatorname{Im}y_\\ell(d)=' + texNumber(branch.lineAdmittance.im, 4)} />.</p>
      <p>{t('The stub must supply the opposite susceptance so their sum has no imaginary part:', 'El stub debe aportar la susceptancia opuesta para que la suma no tenga parte imaginaria:')} <Formula tex={'b_s=-b_\\ell=' + texNumber(branch.requiredSusceptance, 4)} />.</p>
      <Formula display tex={'y_{\\mathrm{stub}}=\\iu b_s,\\qquad y_v=y_\\ell(d)+y_{\\mathrm{stub}}=1'} />
      <div className="ss-legend"><span><i style={{ background: CORAL }} /><Formula tex={'\\operatorname{Im}y_\\ell=b_\\ell'} /></span><span><i style={{ background: BLUE }} /><Formula tex={'\\operatorname{Im}y_{\\mathrm{stub}}=b_s'} /></span></div>
    </>;
    break;
  case 'stub':
    explanation = <>
      <p>{t('The length of the ', 'La longitud del stub ')}{selectedTermination === 'open' ? t('open-circuited stub', 'abierto') : t('short-circuited stub', 'en cortocircuito')}{t(' is chosen to supply the required susceptance ', ' se elige para aportar la susceptancia necesaria ')}<Formula tex={'b_s=' + texNumber(branch.requiredSusceptance, 4)} />{t(' and cancel the imaginary part of the line admittance.', ' y cancelar la parte imaginaria de la admitancia de la línea.')}</p>
      <Formula display tex={selectedTermination === 'open' ? 'y_{\\mathrm{stub}}=\\iu\\frac{Z_0}{Z_{0s}}\\tan(\\beta_s\\ell_s)' : 'y_{\\mathrm{stub}}=-\\iu\\frac{Z_0}{Z_{0s}}\\cot(\\beta_s\\ell_s)'} />
      <Formula display tex={'\\ell_s/\\lambda_s=' + texNumber(stubLength * actionProgress, 6)} />
      <div className="ss-legend"><span><i style={{ background: CORAL }} /><Formula tex={'b_\\ell=' + texNumber(branch.lineAdmittance.im, 3)} /></span><span><i style={{ background: BLUE }} /><Formula tex={'b_s=' + texNumber(branch.requiredSusceptance, 3)} /></span></div>
    </>;
    break;
  case 'verify':
    explanation = <>
      <p>{t('Connecting the stub in parallel adds its admittance to that of the line. The match is obtained when the opposite susceptances cancel, leaving an input impedance equal to ', 'Al conectar el stub en paralelo se suma su admitancia a la de la línea. La adaptación se obtiene cuando las susceptancias opuestas se anulan y la impedancia de entrada queda igual a ')}<Formula tex="Z_0" />.</p>
      <Formula display tex={'y_v=' + complexTex(liveTotalAdmittance, 4)} />
      <Formula display tex={'Z_v=' + complexTex(liveImpedance, 4) + '\\;\\Omega'} />
      <Formula display tex={'|\\Gamma_v|=' + texNumber(cancellationProgress >= 1 ? verified!.reflectionMagnitude : liveMagnitude, 8) + ',\\qquad \\mathrm{VSWR}=' + texNumber(cancellationProgress >= 1 ? verified!.vswr : liveVswr, 5)} />
    </>;
    break;
  default: {
    const unhandledPhase: never = phase;
    throw new Error('Unhandled single-stub phase: ' + unhandledPhase);
  }
  }
  return <><span className="section-kicker">{t('STEP ', 'PASO ')}{stepIndex + 1}{phase !== 'z_load' && phase !== 'load' && phase !== 'circles' ? t(' · BRANCH ', ' · RAMA ') + (step.branchIndex + 1) : ''}</span><h4 id={headingId}>{t(step.title, SPANISH_STEP_TITLES[step.title] ?? step.title)}</h4><div key={step.key} aria-live={ariaLive}>{explanation}</div></>;
}

export function SingleStubConstruction({ input, solution: providedSolution, termination, showTerminationControl = true, onTerminationChange, onStepChange, periodicDistance = 0, periodicStubLength = 0 }: SingleStubConstructionProps) {
  const { locale, t } = useI18n();
  const STAGES = useMemo(() => getSingleStubConstructionSteps(), []);
  const prefix = 'single-stub-construction-' + useId().replaceAll(':', '');
  const workspaceRef = useRef<HTMLElement>(null);
  const [internalTermination, setInternalTermination] = useState<StubTermination>('short');
  const inputKey = JSON.stringify(input);
  const selectedTermination = termination ?? internalTermination;
  const { stage, progress, playing, direction, speed, setSpeed, reducedMotion, completed: stepCompleted,
    canNext, canPrevious, next: advanceNext, previous: advancePrevious, restart } = useStepPlayback(STAGES, inputKey + '|' + selectedTermination);
  const phase = STAGES[stage].phase;
  const stepTitle = t(STAGES[stage].title, SPANISH_STEP_TITLES[STAGES[stage].title] ?? STAGES[stage].title);
  const selectedIndex = STAGES[stage].branchIndex;
  const calculation = useMemo(() => {
    if (providedSolution !== undefined) return { result: providedSolution, error: null };
    try { return { result: solveSingleStub(input), error: null }; }
    catch (error) { return { result: null, error: error instanceof Error ? error : 'Enter valid line and load values.' }; }
  }, [input, providedSolution]);
  const verified = useMemo(() => {
    const result = calculation.result;
    if (result?.status !== 'solved') return null;
    const branch = result.branches[Math.min(Math.max(0, selectedIndex), result.branches.length - 1)];
    return evaluateSingleStub({ ...input, distance: branch.distance, stubLength: selectedTermination === 'open' ? branch.openLength : branch.shortLength, termination: selectedTermination });
  }, [calculation, selectedIndex, selectedTermination, input]);

  const guideStubPath = useMemo(() => {
    const result = calculation.result;
    if (result?.status !== 'solved') return [];
    const branch = result.branches[Math.min(Math.max(0, selectedIndex), result.branches.length - 1)];
    const length = selectedTermination === 'open' ? branch.openLength : branch.shortLength;
    return Array.from({ length: 121 }, (_, index) => mainReferencedStubPoint(input, branch.distance, length * index / 120, selectedTermination));
  }, [calculation, selectedIndex, selectedTermination, input]);
  const guideSusceptanceCurves = useMemo(() => {
    const result = calculation.result;
    if (result?.status !== 'solved') return null;
    const branch = result.branches[Math.min(Math.max(0, selectedIndex), result.branches.length - 1)];
    return { line: constantSusceptancePath(branch.lineAdmittance.im), stub: constantSusceptancePath(branch.requiredSusceptance) };
  }, [calculation, selectedIndex]);
  const fixedGeometry = useMemo(() => {
    const result = calculation.result;
    if (result?.status !== 'solved') return null;
    const radius = Math.hypot(result.loadReflection.re, result.loadReflection.im);
    return {
      swr: circleArc({ re: 0, im: 0 }, radius, 1),
      unity: circleArc({ re: 0.5, im: 0 }, 0.5, 1),
      rotations: result.branches.map((branch) => rotationPath(chartPoint(result.loadReflection, true), branch.distance)),
      firstLine: constantSusceptancePath(result.branches[0].lineAdmittance.im),
      firstStub: constantSusceptancePath(result.branches[0].requiredSusceptance),
    };
  }, [calculation]);

  const lessonMeasurements = useMemo(() => {
    const result = calculation.result;
    if (result?.status !== 'solved') return [];
    const verifiedBranches = result.branches.map(branch => evaluateSingleStub({ ...input, distance: branch.distance, stubLength: selectedTermination === 'open' ? branch.openLength : branch.shortLength, termination: selectedTermination }));
    return STAGES.flatMap((step, stepIndex) => {
      const branchIndex = Math.min(Math.max(0, step.branchIndex), result.branches.length - 1);
      const branch = result.branches[branchIndex];
      const verified = verifiedBranches[branchIndex];
      const snapshots = step.phase === 'follow' && step.branchIndex === 1 ? [0, 0.3, 0.5, 1]
        : step.phase === 'follow' || step.phase === 'stub' || step.phase === 'verify' ? [0, 0.5, 1] : [1];
      return snapshots.map(progress => {
        const distance = singleStubDistance(result, step, progress);
        const cancellationProgress = step.phase === 'verify' ? easeProgress(progress) : 0;
        return renderSingleStubLesson({ result, step, stepIndex, selectedTermination, t, readings: {
          distance,
          currentAdmittance: reflectionAdmittance(rotateTowardGenerator(result.loadReflection, distance)),
          stubLength: selectedTermination === 'open' ? branch.openLength : branch.shortLength,
          actionProgress: easeProgress(progress), cancellationProgress, verified,
          ...singleStubVerificationReadings(input.z0, branch.lineAdmittance.im, cancellationProgress, verified),
        } });
      });
    });
  }, [calculation.result, input, selectedTermination, STAGES, t]);

  useEffect(() => { onStepChange?.({ stepIndex: stage, completed: stepCompleted }); }, [stage, stepCompleted, onStepChange]);

  const result = calculation.result;
  if (result === null) return <div className="ss-empty" role="status">{translateMessage(calculation.error ?? '', locale)}</div>;
  if (result.status !== 'solved') {
    return <div className="ss-empty" role="status"><h3>{result.status === 'already-matched' ? t('The load is already matched', 'La carga ya está adaptada') : t('This load cannot be matched with a lossless shunt stub', 'Esta carga no se puede adaptar con un stub en paralelo sin pérdidas')}</h3><p>{translateMessage(result.message, locale)}</p>{result.status === 'already-matched' && <Formula display tex={'y_L=1,\\qquad b_s=0,\\qquad\\Gamma=0'} />}</div>;
  }
  const branch = result.branches[Math.min(Math.max(0, selectedIndex), result.branches.length - 1)];
  const stubLength = selectedTermination === 'open' ? branch.openLength : branch.shortLength;
  const isZLoad = phase === 'z_load';
  const isLoad = phase === 'load';
  const isCircles = phase === 'circles';
  const isFollow = phase === 'follow';
  const isCancel = phase === 'cancel';
  const isStub = phase === 'stub';
  const isVerify = phase === 'verify';
  const isSecondBranch = selectedIndex === 1;
  const isSecondFollow = isSecondBranch && isFollow;
  const undoFirstStub = isSecondFollow && progress < 0.12;
  const returnToLoad = isSecondFollow && progress < 0.3;
  const firstBranch = result.branches[0];
  const firstStubLength = selectedTermination === 'open' ? firstBranch.openLength : firstBranch.shortLength;
  const firstCancellation = undoFirstStub ? 1 - easeProgress(progress / 0.12) : 0;
  const visualProgress = easeProgress(progress);
  const circlesProgress = isCircles ? visualProgress : isZLoad || isLoad ? 0 : 1;
  const followingProgress = isFollow ? easeProgress(isSecondBranch ? clamp((progress - 0.3) / 0.7) : progress) : isZLoad || isLoad || isCircles ? 0 : 1;
  const actionProgress = visualProgress;
  const distance = singleStubDistance(result, STAGES[stage], progress);
  const currentReflection = rotateTowardGenerator(result.loadReflection, distance);
  const currentAdmittance = reflectionAdmittance(currentReflection);
  const stubEndpoint = { re: selectedTermination === 'open' ? -1 : 1, im: 0 };
  const guideSelectedStubLength = isStub ? stubLength * actionProgress : stubLength;
  const guideActiveStubPoint = isStub || isVerify
    ? mainReferencedStubPoint(input, branch.distance, guideSelectedStubLength, selectedTermination)
    : null;
  const construction: SmithConstruction = {
    grid: 'impedance', markers: [], circles: [], paths: [],
    ariaLabel: t('Single-stub matching, step ', 'Adaptación con un stub, paso ') + (stage + 1) + t(', branch ', ', rama ') + (selectedIndex + 1) + ': ' + stepTitle + '. ' + (isZLoad ? t('Impedance', 'Impedancia') : t('Admittance', 'Admitancia')) + t(' reading on the standard Smith grid. Reference impedance ', ' en el diagrama de Smith habitual. Impedancia de referencia ') + input.z0 + t(' ohms.', ' ohmios.'),
  };

  let trackedPoint = chartPoint(currentReflection, !isZLoad);
  let trackedLabel = isZLoad ? 'z_L' : isLoad || isCircles || (isFollow && distance === 0) ? 'y_L' : 'y_\\ell(d)';
  let trackedOpacity = isZLoad ? visualProgress : 1;
  if (isLoad) {
    trackedPoint = reflectThroughCenter(result.loadReflection, visualProgress);
    trackedLabel = visualProgress < 0.5 ? 'z_L' : 'y_L';
    if (progress < 1) {
      construction.paths!.push({ id: 'admittance-diameter', points: [result.loadReflection, chartPoint(result.loadReflection, true)], color: GOLD, dashed: true, opacity: 0.75 * visualProgress });
      construction.markers!.push({ id: 'impedance-origin', label: '', point: result.loadReflection, color: CORAL, opacity: visualProgress });
    }
  }
  if (!isZLoad && !isLoad) {
    const radius = Math.hypot(result.loadReflection.re, result.loadReflection.im);
    const swrReveal = clamp(circlesProgress / 0.55);
    const conductanceReveal = clamp((circlesProgress - 0.3) / 0.55);
    const intersectionReveal = clamp((circlesProgress - 0.75) / 0.25);
    construction.circles!.push({ id: 'swr', center: { re: 0, im: 0 }, radius, color: GOLD, dashed: true, opacity: swrReveal });
    construction.circles!.push({ id: 'unity-conductance', center: { re: 0.5, im: 0 }, radius: 0.5, color: BLUE, opacity: conductanceReveal });
    construction.paths!.push({ id: 'swr-drawing', points: swrReveal === 1 ? fixedGeometry!.swr : circleArc({ re: 0, im: 0 }, radius, swrReveal), color: GOLD, dashed: true, opacity: swrReveal });
    construction.paths!.push({ id: 'unity-drawing', points: conductanceReveal === 1 ? fixedGeometry!.unity : circleArc({ re: 0.5, im: 0 }, 0.5, conductanceReveal), color: BLUE, opacity: conductanceReveal });
    result.branches.forEach((candidate, index) => {
      if (!isCircles && index !== selectedIndex) return;
      const trackedAtTarget = Math.hypot(candidate.reflection.re - currentReflection.re, candidate.reflection.im - currentReflection.im) < 0.015;
      construction.markers!.push({ id: 'intersection-' + (index + 1), label: (index === selectedIndex || (returnToLoad && index === 0)) && trackedAtTarget ? '' : '\\mathrm{P}_' + (index + 1), point: chartPoint(candidate.reflection, true), color: index === selectedIndex ? CORAL : GOLD, opacity: intersectionReveal });
    });
    construction.markers!.push({ id: 'load-background', label: distance > 0 ? 'y_L' : '', point: chartPoint(result.loadReflection, true), color: CORAL, opacity: 1 });
    if (!isCircles) construction.paths!.push({ id: 'line-rotation', points: distance === branch.distance ? fixedGeometry!.rotations[selectedIndex] : rotationPath(chartPoint(result.loadReflection, true), distance), color: CORAL, opacity: isSecondFollow ? 1 : followingProgress });
    if (undoFirstStub) {
      const path = chartCancellationPath(firstBranch.lineAdmittance.im, firstCancellation);
      trackedPoint = path.at(-1)!;
      trackedLabel = 'y_v';
      construction.paths!.push({ id: 'first-branch-cancellation', points: path, color: GREEN });
      construction.paths!.push({ id: 'first-line-susceptance', points: fixedGeometry!.firstLine, color: CORAL, opacity: firstCancellation });
      construction.paths!.push({ id: 'first-stub-susceptance', points: fixedGeometry!.firstStub, color: BLUE, opacity: firstCancellation });
      construction.circles!.push({ id: 'first-stub-boundary', center: { re: 0, im: 0 }, radius: 1, color: BLUE, opacity: firstCancellation });
      construction.markers!.push({ id: 'first-stub-final', label: 'y_{\\mathrm{stub}}', point: mainReferencedStubPoint(input, firstBranch.distance, firstStubLength, selectedTermination), color: BLUE, opacity: firstCancellation });
    }

  }
  if (isCancel || isStub || isVerify) {
    const lineReveal = isCancel ? easeProgress(clamp(progress / 0.5)) : 1;
    const stubReveal = isCancel ? easeProgress(clamp((progress - 0.5) / 0.5)) : 1;
    const lineCurve = guideSusceptanceCurves!.line;
    const stubCurve = guideSusceptanceCurves!.stub;
    construction.paths!.push({ id: 'line-susceptance', points: revealPath(lineCurve, lineReveal), color: CORAL, opacity: lineReveal, dataSusceptance: branch.lineAdmittance.im });
    construction.paths!.push({ id: 'stub-susceptance', points: revealPath(stubCurve, stubReveal), color: BLUE, opacity: stubReveal, dataSusceptance: branch.requiredSusceptance });
    const stubAtTarget = guideActiveStubPoint !== null && Math.hypot(guideActiveStubPoint.re - stubCurve[0].re, guideActiveStubPoint.im - stubCurve[0].im) < 0.02;
    construction.markers!.push({ id: 'required-stub', label: stubAtTarget ? '' : '\\iu b_s', point: stubCurve[0], color: BLUE, opacity: stubReveal });
    if (isStub || isVerify) construction.markers!.push({ id: 'line-junction', label: 'y_\\ell(d)', point: chartPoint(branch.reflection, true), color: CORAL });
  }
  if (isStub || isVerify) {
    construction.circles!.push({ id: 'stub-boundary', center: { re: 0, im: 0 }, radius: 1, color: BLUE, opacity: 1 });
    const point = guideActiveStubPoint!;
    const trace = revealPath(guideStubPath, isStub ? actionProgress : 1);
    // A completed reveal returns the memoized full trace. Only the newly
    // allocated partial trace needs an exact moving endpoint; never mutate
    // the shared completed path during verification or reverse playback.
    if (trace !== guideStubPath) trace[trace.length - 1] = point;
    construction.paths!.push({ id: 'stub-rotation', points: trace, color: BLUE });
    construction.markers!.push({ id: 'stub-termination', label: selectedTermination === 'open' ? t('\\text{Open}', '\\text{Abierto}') : t('\\text{Short}', '\\text{Cortocircuito}'), point: stubEndpoint, color: BLUE });
    if (isStub) {
      trackedPoint = point;
      trackedLabel = 'y_{\\mathrm{stub}}';
      trackedOpacity = clamp(visualProgress / 0.08);
    } else {
      construction.markers!.push({ id: 'stub-final', label: 'y_{\\mathrm{stub}}', point, color: BLUE });
      trackedPoint = chartPoint(branch.reflection, true);
      trackedLabel = 'y_v';
      trackedOpacity = clamp(visualProgress / 0.08);
    }
  }

  const cancellationProgress = isVerify ? actionProgress : 0;
  if (isVerify) {
    const path = chartCancellationPath(branch.lineAdmittance.im, cancellationProgress);
    construction.paths!.push({ id: 'susceptance-cancellation', points: path, color: GREEN });
    trackedPoint = path.at(-1)!;
    trackedLabel = 'y_v';
  }
  construction.markers!.push({ id: 'tracked-load', label: trackedLabel, point: trackedPoint, color: trackedLabel === 'y_v' ? GREEN : trackedLabel === 'y_{\\mathrm{stub}}' ? BLUE : CORAL, opacity: trackedOpacity });

  const lessonReadings = {
    distance, currentAdmittance, stubLength, actionProgress, cancellationProgress, verified: verified!,
    ...singleStubVerificationReadings(input.z0, branch.lineAdmittance.im, cancellationProgress, verified!),
  };


  function nextStage() {
    if (!canNext) return;
    revealWorkspace();
    advanceNext();
  }

  function previousStage() {
    if (!canPrevious) return;
    revealWorkspace();
    advancePrevious();
  }

  function revealWorkspace() {
    const top = workspaceRef.current?.getBoundingClientRect().top;
    if (top !== undefined && (top < 0 || top > 32)) workspaceRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }

  return (
    <section ref={workspaceRef} className="ss-construction" aria-label={t("Single-stub matching construction", "Construcción de adaptación con un stub")} aria-busy={playing} data-variant="guide" data-stage={stage} data-stage-name={isLoad ? 'admittance' : phase} data-step-key={STAGES[stage].key} data-tracked-quantity={trackedLabel} data-stage-progress={progress.toFixed(3)} data-visual-progress={visualProgress.toFixed(3)} data-playing={playing} data-direction={direction === 1 ? 'forward' : 'reverse'} data-chart-convention="printed" data-branch={selectedIndex} data-termination={selectedTermination} data-playback-speed={speed} data-branch-handoff={returnToLoad}>
      <div className="ss-construction__toolbar" style={{ marginTop: 0 }}>
        <SingleStubBranchSummary solution={result} steps={STAGES} position={{ stepIndex: stage, completed: stepCompleted }} termination={selectedTermination} periodicDistance={periodicDistance} periodicStubLength={periodicStubLength} />
        <div className="ss-playback">
          <div className="ss-playback__buttons">
            <span className="ss-step-count">{stage + 1} / {STAGES.length}</span>
            <button type="button" onClick={previousStage} aria-disabled={!canPrevious}>{t("Previous", "Anterior")}</button>
            <button type="button" className="ss-playback__next" onClick={nextStage} aria-disabled={!canNext}>{t("Next", "Siguiente")}</button>
            <button type="button" onClick={restart}>{t("Restart", "Reiniciar")}</button>
          </div>
          <div className={showTerminationControl ? 'ss-stub-speed-row' : undefined}>
            {showTerminationControl && <div className="ss-construction__selectors"><div role="group" aria-label={t("Construction termination", "Terminación de la construcción")}>{(['short', 'open'] as const).map((item) => <button type="button" key={item} aria-pressed={selectedTermination === item} onClick={() => { setInternalTermination(item); onTerminationChange?.(item); }}>{item === 'open' ? t('Open stub', 'Stub abierto') : t('Short stub', 'Stub en cortocircuito')}</button>)}</div></div>}
            <label className="ss-speed" htmlFor={prefix + '-speed'}>
              <span>{t("Movement speed", "Velocidad")}</span><output>{formatNumber(speed, 2)}×</output>
              <input id={prefix + '-speed'} type="range" min="0.25" max="4" step="0.25" value={speed} aria-label={t("Movement speed", "Velocidad")} aria-valuetext={formatNumber(speed, 2) + t(' times normal speed', ' veces la velocidad normal')} onChange={(event) => setSpeed(Number(event.target.value))} />
            </label>
          </div>
        </div>
      </div>
      <div className="ss-construction__body">
        <div className="ss-construction__visual">
          <div className="ss-construction__chart"><SmithChart solution={null} length={0} showCurves={false} showGamma={false} showSwr={false} interactive={false} onSelectReflection={() => {}} construction={construction} /></div>
        </div>
        <div className="ss-construction__details">
          <div className="ss-construction__circuit"><SingleStubDiagram z0={input.z0} stubZ0={input.stubZ0} loadLabel={loadText(input, t)} distance={distance} stubLength={undoFirstStub ? firstStubLength : isStub ? stubLength * actionProgress : isVerify ? stubLength : 0} stubOpacity={undoFirstStub ? firstCancellation : 1} termination={selectedTermination} showStub={undoFirstStub || isStub || isVerify} attached={undoFirstStub || isVerify} periodicDistance={periodicDistance} periodicStubLength={periodicStubLength} />
          </div>
          <div className="ss-construction__lesson" role="region" aria-labelledby={prefix + '-step-title'} tabIndex={0}><StepExplanation measurements={lessonMeasurements} active={renderSingleStubLesson({ result, step: STAGES[stage], stepIndex: stage, selectedTermination, t, headingId: prefix + '-step-title', ariaLive: playing ? 'off' : 'polite', readings: lessonReadings })} /></div>
        </div>
      </div>
      {reducedMotion && <p className="ss-motion-note">{t("Reduced motion is enabled: playback advances between completed steps.", "La preferencia de movimiento reducido está activa: la reproducción avanza entre pasos completos.")}</p>}
    </section>
  );
}
