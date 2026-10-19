import { describe, expect, it } from 'vitest';
import { DomainError } from './errors';
import { impedanceToReflection, solveLine } from './transmission';
import { solveDoubleStub } from './doubleStub';
import { evaluateLumpedMatching } from './lumpedMatching';
import { advanceLinePosition } from './lineTraversal';
import { projectionGrid } from './smithProjection';

function caught(action: () => unknown): DomainError {
  try { action(); } catch (error) {
    expect(error).toBeInstanceOf(RangeError);
    expect(error).toBeInstanceOf(DomainError);
    return error as DomainError;
  }
  throw new Error('Expected a structured domain failure.');
}

describe('stable numerical domain errors', () => {
  it('preserves the public English message while carrying the invalid field', () => {
    const error = caught(() => solveLine({ z0: NaN, load: { kind: 'short' }, lengthInWavelengths: 0 }));
    expect(error.code).toBe('value.not-finite');
    expect(error.params).toEqual({ label: 'Characteristic impedance' });
    expect(error.message).toBe('Characteristic impedance must be a finite number.');
    expect(Object.isFrozen(error.params)).toBe(true);
  });

  it('retains the failing real or imaginary coordinate in structured metadata', () => {
    const error = caught(() => impedanceToReflection({ re: 1, im: Infinity }));
    expect(error.code).toBe('value.not-finite');
    expect(error.params.label).toBe('Normalized impedance: imaginary part');
    expect(error.message).toBe('Normalized impedance: imaginary part must be a finite number.');
  });

  it('identifies the second physical component when its value is invalid', () => {
    const error = caught(() => evaluateLumpedMatching({
      z0: 50, frequencyHz: 1e9, load: { kind: 'impedance', resistance: 100, reactance: 50 },
      elements: [{ component: 'L', connection: 'series' }, { component: 'C', connection: 'parallel' }],
      values: [1e-9, -1],
    }));
    expect(error.code).toBe('value.not-positive');
    expect(error.params.label).toBe('Element 2 value');
    expect(error.message).toBe('Element 2 value must be greater than zero.');
  });

  it('preserves double-stub numbering in validation failures', () => {
    const error = caught(() => solveDoubleStub({
      z0: 50, load: { kind: 'impedance', resistance: 100, reactance: 50 },
      distance: 0.125, separation: 0.125, stub1Z0: 50, stub2Z0: 0,
    }));
    expect(error.code).toBe('value.not-positive');
    expect(error.params.label).toBe('Stub 2 characteristic impedance');
  });

  it('provides distinct codes for invalid animation timing and projection samples', () => {
    expect(caught(() => advanceLinePosition(0, 1, -1)).code).toBe('line.invalid-elapsed-time');
    expect(caught(() => projectionGrid(0.5, { segments: 8 })).code).toBe('projection.invalid-segments');
  });
});
