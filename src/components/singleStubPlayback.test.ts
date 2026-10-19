import { describe, expect, it } from 'vitest';
import { getSingleStubConstructionSteps, singleStubPlaybackProgress } from './singleStubPlayback';

describe('single-stub construction timeline', () => {
  it('draws the circles before moving, then verifies branch one before introducing branch two in the guide', () => {
    const steps = getSingleStubConstructionSteps();
    expect(steps).toHaveLength(11);
    expect(steps.map(({ phase }) => phase)).toEqual(['z_load', 'load', 'circles', 'follow', 'cancel', 'stub', 'verify', 'follow', 'cancel', 'stub', 'verify']);
    expect(steps.map(({ branchIndex }) => branchIndex)).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1]);
    expect(steps.map(({ key }) => key)).toEqual(['z_load', 'admittance', 'circles', 'branch-1-follow', 'branch-1-cancel', 'branch-1-stub', 'branch-1-verify', 'branch-2-follow', 'branch-2-cancel', 'branch-2-stub', 'branch-2-verify']);
    expect(new Set(steps.map(({ key }) => key)).size).toBe(steps.length);
    expect(steps.map(({ duration }) => duration)).toEqual([1400, 3000, 2000, 3000, 2400, 3800, 3400, 4800, 2400, 3800, 3400]);
    expect(steps[2].title).toBe('Draw the SWR and unity-conductance circles');
    expect(steps[2].phase).toBe('circles');
    expect(steps[3].phase).toBe('follow');
    expect(steps[6].phase).toBe('verify');
    expect(steps[7].phase).toBe('follow');
    expect(steps[7].branchIndex).toBe(1);
    expect(getSingleStubConstructionSteps()).toEqual(steps);
  });

});

describe('single-stub playback position', () => {
  it('pauses and resumes from the displayed frame without restarting the phase', () => {
    const first = singleStubPlaybackProgress(0, 1200, 4800, 1, 1);
    expect(first).toBe(0.25);
    expect(singleStubPlaybackProgress(first, 0, 4800, 1, 1)).toBe(first);
    expect(singleStubPlaybackProgress(first, 600, 4800, 1, 1)).toBe(0.375);
    expect(singleStubPlaybackProgress(first, 5000, 4800, 1, 0)).toBe(first);
  });

  it('applies speed ratios to the remaining motion rather than to previous elapsed time', () => {
    const initial = 0.375;
    const normal = singleStubPlaybackProgress(initial, 1200, 4800, 1, 1);
    const fast = singleStubPlaybackProgress(initial, 1200, 4800, 1, 2);
    const slow = singleStubPlaybackProgress(initial, 1200, 4800, 1, 0.5);
    expect(normal).toBe(0.625);
    expect(fast - initial).toBe(2 * (normal - initial));
    expect(slow - initial).toBe(0.5 * (normal - initial));
    expect(singleStubPlaybackProgress(normal, 300, 4800, 1, 2)).toBe(0.75);
  });

  it('reverses from the current frame at the selected speed', () => {
    expect(singleStubPlaybackProgress(1, 600, 2400, -1, 1)).toBe(0.75);
    expect(singleStubPlaybackProgress(0.75, 600, 2400, -1, 2)).toBe(0.25);
    expect(singleStubPlaybackProgress(0.25, 600, 2400, 1, 2)).toBe(0.75);
  });

  it('clamps completed forward and reverse playback without advancing beyond an endpoint', () => {
    expect(singleStubPlaybackProgress(0.9, 1000, 1000, 1, 2)).toBe(1);
    expect(singleStubPlaybackProgress(0.1, 1000, 1000, -1, 2)).toBe(0);
    expect(singleStubPlaybackProgress(1, 1000, 1000, 1, 1)).toBe(1);
    expect(singleStubPlaybackProgress(0, 1000, 1000, -1, 1)).toBe(0);
  });

  it.each([
    [NaN, 0, 1000, 1], [0, -1, 1000, 1], [0, Infinity, 1000, 1],
    [0, 0, 0, 1], [0, 0, Infinity, 1], [0, 0, 1000, -1], [0, 0, 1000, NaN],
  ])('rejects timing values that could create invalid state: %j', (initial, elapsed, duration, speed) => {
    expect(() => singleStubPlaybackProgress(initial, elapsed, duration, 1, speed)).toThrow(RangeError);
  });
});
