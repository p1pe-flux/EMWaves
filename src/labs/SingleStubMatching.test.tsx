import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import SingleStubMatching from './SingleStubMatching';

describe('single-stub laboratory initial design', () => {
  it('starts both branches with compact summaries and no stale measurements', () => {
    const html = renderToStaticMarkup(<SingleStubMatching />);
    expect(html).toContain('data-variant="guide"');
    expect(html).toContain('data-step-key="z_load"');
    expect(html).toContain('data-tracked-quantity="z_L"');
    expect(html).toContain('1 / 11');
    expect(html).toContain('data-summary-branch="0"');
    expect(html).toContain('data-summary-branch="1"');
    expect(html).not.toMatch(/<h2\b[^>]*>Matching solutions<\/h2>/);
    const summaryCells = [...html.matchAll(/<span\b[^>]*data-summary-field="[^"]+"[^>]*>([\s\S]*?)<\/span>/g)];
    expect(summaryCells).toHaveLength(4);
    expect(summaryCells.every((cell) => cell[1] === '')).toBe(true);
    expect(html).not.toContain('data-summary-field="stub-admittance"');
    expect(html).not.toContain('ssl-card');
    expect(html).not.toContain('Junction measurements');
    expect(html).not.toContain('At the stub junction');
    expect(html).not.toContain('data-reflection-magnitude=');
    expect(html).not.toContain('formula--error');
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it('keeps only editable electrical parameters beside the paused step controls', () => {
    const html = renderToStaticMarkup(<SingleStubMatching />);
    for (const [label, value] of [['Main-line impedance', '50'], ['Load resistance', '100'], ['Load reactance', '50']]) {
      const field = html.match(new RegExp('<input[^>]*aria-label="' + label + '"[^>]*>'));
      expect(field).not.toBeNull();
      expect(field![0]).toContain('value="' + value + '"');
      expect(field![0]).not.toContain('disabled');
    }
    expect(html).not.toContain('Load type');
    expect(html).not.toContain('aria-label="Construction termination"');
    expect(html).toMatch(/<input[^>]*aria-label="Short circuit"[^>]*\/>Short<\/label>/);
    expect(html).toMatch(/<input[^>]*aria-label="Open circuit"[^>]*\/>Open<\/label>/);
    expect(html).not.toMatch(/<select\b/);
    expect(html).toContain('Same as main line');
    const stubImpedance = html.match(/<input[^>]*aria-label="Stub impedance"[^>]*>/);
    expect(stubImpedance).not.toBeNull();
    expect(stubImpedance![0]).toContain('disabled');
    expect(stubImpedance![0]).toContain('value="50"');
    expect(html).toContain('data-playing="false"');
    expect(html).toContain('data-termination="short"');
    expect(html).toContain('>Previous</button>');
    expect(html).toContain('>Next</button>');
    expect(html).toContain('>Restart</button>');
    expect(html.match(/type="range"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Movement speed"');
    expect(html).not.toContain('Automatic steps');
    expect(html).not.toContain('Manual tuning');
    expect(html).not.toContain('Restore selected solution');
    expect(html).not.toContain('Restore matched configuration');
    expect(html).not.toContain('aria-label="Manual placement slider"');
    expect(html).not.toContain('aria-label="Manual stub length slider"');
    const diagramPosition = html.match(/<g[^>]*aria-label="Stub placement"[^>]*>/)?.[0];
    if (diagramPosition) {
      expect(diagramPosition).toContain('aria-disabled="true"');
      expect(diagramPosition).toContain('tabindex="-1"');
    }
    expect(html).not.toContain('aria-label="Stub length"');
    const aside = html.match(/<aside\b[^>]*>([\s\S]*?)<\/aside>/)?.[1];
    expect(aside).toBeDefined();
    expect(aside).not.toContain('Equivalent designs');
    expect(aside).not.toContain('Main-line repetitions n');
    expect(aside).not.toContain('Stub repetitions m');
    expect(aside).toContain('aria-label="Reset"');
    expect(aside).toContain('title="Reset to initial values"');
    expect(aside).toMatch(/<button\b[^>]*class="icon-button parameter-reset"[^>]*>\s*<svg\b/);
  });

  it('keeps the general deduction in Read guide and starts the lab with load impedance', () => {
    const html = renderToStaticMarkup(<SingleStubMatching />);
    expect(html).not.toContain('ss-deduction');
    expect(html).not.toContain('What must the shunt stub do?');
    expect(html).not.toContain('Tune the match');
    expect(html).not.toContain('Solver mode');
    expect(html).toMatch(/<h4[^>]*>Plot the load impedance<\/h4>/);
    expect(html).toContain('data-stage-name="z_load"');
  });
});
