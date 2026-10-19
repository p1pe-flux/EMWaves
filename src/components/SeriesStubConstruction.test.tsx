import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { solveSeriesStub, type SeriesStubInput } from '../domain/seriesStub';
import { SeriesStubConstruction } from './SeriesStubConstruction';
import { SeriesStubDiagram } from './SeriesStubDiagram';
import { SeriesStubBranchSummary } from './SeriesStubBranchSummary';
import { getSeriesStubConstructionSteps } from './seriesStubPlayback';

const input: SeriesStubInput = { z0: 50, stubZ0: 50, load: { kind: 'impedance', resistance: 100, reactance: 50 } };

describe('series-stub construction and schematic', () => {
  it('starts paused with physical zL and impedance grid, ten steps, and one speed slider', () => {
    const html = renderToStaticMarkup(<SeriesStubConstruction input={input} />);
    expect(html).toContain('data-tracked-quantity="z_L"');
    expect(html).toContain('data-grid="impedance"');
    expect(html).toContain('data-playing="false"');
    expect(html).toContain('data-stage-progress="1.000"');
    expect(html).toContain('1 / 10');
    const marker = html.match(/data-chart-marker="tracked-load" data-re="([^"]+)" data-im="([^"]+)"/)!;
    expect(Number(marker[1])).toBeCloseTo(0.4, 12);
    expect(Number(marker[2])).toBeCloseTo(0.2, 12);
    expect(html).toContain('>Previous</button>');
    expect(html).toContain('>Next</button>');
    expect(html).toContain('>Restart</button>');
    expect(html.match(/type="range"/g)).toHaveLength(1);
    expect(html).not.toMatch(/<button[^>]*>(Play|Pause)<\/button>|Construction progress|progressbar|admittance|formula--error|NaN/);
    expect(html.indexOf('ss-construction__toolbar')).toBeLessThan(html.indexOf('ss-construction__body'));
    expect(html.indexOf('ss-construction__circuit')).toBeLessThan(html.indexOf('ss-construction__lesson'));
    expect(html).toContain('data-stub-present="false"');
  });

  it.each(['open', 'short'] as const)('inserts a %s two-terminal stub only in the upper rail', (termination) => {
    const html = renderToStaticMarkup(<SeriesStubDiagram input={input} termination={termination} distance={0.125} stubLength={0.125} />);
    expect(html).toContain('data-stub-topology="series"');
    expect(html).toContain('data-stub-projection="out-of-plane"');
    expect(html).toContain('data-series-terminal-left="366"');
    expect(html).toContain('data-series-terminal-right="400"');
    expect(html).toContain('data-main-conductor="upper" data-series-gap="true" d="M110 150H366M400 150H480"');
    expect(html).toContain('data-main-conductor="lower" data-continuous="true" d="M110 230H480"');
    expect(html).toContain('data-stub-conductor="first"');
    expect(html).toContain('data-stub-conductor="second"');
    expect(html).toContain('data-stub-end="' + termination + '"');
    expect(html).not.toContain('role="slider"');
  });

  it('can show a detached series element and a conceptual drawing with symbolic ports', () => {
    const detached = renderToStaticMarkup(<SeriesStubDiagram input={input} attached={false} />);
    expect(detached).toContain('data-attached="false"');
    expect(detached).toContain('data-main-conductor="upper" data-series-gap="false" d="M110 150H480"');
    const conceptual = renderToStaticMarkup(<SeriesStubDiagram input={input} abstractLabels />);
    for (const symbol of ['series-stub__port--input', 'series-stub__port--line', 'series-stub__port--stub']) expect(conceptual).toContain(symbol);
    expect(conceptual).not.toContain('100 + j50 Ω');
  });

  it('keeps result cards empty until the associated step is complete and retains branch 1', () => {
    const solution = solveSeriesStub(input);
    const steps = getSeriesStubConstructionSteps();
    const render = (stepIndex: number, completed = true) => renderToStaticMarkup(<SeriesStubBranchSummary solution={solution} steps={steps} position={{ stepIndex, completed }} termination="short" />);
    expect(render(2, false).match(/data-found="false"/g)).toHaveLength(4);
    expect(render(2).match(/data-found="true"/g)).toHaveLength(1);
    expect(render(4, false).match(/data-found="true"/g)).toHaveLength(1);
    expect(render(4).match(/data-found="true"/g)).toHaveLength(2);
    expect(render(6, false).match(/data-found="true"/g)).toHaveLength(2);
    expect(render(9).match(/data-found="true"/g)).toHaveLength(4);
    expect(render(9)).toContain('d=\\mathbf{0.125}');
    expect(render(9)).toContain('d=\\mathbf{0.448792}');
    expect(render(9)).toContain('\\ell_s=\\mathbf{0.375}');
    expect(render(3).match(/data-found="true"/g)).toHaveLength(1);
    expect(render(0).match(/data-found="false"/g)).toHaveLength(4);
    expect(render(9)).not.toMatch(/stub-reactance|formula--error|NaN/);
  });

  it('explains special cases and clears invalid input without stale chart results', () => {
    for (const load of [{ kind: 'open' } as const, { kind: 'short' } as const, { kind: 'impedance', resistance: 0, reactance: 50 } as const, { kind: 'impedance', resistance: 50, reactance: 0 } as const]) {
      const html = renderToStaticMarkup(<SeriesStubConstruction input={{ ...input, load }} />);
      expect(html).toContain('role="status"');
      expect(html).not.toMatch(/data-chart-marker|formula--error|NaN|Infinity/);
    }
    const invalid = renderToStaticMarkup(<SeriesStubConstruction input={{ ...input, stubZ0: 0 }} />);
    expect(invalid).toContain('role="status"');
    expect(invalid).not.toMatch(/data-chart-marker|NaN/);
  });
});
