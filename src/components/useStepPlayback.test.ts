import { describe, expect, it } from 'vitest';
import { getSingleStubConstructionSteps, singleStubPlaybackProgress } from './singleStubPlayback';
import { singleStubResultMilestones } from './singleStubResultMilestones';
import { getSeriesStubConstructionSteps } from './seriesStubPlayback';
import { quarterWaveSteps } from './quarterWavePlayback';
import { doubleStubSteps } from './doubleStubPlayback';
import { getLCMatchingConstructionSteps } from './lcMatchingPlayback';
import { initialStepPlaybackState, stepPlaybackReducer, type StepPlaybackState } from './useStepPlayback';

const steps = getSingleStubConstructionSteps();
const next = (state: StepPlaybackState) => stepPlaybackReducer(state, { type: 'next', stepCount: steps.length });
const finish = (state: StepPlaybackState) => stepPlaybackReducer(state, { type: 'finish', run: state.run });

describe('shared matching playback state', () => {
  it.each([
    ['single stub', getSingleStubConstructionSteps()],
    ['series stub', getSeriesStubConstructionSteps()],
    ['quarter wave', quarterWaveSteps(2)],
    ['canonical quarter wave', quarterWaveSteps(1)],
    ['double stub', doubleStubSteps(2)],
    ['tangent double stub', doubleStubSteps(1)],
    ['no discrete double-stub branches', doubleStubSteps(0)],
    ['parallel load-side LC', getLCMatchingConstructionSteps(true)],
    ['series load-side LC', getLCMatchingConstructionSteps(false)],
    ['no discrete LC branches', getLCMatchingConstructionSteps(true, 0, false)],
  ] as const)('walks every %s stage forward and backward through the active reducer', (_label, timeline) => {
    let state = initialStepPlaybackState();
    const visited = [timeline[state.stage].key];
    while (state.stage < timeline.length - 1) {
      const stage = state.stage;
      state = stepPlaybackReducer(state, { type: 'next', stepCount: timeline.length });
      expect(state).toMatchObject({ stage: stage + 1, progress: 0, playing: true, direction: 1 });
      state = finish(state);
      visited.push(timeline[state.stage].key);
    }
    expect(visited).toEqual(timeline.map(step => step.key));
    expect(stepPlaybackReducer(state, { type: 'next', stepCount: timeline.length })).toBe(state);
    const reversed = [timeline[state.stage].key];
    while (state.stage > 0) {
      const stage = state.stage;
      state = stepPlaybackReducer(state, { type: 'previous' });
      expect(state).toMatchObject({ stage, progress: 1, playing: true, direction: -1 });
      state = finish(state);
      reversed.push(timeline[state.stage].key);
    }
    expect(reversed).toEqual([...visited].reverse());
    expect(stepPlaybackReducer(state, { type: 'previous' })).toBe(state);
  });

  it('starts paused and advances exactly one step, retaining the completed step until Next', () => {
    let state = initialStepPlaybackState();
    expect(state).toMatchObject({ stage: 0, progress: 1, playing: false });
    state = next(state);
    expect(state).toMatchObject({ stage: 1, progress: 0, playing: true, direction: 1 });
    expect(next(state)).toBe(state);
    state = finish(state);
    expect(state).toMatchObject({ stage: 1, progress: 1, playing: false });
    expect(finish(state)).toBe(state);
  });

  it('reverses the displayed transition before returning to the previous completed step', () => {
    const completed = finish(next(initialStepPlaybackState()));
    const reversing = stepPlaybackReducer(completed, { type: 'previous' });
    expect(reversing).toMatchObject({ stage: 1, progress: 1, playing: true, direction: -1 });
    const halfway = stepPlaybackReducer(reversing, { type: 'frame', progress: 0.5, run: reversing.run });
    expect(halfway.stage).toBe(1);
    expect(finish(halfway)).toMatchObject({ stage: 0, progress: 1, playing: false });
  });

  it('ignores repeated navigation during a transition and stops at either boundary', () => {
    let state = initialStepPlaybackState();
    expect(stepPlaybackReducer(state, { type: 'previous' })).toBe(state);
    for (let stage = 1; stage < steps.length; stage += 1) {
      state = next(state);
      expect(next(state)).toBe(state);
      expect(stepPlaybackReducer(state, { type: 'previous' })).toBe(state);
      state = finish(state);
      expect(state.stage).toBe(stage);
    }
    expect(next(state)).toBe(state);
  });

  it('continues from the latest forward or reverse frame when speed changes', () => {
    for (const direction of [1, -1] as const) {
      const initial = direction === 1 ? 0 : 1;
      const beforeChange = singleStubPlaybackProgress(initial, 250, 1000, direction, 1);
      const afterChange = singleStubPlaybackProgress(beforeChange, 125, 1000, direction, 2);
      expect(afterChange).toBeCloseTo(0.5);
      expect(singleStubPlaybackProgress(beforeChange, 0, 1000, direction, 4)).toBe(beforeChange);
    }
  });

  it('keeps reduced-motion endpoints incomplete until the transition finishes', () => {
    let state = initialStepPlaybackState();
    while (state.stage < 3) state = finish(next(state));
    state = next(state);
    state = stepPlaybackReducer(state, { type: 'frame', progress: 1, run: state.run });
    expect(state.playing).toBe(true);
    const position = { stepIndex: state.stage, completed: state.progress >= 1 && !state.playing };
    expect(singleStubResultMilestones(steps, position)[0].cancellation).toBe(false);
    state = finish(state);
    expect(singleStubResultMilestones(steps, { stepIndex: state.stage, completed: !state.playing })[0].cancellation).toBe(true);
  });

  it('hides future results immediately during rewind and preserves the completed earlier branch', () => {
    let state = initialStepPlaybackState();
    while (state.stage < 9) state = finish(next(state));
    const found = () => singleStubResultMilestones(steps, { stepIndex: state.stage, completed: state.progress >= 1 && !state.playing });
    expect(found()[1].stub).toBe(true);
    state = stepPlaybackReducer(state, { type: 'previous' });
    expect(found()[0].verified).toBe(true);
    expect(found()[1].stub).toBe(false);
    state = finish(state);
    expect(found()[1].stub).toBe(false);
    state = stepPlaybackReducer(state, { type: 'restart' });
    expect(found()).toEqual([]);
  });

  it('ignores callbacks from an animation canceled by restart or electrical-input reset', () => {
    const first = next(initialStepPlaybackState());
    const reset = stepPlaybackReducer(first, { type: 'restart' });
    const second = next(reset);
    expect(stepPlaybackReducer(second, { type: 'frame', progress: 0.8, run: first.run })).toBe(second);
    expect(stepPlaybackReducer(second, { type: 'finish', run: first.run })).toBe(second);
    expect(stepPlaybackReducer(second, { type: 'frame', progress: 0.4, run: second.run }).progress).toBe(0.4);
  });
});
