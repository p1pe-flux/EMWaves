import { describe, expect, it } from 'vitest';
import { LINE_EXAMPLE, solveLineExample } from './lineExample';
import type { ComplexValue } from './transmission';

function expectComplex(actual: ComplexValue | null, re: number, im: number): void {
  expect(actual).not.toBeNull();
  expect(actual!.re).toBeCloseTo(re, 10);
  expect(actual!.im).toBeCloseTo(im, 10);
}

/** Independent V/I expression, avoiding tan's poles at quarter-wave positions. */
function analyticImpedance(distance: number): ComplexValue {
  const angle = 2 * Math.PI * distance;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  // (zL cos βℓ + j sin βℓ) / (cos βℓ + j zL sin βℓ), zL = 2+j.
  const numeratorRe = 2 * c;
  const numeratorIm = c + s;
  const denominatorRe = c - s;
  const denominatorIm = 2 * s;
  const denominator = denominatorRe ** 2 + denominatorIm ** 2;
  return {
    re: 50 * (numeratorRe * denominatorRe + numeratorIm * denominatorIm) / denominator,
    im: 50 * (numeratorIm * denominatorRe - numeratorRe * denominatorIm) / denominator,
  };
}

describe('one-wavelength worked transmission-line example', () => {
  it('defines the fixed physical line and analytic load quantities', () => {
    expect(LINE_EXAMPLE).toEqual({
      z0: 50,
      load: { kind: 'impedance', resistance: 100, reactance: 50 },
      lengthInWavelengths: 1,
    });
    const { solution, normalizedInput, inputPhase } = solveLineExample(0);
    expectComplex(solution.normalizedLoad, 2, 1);
    expectComplex(solution.loadReflection, 0.4, 0.2);
    expectComplex(normalizedInput, 2, 1);
    expect(inputPhase).toBeCloseTo(Math.atan(0.5), 12);
    expect(solution.reflectionMagnitude).toBeCloseTo(1 / Math.sqrt(5), 12);
    expect(solution.vswr).toBeCloseTo((3 + Math.sqrt(5)) / 2, 12);
  });

  it.each([
    [0, 100, 50],
    [1 / 8, 50, -50],
    [1 / 4, 20, -10],
    [3 / 8, 25, 25],
    [1 / 2, 100, 50],
    [3 / 4, 20, -10],
    [1, 100, 50],
  ])('has the expected impedance at ℓ/λ=%s', (distance, resistance, reactance) => {
    const { solution, normalizedInput } = solveLineExample(distance);
    expectComplex(solution.inputImpedance, resistance, reactance);
    expectComplex(normalizedInput, resistance / 50, reactance / 50);
    const analytic = analyticImpedance(distance);
    expectComplex(solution.inputImpedance, analytic.re, analytic.im);
  });

  it('agrees with the independent voltage/current formula across the full line', () => {
    for (let index = 0; index <= 256; index += 1) {
      const distance = index / 256;
      const { solution, normalizedInput, inputPhase } = solveLineExample(distance);
      const analytic = analyticImpedance(distance);
      expectComplex(solution.inputImpedance, analytic.re, analytic.im);
      expectComplex(normalizedInput, analytic.re / 50, analytic.im / 50);
      expect(Math.hypot(solution.inputReflection.re, solution.inputReflection.im)).toBeCloseTo(Math.sqrt(0.2), 12);
      expect(solution.vswr).toBeCloseTo((3 + Math.sqrt(5)) / 2, 12);
      expect(inputPhase).not.toBeNull();
      expect(solution.reflectionMagnitude * Math.cos(inputPhase!)).toBeCloseTo(solution.inputReflection.re, 12);
      expect(solution.reflectionMagnitude * Math.sin(inputPhase!)).toBeCloseTo(solution.inputReflection.im, 12);
    }
  });

  it('rotates clockwise twice over one wavelength', () => {
    expectComplex(solveLineExample(1 / 8).solution.inputReflection, 0.2, -0.4);
    let previous = solveLineExample(0).solution.inputReflection;
    let totalAngle = 0;
    for (let index = 1; index <= 128; index += 1) {
      const current = solveLineExample(index / 128).solution.inputReflection;
      const increment = Math.atan2(
        previous.re * current.im - previous.im * current.re,
        previous.re * current.re + previous.im * current.im,
      );
      expect(increment).toBeLessThan(0);
      totalAngle += increment;
      previous = current;
    }
    expect(totalAngle).toBeCloseTo(-4 * Math.PI, 11);
  });

  it('repeats impedance and reflection every half wavelength', () => {
    for (const distance of [0, 0.031, 0.125, 0.25, 0.375, 0.5]) {
      const first = solveLineExample(distance);
      const repeated = solveLineExample(distance + 0.5);
      expectComplex(repeated.solution.inputImpedance, first.solution.inputImpedance!.re, first.solution.inputImpedance!.im);
      expectComplex(repeated.solution.inputReflection, first.solution.inputReflection.re, first.solution.inputReflection.im);
      expect(repeated.inputPhase).toBeCloseTo(first.inputPhase!, 12);
    }
  });

  it.each([-1, -Number.MIN_VALUE, 1 + Number.EPSILON, Infinity, -Infinity, NaN])(
    'rejects positions outside the finite one-wavelength line: %s', (distance) => {
      expect(() => solveLineExample(distance)).toThrow(RangeError);
    },
  );
});
