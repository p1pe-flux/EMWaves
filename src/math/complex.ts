import Complex from 'complex.js';

/** Library-independent values at the numerical model boundary. */
export interface ComplexValue { re: number; im: number }

function plain(value: Complex): ComplexValue {
  return {
    re: Object.is(value.re, -0) ? 0 : value.re,
    im: Object.is(value.im, -0) ? 0 : value.im,
  };
}

/** Use the same Complex.js arithmetic previously dispatched through mathjs. */
export function divideComplex(numerator: ComplexValue, denominator: ComplexValue): ComplexValue {
  return plain(new Complex(numerator.re, numerator.im).div(denominator.re, denominator.im));
}

export function multiplyComplex(value: ComplexValue, factor: ComplexValue | number): ComplexValue {
  const complex = new Complex(value.re, value.im);
  return plain(typeof factor === 'number' ? complex.mul(factor) : complex.mul(factor.re, factor.im));
}
