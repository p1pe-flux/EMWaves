/**
 * Pure README scenes, derived from the application's solvers and chart geometry.
 * No screenshots, browser state, timers, controls, or alternate matching solver.
 * All formula strings use ordinary TeX, without application-specific macros.
 */
import type { SmithConstruction } from '../src/components/SmithChart';
import type { ComplexValue } from '../src/domain/transmission';
import { solveSingleStub, evaluateSingleStub } from '../src/domain/singleStub';
import { solveQuarterWave, evaluateQuarterWave } from '../src/domain/quarterWave';
import { projectImpedance } from '../src/domain/smithProjection';
import { admittanceReflection, chartCancellationPath, chartPoint, constantSusceptancePath, reflectThroughCenter, reflectionAdmittance, rotateTowardGenerator, rotationPath } from '../src/components/singleStubConstructionGeometry';
import { interpolateReference, quarterWaveCircle, quarterWaveReflection } from '../src/components/quarterWaveGeometry';

export type ReadmeKind = 'smith' | 'single-stub' | 'quarter-wave';
export interface ReadmeLine { text?: string; tex?: string; color?: string }
export interface ReadmeField { label: string; value: string; color?: string }
export interface ReadmeCircuit {
  kind: 'stub' | 'quarter-wave';
  z0: number; loadLabel: string; distance: number;
  stubZ0?: number; stubLength?: number; termination?: 'open' | 'short';
  showStub?: boolean; attached?: boolean; stubOpacity?: number;
  transformerZ0?: number; transformerLength?: number;
  showTransformer?: boolean; activeTransformerProgress?: number; transformerOpacity?: number;
}
export interface ReadmeScene {
  kind: ReadmeKind; title: string; kicker: string; step: string; phase: string;
  progress: number; durationSeconds: number; contentOpacity: number;
  reference: number; referenceTex: string; chart?: SmithConstruction;
  projection?: { progress: number };
  circuit?: ReadmeCircuit;
  /** At most four lines; text and tex are mutually exclusive. */
  lines: ReadmeLine[];
  /** At most three fields. Values are TeX, labels are plain English. */
  fields: ReadmeField[];
}
export const README_SCENE_META = {
  smith: { durationSeconds: 16, fps: 50, posterTimeSeconds: 7.5, alt: 'The impedance grid continuously transforms into the Smith chart and back.' },
  'single-stub': { durationSeconds: 26, fps: 50, posterTimeSeconds: 15.2, alt: 'A generated first-branch single-stub construction reaches a verified match, then reverses continuously back to the load.' },
  'quarter-wave': { durationSeconds: 26, fps: 50, posterTimeSeconds: 15.2, alt: 'A generated first-branch quarter-wave construction reaches a verified match, then reverses continuously through the same references and line sections.' },
} as const;

