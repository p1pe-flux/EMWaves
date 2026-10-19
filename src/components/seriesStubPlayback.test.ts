import { describe, expect, it } from 'vitest';
import { getSeriesStubConstructionSteps, seriesStubResultMilestones } from './seriesStubPlayback';

describe('series-stub adjacent-step playback', () => {
  it('uses ten impedance steps and completes branch 1 before branch 2', () => {
    const steps = getSeriesStubConstructionSteps();
    expect(steps.map((step) => step.phase)).toEqual(['load', 'circles', 'follow', 'cancel', 'stub', 'verify', 'follow', 'cancel', 'stub', 'verify']);
    expect(steps.map((step) => step.branchIndex)).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 1]);
    expect(new Set(steps.map((step) => step.key)).size).toBe(10);
  });

  it('discloses only completed placement and stub steps and hides future values on rewind', () => {
    const steps = getSeriesStubConstructionSteps();
    const at = (stepIndex: number, completed = true) => seriesStubResultMilestones(steps, { stepIndex, completed });
    expect(at(2, false).size).toBe(0);
    expect(at(2).get(0)).toEqual({ placement: true, stub: false });
    expect(at(4, false).get(0)).toEqual({ placement: true, stub: false });
    expect(at(4).get(0)).toEqual({ placement: true, stub: true });
    expect(at(6, false).get(0)).toEqual({ placement: true, stub: true });
    expect(at(6, false).get(1)).toBeUndefined();
    expect(at(6).get(1)).toEqual({ placement: true, stub: false });
    expect(at(8).get(1)).toEqual({ placement: true, stub: true });
    expect(at(3).get(0)).toEqual({ placement: true, stub: false });
    expect(at(3).get(1)).toBeUndefined();
    expect(at(0).size).toBe(0);
  });
});
