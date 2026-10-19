import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import katex from 'katex';
import { complexTex, formatNumber, reflectionPhaseRadians, reflectionPolarTex, texNumber } from './format';
import { mathMacros } from './notation';

describe('result formatting', () => {
  it('renders large exponents as powers of ten in TeX', () => {
    expect(texNumber(1.2e21)).toBe('1.2\\times 10^{21}');
  });
  it('rounds without negative zeros or grouping separators in formulas', () => {
    expect(texNumber(-0.00001)).toBe('0');
    expect(texNumber(1200.25)).toBe('1200.25');
  });
  it('distinguishes open circuits, real values and unit imaginary values', () => {
    expect(complexTex(null)).toBe('\\infty');
    expect(complexTex({ re: 50, im: 0 })).toBe('50');
    expect(complexTex({ re: 2, im: -1 })).toBe('2 - \\iu');
    expect(complexTex({ re: 2, im: 1 - Number.EPSILON })).toBe('2 + \\iu');
  });
  it('shows total reflection without NaN in the metrics', () => {
    expect(formatNumber(Infinity)).toBe('∞');
  });
});

describe('reusable number formatters', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.restoreAllMocks());

  it('reuses one formatter per precision across changing animation values', async () => {
    const { formatNumber: cachedFormatNumber } = await import('./format');
    const construct = vi.spyOn(Intl, 'NumberFormat');
    expect(cachedFormatNumber(1234.56789, 3)).toBe('1,234.568');
    expect(cachedFormatNumber(-0.0001, 3)).toBe('0');
    expect(cachedFormatNumber(9.87654, 3)).toBe('9.877');
    expect(cachedFormatNumber(9.87654, 2)).toBe('9.88');
    expect(construct).toHaveBeenCalledTimes(2);
  });

  it('limits cached precisions to 16, retaining the most recently used', async () => {
    const { formatNumber: cachedFormatNumber } = await import('./format');
    const construct = vi.spyOn(Intl, 'NumberFormat');
    for (let digits = 0; digits < 16; digits += 1) cachedFormatNumber(1.234, digits);
    cachedFormatNumber(1.234, 0);
    cachedFormatNumber(1.234, 16);
    cachedFormatNumber(1.234, 0);
    expect(construct).toHaveBeenCalledTimes(17);
    cachedFormatNumber(1.234, 1);
    expect(construct).toHaveBeenCalledTimes(18);
  });

  it('preserves Intl rounding, fractional precision coercion, and negative zero rules', async () => {
    const { formatNumber: cachedFormatNumber } = await import('./format');
    for (const digits of [0, 1, 3, 7.8, 20]) {
      for (const value of [-0, -0.0004999, -1234.56789, 0.0005, 9.99995, 1e21]) {
        const rounded = Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value;
        const expected = new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(rounded);
        expect(cachedFormatNumber(value, digits)).toBe(expected);
      }
    }
  });

  it('keeps invalid precisions as errors, and nonfinite values independent of precision', async () => {
    const { formatNumber: cachedFormatNumber } = await import('./format');
    for (const digits of [-1, 101, Infinity, NaN]) {
      expect(() => cachedFormatNumber(1, digits)).toThrow(RangeError);
      expect(() => cachedFormatNumber(1, digits)).toThrow(RangeError);
      expect(cachedFormatNumber(Infinity, digits)).toBe('∞');
      expect(cachedFormatNumber(-Infinity, digits)).toBe('—');
      expect(cachedFormatNumber(NaN, digits)).toBe('—');
    }
  });
});

describe('polar reflection formatting', () => {
  it.each([
    [{ re: 0.4, im: 0.2 }, Math.atan(0.5)],
    [{ re: -0.4, im: 0.2 }, Math.PI - Math.atan(0.5)],
    [{ re: -0.4, im: -0.2 }, -Math.PI + Math.atan(0.5)],
    [{ re: 0.4, im: -0.2 }, -Math.atan(0.5)],
    [{ re: 1, im: 0 }, 0],
    [{ re: -1, im: 0 }, Math.PI],
    [{ re: 0, im: 1 }, Math.PI / 2],
    [{ re: 0, im: -1 }, -Math.PI / 2],
  ])('computes the principal phase of %j in radians', (gamma, expected) => {
    expect(reflectionPhaseRadians(gamma)).toBeCloseTo(expected, 12);
  });

  it('represents matched loads as zero with an undefined phase', () => {
    expect(reflectionPhaseRadians({ re: 0, im: 0 })).toBeNull();
    expect(reflectionPhaseRadians({ re: -0, im: -0 })).toBeNull();
    expect(reflectionPolarTex({ re: 0, im: 0 })).toBe('0');
  });

  it.each([
    [{ re: 0.4, im: 0.2 }, String.raw`0.447\,e^{\iu\,0.464}`],
    [{ re: 1, im: 0 }, String.raw`1\,e^{\iu\,0}`],
    [{ re: -1, im: 0 }, String.raw`1\,e^{\iu\,3.142}`],
    [{ re: 0, im: 1 }, String.raw`1\,e^{\iu\,1.571}`],
    [{ re: 0, im: -1 }, String.raw`1\,e^{-\iu\,1.571}`],
  ])('renders %j as magnitude and phase in radians', (gamma, expected) => {
    const tex = reflectionPolarTex(gamma);
    expect(tex).toBe(expected);
    expect(() => katex.renderToString(tex, { macros: { ...mathMacros }, throwOnError: true })).not.toThrow();
  });

  it('normalizes signed zeros and phases that round to zero', () => {
    expect(Object.is(reflectionPhaseRadians({ re: 1, im: -0 }), -0)).toBe(false);
    expect(reflectionPhaseRadians({ re: -1, im: -0 })).toBe(Math.PI);
    expect(reflectionPolarTex({ re: 1, im: -0 })).toBe(String.raw`1\,e^{\iu\,0}`);
    expect(reflectionPolarTex({ re: 1, im: -1e-10 })).toBe(String.raw`1\,e^{\iu\,0}`);
  });

  it('uses the requested precision for magnitude and phase', () => {
    expect(reflectionPolarTex({ re: 0.4, im: 0.2 }, 2)).toBe(String.raw`0.45\,e^{\iu\,0.46}`);
  });
});