const C = { teal: '#2e686c', line: '#a95c3f', stub: '#547eb1', input: '#3e806a', swr: '#a08149', quiet: '#87948b' };
const INPUT = { z0: 50, load: { kind: 'impedance' as const, resistance: 100, reactance: 50 } };
const STUB_INPUT = { ...INPUT, stubZ0: 50 };
const STUB = solveSingleStub(STUB_INPUT), QUARTER = solveQuarterWave(INPUT);
const SB = STUB.branches[0], QB = QUARTER.branches[0], ZERO = { re: 0, im: 0 };
const clamp = (p: number) => Math.max(0, Math.min(1, p));
const num = (v: number, digits = 4) => Math.abs(v) < 0.5 * 10 ** -digits ? '0' : String(Number(v.toFixed(digits)));
function cx(z: ComplexValue | null, digits = 4): string {
  if (z === null) return '\\infty';
  const re = num(z.re, digits), im = num(Math.abs(z.im), digits);
  if (im === '0') return re;
  const imaginary = '\\mathrm{j}' + (im === '1' ? '' : '\\,' + im);
  return re === '0' ? (z.im < 0 ? '-' : '') + imaginary : re + (z.im < 0 ? '-' : '+') + imaginary;
}
function loopTime(seconds: number, duration: number): number {
  return Number.isFinite(seconds) ? ((seconds % duration) + duration) % duration : 0;
}
/** A timing curve with zero velocity and acceleration at both operation boundaries. */
function sceneEase(value: number): number {
  const p = clamp(value);
  return clamp(p * p * p * (p * (p * 6 - 15) + 10));
}
/** Keep the complete forward construction, then undo the same physical states. */
function matchingTime(t: number, matchedAt: number): number {
  if (t < 16) return Math.min(t, matchedAt);
  if (t < 25) return matchedAt * (1 - (t - 16) / 9);
  return 0;
}
function phaseAt(t: number, stages: readonly (readonly [string, number])[]): { phase: string; index: number; p: number } {
  let start = 0;
  for (let i = 0; i < stages.length; i++) {
    const [phase, end] = stages[i];
    if (t < end) return { phase, index: i, p: sceneEase((t - start) / (end - start)) };
    start = end;
  }
  return { phase: stages.at(-1)![0], index: stages.length - 1, p: 1 };
}
function reveal(points: ComplexValue[], p: number): ComplexValue[] {
  const position = clamp(p) * (points.length - 1), i = Math.floor(position);
  if (i >= points.length - 1) return points;
  const a = points[i], b = points[i + 1], f = position - i;
  return [...points.slice(0, i + 1), { re: a.re + (b.re - a.re) * f, im: a.im + (b.im - a.im) * f }];
}
function circle(center: ComplexValue, radius: number, p: number): ComplexValue[] {
  return quarterWaveCircle(radius, p).map((v) => ({ re: v.re + center.re, im: v.im + center.im }));
}
function blank(label: string): SmithConstruction { return { grid: 'impedance', ariaLabel: label, markers: [], circles: [], paths: [] }; }
function stubPoint(length: number): ComplexValue {
  const b = evaluateSingleStub({ ...STUB_INPUT, distance: SB.distance, stubLength: length, termination: 'short' }).stubSusceptance;
  return Number.isFinite(b) ? chartPoint(admittanceReflection({ re: 0, im: b }), true) : { re: 1, im: 0 };
}
const STUB_PATH = Array.from({ length: 121 }, (_, i) => stubPoint(SB.shortLength * i / 120));
const LINE_B_PATH = constantSusceptancePath(SB.lineAdmittance.im);
const STUB_B_PATH = constantSusceptancePath(SB.requiredSusceptance);

function smith(t: number): ReadmeScene {
  const p = t < 1 ? 0 : t < 7.2 ? sceneEase((t - 1) / 6.2) : t < 8.8 ? 1 : t < 15 ? 1 - sceneEase((t - 8.8) / 6.2) : 0;
  const matchedPoint = projectImpedance({ re: 1, im: 0 }, p)!;
  return {
    kind: 'smith', title: 'The Smith chart, constructed', kicker: 'FROM IMPEDANCE TO REFLECTION',
    step: 'Straight lines become circles and arcs', phase: 'projection', progress: p,
    durationSeconds: README_SCENE_META.smith.durationSeconds, contentOpacity: 1, reference: 50, referenceTex: 'z=Z/Z_0', projection: { progress: p },
    lines: [
      { text: 'A continuous Möbius map turns the impedance plane into the Smith chart.' },
      { tex: 'w=\\frac{z\\cos\\theta-\\sin\\theta}{z\\sin\\theta+\\cos\\theta}' },
      { tex: '0\\leq\\theta\\leq\\frac{\\pi}{4}' },
      { tex: '\\theta=\\frac{\\pi}{4}\\quad\\Longrightarrow\\quad\\Gamma=\\frac{z-1}{z+1}' },
    ],
    fields: [
      { label: 'The matched load', value: 'z=1\\;\\longrightarrow\\;\\Gamma=0', color: C.input },
      { label: 'Current image of z = 1', value: 'w=' + num(matchedPoint.re), color: C.quiet },
    ],
  };
}

