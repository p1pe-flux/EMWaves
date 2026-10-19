import { useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { evaluateSeriesStub, solveSeriesStub } from '../domain/seriesStub';
import type { SeriesStubEvaluation, SeriesStubInput, SeriesStubSolution } from '../domain/seriesStub';
import type { StubTermination } from '../domain/singleStub';
import type { ComplexValue } from '../domain/transmission';
import { impedanceToReflection } from '../domain/transmission';
import { useI18n, translateMessage } from '../i18n';
import { complexTex, formatNumber, texNumber } from '../math/format';
import { Formula } from './Formula';
import { SmithChart } from './SmithChart';
import type { SmithConstruction } from './SmithChart';
import { SeriesStubDiagram } from './SeriesStubDiagram';
import { SeriesStubBranchSummary } from './SeriesStubBranchSummary';
import { getSeriesStubConstructionSteps, type SeriesStubConstructionStep } from './seriesStubPlayback';
import { StepExplanation } from './StepExplanation';
import { useStepPlayback } from './useStepPlayback';
import { clampSeriesProgress as clamp, constantReactancePath, easeProgress, revealSeriesPath, rotateTowardGenerator, rotationPath, seriesCancellationPath, seriesCircleArc, seriesStubPath, seriesStubPoint } from './seriesStubGeometry';
import '../series-stub.css';

export interface SeriesStubConstructionProps {
  input: SeriesStubInput;
  solution?: SeriesStubSolution;
  termination?: StubTermination;
  showTerminationControl?: boolean;
  onTerminationChange?: (termination: StubTermination) => void;
}

const CORAL = '#a95c3f';
const GREEN = '#3e806a';
const GOLD = '#a08149';
const BLUE = '#547eb1';

function seriesStubDistance(result: SeriesStubSolution, step: SeriesStubConstructionStep, progress: number): number {
  const branch = result.branches[step.branchIndex];
  if (step.phase === 'load' || step.phase === 'circles') return 0;
  if (step.phase !== 'follow') return branch.distance;
  const second = step.branchIndex > 0;
  if (second && progress < 0.4) {
    return result.branches[0].distance * (progress < 0.15 ? 1 : 1 - easeProgress((progress - 0.15) / 0.25));
  }
  return branch.distance * easeProgress(second ? clamp((progress - 0.4) / 0.6) : progress);
}

function seriesStubVerificationReadings(z0: number, lineImpedance: ComplexValue, cancellation: number) {
  const liveTotal = { re: lineImpedance.re, im: lineImpedance.im * (1 - cancellation) };
  const liveReflection = impedanceToReflection(liveTotal);
  const liveMagnitude = Math.hypot(liveReflection.re, liveReflection.im);
  const liveImpedance = { re: liveTotal.re * z0, im: liveTotal.im * z0 };
  return { liveTotal, liveImpedance, liveMagnitude };
}

interface SeriesStubLessonContext {
  result: SeriesStubSolution;
  step: SeriesStubConstructionStep;
  stepIndex: number;
  selectedTermination: StubTermination;
  t: (english: string, spanish: string) => string;
  headingId?: string;
  ariaLive?: 'off' | 'polite';
  readings: ReturnType<typeof seriesStubVerificationReadings> & {
    distance: number;
    currentLine: ComplexValue;
    stubLength: number;
    visual: number;
    cancellation: number;
    verified: SeriesStubEvaluation;
  };
}

function renderSeriesStubLesson({ result, step, stepIndex, selectedTermination, t, headingId, ariaLive, readings }: SeriesStubLessonContext): ReactNode {
  const branch = result.branches[step.branchIndex];
  const isLoad = step.phase === 'load';
  const isCircles = step.phase === 'circles';
  const isFollow = step.phase === 'follow';
  const isCancel = step.phase === 'cancel';
  const isStub = step.phase === 'stub';
  const secondFollow = step.branchIndex > 0 && isFollow;
  const { distance, currentLine, stubLength, visual, cancellation, verified, liveTotal, liveImpedance, liveMagnitude } = readings;
  let explanation: ReactNode;
  if (isLoad) explanation = <>
    <p>{t('The load impedance is normalized to the line characteristic impedance. A matched load has ', 'La impedancia de la carga se normaliza respecto de la impedancia característica de la línea. Una carga adaptada cumple ')}<Formula tex="z_L=1" />.</p>
    <Formula display tex={'z_L=\\frac{Z_L}{Z_0}=' + complexTex(result.normalizedLoad!, 4)} />
    <Formula display tex={'\\Gamma_L=\\frac{z_L-1}{z_L+1}=' + complexTex(result.loadReflection, 4)} />
  </>;
  else if (isCircles) explanation = <>
    <p>{t('The series stub compensates the remaining reactance at a section where the line resistance equals ', 'El stub en serie compensa la reactancia restante en una sección donde la resistencia de la línea es igual a ')}<Formula tex="Z_0" />{t('. This gives the unit normalized-resistance condition.', '. De aquí se obtiene la condición de resistencia normalizada unitaria.')}</p>
    <Formula display tex={'|\\Gamma|=|\\Gamma_L|,\\qquad\\operatorname{Re}z=1'} />
    <p>{t('The intersections P₁ and P₂ identify the locations that satisfy this condition.', 'Las intersecciones P₁ y P₂ identifican las ubicaciones que cumplen esta condición.')}</p>
    <div className="ss-legend"><span><i style={{ background: GOLD }} />{t('Constant SWR', 'ROE constante')}</span><span><i style={{ background: BLUE }} />{t('Unity resistance', 'Resistencia unitaria')}</span></div>
  </>;
  else if (isFollow) explanation = <>
    <p>{secondFollow
      ? t('P₂ is the other connection section where the line resistance equals Z₀. Its reactance requires a different stub length to match the same load.', 'P₂ es la otra sección de conexión donde la resistencia de la línea es igual a Z₀. Su reactancia requiere una longitud de stub distinta para adaptar la misma carga.')
      : t('Propagation through the line section transforms the load impedance. At P₁, the resistance equals Z₀; the series stub must compensate the remaining imaginary part.', 'La propagación por el tramo de línea transforma la impedancia de la carga. En P₁, la resistencia es igual a Z₀; el stub en serie debe compensar la parte imaginaria restante.')}</p>
    <Formula display tex={'\\Gamma(d)=\\Gamma_L e^{-\\iu2\\beta d}'} />
    <Formula display tex={'d=' + texNumber(distance, 6) + '\\,\\lambda,\\qquad z_\\ell(d)=' + complexTex(currentLine, 4)} />
  </>;
  else if (isCancel) explanation = <>
    <p>{t('Compensating the line reactance requires a stub reactance of the same magnitude and opposite sign. Their series sum then retains the resistance ', 'Para compensar la reactancia de la línea se requiere una reactancia de stub de igual magnitud y signo opuesto. Su suma en serie conserva entonces la resistencia ')}<Formula tex="Z_0" />.</p>
    <Formula display tex={'x_s=-\\operatorname{Im}z_\\ell(d)=' + texNumber(branch.requiredReactance, 4)} />
    <Formula display tex={'z_{\\mathrm{stub}}=\\iu x_s,\\qquad z_v=z_\\ell(d)+z_{\\mathrm{stub}}=1'} />
  </>;
  else if (isStub) explanation = <>
    <p>{t('The length of the ', 'La longitud del stub ')}{selectedTermination === 'short' ? t('short-circuited stub', 'en cortocircuito') : t('open-circuited stub', 'abierto')}{t(' is chosen to provide the normalized reactance ', ' se elige para obtener la reactancia normalizada ')}<Formula tex={'x_s=' + texNumber(branch.requiredReactance, 4)} />{t(' needed to cancel the line reactance.', ' necesaria para cancelar la reactancia de la línea.')}</p>
    <Formula display tex={selectedTermination === 'short' ? 'z_{\\mathrm{stub}}=\\iu\\frac{Z_{0s}}{Z_0}\\tan(\\beta_s\\ell_s)' : 'z_{\\mathrm{stub}}=-\\iu\\frac{Z_{0s}}{Z_0}\\cot(\\beta_s\\ell_s)'} />
    <Formula display tex={'\\ell_s=' + texNumber(stubLength * visual, 6) + '\\,\\lambda_s'} />
  </>;
  else explanation = <>
    <p>{t('The stub is connected in series with the line section. Its reactance cancels the line reactance, so the input impedance equals ', 'El stub se conecta en serie con el tramo de línea. Su reactancia cancela la de la línea, de modo que la impedancia de entrada resulta igual a ')}<Formula tex="Z_0" />{t(' when the compensation is complete.', ' al completarse la compensación.')}</p>
    <Formula display tex={'z_v=z_\\ell(d)+z_{\\mathrm{stub}}=' + complexTex(liveTotal, 4)} />
    <Formula display tex={'Z_v=' + complexTex(cancellation >= 1 ? verified!.totalImpedance! : liveImpedance, 4) + '\\;\\Omega'} />
    <Formula display tex={'|\\Gamma_v|=' + texNumber(cancellation >= 1 ? verified!.reflectionMagnitude : liveMagnitude, 8) + ',\\qquad\\mathrm{VSWR}=' + texNumber(cancellation >= 1 ? verified!.vswr : (1 + liveMagnitude) / (1 - liveMagnitude), 5)} />
  </>;
  return <><span className="section-kicker">{t('STEP ', 'PASO ')}{stepIndex + 1}{!isLoad && !isCircles ? t(' · BRANCH ', ' · RAMA ') + (step.branchIndex + 1) : ''}</span><h4 id={headingId}>{t(step.title, step.spanishTitle)}</h4><div key={step.key} aria-live={ariaLive}>{explanation}</div></>;
}

export function SeriesStubConstruction({ input, solution: providedSolution, termination, showTerminationControl = true, onTerminationChange }: SeriesStubConstructionProps) {
  const { locale, t } = useI18n();
  const prefix = 'series-stub-construction-' + useId().replaceAll(':', '');
  const workspace = useRef<HTMLElement>(null);
  const [internalTermination, setInternalTermination] = useState<StubTermination>('short');
  const selectedTermination = termination ?? internalTermination;
  const inputKey = JSON.stringify(input);
  const calculation = useMemo(() => {
    if (providedSolution !== undefined) return { result: providedSolution, error: null };
    try { return { result: solveSeriesStub(input), error: null }; }
    catch (error) { return { result: null, error: error instanceof Error ? error : 'Enter valid line and load values.' }; }
  }, [input, providedSolution]);
  const result = calculation.result;
  const branchCount = result?.status === 'solved' ? result.branches.length : 2;
  const steps = useMemo(() => getSeriesStubConstructionSteps(branchCount), [branchCount]);
  const { stage, progress, playing, direction, speed, setSpeed, reducedMotion, completed: stepCompleted,
    canNext, canPrevious, next: advanceNext, previous: advancePrevious, restart } = useStepPlayback(steps, inputKey + '|' + selectedTermination);
  const step = steps[stage];
  const selectedIndex = step.branchIndex;
  const verified = useMemo(() => {
    if (result?.status !== 'solved') return null;
    const branch = result.branches[selectedIndex];
    return evaluateSeriesStub({ ...input, distance: branch.distance, stubLength: selectedTermination === 'open' ? branch.openLength : branch.shortLength, termination: selectedTermination });
  }, [result, selectedIndex, selectedTermination, input]);
  // These loci and completed stub traces belong to the electrical solution,
  // not to the current animation frame. Reuse their exact samples while the
  // moving point and partial paths continue to be evaluated continuously.
  const branchGeometry = useMemo(() => result?.status === 'solved' ? result.branches.map((branch) => {
    const length = selectedTermination === 'open' ? branch.openLength : branch.shortLength;
    return {
      line: constantReactancePath(branch.lineImpedance.im),
      stub: constantReactancePath(branch.requiredReactance),
      trace: seriesStubPath(input.z0, input.stubZ0, length, selectedTermination),
      rotation: rotationPath(result.loadReflection, branch.distance),
    };
  }) : [], [result, selectedTermination, input.z0, input.stubZ0]);


  const lessonMeasurements = useMemo(() => {
    if (result?.status !== 'solved') return [];
    const verifiedBranches = result.branches.map(branch => evaluateSeriesStub({ ...input, distance: branch.distance, stubLength: selectedTermination === 'open' ? branch.openLength : branch.shortLength, termination: selectedTermination }));
    return steps.flatMap((step, stepIndex) => {
      const branch = result.branches[step.branchIndex];
      const verified = verifiedBranches[step.branchIndex];
      const snapshots = step.phase === 'follow' && step.branchIndex > 0 ? [0, 0.4, 0.5, 1]
        : step.phase === 'follow' || step.phase === 'stub' || step.phase === 'verify' ? [0, 0.5, 1] : [1];
      return snapshots.map(progress => {
        const distance = seriesStubDistance(result, step, progress);
        const cancellation = step.phase === 'verify' ? easeProgress(clamp((progress - 0.12) / 0.88)) : 0;
        return renderSeriesStubLesson({ result, step, stepIndex, selectedTermination, t, readings: {
          distance, currentLine: evaluateSeriesStub({ ...input, distance, stubLength: 0, termination: 'short' }).lineImpedance!,
          stubLength: selectedTermination === 'open' ? branch.openLength : branch.shortLength,
          visual: easeProgress(progress), cancellation, verified,
          ...seriesStubVerificationReadings(input.z0, branch.lineImpedance, cancellation),
        } });
      });
    });
  }, [result, input, selectedTermination, steps, t]);

  if (result === null) return <div className="ss-empty" role="status">{translateMessage(calculation.error ?? '', locale)}</div>;
  if (result.status !== 'solved') return <div className="ss-empty" role="status"><h3>{result.status === 'already-matched' ? t('The load is already matched', 'La carga ya está adaptada') : t('This load cannot be matched with a lossless series stub', 'Esta carga no se puede adaptar con un stub en serie sin pérdidas')}</h3><p>{translateMessage(result.message, locale)}</p>{result.status === 'already-matched' && <Formula display tex={'z_L=1,\\qquad x_s=0,\\qquad\\Gamma_v=0'} />}</div>;

  const branch = result.branches[selectedIndex];
  const stubLength = selectedTermination === 'open' ? branch.openLength : branch.shortLength;
  const firstBranch = result.branches[0];
  const firstLength = selectedTermination === 'open' ? firstBranch.openLength : firstBranch.shortLength;
  const { phase } = step;
  const isLoad = phase === 'load';
  const isCircles = phase === 'circles';
  const isFollow = phase === 'follow';
  const isCancel = phase === 'cancel';
  const isStub = phase === 'stub';
  const isVerify = phase === 'verify';
  const secondFollow = selectedIndex > 0 && isFollow;
  const undoStub = secondFollow && progress < 0.15;
  const returning = secondFollow && progress < 0.4;
  const firstCancellation = undoStub ? 1 - easeProgress(progress / 0.15) : 0;
  const visual = easeProgress(progress);
  const distance = seriesStubDistance(result, step, progress);
  const currentReflection = rotateTowardGenerator(result.loadReflection, distance);
  const currentLine = evaluateSeriesStub({ ...input, distance, stubLength: 0, termination: 'short' }).lineImpedance!;
  const cancellation = isVerify ? easeProgress(clamp((progress - 0.12) / 0.88)) : 0;
  const lessonReadings = {
    distance, currentLine, stubLength, visual, cancellation, verified: verified!,
    ...seriesStubVerificationReadings(input.z0, branch.lineImpedance, cancellation),
  };
  const construction: SmithConstruction = { grid: 'impedance', markers: [], circles: [], paths: [], ariaLabel: t('Series-stub matching, step ', 'Adaptación con un stub en serie, paso ') + (stage + 1) + ': ' + t(step.title, step.spanishTitle) + t('. Impedance reading on the fixed Smith grid, normalized to ', '. Lectura de impedancia en el diagrama de Smith fijo, normalizada a ') + input.z0 + t(' ohms.', ' ohmios.') };
  let trackedPoint: ComplexValue = currentReflection;
  let trackedLabel = isLoad || isCircles || (isFollow && distance === 0) ? 'z_L' : 'z_\\ell(d)';
  let trackedColor = CORAL;
  let trackedOpacity = isLoad ? visual : 1;

  if (!isLoad) {
    const circles = isCircles ? visual : 1;
    const swrReveal = clamp(circles / 0.6);
    const resistanceReveal = clamp((circles - 0.3) / 0.55);
    const intersectionReveal = clamp((circles - 0.78) / 0.22);
    const radius = Math.hypot(result.loadReflection.re, result.loadReflection.im);
    if (swrReveal >= 1) construction.circles!.push({ id: 'swr', center: { re: 0, im: 0 }, radius, color: GOLD, dashed: true });
    else construction.paths!.push({ id: 'swr-drawing', points: seriesCircleArc({ re: 0, im: 0 }, radius, swrReveal), color: GOLD, dashed: true, opacity: swrReveal });
    if (resistanceReveal >= 1) construction.circles!.push({ id: 'unity-resistance', center: { re: 0.5, im: 0 }, radius: 0.5, color: BLUE });
    else construction.paths!.push({ id: 'unity-resistance-drawing', points: seriesCircleArc({ re: 0.5, im: 0 }, 0.5, resistanceReveal), color: BLUE, opacity: resistanceReveal });
    result.branches.forEach((candidate, index) => {
      if (!isCircles && index !== selectedIndex) return;
      const coincident = Math.hypot(candidate.reflection.re - trackedPoint.re, candidate.reflection.im - trackedPoint.im) < 0.015;
      construction.markers!.push({ id: 'intersection-' + (index + 1), label: coincident ? '' : '\\mathrm{P}_' + (index + 1), point: candidate.reflection, color: index === selectedIndex ? CORAL : GOLD, opacity: intersectionReveal });
    });
    if (!isCircles) {
      construction.markers!.push({ id: 'load-background', label: distance > 0 ? 'z_L' : '', point: result.loadReflection, color: CORAL });
      construction.paths!.push({ id: 'line-rotation', points: distance === branch.distance ? branchGeometry[selectedIndex].rotation : rotationPath(result.loadReflection, distance), color: CORAL });
    }
  }

  const addRequiredCurves = (index: number, lineProgress: number, stubProgress: number, opacity = 1) => {
    const curves = branchGeometry[index];
    construction.paths!.push({ id: 'line-reactance', points: revealSeriesPath(curves.line, lineProgress), color: CORAL, opacity: lineProgress * opacity });
    construction.paths!.push({ id: 'stub-reactance', points: revealSeriesPath(curves.stub, stubProgress), color: BLUE, opacity: stubProgress * opacity });
    construction.markers!.push({ id: 'required-stub', label: isCancel ? '\\iu x_s' : '', point: curves.stub[0], color: BLUE, opacity: stubProgress * opacity });
  };

  if (isCancel || isStub || isVerify) {
    addRequiredCurves(selectedIndex, isCancel ? easeProgress(clamp(progress / 0.5)) : 1, isCancel ? easeProgress(clamp((progress - 0.5) / 0.5)) : 1);
    if (isStub || isVerify) construction.markers!.push({ id: 'line-junction', label: 'z_\\ell(d)', point: branch.reflection, color: CORAL });
  }

  if (undoStub) {
    const path = seriesCancellationPath(firstBranch.lineImpedance.im, firstCancellation);
    trackedPoint = path.at(-1)!;
    trackedLabel = 'z_v';
    trackedColor = GREEN;
    addRequiredCurves(0, 1, 1, firstCancellation);
    construction.paths!.push({ id: 'previous-cancellation', points: path, color: GREEN });
    construction.circles!.push({ id: 'stub-boundary', center: { re: 0, im: 0 }, radius: 1, color: BLUE, opacity: firstCancellation });
    construction.paths!.push({ id: 'previous-stub-path', points: branchGeometry[0].trace, color: BLUE, opacity: firstCancellation });
    construction.markers!.push({ id: 'stub-final', label: 'z_{\\mathrm{stub}}', point: seriesStubPoint(input.z0, input.stubZ0, firstLength, selectedTermination), color: BLUE, opacity: firstCancellation });
  }

  if (isStub || isVerify) {
    const length = isStub ? stubLength * visual : stubLength;
    const stubPoint = seriesStubPoint(input.z0, input.stubZ0, length, selectedTermination);
    construction.circles!.push({ id: 'stub-boundary', center: { re: 0, im: 0 }, radius: 1, color: BLUE, opacity: isStub ? clamp(progress / 0.12) : 1 });
    construction.paths!.push({ id: 'stub-rotation', points: isStub && visual < 1 ? seriesStubPath(input.z0, input.stubZ0, length, selectedTermination) : branchGeometry[selectedIndex].trace, color: BLUE, opacity: isStub ? clamp(progress / 0.12) : 1 });
    construction.markers!.push({ id: 'stub-termination', label: selectedTermination === 'open' ? t('\\text{Open}', '\\text{Abierto}') : t('\\text{Short}', '\\text{Cortocircuito}'), point: { re: selectedTermination === 'open' ? 1 : -1, im: 0 }, color: BLUE, opacity: isStub ? clamp(progress / 0.12) : 1 });
    if (isStub) { trackedPoint = stubPoint; trackedLabel = 'z_{\\mathrm{stub}}'; trackedColor = BLUE; trackedOpacity = clamp(progress / 0.12); }
    else {
      construction.markers!.push({ id: 'stub-final', label: 'z_{\\mathrm{stub}}', point: stubPoint, color: BLUE });
      const path = seriesCancellationPath(branch.lineImpedance.im, cancellation);
      construction.paths!.push({ id: 'series-cancellation', points: path, color: GREEN, opacity: clamp(progress / 0.12) });
      trackedPoint = path.at(-1)!;
      trackedLabel = 'z_v';
      trackedColor = GREEN;
      trackedOpacity = clamp(progress / 0.12);
    }
  }
  construction.markers!.push({ id: 'tracked-load', label: trackedLabel, point: trackedPoint, color: trackedColor, opacity: trackedOpacity });



  const revealWorkspace = () => {
    const top = workspace.current?.getBoundingClientRect().top;
    if (top !== undefined && (top < 0 || top > 32)) workspace.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  };
  const next = () => { if (canNext) { revealWorkspace(); advanceNext(); } };
  const previous = () => { if (canPrevious) { revealWorkspace(); advancePrevious(); } };
  const shownLength = undoStub ? firstLength : isStub ? stubLength * visual : isVerify ? stubLength : 0;

  return <section ref={workspace} className="ss-construction series-stub-construction" aria-label={t('Series-stub matching construction', 'Construcción de adaptación con un stub en serie')} aria-busy={playing} data-stage={stage} data-stage-name={phase} data-step-key={step.key} data-stage-progress={progress.toFixed(3)} data-visual-progress={visual.toFixed(3)} data-playing={playing} data-direction={direction === 1 ? 'forward' : 'reverse'} data-branch={selectedIndex} data-termination={selectedTermination} data-tracked-quantity={trackedLabel} data-chart-convention="printed" data-playback-speed={speed} data-branch-handoff={returning}>
    <div className="ss-construction__toolbar">
      <SeriesStubBranchSummary solution={result} steps={steps} position={{ stepIndex: stage, completed: stepCompleted }} termination={selectedTermination} />
      <div className="ss-playback"><div className="ss-playback__buttons"><span className="ss-step-count">{stage + 1} / {steps.length}</span><button type="button" onClick={previous} aria-disabled={!canPrevious}>{t('Previous', 'Anterior')}</button><button type="button" className="ss-playback__next" onClick={next} aria-disabled={!canNext}>{t('Next', 'Siguiente')}</button><button type="button" onClick={restart}>{t('Restart', 'Reiniciar')}</button></div>
        <div className={showTerminationControl ? 'ss-stub-speed-row' : undefined}>
          {showTerminationControl && <div className="ss-construction__selectors"><div role="group" aria-label={t('Construction termination', 'Terminación de la construcción')}>{(['short', 'open'] as const).map((item) => <button key={item} type="button" aria-pressed={selectedTermination === item} onClick={() => { setInternalTermination(item); onTerminationChange?.(item); }}>{item === 'short' ? t('Short stub', 'Stub en cortocircuito') : t('Open stub', 'Stub abierto')}</button>)}</div></div>}
          <label className="ss-speed" htmlFor={prefix + '-speed'}><span>{t('Movement speed', 'Velocidad')}</span><output>{formatNumber(speed, 2)}×</output><input id={prefix + '-speed'} type="range" min="0.25" max="4" step="0.25" value={speed} aria-label={t('Movement speed', 'Velocidad')} aria-valuetext={formatNumber(speed, 2) + t(' times normal speed', ' veces la velocidad normal')} onChange={(event) => setSpeed(Number(event.target.value))} /></label>
        </div>
      </div>
    </div>
    <div className="ss-construction__body"><div className="ss-construction__visual"><div className="ss-construction__chart"><SmithChart solution={null} length={0} showCurves={false} showGamma={false} showSwr={false} interactive={false} onSelectReflection={() => {}} construction={construction} /></div></div>
      <div className="ss-construction__details"><div className="ss-construction__circuit"><SeriesStubDiagram input={input} distance={distance} stubLength={shownLength} termination={selectedTermination} showStub={undoStub || isStub || isVerify} attached={isVerify || undoStub} attachmentProgress={undoStub ? firstCancellation : isVerify ? clamp(progress / 0.12) : 0} stubOpacity={undoStub ? firstCancellation : isStub ? clamp(progress / 0.12) : 1} /></div>
        <div className="ss-construction__lesson" role="region" aria-labelledby={prefix + '-title'} tabIndex={0}><StepExplanation measurements={lessonMeasurements} active={renderSeriesStubLesson({ result, step, stepIndex: stage, selectedTermination, t, headingId: prefix + '-title', ariaLive: playing ? 'off' : 'polite', readings: lessonReadings })} /></div>
      </div>
    </div>
    {reducedMotion && <p className="ss-motion-note">{t('Reduced motion is enabled: playback advances between completed steps.', 'La preferencia de movimiento reducido está activa: la reproducción avanza entre pasos completos.')}</p>}
  </section>;
}
