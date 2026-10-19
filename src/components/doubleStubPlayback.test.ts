import { describe, expect, it } from 'vitest';
import { solveDoubleStub } from '../domain/doubleStub';
import { doubleStubResultMilestones, doubleStubSteps } from './doubleStubPlayback';
const solution = solveDoubleStub({ z0: 50, stub1Z0: 50, stub2Z0: 50, distance: 0.125, separation: 0.125, load: { kind: 'impedance', resistance: 100, reactance: 50 } });
describe('double-stub playback and earned lengths', () => {
  it('constructs the backward locus and derives the load-side admittance before either branch', () => {
    const steps = doubleStubSteps(2);
    expect(steps).toHaveLength(15);
    expect(steps.slice(0, 7).map((s) => s.phase)).toEqual(['matched', 'left-circle', 'transport', 'load', 'admittance', 'load-line', 'intersections']);
    expect(steps.slice(7).map((s) => s.branchIndex)).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
    expect(doubleStubSteps(1)).toHaveLength(11);
    expect(doubleStubSteps(0)).toHaveLength(7);
  });
  it('reveals each length only after its construction is completed', () => {
    expect(doubleStubResultMilestones(solution, { stepIndex: 7, completed: false })[0]).toEqual({ branchIndex: 0, stub1: false, stub2: false });
    expect(doubleStubResultMilestones(solution, { stepIndex: 7, completed: true })[0]).toEqual({ branchIndex: 0, stub1: false, stub2: true });
    expect(doubleStubResultMilestones(solution, { stepIndex: 9, completed: false })[0].stub1).toBe(false);
    expect(doubleStubResultMilestones(solution, { stepIndex: 9, completed: true })[0].stub1).toBe(true);
    const second = doubleStubResultMilestones(solution, { stepIndex: 11, completed: false });
    expect(second[0]).toEqual({ branchIndex: 0, stub1: true, stub2: true });
    expect(second[1]).toEqual({ branchIndex: 1, stub1: false, stub2: false });
    expect(doubleStubResultMilestones(solution, { stepIndex: 6, completed: true }).every((s) => !s.stub1 && !s.stub2)).toBe(true);
  });
});
