import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import QuarterWaveTransformer from './QuarterWaveTransformer';

describe('quarter-wave laboratory initial design', () => {
  it('starts paused with the complex load in its main-line reference and no stale results', () => {
    const html = renderToStaticMarkup(<QuarterWaveTransformer />);
    expect(html).toContain('data-stage-name="load"');
    expect(html).toContain('data-step-key="load"');
    expect(html).toContain('data-playing="false"');
    expect(html).toContain('data-reference="50"');
    expect(html).toContain('data-distance="0"');
    expect(html).toContain('data-transformer-position="0"');
    expect(html).toContain('1 / 12');
    expect(html).toContain('data-summary-branch="0"');
    expect(html).toContain('data-summary-branch="1"');
    expect(html).toContain('Branch 1');
    expect(html).toContain('Branch 2');
    const summaryCells = [...html.matchAll(/<span\b[^>]*data-summary-field="[^"]+"[^>]*>([\s\S]*?)<\/span>/g)];
    expect(summaryCells).toHaveLength(6);
    expect(summaryCells.every((cell) => cell[1] === '')).toBe(true);
    expect(html).toMatch(/<h4[^>]*>Plot the load impedance<\/h4>/);
    const marker = html.match(/data-chart-marker="tracked-quarter-wave" data-re="([^"]+)" data-im="([^"]+)"/);
    expect(marker).not.toBeNull();
    expect(Number(marker![1])).toBeCloseTo(0.4, 12);
    expect(Number(marker![2])).toBeCloseTo(0.2, 12);
    expect(html).not.toContain('qw-results');
    expect(html).not.toContain('aria-label="Results found"');
    expect(html).not.toContain('At the transformer input');
    expect(html).not.toContain('data-reflection-magnitude=');
    expect(html).not.toMatch(/formula--error|NaN|Infinity/);
  });

  it('accepts editable resistance and reactance without equivalent-design controls', () => {
    const html = renderToStaticMarkup(<QuarterWaveTransformer />);
    for (const [label, value] of [['Main-line impedance', '50'], ['Load resistance', '100'], ['Load reactance', '50']]) {
      const field = html.match(new RegExp('<input[^>]*aria-label="' + label + '"[^>]*>'));
      expect(field).not.toBeNull();
      expect(field![0]).toContain('value="' + value + '"');
      expect(field![0]).not.toContain('disabled');
      if (label === 'Load reactance') expect(field![0]).not.toContain('min=');
    }
    expect(html).not.toContain('Load type');
    expect(html).not.toMatch(/<select\b/);
    const aside = html.match(/<aside\b[^>]*>([\s\S]*?)<\/aside>/)?.[1];
    expect(aside).toBeDefined();
    expect(aside).not.toContain('Equivalent designs');
    expect(aside).not.toContain('Main-line repetitions n');
    expect(aside).not.toContain('Transformer repetitions m');
    expect(aside).toContain('aria-label="Reset"');
    expect(aside).toContain('title="Reset to initial values"');
    expect(aside).toMatch(/<button\b[^>]*class="icon-button parameter-reset"[^>]*>\s*<svg\b/);
    expect(html).not.toContain('aria-label="Stub impedance"');
  });

  it('offers numbered-step navigation and speed without manual modes or solution cards', () => {
    const html = renderToStaticMarkup(<QuarterWaveTransformer />);
    expect(html).toContain('>Previous</button>');
    expect(html).toContain('>Next</button>');
    expect(html).toContain('>Restart</button>');
    expect(html.match(/type="range"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Movement speed"');
    expect(html).not.toMatch(/<button\b[^>]*>\s*(?:Play|Pause)\s*<\/button>/);
    expect(html).not.toContain('ssl-card');
    expect(html).not.toMatch(/<h2\b[^>]*>Matching solutions<\/h2>/);
    expect(html).not.toContain('Automatic steps');
    expect(html).not.toContain('Manual tuning');
    expect(html).not.toContain('Solver mode');
    expect(html).not.toContain('Construction progress');
    expect(html).not.toContain('role="progressbar"');
  });
});
