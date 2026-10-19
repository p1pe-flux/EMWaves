import { describe, expect, it } from 'vitest';
import { divideComplex, multiplyComplex } from './complex';

describe('typed complex arithmetic boundary', () => {
  it.each([1e-300, 1, 1e300])('divides without squaring an extreme denominator, scale %s', (scale) => {
    const quotient = divideComplex({ re: scale, im: scale }, { re: scale, im: -scale });
    expect(quotient.re).toBe(0);
    expect(quotient.im).toBeCloseTo(1, 14);
  });

  it('preserves signs for imaginary divisors and scalar/complex multiplication', () => {
    expect(divideComplex({ re: 6, im: 4 }, { re: 0, im: 2 })).toEqual({ re: 2, im: -3 });
    expect(multiplyComplex({ re: 3, im: -2 }, { re: 1, im: 4 })).toEqual({ re: 11, im: 10 });
    expect(multiplyComplex({ re: 1e300, im: -1e300 }, 1e-300)).toEqual({ re: 1, im: -1 });
  });

  it('returns detached plain values and normalizes signed zero', () => {
    const input = Object.freeze({ re: -0, im: -0 });
    const result = divideComplex(input, { re: 2, im: 0 });
    expect(result).toEqual({ re: 0, im: 0 });
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(result).not.toBe(input);
    expect(Object.is(result.re, -0)).toBe(false);
    expect(Object.is(result.im, -0)).toBe(false);
  });

  it('leaves singular quotient detection to the caller’s numerical guard', () => {
    const pole = divideComplex({ re: 1, im: 0 }, { re: 0, im: 0 });
    expect(Number.isFinite(pole.re) && Number.isFinite(pole.im)).toBe(false);
  });
});
