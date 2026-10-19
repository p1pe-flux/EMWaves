export type QuarterWavePhase = 'load' | 'circles' | 'follow' | 'design' | 'reference' | 'transform' | 'verify';
export interface QuarterWaveStep { key: string; phase: QuarterWavePhase; title: string; duration: number; branchIndex: number; }
export interface QuarterWavePosition { stepIndex: number; completed: boolean; }
export interface QuarterWaveMilestone { branchIndex: number; placement: boolean; transformer: boolean; length: boolean; verified: boolean; }

export function quarterWaveSteps(branchCount: number): QuarterWaveStep[] {
  const steps: QuarterWaveStep[] = [
    { key: 'load', phase: 'load', title: 'Plot the load impedance', duration: 1400, branchIndex: 0 },
    { key: 'circles', phase: 'circles', title: 'Draw the SWR circle and find real impedances', duration: 2200, branchIndex: 0 },
  ];
  for (let branchIndex = 0; branchIndex < branchCount; branchIndex += 1) {
    const phases: Omit<QuarterWaveStep, 'key' | 'branchIndex'>[] = [
      { phase: 'follow', title: 'Move to a real impedance', duration: branchIndex === 0 ? 3200 : 5200 },
      { phase: 'design', title: 'Calculate the transformer impedance', duration: 2200 },
      { phase: 'reference', title: 'Read the same resistance using Zₜ', duration: 2200 },
      { phase: 'transform', title: 'Travel through the quarter-wave section', duration: 3800 },
      { phase: 'verify', title: 'Return to Z₀ and verify the match', duration: 2400 },
    ];
    steps.push(...phases.map((step) => ({ ...step, key: 'branch-' + (branchIndex + 1) + '-' + step.phase, branchIndex })));
  }
  return steps;
}

export function quarterWaveMilestones(steps: readonly QuarterWaveStep[], position: QuarterWavePosition | null): QuarterWaveMilestone[] {
  if (position === null || !Number.isInteger(position.stepIndex) || position.stepIndex < 0) return [];
  const branches = new Map<number, QuarterWaveMilestone>();
  for (let i = 0; i < steps.length; i += 1) {
    if (i > position.stepIndex || (i === position.stepIndex && !position.completed)) break;
    const step = steps[i];
    const flag = step.phase === 'follow' ? 'placement' : step.phase === 'design' ? 'transformer' : step.phase === 'transform' ? 'length' : step.phase === 'verify' ? 'verified' : null;
    if (flag === null) continue;
    const item = branches.get(step.branchIndex) ?? { branchIndex: step.branchIndex, placement: false, transformer: false, length: false, verified: false };
    item[flag] = true;
    branches.set(step.branchIndex, item);
  }
  return [...branches.values()].filter((branch) => branch.placement);
}
