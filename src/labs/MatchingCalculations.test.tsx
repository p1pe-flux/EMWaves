import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SingleStubMatching from './SingleStubMatching';
import SeriesStubMatching from './SeriesStubMatching';
import QuarterWaveTransformer from './QuarterWaveTransformer';
import LCMatching from './LCMatching';
import DoubleStubMatching from './DoubleStubMatching';
import * as singleStub from '../domain/singleStub';
import * as seriesStub from '../domain/seriesStub';
import * as quarterWave from '../domain/quarterWave';
import * as lumpedMatching from '../domain/lumpedMatching';
import * as doubleStub from '../domain/doubleStub';

afterEach(() => vi.restoreAllMocks());

describe('matching laboratory calculation ownership', () => {
  it.each([
    ['single-stub', () => vi.spyOn(singleStub, 'solveSingleStub'), SingleStubMatching],
    ['series-stub', () => vi.spyOn(seriesStub, 'solveSeriesStub'), SeriesStubMatching],
    ['quarter-wave', () => vi.spyOn(quarterWave, 'solveQuarterWave'), QuarterWaveTransformer],
    ['lumped', () => vi.spyOn(lumpedMatching, 'solveLumpedMatching'), LCMatching],
    ['double-stub', () => vi.spyOn(doubleStub, 'solveDoubleStub'), DoubleStubMatching],
  ] as const)('%s synthesizes once and passes that solution into its construction', (_name, observe, Laboratory) => {
    const synthesis = observe();
    const html = renderToStaticMarkup(<Laboratory />);
    expect(synthesis).toHaveBeenCalledTimes(1);
    expect(html).toContain('data-stage="0"');
    expect(html).not.toMatch(/formula--error|NaN/);
  });
});
