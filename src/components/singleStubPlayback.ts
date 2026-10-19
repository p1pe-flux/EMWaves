export interface SingleStubConstructionStep {
  key: string;
  phase: 'z_load' | 'load' | 'circles' | 'follow' | 'cancel' | 'stub' | 'verify';
  title: string;
  duration: number;
  branchIndex: number;
}

const matchingPhases: Omit<SingleStubConstructionStep, 'key' | 'branchIndex'>[] = [
  { phase: 'follow', title: 'Follow SWR to Re(y) = 1', duration: 4800 },
  { phase: 'cancel', title: 'Determine required stub admittance', duration: 2400 },
  { phase: 'stub', title: 'Build the isolated stub', duration: 3800 },
  { phase: 'verify', title: 'Attach and verify', duration: 3400 },
];

function branchSteps(branchIndex: number, keyPrefix: string, followDuration = 4800): SingleStubConstructionStep[] {
  return matchingPhases.map((step) => ({ ...step, duration: step.phase === 'follow' ? followDuration : step.duration, key: keyPrefix + step.phase, branchIndex }));
}

/** The shared guide/laboratory construction completes one branch at a time. */
export function getSingleStubConstructionSteps(): SingleStubConstructionStep[] {
  return [
    { key: 'z_load', phase: 'z_load', title: 'Plot the load impedance', duration: 1400, branchIndex: 0 },
    { key: 'admittance', phase: 'load', title: 'Reflect through the center to read admittance', duration: 3000, branchIndex: 0 },
    { key: 'circles', phase: 'circles', title: 'Draw the SWR and unity-conductance circles', duration: 2000, branchIndex: 0 },
    ...branchSteps(0, 'branch-1-', 3000),
    ...branchSteps(1, 'branch-2-'),
  ];
}

/** Advance from the current frame, so pauses and speed changes retain position. */
export function singleStubPlaybackProgress(initial: number, elapsedMs: number, durationMs: number, direction: 1 | -1, speed: number): number {
  if (!Number.isFinite(initial) || !Number.isFinite(elapsedMs) || elapsedMs < 0
    || !Number.isFinite(durationMs) || durationMs <= 0 || !Number.isFinite(speed) || speed < 0) {
    throw new RangeError('Playback needs finite values, nonnegative elapsed time and speed, and a positive duration.');
  }
  return Math.max(0, Math.min(1, initial + direction * elapsedMs * speed / durationMs));
}
