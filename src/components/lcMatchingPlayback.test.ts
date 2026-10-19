import { describe, expect, it } from 'vitest';
import { getLCMatchingConstructionSteps, lcMatchingResultMilestones } from './lcMatchingPlayback';

describe('L–C adjacent-step playback', () => {
  it('separates drawing, each component addition, and reading the other grid at the same point', () => {
    expect(getLCMatchingConstructionSteps(true).map(step => step.phase)).toEqual(['load', 'read-load', 'circles', 'add-load', 'convert', 'add-source', 'verify']);
    expect(getLCMatchingConstructionSteps(false).map(step => step.phase)).toEqual(['load', 'circles', 'add-load', 'convert', 'add-source', 'verify']);
    expect(getLCMatchingConstructionSteps(true, 0, false).map(step => step.phase)).toEqual(['load', 'read-load', 'circles', 'case']);
  });

  it('reveals each result only after addition completes and hides it immediately on rewind', () => {
    const steps = getLCMatchingConstructionSteps(true);
    const at = (stepIndex: number, completed = true) => lcMatchingResultMilestones(steps, { stepIndex, completed });
    expect(at(3, false).size).toBe(0);
    expect(at(3).get(0)).toEqual({ load: true, source: false });
    expect(at(5, false).get(0)).toEqual({ load: true, source: false });
    expect(at(5).get(0)).toEqual({ load: true, source: true });
    expect(at(2).size).toBe(0);
    expect(at(6).get(0)).toEqual({ load: true, source: true });
  });
});
