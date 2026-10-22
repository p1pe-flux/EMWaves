import { useId, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { applyLumpedStage, evaluateLumpedMatching, solveLumpedMatching, toLumpedMatchingInput } from '../domain/lumpedMatching';
import type { LumpedMatchingInput, LumpedMatchingStage, LumpedMatchingSolution, LumpedMatchingEvaluation } from '../domain/lumpedMatching';
import { classifyLumpedPhysicalLoadFeasibility, describeLumpedFeasibility } from '../domain/lumpedFeasibility';
import type { ComplexValue } from '../domain/transmission';
import { impedanceToReflection } from '../domain/transmission';
import { useI18n, translateMessage } from '../i18n';
import { complexTex, formatNumber, texNumber } from '../math/format';
import { Formula } from './Formula';
import { StepExplanation } from './StepExplanation';
import { SmithChart } from './SmithChart';
import type { SmithConstruction } from './SmithChart';
import { LCMatchingDiagram } from './LCMatchingDiagram';
import { LCFeasibilityLegend } from './LCFeasibilityLegend';
import { lumpedFeasibilityGeometry } from './lumpedFeasibilityGeometry';
import { LCMatchingBranchSummary, LCMatchingStatusSummary, formattedLCValue } from './LCMatchingBranchSummary';
import { getLCMatchingConstructionSteps, lcMatchingResultMilestones, type LCMatchingConstructionStep } from './lcMatchingPlayback';
import { clampLCProgress as clamp, easeLCProgress as ease, lcCirclePath, lcConstantRealLocus, lcGridFocus, lcMatchingReadings, lcReadingValue, lcStagePath } from './lcMatchingGeometry';
import type { LCReading } from './lcMatchingGeometry';
import { useStepPlayback } from './useStepPlayback';
import '../styles/lc-matching.css';

export interface LCMatchingConstructionProps { input: LumpedMatchingInput; solution?: LumpedMatchingSolution }
const CORAL = '#a95c3f';
const GREEN = '#3e806a';
const GOLD = '#a08149';
const BLUE = '#547eb1';
const physicalReflection = (value: ComplexValue | null) => value === null ? { re: 1, im: 0 } : impedanceToReflection(value);

type ExplanationTranslation = (english: string, spanish: string) => string;
type LCExplanationSnapshot = {
  input: LumpedMatchingInput;
  result: LumpedMatchingSolution;
  step: LCMatchingConstructionStep;
  stage: number;
  visual: number;
  completed: boolean;
  currentImpedance: ComplexValue | null;
  verified: LumpedMatchingEvaluation | null;
};

function getLCExplanation(snapshot: LCExplanationSnapshot, t: ExplanationTranslation, locale: 'en' | 'es'): ReactNode {
  const { input, result, step, visual, completed, currentImpedance, verified } = snapshot;
  const phase = step.phase;
  const branch = result.branches[step.branchIndex];
  const first = branch?.stages[0];
  const second = branch?.stages[1];
  const { first: firstReading, second: secondReading } = lcMatchingReadings(input);
  const loadConnection = input.elements[1].connection;
  const loadValue = lcReadingValue(result.normalizedLoad, firstReading);
  const componentEquation = (element: LumpedMatchingStage, amount: number) => {
    const index = element.elementIndex + 1;
    const symbol = element.component + '_' + index;
    const q = (element.connection === 'series' ? 'x_' : 'b_') + index;
    const definition = element.component === 'L'
      ? element.connection === 'series' ? '\\frac{\\omega ' + symbol + '}{Z_0}' : '-\\frac{Z_0}{\\omega ' + symbol + '}'
      : element.connection === 'series' ? '-\\frac{1}{\\omega ' + symbol + ' Z_0}' : '\\omega ' + symbol + ' Z_0';
    return q + '=' + definition + '=' + texNumber(element.normalizedValue * amount, 5);
  };
  const componentValueEquation = (element: LumpedMatchingStage, obtained: boolean) => {
    if (!branch || !obtained) return null;
    return <Formula display tex={formattedLCValue(element.component, branch.elements[element.elementIndex].value, element.elementIndex + 1).tex} />;
  };
  const caseTitle = result.status === 'continuous' ? t('A continuous family of matching networks', 'Una familia continua de redes adaptadas') : result.status === 'already-matched' ? t('The load is already matched', 'La carga ya está adaptada') : result.status === 'unmatchable' ? t('The load absorbs no real power', 'La carga no absorbe potencia real') : t('No positive, finite pair for this topology', 'No existe un par positivo y finito para esta topología');
  const boundTex = (value: number) => {
    if (value === 0 || Math.abs(value) >= 1e-8) return texNumber(value, 8);
    const [mantissa, exponent] = value.toExponential(5).split('e');
    return mantissa + '\\times10^{' + Number(exponent) + '}';
  };
  const familySymbol = result.family?.connection === 'series' ? 'x' : 'b';
  const caseExplanation = <div className="lc-matching__case" role="status">
    <h5>{caseTitle}</h5>
    <p>{result.status === 'continuous' ? t('Both elements preserve the same real part. Matching fixes the sum of their reactances or susceptances, while allowing different divisions between two positive, finite components.', 'Ambos elementos conservan la misma parte real. La adaptación fija la suma de sus reactancias o susceptancias, pero admite distintas distribuciones entre dos componentes positivos y finitos.') : translateMessage(result.message, locale)}</p>
    {result.family && <>
      <Formula display tex={familySymbol + '_1=' + (result.family.signs[0] === 1 ? 'q' : '-q') + ',\\quad ' + familySymbol + '_2=' + boundTex(result.family.totalNormalizedValue) + (result.family.signs[0] === 1 ? '-q' : '+q')} />
      <Formula display tex={result.family.maximum === null ? 'q>' + boundTex(result.family.minimum) : '0<q<' + boundTex(result.family.maximum)} />
      <p>{t('q is the positive normalized magnitude of element 1, on the generator side. Every value strictly inside these limits gives two positive, finite components.', 'q es la magnitud normalizada positiva del elemento 1, del lado del generador. Cada valor estrictamente dentro de estos límites da dos componentes positivos y finitos.')}</p>
    </>}
  </div>;

  let explanation: ReactNode;
  if (phase === 'load') explanation = <><p>{t('Normalization expresses the load impedance relative to the real line impedance. Matching requires a normalized input of one, so that there is no reflected wave.', 'La normalización expresa la impedancia de la carga respecto de la impedancia real de la línea. La adaptación requiere una entrada normalizada igual a uno, para que no haya onda reflejada.')}</p><Formula display tex={'z_L=\\frac{Z_L}{Z_0}=' + complexTex(result.normalizedLoad, 4)} /><Formula display tex={'\\Gamma_L=\\frac{z_L-1}{z_L+1}=' + complexTex(result.loadReflection, 4)} /><Formula display tex={'f=' + texNumber(input.frequencyHz / 1e9, 6) + '\\,\\mathrm{GHz},\\qquad\\omega=2\\pi f'} /><p>{t('Element 2 is next to the load and determines the impedance seen by element 1 on the generator side.', 'El elemento 2 está junto a la carga y determina la impedancia que recibe el elemento 1, del lado del generador.')}</p></>;
  else if (phase === 'read-load') explanation = <><p>{t('Element 2 is in parallel with the load. Their admittances add because both share the same voltage.', 'El elemento 2 se conecta en paralelo con la carga. Como ambos comparten el mismo voltaje, sus admitancias se suman.')}</p><Formula display tex={'y_L=\\frac{1}{z_L}=' + complexTex(loadValue, 4) + ',\\qquad\\Gamma_L=\\frac{1-y_L}{1+y_L}'} /></>;
  else if (phase === 'circles') explanation = <><p>{input.elements[0].connection === input.elements[1].connection ? t('With both elements in series or both in parallel, reactive contributions preserve the same real part. Its normalized value at the load must already be one for matching to be possible.', 'Con ambos componentes en serie o ambos en paralelo, las contribuciones reactivas conservan la misma parte real. Su valor normalizado en la carga debe ser uno para que la adaptación sea posible.') : loadConnection === 'series' ? t('The load-side series element preserves resistance. Its reactance must produce unit normalized conductance, so the generator-side parallel element can cancel the remaining susceptance.', 'El elemento en serie junto a la carga conserva la resistencia. Su reactancia debe producir una conductancia normalizada igual a uno; así, el elemento en paralelo del lado del generador puede cancelar la susceptancia restante.') : t('The load-side parallel element preserves conductance. Its susceptance must produce an equivalent impedance with unit normalized resistance; the generator-side series element can then cancel its reactance.', 'El elemento en paralelo junto a la carga conserva la conductancia. Su susceptancia debe producir una impedancia equivalente con resistencia normalizada igual a uno; el elemento en serie del lado del generador cancela entonces la reactancia restante.')}</p><Formula display tex={input.elements[0].connection === input.elements[1].connection ? (firstReading === 'impedance' ? '\\operatorname{Re}z=\\operatorname{Re}z_L,\\qquad\\operatorname{Re}z=1' : '\\operatorname{Re}y=\\operatorname{Re}y_L,\\qquad\\operatorname{Re}y=1') : (firstReading === 'impedance' ? '\\operatorname{Re}z=\\operatorname{Re}z_L,\\qquad\\operatorname{Re}y=1' : '\\operatorname{Re}y=\\operatorname{Re}y_L,\\qquad\\operatorname{Re}z=1')} /><p>{t('The intersections satisfy both real-part conditions. A realizable solution also requires two positive, finite component values with the signs imposed by their types.', 'Las intersecciones satisfacen ambas condiciones sobre la parte real. La solución exige además dos componentes positivos y finitos, con los signos reactivos de los tipos elegidos.')}</p><div className="ss-legend"><span><i style={{ background: GOLD }} />{t('Preserved load real part', 'Parte real conservada de la carga')}</span><span><i style={{ background: BLUE }} />{t('Required unit real part', 'Parte real unitaria necesaria')}</span></div></>;
  else if (phase === 'add-load' && first) explanation = <><p>{t('The component ', 'El componente ')}<Formula tex={first.component + '_' + (first.elementIndex + 1)} />{first.connection === 'series' ? t(' supplies the series reactance needed to reach unit normalized conductance while keeping the load resistance unchanged.', ' aporta la reactancia en serie necesaria para alcanzar una conductancia normalizada igual a uno, conservando la resistencia de la carga.') : t(' supplies the parallel susceptance needed to obtain unit normalized resistance while keeping the load conductance unchanged.', ' aporta la susceptancia en paralelo necesaria para obtener una resistencia normalizada igual a uno, conservando la conductancia de la carga.')}</p><Formula display tex={componentEquation(first, visual)} /><Formula display tex={(first.connection === 'series' ? 'z_1=z_L+\\iu x_' : 'y_1=y_L+\\iu b_') + (first.elementIndex + 1) + '=' + complexTex(lcReadingValue(currentImpedance, firstReading), 4)} />{componentValueEquation(first, completed)}<p>{t('Positive series reactance is inductive; negative series reactance is capacitive. In parallel, susceptance is negative for inductive behavior and positive for capacitive behavior.', 'Una reactancia en serie positiva es inductiva y una negativa es capacitiva. En paralelo, la susceptancia es negativa para el comportamiento inductivo y positiva para el capacitivo.')}</p></>;
  else if (phase === 'convert' && first) explanation = <><p>{secondReading === 'admittance' ? t('Element 1 is in parallel with the network formed by element 2 and the load. Their admittances add because both branches share the same voltage.', 'El elemento 1 está en paralelo con la red formada por el elemento 2 y la carga. Sus admitancias se suman porque ambas ramas comparten el mismo voltaje.') : t('Element 1 is in series with the network formed by element 2 and the load. Their impedances add because both carry the same current.', 'El elemento 1 está en serie con la red formada por el elemento 2 y la carga. Sus impedancias se suman porque comparten la misma intensidad de corriente.')}</p><Formula display tex={'z_1=' + complexTex(first.impedance, 4) + ',\\qquad y_1=' + complexTex(lcReadingValue(first.impedance, 'admittance'), 4)} /><Formula display tex={'\\Gamma_1=\\frac{z_1-1}{z_1+1}=\\frac{1-y_1}{1+y_1}'} /><p>{t('Both expressions describe the same equivalent network. Its resistance or conductance already meets the matching condition; the remaining imaginary part needs compensation.', 'Las dos expresiones representan la misma red equivalente. Su resistencia o conductancia ya cumple la condición de adaptación; falta compensar la parte imaginaria.')}</p></>;
  else if (phase === 'add-source' && second) explanation = <><p>{t('The component ', 'El componente ')}<Formula tex={second.component + '_' + (second.elementIndex + 1)} />{second.connection === 'series' ? t(' supplies an equal and opposite series reactance. The normalized resistance already equals one, so cancellation leaves a normalized input impedance of one.', ' aporta una reactancia en serie igual y opuesta a la restante. Como la resistencia normalizada ya vale uno, la cancelación deja una impedancia de entrada normalizada igual a uno.') : t(' supplies an equal and opposite parallel susceptance. The normalized conductance already equals one, so cancellation leaves a normalized input admittance of one.', ' aporta una susceptancia en paralelo igual y opuesta a la restante. Como la conductancia normalizada ya vale uno, la cancelación deja una admitancia de entrada normalizada igual a uno.')}</p><Formula display tex={componentEquation(second, visual)} /><Formula display tex={(second.connection === 'series' ? 'z_v=z_1+\\iu x_' : 'y_v=y_1+\\iu b_') + (second.elementIndex + 1) + '=' + complexTex(lcReadingValue(currentImpedance, secondReading), 4)} />{componentValueEquation(second, completed)}<p>{t('Once cancellation is complete, the ideal lossless network transfers all incident average power to the load.', 'Con la cancelación completa, la red ideal sin pérdidas transmite toda la potencia media incidente a la carga.')}</p></>;
  else if (phase === 'verify' && verified) explanation = <><p>{t('At the design frequency, the complete network presents a real input equal to the line impedance. Its reflection coefficient is zero, so no average power is reflected toward the generator.', 'A la frecuencia de diseño, la red completa presenta una entrada real e igual a la impedancia de la línea. El coeficiente de reflexión es cero y no vuelve potencia media hacia el generador.')}</p><Formula display tex={'Z_v=' + complexTex(verified.inputImpedance, 5) + '\\,\\Omega,\\qquad z_v=' + complexTex(verified.normalizedInput, 5)} /><Formula display tex={'|\\Gamma_v|=' + texNumber(verified.reflectionMagnitude, 9) + ',\\qquad\\mathrm{VSWR}=' + texNumber(verified.vswr, 6)} /></>;
  else if (phase === 'return') explanation = <p>{t('Another admissible intersection represents a different matching network for the same load and topology. Each solution has its own component values and independently satisfies the same input-match condition.', 'Otra intersección admisible representa una red de adaptación distinta para la misma carga y la misma topología. Cada solución tiene su propio par de valores y cumple por separado la misma condición de entrada adaptada.')}</p>;
  else explanation = caseExplanation;

  return explanation;
}

function getLCLesson(snapshot: LCExplanationSnapshot, t: ExplanationTranslation, locale: 'en' | 'es', active?: { titleId: string; playing: boolean }): ReactNode {
  const { stage, step, result } = snapshot;
  const branch = result.branches[step.branchIndex];
  const phase = step.phase;
  return <>
    <span className="section-kicker">{t('STEP ', 'PASO ')}{stage + 1}{branch && phase !== 'load' && phase !== 'read-load' && phase !== 'circles' ? t(' · SOLUTION', ' · SOLUCIÓN') : ''}</span>
    <h4 id={active?.titleId}>{t(step.title, step.spanishTitle)}</h4>
    <div key={step.key} aria-live={active && !active.playing ? 'polite' : 'off'}>{getLCExplanation(snapshot, t, locale)}</div>
  </>;
}

export function LCMatchingConstruction({ input: providedInput, solution: providedSolution }: LCMatchingConstructionProps) {
  const input = useMemo(() => toLumpedMatchingInput(providedInput), [providedInput]);
  const { locale, t } = useI18n();
  const prefix = 'lc-matching-' + useId().replaceAll(':', '');
  const workspace = useRef<HTMLElement>(null);
  const inputKey = JSON.stringify(input);
  const calculation = useMemo(() => {
    if (providedSolution !== undefined) return { result: providedSolution, error: null };
    try { return { result: solveLumpedMatching(input), error: null }; }
    catch (error) { return { result: null, error: error instanceof Error ? error : 'Enter valid line and load values.' }; }
  }, [input, providedSolution]);
  const result = calculation.result;
  const feasibilityGeometry = useMemo(() => lumpedFeasibilityGeometry(input), [input.elements[0].component, input.elements[0].connection, input.elements[1].component, input.elements[1].connection]);
  const loadConnection = input.elements[1].connection;
  const { first: firstReading, second: secondReading } = lcMatchingReadings(input);
  const steps = useMemo(() => getLCMatchingConstructionSteps(loadConnection === 'parallel', result?.branches.length ?? 0, result?.status === 'solved'), [loadConnection, result]);
  const { stage, progress, playing, direction, speed, setSpeed, reducedMotion, completed,
    canNext, canPrevious, next: advanceNext, previous: advancePrevious, restart } = useStepPlayback(steps, inputKey);
  const step = steps[stage];
  const branch = result?.branches[step.branchIndex];
  const verified = useMemo(() => branch ? evaluateLumpedMatching({ ...input, values: [branch.elements[0].value, branch.elements[1].value] }) : null,
    [branch, input]);
  const measurementVerifications = useMemo(() => {
    try {
      return result?.branches.map(candidate => evaluateLumpedMatching({
        ...input, values: [candidate.elements[0].value, candidate.elements[1].value],
      })) ?? [];
    } catch {
      return [];
    }
  }, [result, input]);
  const electricalGeometry = useMemo(() => result ? {
    feasibility: describeLumpedFeasibility(input),
    loadFeasibility: classifyLumpedPhysicalLoadFeasibility(input, input),
    branches: result.branches.map((candidate) => {
      const [first, second] = candidate.stages;
      const firstEnd = applyLumpedStage(result.normalizedLoad, first.connection, first.normalizedValue);
      return {
        first: lcStagePath(result.normalizedLoad, first.connection, first.normalizedValue),
        second: lcStagePath(firstEnd, second.connection, second.normalizedValue),
      };
    }),
    // Reuse feasibility classification (including exact boundary arithmetic)
    // and completed addition traces until an electrical input changes.
  } : null, [result, input]);


  const explanationMeasurements = useMemo(() => {
    if (!result) return [];
    try {
      return steps.flatMap((candidate, candidateStage) => {
        const candidateBranch = result.branches[candidate.branchIndex];
        const candidateFirst = candidateBranch?.stages[0];
        const candidateSecond = candidateBranch?.stages[1];
        const candidateImpedance = candidate.phase === 'add-load' || candidate.phase === 'convert'
          ? candidateFirst ? candidateFirst.impedance : result.normalizedLoad
          : candidate.phase === 'add-source' || candidate.phase === 'verify'
            ? candidateSecond ? candidateSecond.impedance : result.normalizedLoad
            : result.normalizedLoad;
        const candidateVerified = measurementVerifications[candidate.branchIndex] ?? null;
        if (candidate.phase === 'verify' && !candidateVerified) return [];
        return [getLCLesson({ input, result, step: candidate, stage: candidateStage, visual: 1, completed: true,
          currentImpedance: candidateImpedance, verified: candidateVerified }, t, locale)];
      });
    } catch {
      return [];
    }
  }, [result, input, steps, measurementVerifications, t, locale]);

  if (result === null) return <section className="ss-construction lc-matching-construction"><div className="ss-construction__toolbar"><LCMatchingStatusSummary message={translateMessage(calculation.error ?? '', locale)} /></div></section>;

  const phase = step.phase;
  const visual = ease(progress);
  const first = branch?.stages[0];
  const second = branch?.stages[1];
  const loadValue = lcReadingValue(result.normalizedLoad, firstReading);
  const afterFirst = phase === 'convert' || phase === 'add-source' || phase === 'verify';
  const afterConversion = phase === 'add-source' || phase === 'verify';
  const firstAmount = phase === 'add-load' ? visual : afterFirst ? 1 : 0;
  const secondAmount = phase === 'add-source' ? visual : phase === 'verify' ? 1 : 0;
  let reading = phase === 'load' || phase === 'read-load' ? 'impedance' as LCReading : afterConversion ? secondReading : firstReading;
  let gridFocus = phase === 'load' ? 0 : phase === 'read-load' ? lcGridFocus('impedance', firstReading, progress) : phase === 'convert' ? lcGridFocus(firstReading, secondReading, progress) : lcGridFocus(reading);
  let activeFirst = first;
  let activeSecond = second;
  let activeFirstAmount = firstAmount;
  let activeSecondAmount = secondAmount;

  // Most selected mixed topologies have one physical branch. If another exists,
  // remove its two contributions in reverse order before starting the next one.
  if (phase === 'return' && step.branchIndex > 0) {
    const previous = result.branches[step.branchIndex - 1];
    activeFirst = previous.stages[0];
    activeSecond = previous.stages[1];
    if (progress < 0.35) { reading = secondReading; gridFocus = lcGridFocus(secondReading); activeFirstAmount = 1; activeSecondAmount = 1 - ease(progress / 0.35); }
    else if (progress < 0.6) { reading = secondReading; gridFocus = lcGridFocus(secondReading, firstReading, (progress - 0.35) / 0.25); activeFirstAmount = 1; activeSecondAmount = 0; }
    else { reading = firstReading; gridFocus = lcGridFocus(firstReading); activeFirstAmount = 1 - ease((progress - 0.6) / 0.4); activeSecondAmount = 0; }
  }

  const partialFirst = activeFirst ? applyLumpedStage(result.normalizedLoad, activeFirst.connection, activeFirst.normalizedValue * activeFirstAmount) : result.normalizedLoad;
  const currentImpedance = activeSecond ? applyLumpedStage(partialFirst, activeSecond.connection, activeSecond.normalizedValue * activeSecondAmount) : partialFirst;
  const currentGamma = physicalReflection(currentImpedance);
  // Both grids share physical Γ. Reading y never moves the load, paths or zone.
  const feasibility = electricalGeometry!.feasibility;
  const loadFeasibility = electricalGeometry!.loadFeasibility;
  const trackedPoint = currentGamma;
  let trackedLabel = phase === 'load' ? 'z_L' : phase === 'read-load' ? progress >= 1 ? 'y_L' : 'z_L,\\ y_L' : (reading === 'impedance' ? 'z' : 'y') + (activeSecondAmount > 0 || phase === 'verify' ? '_v' : activeFirstAmount > 0 ? '_1' : '_L');
  if (phase === 'convert') trackedLabel = progress >= 1 ? (secondReading === 'impedance' ? 'z_1' : 'y_1') : 'z_1,\\ y_1';
  const construction: SmithConstruction = {
    grid: 'both', gridFocus, markers: [], circles: [], paths: [],
    ariaLabel: t('L–C matching, step ', 'Adaptación L–C, paso ') + (stage + 1) + ': ' + t(step.title, step.spanishTitle) + '. ' + t('Combined impedance and admittance grids at the same physical reflection coefficient.', 'Cuadrículas de impedancia y admitancia combinadas sobre el mismo coeficiente de reflexión físico.'),
  };
  construction.regions = feasibilityGeometry.loops.length ? [{
    id: 'lc-matchable-loads', loops: feasibilityGeometry.loops,
    color: GREEN, opacity: 0.2,
    ariaLabel: t('Original loads that can be matched by the selected L–C topology. Dashed boundaries are excluded.', 'Cargas originales que pueden adaptarse con la topología L–C elegida. Las fronteras discontinuas están excluidas.'),
  }] : [];
  feasibilityGeometry.excludedBoundaries.forEach((points, index) => construction.paths!.push({
    id: 'lc-feasibility-boundary-' + index, points, color: GREEN, dashed: true, opacity: 0.8,
  }));
  if (feasibilityGeometry.allowedCurve) construction.paths!.push({
    id: 'lc-feasibility-curve', points: feasibilityGeometry.allowedCurve, color: GREEN,
  });

  if (phase !== 'load' && phase !== 'read-load' && loadValue !== null && Number.isFinite(loadValue.re)) {
    const loci = [lcConstantRealLocus(loadValue.re, firstReading), lcConstantRealLocus(1, secondReading)];
    loci.forEach((locus, index) => {
      const reveal = phase === 'circles' ? ease(clamp(index === 0 ? progress / 0.6 : (progress - 0.35) / 0.65)) : 1;
      if (reveal >= 1) construction.circles!.push({ id: index === 0 ? 'load-constant-real' : 'required-unit-real', center: locus.center, radius: locus.radius, color: index === 0 ? GOLD : BLUE, dashed: index === 0 });
      else construction.paths!.push({ id: index === 0 ? 'load-locus-drawing' : 'target-locus-drawing', points: lcCirclePath(locus, reveal), color: index === 0 ? GOLD : BLUE, dashed: index === 0, opacity: reveal });
    });
    result.branches.forEach((candidate, index) => {
      if ((phase !== 'circles' && index !== step.branchIndex) || phase === 'add-source' || phase === 'verify') return;
      const point = candidate.stages[0].reflection;
      const coincident = Math.hypot(point.re - trackedPoint.re, point.im - trackedPoint.im) < 0.02;
      construction.markers!.push({ id: 'intersection-' + (index + 1), label: coincident ? '' : '\\mathrm{P}_' + (index + 1), point, color: BLUE, opacity: phase === 'circles' ? ease(clamp((progress - 0.8) / 0.2)) : 1 });
    });
  }
  if (activeFirst && activeFirstAmount > 0) {
    const geometryIndex = phase === 'return' && step.branchIndex > 0 ? step.branchIndex - 1 : step.branchIndex;
    construction.paths!.push({ id: 'load-element-addition', points: activeFirstAmount === 1 ? electricalGeometry!.branches[geometryIndex].first : lcStagePath(result.normalizedLoad, activeFirst.connection, activeFirst.normalizedValue, activeFirstAmount), color: BLUE });
    const loadReferenceLabel = (afterConversion || (phase === 'convert' && progress >= 1) ? secondReading : firstReading) === 'impedance' ? 'z_L' : 'y_L';
    construction.markers!.push({ id: 'load-reference', label: loadReferenceLabel, point: result.loadReflection, color: CORAL });
  }
  if (activeSecond && activeSecondAmount > 0) {
    const geometryIndex = phase === 'return' && step.branchIndex > 0 ? step.branchIndex - 1 : step.branchIndex;
    construction.paths!.push({ id: 'source-element-addition', points: activeFirstAmount === 1 && activeSecondAmount === 1 ? electricalGeometry!.branches[geometryIndex].second : lcStagePath(partialFirst, activeSecond.connection, activeSecond.normalizedValue, activeSecondAmount), color: GREEN });
    construction.markers!.push({ id: 'first-element-junction', label: reading === 'impedance' ? 'z_1' : 'y_1', point: activeFirst!.reflection, color: BLUE });
  }
  construction.markers!.push({ id: 'tracked-load', label: trackedLabel, point: trackedPoint, color: activeSecondAmount > 0 ? GREEN : activeFirstAmount > 0 ? BLUE : CORAL, opacity: phase === 'load' ? visual : 1 });

  const activeExplanation = getLCLesson({ input, result, step, stage, visual, completed, currentImpedance, verified }, t, locale, { titleId: prefix + '-title', playing });

  const milestones = lcMatchingResultMilestones(steps, { stepIndex: stage, completed });
  const obtained = milestones.get(step.branchIndex);
  const revealWorkspace = () => {
    const top = workspace.current?.getBoundingClientRect().top;
    if (top !== undefined && (top < 0 || top > 32)) workspace.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  };
  const next = () => { if (canNext) { revealWorkspace(); advanceNext(); } };
  const previous = () => { if (canPrevious) { revealWorkspace(); advancePrevious(); } };

  const visibleReading = phase === 'read-load' && progress >= 1 ? firstReading : phase === 'convert' && progress >= 1 ? secondReading : reading;
  return <section ref={workspace} className="ss-construction lc-matching-construction" aria-label={t('Two-element matching construction', 'Construcción de adaptación con dos elementos')} aria-busy={playing} data-stage={stage} data-stage-name={phase} data-step-key={step.key} data-stage-progress={progress.toFixed(3)} data-playing={playing} data-direction={direction === 1 ? 'forward' : 'reverse'} data-branch={step.branchIndex} data-tracked-quantity={trackedLabel} data-reading={visibleReading} data-chart-convention="physical-yz" data-grid-focus={gridFocus.toFixed(3)} data-lc-status={result.status} data-playback-speed={speed}>
    <div className="ss-construction__toolbar"><LCMatchingBranchSummary solution={result} steps={steps} position={{ stepIndex: stage, completed }} />
      <div className="ss-playback"><div className="ss-playback__buttons"><span className="ss-step-count">{stage + 1} / {steps.length}</span><button type="button" onClick={previous} aria-disabled={!canPrevious}>{t('Previous', 'Anterior')}</button><button type="button" className="ss-playback__next" onClick={next} aria-disabled={!canNext}>{t('Next', 'Siguiente')}</button><button type="button" onClick={restart}>{t('Restart', 'Reiniciar')}</button></div>
        <label className="ss-speed" htmlFor={prefix + '-speed'}><span>{t('Movement speed', 'Velocidad')}</span><output>{formatNumber(speed, 2)}×</output><input id={prefix + '-speed'} type="range" min="0.25" max="4" step="0.25" value={speed} aria-label={t('Movement speed', 'Velocidad')} aria-valuetext={formatNumber(speed, 2) + t(' times normal speed', ' veces la velocidad normal')} onChange={(event) => setSpeed(Number(event.target.value))} /></label>
      </div>
    </div>
    <div className="ss-construction__body"><div className="ss-construction__visual"><div className="ss-construction__chart"><SmithChart solution={null} length={0} showCurves={false} showGamma={false} showSwr={false} interactive={false} onSelectReflection={() => {}} construction={construction} /></div><LCFeasibilityLegend kind={feasibility.kind} classification={loadFeasibility} alreadyMatched={result.status === 'already-matched'} /></div>
      <div className="ss-construction__details"><div className="ss-construction__circuit"><LCMatchingDiagram input={input} values={branch ? [branch.elements[0].value, branch.elements[1].value] : undefined} progress={[activeSecondAmount, activeFirstAmount]} revealed={[!!obtained?.source, !!obtained?.load]} /></div>
        <div className="ss-construction__lesson" role="region" aria-labelledby={prefix + '-title'} tabIndex={0}><StepExplanation active={activeExplanation} measurements={explanationMeasurements} /></div>
      </div>
    </div>
    {reducedMotion && <p className="ss-motion-note">{t('Reduced motion is enabled: playback advances between completed steps.', 'La preferencia de movimiento reducido está activa: la reproducción avanza entre pasos completos.')}</p>}
  </section>;
}
