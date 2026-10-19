import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { QuarterWaveConstruction } from './QuarterWaveConstruction';
import type { QuarterWaveInput } from '../domain/quarterWave';
import { I18nProvider } from '../i18n';
import * as playback from './useStepPlayback';

const example: QuarterWaveInput = { z0: 50, load: { kind: 'impedance', resistance: 100, reactance: 50 } };
describe('quarter-wave animated construction', () => {
  it('starts paused at the physical load before drawing circles or a transformer', () => {
    const html = renderToStaticMarkup(<QuarterWaveConstruction input={example} />);
    expect(html).toContain('data-stage="0"');
    expect(html).toContain('data-stage-name="load"');
    expect(html).toContain('data-playing="false"');
    expect(html).toContain('data-reference="50"');
    expect(html).toContain('data-transformer-present="false"');
    const marker = html.match(/data-chart-marker="tracked-quarter-wave" data-re="([^"]+)" data-im="([^"]+)"/);
    expect(marker).not.toBeNull();
    expect(Number(marker![1])).toBeCloseTo(0.4, 12);
    expect(Number(marker![2])).toBeCloseTo(0.2, 12);
    expect(html).toContain('<annotation encoding="application/x-tex">z_L</annotation>');
    expect(html).not.toContain('data-chart-path="load-swr"');
    expect(html).not.toContain('formula--error');
  });
  it('has a single twelve-step sequence and only a speed slider above the chart', () => {
    const html = renderToStaticMarkup(<QuarterWaveConstruction input={example} />);
    expect(html).toContain('1 / 12');
    expect(html).toContain('data-summary-branch="0"');
    expect(html).toContain('data-summary-branch="1"');
    expect(html).toContain('Branch 1');
    expect(html).toContain('Branch 2');
    const cells = [...html.matchAll(/<span\b[^>]*data-summary-field="[^"]+"[^>]*>([\s\S]*?)<\/span>/g)];
    expect(cells).toHaveLength(6);
    expect(cells.every((cell) => cell[1] === '')).toBe(true);
    expect(html).toMatch(/<button[^>]*aria-disabled="true"[^>]*>Previous<\/button>/);
    expect(html).toMatch(/<button[^>]*class="ss-playback__next"[^>]*>Next<\/button>/);
    expect(html.match(/type="range"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Movement speed"');
    expect(html.indexOf('ss-construction__toolbar')).toBeLessThan(html.indexOf('ss-construction__chart'));
    expect(html.indexOf('ss-construction__circuit')).toBeLessThan(html.indexOf('ss-construction__lesson'));
    expect(html).not.toMatch(/<button[^>]*>(Play|Pause)<\/button>/);
    expect(html).not.toContain('Construction progress');
  });
  it('keeps the full construction lesson keyboard accessible', () => {
    const html = renderToStaticMarkup(<QuarterWaveConstruction input={example} />);
    expect(html).toContain('1 / 12');
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
  });
  it('uses a canonical seven-step realization for an already matched load', () => {
    const html = renderToStaticMarkup(<QuarterWaveConstruction input={{ z0: 50, load: { kind: 'impedance', resistance: 50, reactance: 0 } }} />);
    expect(html).toContain('1 / 7');
    expect(html).toContain('aria-label="Canonical matched realization"');
    expect(html).toContain('data-summary-branch="0"');
    expect(html).not.toContain('data-summary-branch="1"');
    expect(html).not.toContain('NaN');
  });
  it.each([{ kind: 'open' }, { kind: 'short' }, { kind: 'impedance', resistance: 0, reactance: -50 }] as const)('explains unmatchable %j without chart markers', (load) => {
    const html = renderToStaticMarkup(<QuarterWaveConstruction input={{ z0: 50, load }} />);
    expect(html).toContain('cannot be matched');
    expect(html).toContain('absorbs no real power');
    expect(html).not.toContain('data-chart-marker');
    expect(html).not.toContain('NaN');
  });
  it('clears the construction for invalid parameters', () => {
    const html = renderToStaticMarkup(<QuarterWaveConstruction input={{ ...example, z0: 0 }} />);
    expect(html).toContain('role="status"');
    expect(html).not.toContain('data-chart-marker');
  });
});

describe('quarter-wave physical explanations', () => {
  const cases = [
    [0, 'Normalized impedance expresses the load', 'La impedancia normalizada expresa la carga'],
    [1, 'positions where the main-line reactance vanishes', 'posiciones donde se anula la reactancia'],
    [2, 'The resulting real resistance is the load seen by the transformer', 'La resistencia real resultante es la carga que ve el transformador'],
    [3, 'Matching requires the quarter-wave impedance inversion', 'La adaptación exige que la inversión de impedancia'],
    [4, 'The physical impedance, line lengths, and reading plane remain unchanged', 'La impedancia física, las longitudes y el plano de lectura no cambian'],
    [5, 'Its normalized value in the transformer reference need not be one', 'Su valor normalizado en la referencia del transformador no tiene por qué ser uno'],
    [6, 'produces no reflection for waves incident from that line', 'no produce reflexión de las ondas que llegan por esa línea'],
    [7, 'an alternative network for the same load', 'una red alternativa para la misma carga'],
  ] as const;

  it.each(cases)('explains the physics at stage %s in both languages', (stage, english, spanish) => {
    const controls = { next: () => {}, previous: () => {}, restart: () => {}, setSpeed: () => {} };
    const hook = vi.spyOn(playback, 'useStepPlayback').mockReturnValue({ ...controls, stage, progress: 1, playing: false, direction: 1, speed: 1, reducedMotion: false, completed: true, canNext: true, canPrevious: stage > 0 });
    try {
      for (const [locale, expected] of [['en', english], ['es', spanish]] as const) {
        const html = renderToStaticMarkup(<I18nProvider initialLocale={locale}><QuarterWaveConstruction input={example} /></I18nProvider>);
        const lesson = html.slice(html.indexOf('class="ss-construction__lesson"')).replace(/<h4\b[^>]*>[\s\S]*?<\/h4>/, '');
        expect(lesson).toContain(expected);
        expect(lesson).not.toMatch(/Next |Siguiente |Draw |Dibuja |Move |Desplaza |Keep |Mantén |Choose |Elige |Return through|Vuelve a través/);
        expect(html).not.toMatch(/formula--error|katex-error|NaN/);
      }
    } finally { hook.mockRestore(); }
  });
});