function singleStub(t: number): ReadmeScene {
  const stages = [['load', 1], ['admittance', 2.8], ['circles', 4.8], ['follow', 7.4], ['cancel', 9.6], ['stub', 12], ['verify', 14.2], ['hold', 16]] as const;
  const { phase, index: i, p } = phaseAt(t, stages), chart = blank('Single-stub matching on the unchanged standard Smith grid.');
  const yLoad = chartPoint(STUB.loadReflection, true);
  const distance = phase === 'follow' ? SB.distance * p : i >= 4 ? SB.distance : 0;
  const physical = rotateTowardGenerator(STUB.loadReflection, distance), yLine = reflectionAdmittance(physical);
  const point = chartPoint(physical, true), circleP = phase === 'circles' ? p : i > 2 ? 1 : 0;
  const showStub = i >= 5, verify = i >= 6, cancelP = phase === 'verify' ? p : phase === 'hold' ? 1 : 0;
  const length = phase === 'stub' ? SB.shortLength * p : i > 5 ? SB.shortLength : 0;
  const stubOpacity = phase === 'stub' ? sceneEase(p / 0.2) : showStub ? 1 : 0;
  const fields: ReadmeField[] = [];
  let step = 'Normalize and plot the load', lines: ReadmeLine[] = [
    { text: 'Start with the load on the standard impedance grid.' },
    { tex: 'z_L=Z_L/Z_0=2+\\mathrm{j}' }, { tex: '\\Gamma_L=0.4+\\mathrm{j}0.2' },
  ];
  if (phase === 'admittance') {
    chart.paths!.push({ id: 'reading-diameter', points: [STUB.loadReflection, yLoad], color: C.quiet, dashed: true, opacity: 0.45 * Math.sin(Math.PI * p) });
    chart.markers!.push({ id: 'impedance-reference', label: p < 0.5 ? '' : 'z_L', point: STUB.loadReflection, color: C.line, opacity: 0.45 * Math.sin(Math.PI * p) });
  }
  if (circleP > 0) {
    chart.paths!.push({ id: 'load-swr', points: circle(ZERO, Math.hypot(STUB.loadReflection.re, STUB.loadReflection.im), clamp(circleP / 0.6)), color: C.swr, dashed: true });
    chart.paths!.push({ id: 'unity-conductance', points: circle({ re: 0.5, im: 0 }, 0.5, clamp((circleP - 0.35) / 0.65)), color: C.stub });
    STUB.branches.forEach((branch, j) => {
      if (phase !== 'circles' && j !== 0) return;
      const target = chartPoint(branch.reflection, true), overlap = Math.hypot(target.re - point.re, target.im - point.im) < 0.025;
      chart.markers!.push({ id: 'placement-' + (j + 1), label: overlap && phase !== 'circles' ? '' : 'P_' + (j + 1), point: target, color: C.swr, opacity: clamp((circleP - 0.75) / 0.25) * (j === 0 ? 1 : 1 - sceneEase((circleP - 0.9) / 0.1)) });
    });
  }
  if (distance > 0) {
    chart.paths!.push({ id: 'line-rotation', points: rotationPath(STUB.loadReflection, distance).map((v) => chartPoint(v, true)), color: C.line });
    chart.markers!.push({ id: 'load-admittance', label: 'y_L', point: yLoad, color: C.line, opacity: 0.65 });
  }
  if (i >= 4) {
    const lineP = phase === 'cancel' ? clamp(p / 0.5) : 1, stubP = phase === 'cancel' ? clamp((p - 0.45) / 0.55) : 1;
    chart.paths!.push({ id: 'line-susceptance', points: reveal(LINE_B_PATH, lineP), color: C.line, opacity: lineP, dataSusceptance: SB.lineAdmittance.im });
    chart.paths!.push({ id: 'stub-susceptance', points: reveal(STUB_B_PATH, stubP), color: C.stub, opacity: stubP, dataSusceptance: SB.requiredSusceptance });
    if (stubP > 0) chart.markers!.push({ id: 'required-stub', label: showStub ? '' : '\\mathrm{j}b_s', point: STUB_B_PATH[0], color: C.stub, opacity: stubP });
  }
  if (showStub) {
    chart.paths!.push({ id: 'stub-rotation', points: reveal(STUB_PATH, phase === 'stub' ? p : 1), color: C.stub, opacity: stubOpacity });
    chart.markers!.push({ id: 'stub-input', label: 'y_{\\mathrm{stub}}', point: stubPoint(length), color: C.stub, opacity: stubOpacity });
    chart.markers!.push({ id: 'junction-line', label: 'y_\\ell(d)', point, color: C.line });
  }
  if (verify) {
    const path = chartCancellationPath(SB.lineAdmittance.im, cancelP);
    chart.paths!.push({ id: 'admittance-addition', points: path, color: C.input, opacity: sceneEase(cancelP / 0.15) });
    chart.markers!.push({ id: 'combined-input', label: cancelP < 0.1 ? '' : 'y_v', point: path.at(-1)!, color: C.input, opacity: sceneEase(cancelP / 0.15) });
  } else if (!showStub) {
    const tracked = phase === 'load' ? STUB.loadReflection : phase === 'admittance' ? reflectThroughCenter(STUB.loadReflection, p) : point;
    const label = phase === 'load' ? 'z_L' : phase === 'admittance' ? p < 0.5 ? 'z_L' : 'y_L' : distance > 0 ? 'y_\\ell(d)' : 'y_L';
    chart.markers!.push({ id: 'tracked-stub-construction', label, point: tracked, color: C.line });
  }
  if (phase === 'admittance') {
    step = 'Read the load admittance';
    lines = [{ text: 'Reflect the reading through the center; keep the grid fixed.' }, { tex: 'y_L=1/z_L=0.4-\\mathrm{j}0.2' }, { text: 'The line distance stays zero during this change of reading.' }];
  } else if (phase === 'circles') {
    step = 'Find the unity-conductance intersections';
    lines = [{ text: 'A reactive shunt stub changes susceptance, but not conductance.' }, { tex: '|\\Gamma|=|\\Gamma_L|,\\qquad\\operatorname{Re}y_\\ell=1' }, { text: 'The two intersections give two distinct matching branches.' }];
  } else if (phase === 'follow') {
    step = 'Follow the SWR circle to the first branch';
    lines = [{ text: 'Move clockwise toward the generator until conductance is one.' }, { tex: 'd=' + num(distance, 6) + '\\,\\lambda' }, { tex: 'y_\\ell(d)=' + cx(yLine) }];
  } else if (phase === 'cancel') {
    step = 'Determine the required stub admittance';
    lines = [{ text: 'Trace the line susceptance and its opposite stub susceptance.' }, { tex: 'y_\\ell=1+\\mathrm{j},\\qquad y_{\\mathrm{stub}}=-\\mathrm{j}' }, { tex: 'b_s=-\\operatorname{Im}y_\\ell=-1' }];
  } else if (phase === 'stub') {
    step = 'Build the short-circuited stub';
    lines = [{ text: 'Read the isolated stub on the boundary using the same reference.' }, { tex: 'y_{\\mathrm{stub}}=-\\mathrm{j}\\frac{Z_0}{Z_{0s}}\\cot(\\beta_s\\ell_s)' }, { tex: '\\ell_s=' + num(length, 5) + '\\,\\lambda_s' }];
  } else if (verify) {
    step = 'Add the stub admittance and verify';
    const y = { re: 1, im: SB.lineAdmittance.im * (1 - cancelP) }, gamma = admittanceReflection(y);
    lines = [{ tex: 'y_v=y_\\ell+y_{\\mathrm{stub}}=' + cx(y) }, { tex: 'Z_v=' + cx({ re: 50 / (1 + y.im ** 2), im: -50 * y.im / (1 + y.im ** 2) }, 3) + '\\;\\Omega' }, { tex: '|\\Gamma_v|=' + num(Math.hypot(gamma.re, gamma.im)) }, { text: cancelP >= 1 ? 'The load is matched to the 50 Ω main line.' : 'Parallel admittances add along the unity-conductance circle.' }];
  }
  if (i >= 4) fields.push({ label: 'Placement', value: 'd=' + num(SB.distance, 6) + '\\,\\lambda', color: C.line });
  if (i >= 6) fields.push({ label: 'Short stub', value: '\\ell_s=' + num(SB.shortLength, 5) + '\\,\\lambda_s', color: C.stub });
  return {
    kind: 'single-stub', title: 'Single-stub matching', kicker: 'LOSSLESS SHUNT MATCH · FIRST BRANCH',
    step, phase, progress: p, durationSeconds: README_SCENE_META['single-stub'].durationSeconds, contentOpacity: 1, reference: 50,
    referenceTex: 'Z_0=Z_{0s}=50\\;\\Omega', chart,
    circuit: { kind: 'stub', z0: 50, stubZ0: 50, loadLabel: '100 + j50 Ω', distance, stubLength: length, termination: 'short', showStub, attached: verify, stubOpacity },
    lines, fields,
  };
}

