import { describe, expect, it } from 'vitest';
import { advanceLinePosition, clampLinePosition, parseLineLength } from './lineTraversal';

describe('total transmission-line length', () => {
  it.each([
    ['0', 0], [' 0 ', 0], ['.25', 0.25], ['1', 1], ['2.75', 2.75], ['1e6', 1e6],
    [String(Number.MAX_VALUE), Number.MAX_VALUE],
  ])('parses a finite nonnegative wavelength length: %s', (text, expected) => {
    expect(parseLineLength(text)).toBe(expected);
  });

  it('normalizes signed zero', () => {
    expect(Object.is(parseLineLength('-0'), -0)).toBe(false);
  });

  it.each(['', ' ', '\n\t', '-0.01', 'abc', 'NaN', 'Infinity', '-Infinity', '1e309'])(
    'rejects an absent or invalid total length: %j', (text) => {
      expect(() => parseLineLength(text)).toThrow(RangeError);
    },
  );

  it('provides a useful message for an empty field', () => {
    expect(() => parseLineLength('')).toThrow('Enter the total line length in wavelengths.');
  });
});

describe('position within a finite line', () => {
  it.each([
    [-0.5, 1, 0], [0, 0, 0], [0.25, 1, 0.25], [2.5, 3, 2.5], [4, 3, 3],
    [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE],
  ])('clamps distance %s to a line of length %s', (distance, length, expected) => {
    expect(clampLinePosition(distance, length)).toBe(expected);
  });

  it('keeps a selected point inside the line after its length shrinks', () => {
    expect(clampLinePosition(0.8, 0.4)).toBe(0.4);
    expect(clampLinePosition(0.8, 0)).toBe(0);
    expect(clampLinePosition(0.25, 0.4)).toBe(0.25);
  });

  it.each([-0.1, NaN, Infinity, -Infinity])('rejects invalid total length %s', (length) => {
    expect(() => clampLinePosition(0, length)).toThrow(RangeError);
  });

  it.each([NaN, Infinity, -Infinity])('rejects a nonfinite position %s', (distance) => {
    expect(() => clampLinePosition(distance, 1)).toThrow(RangeError);
  });
});

describe('load-to-generator animation timing', () => {
  it.each([0.25, 1, 2.5, 10, Number.MAX_VALUE])(
    'traverses one quarter and the full line in the same time for L=%s', (length) => {
      expect(advanceLinePosition(0, length, 0)).toBe(0);
      expect(advanceLinePosition(0, length, 2000)).toBe(length / 4);
      expect(advanceLinePosition(0, length, 4000)).toBe(length / 2);
      expect(advanceLinePosition(0, length, 8000)).toBe(length);
    },
  );

  it('advances from a selected section and stops at the generator', () => {
    expect(advanceLinePosition(0.5, 2, 2000)).toBe(1);
    expect(advanceLinePosition(0.125, 0.25, 4000)).toBe(0.25);
    expect(advanceLinePosition(1.9, 2, 2000)).toBe(2);
    expect(advanceLinePosition(2, 2, 500)).toBe(2);
    expect(advanceLinePosition(2, 2, 50000)).toBe(2);
  });

  it('clamps the starting position before advancing', () => {
    expect(advanceLinePosition(-1, 2, 2000)).toBe(0.5);
    expect(advanceLinePosition(4, 2, 0)).toBe(2);
    expect(advanceLinePosition(0.8, 0.4, 100)).toBe(0.4);
    expect(advanceLinePosition(1, 0, 100)).toBe(0);
  });

  it('gives equivalent positions for one elapsed interval and multiple frame chunks', () => {
    const chunks = [123, 877, 1000, 250, 1750];
    const length = 2.5;
    let distance = 0;
    for (const elapsed of chunks) distance = advanceLinePosition(distance, length, elapsed);
    expect(distance).toBeCloseTo(advanceLinePosition(0, length, 4000), 12);
    for (let frame = 0; frame < 16; frame += 1) distance = advanceLinePosition(distance, length, 500);
    expect(distance).toBe(length);
  });

  it('moves monotonically and remains inside a multi-wavelength line', () => {
    const length = 3.75;
    let distance = 0;
    for (let frame = 0; frame < 600; frame += 1) {
      const next = advanceLinePosition(distance, length, 16);
      expect(next).toBeGreaterThanOrEqual(distance);
      expect(next).toBeLessThanOrEqual(length);
      distance = next;
    }
    expect(distance).toBe(length);
  });

  it('handles zero and extreme finite lengths without overflow', () => {
    expect(advanceLinePosition(0, 0, 8000)).toBe(0);
    expect(advanceLinePosition(0, Number.MIN_VALUE, 8000)).toBe(Number.MIN_VALUE);
    expect(advanceLinePosition(Number.MAX_VALUE * 0.75, Number.MAX_VALUE, 4000)).toBe(Number.MAX_VALUE);
    expect(advanceLinePosition(0, Number.MAX_VALUE, Number.MAX_VALUE)).toBe(Number.MAX_VALUE);
  });

  it.each([-1, NaN, Infinity, -Infinity])('rejects invalid elapsed time %s', (elapsed) => {
    expect(() => advanceLinePosition(0, 1, elapsed)).toThrow(RangeError);
  });

  it('also rejects invalid position and line length during animation', () => {
    expect(() => advanceLinePosition(NaN, 1, 16)).toThrow(RangeError);
    expect(() => advanceLinePosition(0, -1, 16)).toThrow(RangeError);
  });
});
