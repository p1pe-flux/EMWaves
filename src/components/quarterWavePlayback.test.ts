import { describe, expect, it } from 'vitest';
import { quarterWaveMilestones, quarterWaveSteps, type QuarterWavePhase } from './quarterWavePlayback';

const steps = quarterWaveSteps(2);
function indexOf(phase: QuarterWavePhase, branchIndex = 0): number {
  const index = steps.findIndex((step) => step.phase === phase && step.branchIndex === branchIndex);
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

describe('quarter-wave construction timeline', () => {
  it('finishes and verifies each branch before moving to the other real-axis solution', () => {
    expect(steps).toHaveLength(12);
    expect(steps.map(({ phase }) => phase)).toEqual(['load', 'circles', 'follow', 'design', 'reference', 'transform', 'verify', 'follow', 'design', 'reference', 'transform', 'verify']);
    expect(steps.map(({ branchIndex }) => branchIndex)).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1]);
    expect(new Set(steps.map(({ key }) => key)).size).toBe(steps.length);
    expect(steps[indexOf('verify')].key).toBe('branch-1-verify');
    expect(indexOf('verify')).toBeLessThan(indexOf('follow', 1));
    expect(steps[indexOf('follow', 1)].key).toBe('branch-2-follow');
    expect(steps[indexOf('follow')].duration).toBe(3200);
    expect(steps[indexOf('follow', 1)].duration).toBe(5200);
  });

  it('uses a single seven-step realization for an already-matched load', () => {
    const matched = quarterWaveSteps(1);
    expect(matched).toHaveLength(7);
    expect(matched.map(({ phase }) => phase)).toEqual(['load', 'circles', 'follow', 'design', 'reference', 'transform', 'verify']);
    expect(matched.every(({ branchIndex }) => branchIndex === 0)).toBe(true);
    expect(matched.at(-1)?.key).toBe('branch-1-verify');
  });
});

describe('quarter-wave result milestones', () => {
  it('hides results during setup and while the first placement is still moving', () => {
    expect(quarterWaveMilestones(steps, null)).toEqual([]);
    for (const phase of ['load', 'circles'] as const) {
      for (const completed of [false, true]) expect(quarterWaveMilestones(steps, { stepIndex: indexOf(phase), completed })).toEqual([]);
    }
    expect(quarterWaveMilestones(steps, { stepIndex: indexOf('follow'), completed: false })).toEqual([]);
  });

  it('reveals placement, transformer impedance, length, and final verification at their completed phases', () => {
    expect(quarterWaveMilestones(steps, { stepIndex: indexOf('follow'), completed: true })).toEqual([
      { branchIndex: 0, placement: true, transformer: false, length: false, verified: false },
    ]);
    const designed = [{ branchIndex: 0, placement: true, transformer: true, length: false, verified: false }];
    expect(quarterWaveMilestones(steps, { stepIndex: indexOf('design'), completed: true })).toEqual(designed);
    // A new chart reference changes no physical length and introduces no match.
    expect(quarterWaveMilestones(steps, { stepIndex: indexOf('reference'), completed: false })).toEqual(designed);
    expect(quarterWaveMilestones(steps, { stepIndex: indexOf('reference'), completed: true })).toEqual(designed);
    expect(quarterWaveMilestones(steps, { stepIndex: indexOf('transform'), completed: false })).toEqual(designed);
    expect(quarterWaveMilestones(steps, { stepIndex: indexOf('transform'), completed: true })).toEqual([
      { branchIndex: 0, placement: true, transformer: true, length: true, verified: false },
    ]);
    expect(quarterWaveMilestones(steps, { stepIndex: indexOf('verify'), completed: false })).toEqual([
      { branchIndex: 0, placement: true, transformer: true, length: true, verified: false },
    ]);
    expect(quarterWaveMilestones(steps, { stepIndex: indexOf('verify'), completed: true })).toEqual([
      { branchIndex: 0, placement: true, transformer: true, length: true, verified: true },
    ]);
  });

  it('retains the first branch while revealing the second branch independently', () => {
    const first = { branchIndex: 0, placement: true, transformer: true, length: true, verified: true };
    expect(quarterWaveMilestones(steps, { stepIndex: indexOf('follow', 1), completed: false })).toEqual([first]);
    expect(quarterWaveMilestones(steps, { stepIndex: indexOf('follow', 1), completed: true })).toEqual([
      first, { branchIndex: 1, placement: true, transformer: false, length: false, verified: false },
    ]);
    expect(quarterWaveMilestones(steps, { stepIndex: indexOf('verify', 1), completed: true })).toEqual([
      first, { branchIndex: 1, placement: true, transformer: true, length: true, verified: true },
    ]);
  });

  it('removes future deductions on rewind and clears them after restart', () => {
    expect(quarterWaveMilestones(steps, { stepIndex: indexOf('verify', 1), completed: true })).toHaveLength(2);
    expect(quarterWaveMilestones(steps, { stepIndex: indexOf('design'), completed: false })).toEqual([
      { branchIndex: 0, placement: true, transformer: false, length: false, verified: false },
    ]);
    expect(quarterWaveMilestones(steps, { stepIndex: indexOf('follow'), completed: false })).toEqual([]);
    expect(quarterWaveMilestones(steps, { stepIndex: 0, completed: true })).toEqual([]);
    expect(quarterWaveMilestones(steps, null)).toEqual([]);
  });
});
