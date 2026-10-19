import { describe, expect, it } from 'vitest';
import { getSingleStubConstructionSteps, type SingleStubConstructionStep } from './singleStubPlayback';
import { singleStubResultMilestones } from './singleStubResultMilestones';

const guide = getSingleStubConstructionSteps();

function indexOf(phase: SingleStubConstructionStep['phase'], branchIndex: number): number {
  const index = guide.findIndex((step) => step.phase === phase && step.branchIndex === branchIndex);
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

describe('single-stub result milestones', () => {
  it('reveals nothing before placement, including completed setup and circles steps', () => {
    expect(singleStubResultMilestones(guide, null)).toEqual([]);
    for (const phase of ['z_load', 'load', 'circles'] as const) {
      for (const completed of [false, true]) {
        expect(singleStubResultMilestones(guide, { stepIndex: indexOf(phase, 0), completed })).toEqual([]);
      }
    }
    expect(singleStubResultMilestones(guide, { stepIndex: indexOf('follow', 0), completed: false })).toEqual([]);
  });

  it('reveals placement, cancellation, length, and verification only as each phase completes', () => {
    const phases = ['follow', 'cancel', 'stub', 'verify'] as const;
    const flags = ['placement', 'cancellation', 'stub', 'verified'] as const;
    phases.forEach((phase, phaseIndex) => {
      const result = singleStubResultMilestones(guide, { stepIndex: indexOf(phase, 0), completed: true });
      expect(result).toHaveLength(1);
      expect(result[0].branchIndex).toBe(0);
      flags.forEach((flag, flagIndex) => expect(result[0][flag]).toBe(flagIndex <= phaseIndex));
    });
  });

  it('keeps earlier deductions while the current phase is incomplete', () => {
    const cancellation = singleStubResultMilestones(guide, { stepIndex: indexOf('cancel', 0), completed: false });
    expect(cancellation).toEqual([{ branchIndex: 0, placement: true, cancellation: false, stub: false, verified: false }]);
    const building = singleStubResultMilestones(guide, { stepIndex: indexOf('stub', 0), completed: false });
    expect(building).toEqual([{ branchIndex: 0, placement: true, cancellation: true, stub: false, verified: false }]);
    const verifying = singleStubResultMilestones(guide, { stepIndex: indexOf('verify', 0), completed: false });
    expect(verifying).toEqual([{ branchIndex: 0, placement: true, cancellation: true, stub: true, verified: false }]);
  });

  it('preserves the verified first branch during handoff and reveals the second independently', () => {
    const handoff = singleStubResultMilestones(guide, { stepIndex: indexOf('follow', 1), completed: false });
    expect(handoff).toEqual([{ branchIndex: 0, placement: true, cancellation: true, stub: true, verified: true }]);
    const secondPlacement = singleStubResultMilestones(guide, { stepIndex: indexOf('follow', 1), completed: true });
    expect(secondPlacement).toEqual([
      { branchIndex: 0, placement: true, cancellation: true, stub: true, verified: true },
      { branchIndex: 1, placement: true, cancellation: false, stub: false, verified: false },
    ]);
    const finished = singleStubResultMilestones(guide, { stepIndex: indexOf('verify', 1), completed: true });
    expect(finished).toEqual([
      { branchIndex: 0, placement: true, cancellation: true, stub: true, verified: true },
      { branchIndex: 1, placement: true, cancellation: true, stub: true, verified: true },
    ]);
  });

  it('hides future results on rewind and clears them on restart without high-water history', () => {
    expect(singleStubResultMilestones(guide, { stepIndex: indexOf('verify', 1), completed: true })).toHaveLength(2);
    expect(singleStubResultMilestones(guide, { stepIndex: indexOf('cancel', 0), completed: true })).toEqual([
      { branchIndex: 0, placement: true, cancellation: true, stub: false, verified: false },
    ]);
    expect(singleStubResultMilestones(guide, { stepIndex: indexOf('follow', 0), completed: false })).toEqual([]);
    expect(singleStubResultMilestones(guide, { stepIndex: 0, completed: true })).toEqual([]);
    expect(singleStubResultMilestones(guide, null)).toEqual([]);
  });

  it('restores the previous completed disclosure at every reverse transition endpoint', () => {
    for (let index = guide.length - 1; index > 0; index -= 1) {
      // Immediately on rewind the current deduction becomes incomplete; the
      // previous completed phase then owns exactly the same disclosed values.
      expect(singleStubResultMilestones(guide, { stepIndex: index, completed: false })).toEqual(
        singleStubResultMilestones(guide, { stepIndex: index - 1, completed: true }),
      );
    }
  });

  it.each([NaN, Infinity, -1, 0.5])('never discloses a deduction at an invalid position %s', (stepIndex) => {
    expect(singleStubResultMilestones(guide, { stepIndex, completed: true })).toEqual([]);
  });
});
