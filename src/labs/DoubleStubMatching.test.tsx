import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../i18n';
import DoubleStubMatching from './DoubleStubMatching';

describe('double-stub laboratory initial design', () => {
  it('keeps load and physical positions editable with separately linked stub impedances', () => {
    const html = renderToStaticMarkup(<DoubleStubMatching />);
    for (const [label, value] of [
      ['Main-line impedance', '50'], ['Load resistance', '100'], ['Load reactance', '50'],
      ['Load to stub 2 distance d₁', '0.125'], ['Stub separation d₂', '0.125'],
    ]) {
      const field = html.match(new RegExp('<input[^>]*aria-label="' + label + '"[^>]*>'))?.[0];
      expect(field).toBeDefined();
      expect(field).toContain('value="' + value + '"');
      expect(field).not.toContain('disabled');
    }
    for (const index of [1, 2]) {
      const field = html.match(new RegExp('<input[^>]*aria-label="Stub ' + index + ' impedance"[^>]*>'))?.[0];
      expect(field).toContain('value="50"');
      expect(field).toContain('disabled');
      expect(html).toContain('Stub ' + index + ': same as main line');
      expect(html).toContain('Stub ' + index + ' termination');
      const short = html.match(new RegExp('<input[^>]*name="double-stub-' + index + '-termination"[^>]*checked=""[^>]*>'));
      expect(short).not.toBeNull();
    }
    expect(html).toContain('Stub 1 — generator side');
    expect(html).toContain('Stub 2 — load side');
    expect(html.match(/type="checkbox"/g)).toHaveLength(2);
    expect(html.match(/type="radio"/g)).toHaveLength(4);
    expect(html).not.toContain('Load type');
    expect(html).not.toMatch(/<select\b/);
  });

  it('starts paused with two empty branch summaries without equivalent-design controls', () => {
    const html = renderToStaticMarkup(<DoubleStubMatching />);
    expect(html).toContain('data-playing="false"');
    expect(html).toContain('data-summary-branch="0"');
    expect(html).toContain('data-summary-branch="1"');
    const cells = [...html.matchAll(/<span\b[^>]*data-summary-field="[^"]+"[^>]*>([\s\S]*?)<\/span>/g)];
    expect(cells).toHaveLength(4);
    expect(cells.every((cell) => cell[1] === '')).toBe(true);
    expect(html).toContain('data-summary-field="stub-1-length"');
    expect(html).toContain('data-summary-field="stub-2-length"');
    expect(html).not.toContain('Equivalent designs');
    expect(html).not.toContain('Stub 1 repetitions m₁');
    expect(html).not.toContain('Stub 2 repetitions m₂');
    expect(html).toContain('aria-label="Movement speed"');
    expect(html).toContain('>Previous</button>');
    expect(html).toContain('>Next</button>');
    expect(html).toContain('>Restart</button>');
    expect(html).not.toContain('>Play</button>');
    expect(html).not.toContain('Manual tuning');
    expect(html).not.toContain('data-reflection-magnitude=');
    expect(html).not.toMatch(/formula--error|katex-error|NaN|Infinity/);
  });

  it('translates the parameter controls and preserves their electrical defaults', () => {
    const html = renderToStaticMarkup(<I18nProvider initialLocale="es"><DoubleStubMatching /></I18nProvider>);
    expect(html).toContain('>Parámetros</h2>');
    expect(html).toContain('aria-label="Restablecer"');
    expect(html).toContain('aria-label="Resistencia de la carga"');
    expect(html).toContain('aria-label="Distancia d₁ de la carga al stub 2"');
    expect(html).toContain('aria-label="Separación d₂ entre stubs"');
    expect(html).toContain('Stub 1 — lado del generador');
    expect(html).toContain('Stub 2 — lado de la carga');
    expect(html).not.toContain('Diseños equivalentes');
    expect(html).not.toContain('Repeticiones m₁ del stub 1');
    expect(html).not.toContain('Repeticiones m₂ del stub 2');
    expect(html).toContain('Rama 1');
    expect(html).not.toContain('Load resistance');
    expect(html).not.toMatch(/formula--error|katex-error|NaN|Infinity/);
  });
});
