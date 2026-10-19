import { DomainError } from './errors';
import type { LumpedComponent, LumpedConnection, LumpedMatchingTopology } from './lumpedMatching';
import type { ComplexValue, Load } from './transmission';

export type LumpedFeasibilityRegion = {
  kind: 'area' | 'curve';
  sourceComponent: LumpedComponent;
  loadComponent: LumpedComponent;
  sourceConnection: LumpedConnection;
  loadConnection: LumpedConnection;
  formula: string;
  boundaryFormula: string;
};
export type LumpedFeasibilityClassification = 'matchable' | 'continuous' | 'boundary' | 'outside' | 'unmatchable';

function assertTopology(topology: LumpedMatchingTopology): void {
  if (!Array.isArray(topology.elements) || topology.elements.length !== 2) throw new DomainError('lumped.invalid-element-count');
  for (const element of topology.elements) {
    if (element.component !== 'L' && element.component !== 'C') throw new DomainError('lumped.invalid-component');
    if (element.connection !== 'series' && element.connection !== 'parallel') throw new DomainError('lumped.invalid-connection');
  }
}

export function describeLumpedFeasibility(topology: LumpedMatchingTopology): LumpedFeasibilityRegion {
  assertTopology(topology);
  const [source, load] = topology.elements;
  const base = { sourceComponent: source.component, loadComponent: load.component,
    sourceConnection: source.connection, loadConnection: load.connection };
  if (source.connection === load.connection) {
    const curve = source.connection === 'series' ? String.raw`r=1` : String.raw`r^2+x^2=r,\quad r>0`;
    const restriction = source.component === load.component ? source.component === 'L' ? String.raw`,\quad x<0` : String.raw`,\quad x>0` : '';
    return { ...base, kind: 'curve', formula: curve + restriction, boundaryFormula: curve + restriction };
  }
  if (source.component === load.component) {
    const sign = source.component === 'L' ? '<' : '>';
    return { ...base, kind: 'area', formula: String.raw`0<r<1,\quad r^2+x^2>r,\quad x${sign}0`,
      boundaryFormula: source.component === 'L'
        ? String.raw`\{r^2+x^2=r,\ x\le0\}\;\cup\;\{r=1,\ x\le0\}`
        : String.raw`\{r^2+x^2=r,\ x\ge0\}\;\cup\;\{r=1,\ x\ge0\}` };
  }
  const inductor = source.component === 'L' ? source : load;
  const positiveSide = inductor.connection === 'series';
  const boundaryFormula = positiveSide
    ? String.raw`\{r^2+x^2=r,\ x\ge0\}\;\cup\;\{r=1,\ x\le0\}`
    : String.raw`\{r^2+x^2=r,\ x\le0\}\;\cup\;\{r=1,\ x\ge0\}`;
  const formula = source.connection === 'series'
    ? positiveSide ? String.raw`r>0,\quad r^2+x^2>r,\quad (r>1\;\lor\;x>0)`
      : String.raw`r>0,\quad r^2+x^2>r,\quad (r>1\;\lor\;x<0)`
    : positiveSide ? String.raw`0<r<1,\quad x<\sqrt{r(1-r)}`
      : String.raw`0<r<1,\quad x>-\sqrt{r(1-r)}`;
  return { ...base, kind: 'area', formula, boundaryFormula };
}

type BinaryValue = { coefficient: bigint; exponent: number };
const binaryBuffer = new DataView(new ArrayBuffer(8));

function binaryValue(value: number): BinaryValue {
  binaryBuffer.setFloat64(0, Math.abs(value));
  const bits = binaryBuffer.getBigUint64(0);
  const exponent = Number((bits >> 52n) & 0x7ffn);
  const fraction = bits & ((1n << 52n) - 1n);
  return exponent === 0 ? { coefficient: fraction, exponent: -1074 }
    : { coefficient: fraction | (1n << 52n), exponent: exponent - 1075 };
}