function quarterWave(t: number): ReadmeScene {
  const stages = [['load', 1], ['circles', 3.1], ['follow', 5.4], ['design', 6.8], ['reference', 8.7], ['transform', 11.7], ['verify', 13.9], ['hold', 16]] as const;
  const { phase, index: i, p } = phaseAt(t, stages), b = QB;
  const distance = phase === 'follow' ? b.distance * p : i > 2 ? b.distance : 0;
  const length = phase === 'transform' ? 0.25 * p : i >= 6 ? 0.25 : 0;
  const reference = phase === 'reference' ? interpolateReference(50, b.transformerZ0, p) : phase === 'transform' ? b.transformerZ0 : phase === 'verify' ? interpolateReference(b.transformerZ0, 50, p) : 50;
  const evaluation = evaluateQuarterWave({ ...INPUT, distance, transformerZ0: b.transformerZ0, transformerLength: length });
  const tracked = quarterWaveReflection(evaluation.inputImpedance, reference), chart = blank('Quarter-wave matching, chart reference ' + num(reference, 3) + ' ohms.');
  const fields: ReadmeField[] = [], showTransformer = i >= 4;
  const transformerOpacity = phase === 'reference' ? sceneEase(p / 0.25) : showTransformer ? 1 : 0;
  let step = 'Normalize and plot the load', lines: ReadmeLine[] = [{ text: 'Begin with the complex load in the main-line reference.' }, { tex: 'z_L=2+\\mathrm{j},\\qquad Z_0=50\\;\\Omega' }];
  if (i <= 3) {
    const circleP = phase === 'load' ? 0 : phase === 'circles' ? p : 1;
    if (circleP > 0) {
      chart.paths!.push({ id: 'load-swr', points: quarterWaveCircle(Math.hypot(QUARTER.loadReflection.re, QUARTER.loadReflection.im), circleP), color: C.swr, dashed: true });
      chart.paths!.push({ id: 'real-axis', points: [{ re: -1, im: 0 }, { re: 1, im: 0 }], color: C.stub, opacity: circleP * 0.4 });
      QUARTER.branches.forEach((candidate, j) => {
        if (phase !== 'circles' && j !== 0) return;
        const overlap = Math.hypot(candidate.reflection.re - tracked.re, candidate.reflection.im - tracked.im) < 0.025;
        chart.markers!.push({ id: 'real-intersection-' + (j + 1), label: overlap && phase !== 'circles' ? '' : 'P_' + (j + 1), point: candidate.reflection, color: C.swr, opacity: phase === 'circles' ? clamp((p - 0.65) / 0.35) * (j === 0 ? 1 : 1 - sceneEase((p - 0.9) / 0.1)) : 1 });
      });
    }
    if (distance > 0) {
      chart.paths!.push({ id: 'main-line-rotation', points: rotationPath(QUARTER.loadReflection, distance), color: C.line });
      chart.markers!.push({ id: 'original-load', label: 'z_L', point: QUARTER.loadReflection, color: C.line, opacity: 0.55 });
    }
  }
  // Old-reference circles disappear immediately when renormalization starts.
  if (phase === 'reference' || phase === 'verify' || phase === 'hold') {
    const from = phase === 'reference' ? 50 : b.transformerZ0;
    chart.paths!.push({ id: 'reference-change', points: Array.from({ length: 41 }, (_, j) => quarterWaveReflection(evaluation.inputImpedance, interpolateReference(from, reference, j / 40))), color: phase === 'reference' ? C.stub : C.input });
  }
  if (phase === 'transform') {
    const start = quarterWaveReflection({ re: b.resistance, im: 0 }, b.transformerZ0);
    chart.circles!.push({ id: 'transformer-swr', center: ZERO, radius: Math.abs(start.re), color: C.stub, opacity: sceneEase(p / 0.18) });
    chart.paths!.push({ id: 'transformer-rotation', points: Array.from({ length: 81 }, (_, j) => {
      const sample = evaluateQuarterWave({ ...INPUT, distance: b.distance, transformerZ0: b.transformerZ0, transformerLength: length * j / 80 });
      return quarterWaveReflection(sample.inputImpedance, b.transformerZ0);
    }), color: C.stub, opacity: sceneEase(p / 0.12) });
  }
  const label = i < 2 ? 'z_L' : phase === 'transform' ? 'z^{(t)}(\\ell)' : i >= 6 ? 'z_v' : 'z_\\ell(d)';
  chart.markers!.push({ id: 'tracked-quarter-wave', label, point: tracked, color: i >= 6 ? C.input : showTransformer ? C.stub : C.line });
  if (phase === 'circles') {
    step = 'Find the real-axis intersections';
    lines = [{ text: 'The transformer needs a real resistance at its load end.' }, { tex: '|\\Gamma|=|\\Gamma_L|,\\qquad\\operatorname{Im}Z_\\ell=0' }, { text: 'The two intersections give two distinct placement branches.' }];
  } else if (phase === 'follow') {
    step = 'Move to the first real resistance';
    lines = [{ text: 'Follow the SWR circle clockwise toward the generator.' }, { tex: 'd=' + num(distance, 6) + '\\,\\lambda' }, { tex: 'Z_\\ell(d)=' + cx(evaluation.lineImpedance, 3) + '\\;\\Omega' }];
  } else if (phase === 'design') {
    step = 'Design the quarter-wave section';
    lines = [{ tex: 'R_1=' + num(b.resistance) + '\\;\\Omega' }, { tex: 'Z_t=\\sqrt{Z_0R_1}=' + num(b.transformerZ0) + '\\;\\Omega' }, { tex: '\\ell_t=\\lambda_t/4,\\qquad Z_v=Z_t^2/R_1=Z_0' }];
  } else if (phase === 'reference') {
    step = 'Read the same resistance using Zₜ';
    lines = [{ text: 'Change the reference while keeping the circuit and reading plane fixed.' }, { tex: 'Z_{\\mathrm{ref}}=' + num(reference, 3) + '\\;\\Omega' }, { tex: 'z_\\ell=R_1/Z_{\\mathrm{ref}}=' + num(b.resistance / reference) }];
  } else if (phase === 'transform') {
    step = 'Traverse the quarter-wave transformer';
    lines = [{ text: 'Move through the blue transformer.' }, { tex: '\\ell=' + num(length, 5) + '\\,\\lambda_t' }, { tex: 'Z^{(t)}(\\ell)=' + cx(evaluation.inputImpedance, 3) + '\\;\\Omega' }, { text: 'A quarter wavelength gives a half-turn.' }];
  } else if (i >= 6) {
    step = 'Restore Z₀ and verify the match';
    lines = [{ text: 'Keep the circuit fixed; restore Z₀.' }, { tex: 'Z_v=' + cx(evaluation.inputImpedance, 3) + '\\;\\Omega' }, { tex: 'Z_{\\mathrm{ref}}=' + num(reference, 3) + '\\;\\Omega,\\qquad|\\Gamma_{\\mathrm{ref}}|=' + num(Math.hypot(tracked.re, tracked.im)) }, { text: reference === 50 ? 'The input now matches the main line.' : 'Return to the main-line reference.' }];
  }
  if (i >= 3) fields.push({ label: 'Placement', value: 'd=' + num(b.distance, 6) + '\\,\\lambda', color: C.line });
  if (i >= 4) fields.push({ label: 'Transformer', value: 'Z_t=' + num(b.transformerZ0) + '\\;\\Omega', color: C.stub });
  if (i >= 6) fields.push({ label: 'Length', value: '\\ell_t=0.25\\,\\lambda_t', color: C.stub });
  return {
    kind: 'quarter-wave', title: 'Quarter-wave transformer', kicker: 'LOSSLESS SERIES MATCH · FIRST BRANCH',
    step, phase, progress: p, durationSeconds: README_SCENE_META['quarter-wave'].durationSeconds, contentOpacity: 1, reference,
    referenceTex: 'Z_{\\mathrm{ref}}=' + num(reference, 3) + '\\;\\Omega', chart,
    circuit: { kind: 'quarter-wave', z0: 50, loadLabel: '100 + j50 Ω', distance, transformerZ0: b.transformerZ0, transformerLength: 0.25, showTransformer, transformerOpacity, activeTransformerProgress: showTransformer ? length / 0.25 : undefined },
    lines, fields,
  };
}

/** Repeated calls at the same time produce identical, browser-independent data. */
export function getReadmeScene(kind: ReadmeKind, timeSeconds: number): ReadmeScene {
  const t = loopTime(timeSeconds, README_SCENE_META[kind].durationSeconds);
  return kind === 'smith' ? smith(t) : kind === 'single-stub' ? singleStub(matchingTime(t, 14.2)) : quarterWave(matchingTime(t, 13.9));
}
