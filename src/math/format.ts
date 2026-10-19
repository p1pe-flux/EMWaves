import type { ComplexValue } from '../domain/transmission';

// Formatting animated values is frequent; constructing the locale formatter is
// much more expensive than formatting a number. Bound unusual caller precisions.
const MAX_NUMBER_FORMATTERS = 16;
const numberFormatters = new Map<number, Intl.NumberFormat>();

function numberFormatter(digits: number): Intl.NumberFormat {
  const cached = numberFormatters.get(digits);
  if (cached !== undefined) {
    numberFormatters.delete(digits);
    numberFormatters.set(digits, cached);
    return cached;
  }
  // Keep Intl's own precision validation and rounding behavior.
  const formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: digits });
  if (numberFormatters.size >= MAX_NUMBER_FORMATTERS) {
    numberFormatters.delete(numberFormatters.keys().next().value!);
  }
  numberFormatters.set(digits, formatter);
  return formatter;
}

export function formatNumber(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return value === Infinity ? '∞' : '—';
  const rounded = Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value;
  return numberFormatter(digits).format(rounded);
}

/** Plain TeX numbers omit grouping and use an English decimal point. */
export function texNumber(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return value === Infinity ? '\\infty' : '\\text{—}';
  const rounded = Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value;
  const [mantissa, exponent] = Number(rounded.toFixed(digits)).toString().split('e');
  return mantissa + (exponent === undefined ? '' : '\\times 10^{' + Number(exponent) + '}');
}

export function complexTex(value: ComplexValue | null, digits = 3): string {
  if (value === null) return '\\infty';
  const threshold = 0.5 * 10 ** -digits;
  const re = Math.abs(value.re) < threshold ? 0 : value.re;
  const im = Math.abs(value.im) < threshold ? 0 : value.im;
  if (im === 0) return texNumber(re, digits);
  const imaginaryCoefficient = texNumber(Math.abs(im), digits);
  const imaginary = '\\iu' + (imaginaryCoefficient === '1' ? '' : '\\,' + imaginaryCoefficient);
  if (re === 0) return (im < 0 ? '-' : '') + imaginary;
  return texNumber(re, digits) + (im < 0 ? ' - ' : ' + ') + imaginary;
}

/** Principal reflection phase in radians; a matched load has no defined phase. */
export function reflectionPhaseRadians(gamma: ComplexValue): number | null {
  if (gamma.re === 0 && gamma.im === 0) return null;
  // Normalize signed zeros so a negative real coefficient consistently gives +π.
  const re = gamma.re === 0 ? 0 : gamma.re;
  const im = gamma.im === 0 ? 0 : gamma.im;
  const phase = Math.atan2(im, re);
  return Object.is(phase, -0) ? 0 : phase;
}

/** Polar reflection coefficient; exponential arguments are in radians. */
export function reflectionPolarTex(gamma: ComplexValue, digits = 3): string {
  const phase = reflectionPhaseRadians(gamma);
  if (phase === null) return '0';

  const magnitude = texNumber(Math.hypot(gamma.re, gamma.im), digits);
  const angle = texNumber(phase, digits);
  const negative = angle.startsWith('-');
  return magnitude + '\\,e^{' + (negative ? '-' : '') + '\\iu\\,'
    + (negative ? angle.slice(1) : angle) + '}';
}
