import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { I18nProvider, translateMessage } from '../i18n';
import { solveSeriesStub } from '../domain/seriesStub';
import SeriesStubMatching from './SeriesStubMatching';

describe('series-stub laboratory', () => {
  it('starts the series construction paused with empty branch measurements', () => {
    const html = renderToStaticMarkup(<SeriesStubMatching />);
    expect(html).toContain('data-step-key="load"');
    expect(html).toContain('data-tracked-quantity="z_L"');
    expect(html).toContain('1 / 10');
    expect(html).toContain('data-playing="false"');
    expect(html).toContain('data-termination="short"');
    expect(html).toContain('data-summary-branch="0"');
    expect(html).toContain('data-summary-branch="1"');
    const summaryCells = [...html.matchAll(/<span\b[^>]*data-summary-field="[^"]+"[^>]*>([\s\S]*?)<\/span>/g)];
    expect(summaryCells).toHaveLength(4);
    expect(summaryCells.every((cell) => cell[1] === '')).toBe(true);
    expect(html).toContain('>Previous</button>');
    expect(html).toContain('>Next</button>');
    expect(html).toContain('>Restart</button>');
    expect(html.match(/type="range"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Movement speed"');
    expect(html).not.toMatch(/formula--error|katex-error|NaN|Infinity/);
  });

  it('uses the shared compact electrical parameters and a single termination control', () => {
    const html = renderToStaticMarkup(<SeriesStubMatching />);
    expect(html).toContain('parameters-panel--compact');
    expect(html).toContain('parameter-stub parameter-stub--wide');
    for (const [label, value] of [['Main-line impedance', '50'], ['Load resistance', '100'], ['Load reactance', '50']]) {
      const field = html.match(new RegExp('<input[^>]*aria-label="' + label + '"[^>]*>'))?.[0];
      expect(field).toContain('value="' + value + '"');
      expect(field).not.toContain('disabled');
    }
    const stubImpedance = html.match(/<input[^>]*aria-label="Stub impedance"[^>]*>/)?.[0];
    expect(stubImpedance).toContain('disabled');
    expect(stubImpedance).toContain('value="50"');
    expect(html).toContain('aria-label="Same as main line"');
    expect(html.match(/aria-label="Short circuit"/g)).toHaveLength(1);
    expect(html.match(/aria-label="Open circuit"/g)).toHaveLength(1);
    expect(html).not.toContain('aria-label="Construction termination"');
    expect(html).toContain('aria-label="Reset"');
    expect(html).toContain('title="Reset to initial values"');
    expect(html).not.toMatch(/Load type|Manual tuning|Equivalent designs|repetitions|<select\b/);
  });

  it('translates the controls and preserves the displayed mathematical notation', () => {
    const english = renderToStaticMarkup(<SeriesStubMatching />);
    const spanish = renderToStaticMarkup(<I18nProvider initialLocale="es"><SeriesStubMatching /></I18nProvider>);
    expect(spanish).toContain('Parámetros');
    expect(spanish).toContain('aria-label="Resistencia de la carga"');
    expect(spanish).toContain('aria-label="Impedancia del stub"');
    expect(spanish).toContain('aria-label="Restablecer"');
    expect(spanish).toContain('>Siguiente</button>');
    expect(spanish).toContain('Rama 1');
    expect(spanish).toContain('Rama 2');
    const equations = (html: string) => [...html.matchAll(/<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/g)]
      .map((match) => match[1]).filter((tex) => !tex.includes('\\text{'));
    expect(equations(spanish)).toEqual(equations(english));
    expect(spanish).not.toMatch(/formula--error|katex-error|NaN|Infinity/);
  });

  it('localizes the zero-reactance realizations of an already matched series load', () => {
    const solution = solveSeriesStub({ z0: 50, stubZ0: 50, load: { kind: 'impedance', resistance: 50, reactance: 0 } });
    const spanish = translateMessage(solution.message, 'es');
    expect(spanish).toContain('No hace falta un stub en serie');
    expect(spanish).toContain('cortocircuitado de reactancia nula tiene longitud 0');
    expect(spanish).toContain('abierto tiene longitud λs/4');
  });
});
