import { useEffect, useId, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { evaluateQuarterWave, solveQuarterWave } from '../domain/quarterWave';
import type { QuarterWaveInput, QuarterWaveSolution, QuarterWaveEvaluation } from '../domain/quarterWave';
import type { ComplexValue } from '../domain/transmission';
import { complexTex, formatNumber, texNumber } from '../math/format';
import { translateMessage, useI18n } from '../i18n';
import { Formula } from './Formula';
import { StepExplanation } from './StepExplanation';
import { SmithChart } from './SmithChart';
import type { SmithConstruction } from './SmithChart';
import { QuarterWaveDiagram } from './QuarterWaveDiagram';
import { QuarterWaveBranchSummary } from './QuarterWaveBranchSummary';
import { easeProgress, rotationPath } from './singleStubConstructionGeometry';
import { useStepPlayback } from './useStepPlayback';
import { quarterWaveSteps } from './quarterWavePlayback';
import type { QuarterWavePosition, QuarterWaveStep } from './quarterWavePlayback';
import { interpolateReference, quarterWaveCircle, quarterWaveReflection } from './quarterWaveGeometry';
import '../styles/single-stub.css';
import '../styles/quarter-wave.css';

export interface QuarterWaveConstructionProps {
  input: QuarterWaveInput;
  solution?: QuarterWaveSolution;
  onStepChange?: (position: QuarterWavePosition) => void;
  periodicDistance?: number;
  periodicTransformerLength?: number;
}
const CORAL = '#a95c3f', BLUE = '#547eb1', GREEN = '#3e806a', GOLD = '#a08149';
const clamp = (p: number) => Math.max(0, Math.min(1, p));
function partialPath(points: ComplexValue[], p: number): ComplexValue[] {
  return points.slice(0, Math.max(1, Math.ceil(clamp(p) * (points.length - 1)) + 1));
}
function labelLoad(input: QuarterWaveInput, t: (english: string, spanish: string) => string): string {
  if (input.load.kind === 'open') return t('Open circuit', 'Circuito abierto');
  if (input.load.kind === 'short') return t('Short circuit', 'Cortocircuito');
  return formatNumber(input.load.resistance) + (input.load.reactance === 0 ? '' : (input.load.reactance < 0 ? ' − j' : ' + j') + formatNumber(Math.abs(input.load.reactance))) + ' Ω';
}

type ExplanationTranslation = (english: string, spanish: string) => string;
type QuarterWaveExplanationSnapshot = {
  solution: QuarterWaveSolution;
  step: QuarterWaveStep;
  stage: number;
  progress: number;
  distance: number;
  transformerZ0: number;
  reference: number;
  activeLength: number;
  evaluated: QuarterWaveEvaluation;
  tracked: ComplexValue;
};

function quarterWaveStepTitle(step: QuarterWaveStep, t: ExplanationTranslation) {
  return t(step.title, {
    load: 'Representar la impedancia de carga',
    circles: 'Dibujar el círculo de ROE y encontrar impedancias reales',
    follow: 'Avanzar hasta una impedancia real',
    design: 'Calcular la impedancia del transformador',
    reference: 'Leer la misma resistencia usando Zₜ',
    transform: 'Recorrer el tramo de cuarto de onda',
    verify: 'Volver a Z₀ y verificar la adaptación',
  }[step.phase]);
}

function getQuarterWaveExplanation(snapshot: QuarterWaveExplanationSnapshot, t: ExplanationTranslation): ReactNode {
  const { solution, step, progress, distance, transformerZ0, reference, activeLength, evaluated, tracked } = snapshot;
  const branch = solution.branches[step.branchIndex];
  const isFollow = step.phase === 'follow';
  const handoff = step.branchIndex > 0 && isFollow;
  let explanation: ReactNode;
  if (step.phase === 'load') explanation = <><p>{t("Normalized impedance expresses the load relative to the characteristic impedance of the main line.", "La impedancia normalizada expresa la carga en relación con la impedancia característica de la línea principal.")}</p><Formula display tex={'z_L=Z_L/Z_0=' + complexTex(solution.normalizedLoad, 5)} /><p>{t("A load equal to the main-line impedance produces no reflected wave. Other loads have a nonzero reflection coefficient.", "Una carga igual a la impedancia de la línea principal no produce onda reflejada. Las demás cargas tienen un coeficiente de reflexión no nulo.")}</p></>;
  else if (step.phase === 'circles') explanation = <><p>{solution.branches.length === 1 ? t("This load already equals the main-line impedance. Every position is matched; zero distance is one representative realization.", "Esta carga ya es igual a la impedancia de la línea principal. Cualquier ubicación está adaptada; la distancia cero es una realización representativa.") : <>{t("A quarter-wave section transforms one real resistance into another. The two real-axis intersections are the positions where the main-line reactance vanishes.", "Un tramo de cuarto de onda transforma una resistencia real en otra. Las dos intersecciones con el eje real son las posiciones donde se anula la reactancia de la línea principal.")}</>}</p><Formula display tex={'\\operatorname{Im}Z_\\ell(d)=0,\\qquad\\Gamma(d)\\in\\mathbb{R}'} /><p>{t("Lossless propagation preserves the magnitude of the reflection coefficient and changes its phase, so every possible position belongs to the same SWR circle.", "La propagación sin pérdidas conserva el módulo del coeficiente de reflexión y modifica su fase; por eso, todas las posiciones posibles pertenecen al mismo círculo de ROE.")}</p></>;
  else if (isFollow) explanation = <><p>{handoff ? <>{t("The second branch is an alternative network for the same load ", "La segunda rama es una red alternativa para la misma carga ")}<Formula tex={'z_L'} />{t(". Its transformer is connected at ", ". Su transformador está conectado en ")}<Formula tex={'\\mathrm{P}_2'} />{t(', where the main line presents a different real resistance.', ', donde la línea principal presenta otra resistencia real.')}</> : branch.distance === 0 ? t("The load impedance is already real at this location. This branch therefore has the transformer directly at the load, without an intervening main-line section.", "La impedancia de carga ya es real en esta ubicación. El transformador de esta rama está directamente en la carga, sin un tramo intermedio de línea principal.") : <>{t("Propagation toward the generator changes the reflection phase while preserving its magnitude. The line reactance vanishes at ", "La propagación hacia el generador modifica la fase de la reflexión y conserva su módulo. La reactancia de la línea se anula en ")}<Formula tex={'\\mathrm{P}_1'} />{t(". The resulting real resistance is the load seen by the transformer.", ". La resistencia real resultante es la carga que ve el transformador.")}</>}</p><Formula display tex={'\\Gamma(d)=\\Gamma_L e^{-\\iu\\,2\\beta d}'} /><Formula display tex={'d/\\lambda=' + texNumber(distance, 7) + ',\\qquad Z_\\ell(d)=' + complexTex(evaluated.lineImpedance, 5) + '\\;\\Omega'} /></>;
  else if (step.phase === 'design') explanation = <><p>{t("The transformed load is the real resistance ", "La carga transformada es la resistencia real ")}<Formula tex={'R_' + (step.branchIndex + 1) + '=' + texNumber(branch.resistance, 5) + '\\;\\Omega'} />{t(". Matching requires the quarter-wave impedance inversion to produce ", ". La adaptación exige que la inversión de impedancia de un cuarto de onda produzca ")}<Formula tex={'Z_0'} />.</p><Formula display tex={'Z_v=\\frac{Z_t^2}{R_' + (step.branchIndex + 1) + '}=Z_0'} /><Formula display tex={'Z_t=\\sqrt{Z_0R_' + (step.branchIndex + 1) + '}=' + texNumber(transformerZ0, 6) + '\\;\\Omega'} /><Formula display tex={'\\beta_t\\ell_t=\\pi/2,\\qquad\\ell_t=\\lambda_t/4'} /></>;
  else if (step.phase === 'reference') explanation = <><p>{t("The same physical resistance is normalized by the characteristic impedance of the transformer. The physical impedance, line lengths, and reading plane remain unchanged.", "La misma resistencia física se normaliza con la impedancia característica del transformador. La impedancia física, las longitudes y el plano de lectura no cambian.")}</p><Formula display tex={'Z_{\\mathrm{ref}}=' + texNumber(reference, 5) + '\\;\\Omega,\\qquad z_\\ell=\\frac{R_' + (step.branchIndex + 1) + '}{Z_{\\mathrm{ref}}}=' + texNumber(branch.resistance / reference, 5)} /><p>{t("In this reference, lossless propagation through the transformer preserves the magnitude of its own reflection coefficient.", "En esta referencia, la propagación por el transformador sin pérdidas conserva el módulo de su propio coeficiente de reflexión.")}</p></>;
  else if (step.phase === 'transform') explanation = <><p>{t("A quarter wavelength changes the phase of the reflection coefficient by a half-turn in the ", "La propagación por un cuarto de longitud de onda produce un giro de media vuelta del coeficiente de reflexión en la referencia ")}<Formula tex={'Z_t'} />{t(" reference.", ".")}</p><Formula display tex={'Z^{(t)}(\\ell)=Z_t\\frac{R_i\\cos(\\beta_t\\ell)+\\iu Z_t\\sin(\\beta_t\\ell)}{Z_t\\cos(\\beta_t\\ell)+\\iu R_i\\sin(\\beta_t\\ell)}'} /><Formula display tex={'\\ell/\\lambda_t=' + texNumber(activeLength, 6) + ',\\qquad Z^{(t)}(\\ell)=' + complexTex(evaluated.inputImpedance, 5) + '\\;\\Omega'} /><p>{t("At a quarter wavelength, the physical input impedance equals ", "A un cuarto de longitud de onda, la impedancia física de entrada es ")}<Formula tex={'Z_0'} />{t(". Its normalized value in the transformer reference need not be one, even though it matches the main line.", ". Su valor normalizado en la referencia del transformador no tiene por qué ser uno, aunque esté adaptada a la línea principal.")}</p></>;
  else explanation = <><p>{t("An input impedance equal to the main-line impedance ", "Una impedancia de entrada igual a la de la línea principal ")}<Formula tex={'Z_0'} />{t(" produces no reflection for waves incident from that line. In this reference, the reflection coefficient is zero and the standing-wave ratio is one.", " no produce reflexión de las ondas que llegan por esa línea. En esta referencia, el coeficiente de reflexión es cero y la ROE es uno.")}</p><Formula display tex={'Z_v=' + complexTex(evaluated.inputImpedance, 6) + '\\;\\Omega'} />{progress >= 1 ? <><Formula display tex={'|\\Gamma_v|=' + texNumber(evaluated.reflectionMagnitude, 9) + ',\\qquad\\mathrm{VSWR}=' + texNumber(evaluated.vswr, 6)} /><p>{step.branchIndex < solution.branches.length - 1 ? t("This network is matched. The other real-axis intersection gives an alternative matching network.", "Esta red está adaptada. La otra intersección con el eje real da una red de adaptación alternativa.") : t("The positioning line and quarter-wave transformer together present the main-line impedance at the input.", "El tramo de ubicación y el transformador de cuarto de onda presentan conjuntamente la impedancia de la línea principal en la entrada.")}</p></> : <Formula display tex={'Z_{\\mathrm{ref}}=' + texNumber(reference, 5) + '\\;\\Omega,\\qquad |\\Gamma_{\\mathrm{ref}}|=' + texNumber(Math.hypot(tracked.re, tracked.im), 6)} />}</>;

  return explanation;
}

function getQuarterWaveLesson(snapshot: QuarterWaveExplanationSnapshot, t: ExplanationTranslation, active?: { titleId: string; playing: boolean }): ReactNode {
  const { stage, step } = snapshot;
  return <>
    <span className="section-kicker">{t('STEP', 'PASO')} {stage + 1}{stage >= 2 ? t(' · BRANCH ', ' · RAMA ') + (step.branchIndex + 1) : ''}</span>
    <h4 id={active?.titleId}>{quarterWaveStepTitle(step, t)}</h4>
    <div key={step.key} aria-live={active && !active.playing ? 'polite' : 'off'}>{getQuarterWaveExplanation(snapshot, t)}</div>
  </>;
}

export function QuarterWaveConstruction({ input, solution: providedSolution, onStepChange, periodicDistance = 0, periodicTransformerLength = 0 }: QuarterWaveConstructionProps) {
  const { locale, t } = useI18n();
  const inputKey = JSON.stringify(input);
  const calculation = useMemo(() => {
    if (providedSolution !== undefined) return { solution: providedSolution, error: null };
    try { return { solution: solveQuarterWave(input), error: null }; }
    catch (error) { return { solution: null, error: error instanceof Error ? error : 'Check the parameters.' }; }
  }, [input, providedSolution]);
  const solution = calculation.solution;
  const steps = useMemo(() => quarterWaveSteps(Math.max(1, solution?.branches.length ?? 0)), [solution]);
  const { stage, progress, playing, speed, setSpeed, reducedMotion, completed,
    canNext, canPrevious, next: advanceNext, previous: advancePrevious, restart } = useStepPlayback(steps, inputKey);
  const step = steps[stage];
  const stepTitle = quarterWaveStepTitle(step, t);
  const section = useRef<HTMLElement>(null);
  const prefix = 'quarter-wave-' + useId().replaceAll(':', '');

  const physicalPaths = useMemo(() => {
    if (!solution || solution.branches.length === 0) return { transformer: [], error: null };
    try {
      const branch = solution.branches[step.branchIndex];
      return {
        // The transform step keeps Zt fixed. Normalize these physical samples
        // once instead of repeating 121 conversions for every animation frame.
        transformer: Array.from({ length: 121 }, (_, i) => quarterWaveReflection(evaluateQuarterWave({ ...input, distance: branch.distance, transformerZ0: branch.transformerZ0, transformerLength: i / 480 }).inputImpedance, branch.transformerZ0)),
        error: null,
      };
    } catch (error) { return { transformer: [], error: error instanceof Error ? error : 'The construction is outside the numeric range.' }; }
  }, [solution, step.branchIndex, input]);
  const mainLinePaths = useMemo(() => solution ? {
    swr: quarterWaveCircle(Math.hypot(solution.loadReflection.re, solution.loadReflection.im), 1),
    rotations: solution.branches.map((branch) => rotationPath(solution.loadReflection, branch.distance)),
  } : null, [solution]);

  useEffect(() => { onStepChange?.({ stepIndex: stage, completed }); }, [stage, completed, onStepChange]);

  const explanationMeasurements = useMemo(() => {
    if (!solution || physicalPaths.error || solution.status === 'unmatchable') return [];
    try {
      return steps.flatMap((candidate, candidateStage) => {
        const candidateBranch = solution.branches[candidate.branchIndex];
        const candidateDistance = candidate.phase === 'load' || candidate.phase === 'circles' ? 0 : candidateBranch.distance;
        const candidateLength = candidate.phase === 'transform' || candidate.phase === 'verify' ? 0.25 : 0;
        const candidateReference = candidate.phase === 'reference' || candidate.phase === 'transform' ? candidateBranch.transformerZ0 : input.z0;
        const candidateEvaluation = evaluateQuarterWave({ ...input, distance: candidateDistance, transformerZ0: candidateBranch.transformerZ0, transformerLength: candidateLength });
        const snapshot: QuarterWaveExplanationSnapshot = {
          solution, step: candidate, stage: candidateStage, progress: 1, distance: candidateDistance,
          transformerZ0: candidateBranch.transformerZ0, reference: candidateReference, activeLength: candidateLength,
          evaluated: candidateEvaluation, tracked: quarterWaveReflection(candidateEvaluation.inputImpedance, candidateReference),
        };
        const measurements = [getQuarterWaveLesson(snapshot, t)];
        if (candidate.phase === 'verify' || candidate.phase === 'reference') {
          const from = candidate.phase === 'verify' ? candidateBranch.transformerZ0 : input.z0;
          const to = candidate.phase === 'verify' ? input.z0 : candidateBranch.transformerZ0;
          const intermediateReference = interpolateReference(from, to, 0.5);
          measurements.push(getQuarterWaveLesson({ ...snapshot, progress: 0.5, reference: intermediateReference,
            tracked: quarterWaveReflection(candidateEvaluation.inputImpedance, intermediateReference) }, t));
        }
        if (candidate.phase === 'transform') {
          for (const sampleProgress of [0, 0.5]) {
            const sampleLength = 0.25 * easeProgress(sampleProgress);
            const sampleEvaluation = evaluateQuarterWave({ ...input, distance: candidateDistance,
              transformerZ0: candidateBranch.transformerZ0, transformerLength: sampleLength });
            measurements.push(getQuarterWaveLesson({ ...snapshot, progress: sampleProgress, activeLength: sampleLength,
              evaluated: sampleEvaluation, tracked: quarterWaveReflection(sampleEvaluation.inputImpedance, candidateReference) }, t));
          }
        }
        return measurements;
      });
    } catch {
      // Sizing a future lesson must not change the active construction's error handling.
      return [];
    }
  }, [solution, steps, input, t, physicalPaths.error]);

  if (!solution || physicalPaths.error) return <div className="ss-empty" role="status">{translateMessage(calculation.error ?? physicalPaths.error ?? '', locale)}</div>;
  if (solution.status === 'unmatchable') return <div className="ss-empty" role="status"><h3>{t('This load cannot be matched by a lossless transformer', 'Esta carga no se puede adaptar con un transformador sin pérdidas')}</h3><p>{translateMessage(solution.message, locale)}</p></div>;
  const branch = solution.branches[step.branchIndex];
  const first = solution.branches[0];
  const p = easeProgress(progress);
  const isFollow = step.phase === 'follow';
  const handoff = step.branchIndex > 0 && isFollow;
  const unwinding = handoff && progress < 0.2;
  const returning = handoff && progress < 0.4;
  const travel = handoff ? easeProgress(clamp((progress - 0.4) / 0.6)) : p;
  const distance = step.phase === 'load' || step.phase === 'circles' ? 0 : returning ? first.distance * (unwinding ? 1 : 1 - easeProgress((progress - 0.2) / 0.2)) : isFollow ? branch.distance * travel : branch.distance;
  const transformerZ0 = unwinding ? first.transformerZ0 : branch.transformerZ0;
  const activeLength = unwinding ? 0.25 * (1 - easeProgress(progress / 0.2)) : step.phase === 'transform' ? 0.25 * p : step.phase === 'verify' ? 0.25 : 0;
  const reference = step.phase === 'reference' ? interpolateReference(input.z0, transformerZ0, p) : step.phase === 'transform' ? transformerZ0 : step.phase === 'verify' ? interpolateReference(transformerZ0, input.z0, p) : input.z0;
  let evaluated;
  try { evaluated = evaluateQuarterWave({ ...input, distance, transformerZ0, transformerLength: activeLength }); }
  catch (error) { return <div className="ss-empty" role="status">{translateMessage(error instanceof Error ? error : 'The construction is outside the numeric range.', locale)}</div>; }
  const tracked = quarterWaveReflection(evaluated.inputImpedance, reference);
  const loadPoint = quarterWaveReflection(solution.normalizedLoad === null ? null : { re: solution.normalizedLoad.re * input.z0, im: solution.normalizedLoad.im * input.z0 }, reference);
  const showTransformer = unwinding || ['reference', 'transform', 'verify'].includes(step.phase);
  const inMainLine = ['load', 'circles', 'follow', 'design'].includes(step.phase);
  const mainContextOpacity = inMainLine ? (returning ? unwinding ? 0 : easeProgress((progress - 0.2) / 0.2) : 1) : 0;
  const chart: SmithConstruction = { grid: 'impedance', markers: [], circles: [], paths: [], ariaLabel: t('Quarter-wave transformer, step ', 'Transformador de cuarto de onda, paso ') + (stage + 1) + ': ' + stepTitle + t('. Reference impedance ', '. Impedancia de referencia ') + formatNumber(reference, 5) + t(' ohms.', ' ohmios.') };
  const radius = Math.hypot(solution.loadReflection.re, solution.loadReflection.im);
  const circleReveal = step.phase === 'circles' ? p : step.phase === 'load' ? 0 : 1;
  if (circleReveal > 0 && mainContextOpacity > 0) {
    chart.paths!.push({ id: 'load-swr', points: circleReveal === 1 ? mainLinePaths!.swr : quarterWaveCircle(radius, circleReveal), color: GOLD, dashed: true, opacity: mainContextOpacity });
    chart.paths!.push({ id: 'real-axis', points: [{ re: -1, im: 0 }, { re: 1, im: 0 }], color: BLUE, opacity: circleReveal * 0.4 * mainContextOpacity });
    solution.branches.forEach((candidate, i) => {
      if (step.phase !== 'circles' && i !== step.branchIndex) return;
      const point = quarterWaveReflection({ re: candidate.resistance, im: 0 }, reference);
      const overlapping = Math.hypot(point.re - tracked.re, point.im - tracked.im) < 0.025;
      chart.markers!.push({ id: 'real-intersection-' + (i + 1), label: overlapping ? '' : '\\mathrm{P}_' + (i + 1), point, color: i === step.branchIndex ? CORAL : GOLD, opacity: (step.phase === 'circles' ? clamp((p - 0.7) / 0.3) : 1) * mainContextOpacity });
    });
  }
  if (mainContextOpacity > 0 && Math.hypot(loadPoint.re - tracked.re, loadPoint.im - tracked.im) > 0.02) chart.markers!.push({ id: 'original-load', label: 'z_L', point: loadPoint, color: CORAL, opacity: 0.7 * mainContextOpacity });
  if (distance > 0 && inMainLine && mainContextOpacity > 0) chart.paths!.push({ id: 'main-line-rotation', points: distance === branch.distance ? mainLinePaths!.rotations[step.branchIndex] : rotationPath(solution.loadReflection, distance), color: CORAL, opacity: mainContextOpacity });
  const transformerCircle = (step.phase === 'reference' && completed) || step.phase === 'transform';
  if (transformerCircle) {
    const transformerStart = quarterWaveReflection({ re: branch.resistance, im: 0 }, transformerZ0);
    chart.circles!.push({ id: 'transformer-swr', center: { re: 0, im: 0 }, radius: Math.abs(transformerStart.re), color: BLUE });
  }
  if (step.phase === 'reference' || step.phase === 'verify') {
    const from = step.phase === 'reference' ? input.z0 : transformerZ0;
    chart.paths!.push({ id: 'reference-change', points: Array.from({ length: 41 }, (_, i) => quarterWaveReflection(evaluated.inputImpedance, interpolateReference(from, reference, i / 40))), color: step.phase === 'verify' ? GREEN : BLUE });
  }
  if (step.phase === 'transform') {
    const points = partialPath(physicalPaths.transformer, p);
    points[points.length - 1] = tracked;
    chart.paths!.push({ id: 'quarter-wave-rotation', points, color: BLUE });
  }
  if (unwinding) chart.paths!.push({ id: 'remove-first-transformer', points: Array.from({ length: 65 }, (_, i) => evaluateQuarterWave({ ...input, distance: first.distance, transformerZ0: first.transformerZ0, transformerLength: activeLength * i / 64 }).reflection), color: GREEN });
  const trackedLabel = step.phase === 'load' || step.phase === 'circles' || (isFollow && distance === 0) ? 'z_L' : unwinding || step.phase === 'verify' ? 'z_v' : step.phase === 'transform' ? 'z^{(t)}(\\ell)' : 'z_\\ell(d)';
  chart.markers!.push({ id: 'tracked-quarter-wave', label: trackedLabel, point: tracked, color: step.phase === 'verify' || unwinding ? GREEN : step.phase === 'transform' || step.phase === 'reference' ? BLUE : CORAL, opacity: step.phase === 'load' ? p : 1 });

  const activeExplanation = getQuarterWaveLesson({ solution, step, stage, progress, distance, transformerZ0, reference, activeLength, evaluated, tracked }, t, { titleId: prefix + '-step', playing });

  function reveal() {
    const top = section.current?.getBoundingClientRect().top;
    if (top !== undefined && (top < 0 || top > 32)) section.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
  function next() { if (canNext) { reveal(); advanceNext(); } }
  function previous() { if (canPrevious) { reveal(); advancePrevious(); } }

  return <section ref={section} className="qw-construction ss-construction" aria-label={t('Quarter-wave matching construction', 'Construcción de adaptación de cuarto de onda')} aria-busy={playing} data-stage={stage} data-stage-name={step.phase} data-step-key={step.key} data-branch={step.branchIndex} data-playing={playing} data-stage-progress={progress.toFixed(3)} data-reference={reference} data-distance={distance} data-transformer-position={activeLength}>
    <div className="ss-construction__toolbar" style={{ marginTop: 0 }}><QuarterWaveBranchSummary solution={solution} position={{ stepIndex: stage, completed }} periodicDistance={periodicDistance} periodicTransformerLength={periodicTransformerLength} /><div className="ss-playback"><div className="ss-playback__buttons"><span className="ss-step-count">{stage + 1} / {steps.length}</span><button type="button" aria-disabled={!canPrevious} onClick={previous}>{t("Previous", "Anterior")}</button><button type="button" className="ss-playback__next" aria-disabled={!canNext} onClick={next}>{t("Next", "Siguiente")}</button><button type="button" onClick={restart}>{t("Restart", "Reiniciar")}</button></div><label className="ss-speed" htmlFor={prefix + '-speed'}><span>{t("Movement speed", "Velocidad")}</span><output>{formatNumber(speed, 2)}×</output><input id={prefix + '-speed'} aria-label={t('Movement speed', 'Velocidad')} aria-valuetext={formatNumber(speed, 2) + t(' times normal speed', ' veces la velocidad normal')} type="range" min="0.25" max="4" step="0.25" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} /></label></div></div>
    <div className="ss-construction__body"><div className="ss-construction__visual"><div className="ss-construction__chart"><SmithChart solution={null} length={0} showCurves={false} showGamma={false} showSwr={false} interactive={false} onSelectReflection={() => {}} construction={chart} /></div></div><div className="ss-construction__details"><div className="ss-construction__circuit"><QuarterWaveDiagram z0={input.z0} loadLabel={labelLoad(input, t)} distance={distance} transformerZ0={showTransformer ? transformerZ0 : null} transformerLength={0.25} showTransformer={showTransformer} activeTransformerProgress={showTransformer ? activeLength / 0.25 : undefined} periodicDistance={periodicDistance} periodicTransformerLength={periodicTransformerLength} /></div><div className="ss-construction__lesson" role="region" aria-labelledby={prefix + '-step'} tabIndex={0}><StepExplanation active={activeExplanation} measurements={explanationMeasurements} /></div></div></div>
    {reducedMotion && <p className="ss-motion-note">{t("Reduced motion is enabled.", "La preferencia de movimiento reducido está activa.")}</p>}
  </section>;
}
