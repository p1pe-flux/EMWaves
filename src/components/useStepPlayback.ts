import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { singleStubPlaybackProgress } from './singleStubPlayback';

export interface StepPlaybackState {
  stage: number;
  progress: number;
  playing: boolean;
  direction: 1 | -1;
  run: number;
}

export type StepPlaybackAction =
  | { type: 'next'; stepCount: number }
  | { type: 'previous' }
  | { type: 'restart' }
  | { type: 'frame'; progress: number; run: number }
  | { type: 'finish'; run: number };

export function initialStepPlaybackState(): StepPlaybackState {
  return { stage: 0, progress: 1, playing: false, direction: 1, run: 0 };
}

/** One action changes a complete playback state; stale animation callbacks are ignored. */
export function stepPlaybackReducer(state: StepPlaybackState, action: StepPlaybackAction): StepPlaybackState {
  switch (action.type) {
    case 'next':
      if (state.playing || state.stage >= action.stepCount - 1) return state;
      return { stage: state.stage + 1, progress: 0, playing: true, direction: 1, run: state.run + 1 };
    case 'previous':
      if (state.playing || state.stage === 0) return state;
      return { ...state, playing: true, direction: -1, run: state.run + 1 };
    case 'restart':
      return { ...initialStepPlaybackState(), run: state.run + 1 };
    case 'frame':
      if (!state.playing || state.run !== action.run) return state;
      return { ...state, progress: Math.max(0, Math.min(1, action.progress)) };
    case 'finish':
      if (!state.playing || state.run !== action.run) return state;
      return { ...state, stage: state.direction === -1 ? Math.max(0, state.stage - 1) : state.stage, progress: 1, playing: false };
  }
}

/** Matching constructions animate one transition and then stop at its completed state. */
export function useStepPlayback(steps: readonly { duration: number }[], resetKey: string) {
  const [state, dispatch] = useReducer(stepPlaybackReducer, undefined, initialStepPlaybackState);
  const [speed, setSpeed] = useState(1);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined'
    && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const progress = useRef(state.progress);
  progress.current = state.progress;
  const stage = Math.min(state.stage, steps.length - 1);
  const duration = steps[stage].duration;

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => { dispatch({ type: 'restart' }); }, [resetKey]);

  useEffect(() => {
    if (!state.playing) return;
    const run = state.run;
    const finish = () => dispatch({ type: 'finish', run });
    if (reducedMotion) {
      dispatch({ type: 'frame', progress: state.direction === 1 ? 1 : 0, run });
      const timer = window.setTimeout(finish, 250 / speed);
      return () => window.clearTimeout(timer);
    }
    const initial = progress.current;
    const started = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const next = singleStubPlaybackProgress(initial, Math.max(0, now - started), duration, state.direction, speed);
      dispatch({ type: 'frame', progress: next, run });
      if (state.direction === 1 ? next < 1 : next > 0) frame = requestAnimationFrame(tick);
      else finish();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state.playing, state.direction, state.run, duration, reducedMotion, speed]);

  const next = useCallback(() => dispatch({ type: 'next', stepCount: steps.length }), [steps.length]);
  const previous = useCallback(() => dispatch({ type: 'previous' }), []);
  const restart = useCallback(() => dispatch({ type: 'restart' }), []);
  return {
    stage, progress: state.progress, playing: state.playing, direction: state.direction, completed: state.progress >= 1 && !state.playing,
    speed, setSpeed, reducedMotion, next, previous, restart,
    canNext: !state.playing && stage < steps.length - 1,
    canPrevious: !state.playing && stage > 0,
  };
}