/** Exact sign of R²+X²−RZ0 for the supplied binary floating-point inputs. */
function compareConductanceCircle(resistance: number, reactance: number, z0: number): number {
  const r = binaryValue(resistance);
  const x = binaryValue(reactance);
  const reference = binaryValue(z0);
  const exponent = Math.min(2 * r.exponent, 2 * x.exponent, r.exponent + reference.exponent);
  const coefficient = (r.coefficient * r.coefficient << BigInt(2 * r.exponent - exponent))
    + (x.coefficient * x.coefficient << BigInt(2 * x.exponent - exponent))
    - (r.coefficient * reference.coefficient << BigInt(r.exponent + reference.exponent - exponent));
  return coefficient < 0n ? -1 : coefficient > 0n ? 1 : 0;
}


function classifyPositiveLoad(region: LumpedFeasibilityRegion, resistance: number, reactance: number, z0: number): LumpedFeasibilityClassification {
  const resistanceSide = resistance < z0 ? -1 : resistance > z0 ? 1 : 0;
  const circleSide = compareConductanceCircle(resistance, reactance, z0);
  if (region.kind === 'curve') {
    const onCurve = region.sourceConnection === 'series' ? resistanceSide === 0 : circleSide === 0;
    if (!onCurve) return 'outside';
    if (region.sourceComponent !== region.loadComponent) return 'continuous';
    if (reactance === 0) return 'boundary';
    return (region.sourceComponent === 'L' ? reactance < 0 : reactance > 0) ? 'continuous' : 'outside';
  }
  const sourceSign = (region.sourceComponent === 'L') === (region.sourceConnection === 'series') ? 1 : -1;
  const loadSign = (region.loadComponent === 'L') === (region.loadConnection === 'series') ? 1 : -1;
  const equalReactiveSigns = sourceSign === loadSign;
  // Work in z for a load-side series element, or y for a parallel one.
  // Comparing to sqrt(a(1-a)) needs only exact unit-circle/line sides and the imaginary sign.
  const realSide = region.loadConnection === 'series' ? resistanceSide : -circleSide;
  const targetCircleSide = region.loadConnection === 'series' ? circleSide : -resistanceSide;
  const directedImaginary = sourceSign * (region.loadConnection === 'series' ? reactance : -reactance);
  if (realSide > 0) return 'outside';
  if (realSide === 0) {
    return (equalReactiveSigns ? directedImaginary <= 0 : directedImaginary >= 0) ? 'boundary' : 'outside';
  }
  if (targetCircleSide === 0 && directedImaginary >= 0) return 'boundary';
  const admissible = equalReactiveSigns
    ? directedImaginary < 0 || targetCircleSide < 0
    : directedImaginary > 0 && targetCircleSide > 0;
  return admissible ? 'matchable' : 'outside';
}

export function classifyLumpedFeasibility(topology: LumpedMatchingTopology, impedance: ComplexValue | null): LumpedFeasibilityClassification {
  const region = describeLumpedFeasibility(topology);
  if (impedance === null) return 'unmatchable';
  if (!Number.isFinite(impedance.re) || !Number.isFinite(impedance.im)) throw new DomainError('load.nonfinite-normalized-impedance');
  if (impedance.re <= 0) return 'unmatchable';
  return classifyPositiveLoad(region, impedance.re, impedance.im, 1);
}

export function classifyLumpedPhysicalLoadFeasibility(topology: LumpedMatchingTopology, input: { z0: number; load: Load }): LumpedFeasibilityClassification {
  const region = describeLumpedFeasibility(topology);
  if (!Number.isFinite(input.z0) || input.z0 <= 0) throw new DomainError('line.invalid-characteristic-impedance');
  if (input.load.kind !== 'impedance') return 'unmatchable';
  const { resistance, reactance } = input.load;
  if (!Number.isFinite(resistance) || !Number.isFinite(reactance)) throw new DomainError('load.nonfinite-impedance');
  if (resistance < 0) throw new DomainError('value.negative', { label: 'Resistance' });
  if (resistance === 0) return 'unmatchable';
  return classifyPositiveLoad(region, resistance, reactance, input.z0);
}
