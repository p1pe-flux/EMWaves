import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DoubleStubConstruction } from './DoubleStubConstruction';
import { DoubleStubDiagram } from './DoubleStubDiagram';
import { I18nProvider } from '../i18n';
import type { DoubleStubInput } from '../domain/doubleStub';
import * as playback from './useStepPlayback';
const input = { z0: 50, stub1Z0: 50, stub2Z0: 50, distance: 0.125, separation: 0.125, load: { kind: 'impedance' as const, resistance: 100, reactance: 50 } };
describe('double-stub construction', () => {
  it('starts paused from the matched left-hand input with empty solution lengths', () => {
    const html = renderToStaticMarkup(<DoubleStubConstruction input={input} />);
    expect(html).toContain('data-stage-name="matched"');
    expect(html).toContain('data-playing="false"');
    expect(html).toContain('data-chart-marker="matched-input" data-re="0" data-im="0"');
    expect(html).toContain('Start at the matched input');
    expect(html).toContain('1 / 15');
    expect(html).not.toContain('data-stub="1"');
    expect(html).not.toContain('data-stub="2"');
    expect(html).not.toContain('Play/Pause');
    expect(html).toContain('Movement speed');
  });
  it('draws two projected blue stubs in left-to-right numbering', () => {
    const html = renderToStaticMarkup(<DoubleStubDiagram input={input} length1={0.1} length2={0.2} termination1="open" termination2="short" periodicLength1={0.5} periodicLength2={1} />);
    expect(html).toContain('data-stub-1-x="235" data-stub-2-x="375"');
    expect(html).toContain('data-stub="1" data-stub-length="0.1" data-total-stub-length="0.6"');
    expect(html).toContain('data-stub="2" data-stub-length="0.2" data-total-stub-length="1.2"');
    expect(html).toContain('data-termination="open"');
    expect(html).toContain('data-termination="short"');
    expect(html).toContain('S₁'); expect(html).toContain('S₂');
  });
  it('supports conceptual labels without exposing example dimensions', () => {
    const html = renderToStaticMarkup(<DoubleStubDiagram input={input} abstractLabels />);
    expect(html).toContain('>d<tspan baseline-shift="sub" font-size="12">1</tspan></text>');
    expect(html).toContain('>d<tspan baseline-shift="sub" font-size="12">2</tspan></text>');
    expect(html).toContain('>ℓ₁</text>'); expect(html).toContain('>ℓ₂</text>');
    expect(html).not.toContain('100 + j50');
  });
  it('renders Spanish step explanations without changing the mathematical start', () => {
    const html = renderToStaticMarkup(<I18nProvider initialLocale="es"><DoubleStubConstruction input={input} /></I18nProvider>);
    expect(html).toContain('Comenzar en la entrada adaptada');
    expect(html).toContain('de atrás hacia adelante');
    expect(html).toContain('data-chart-marker="matched-input" data-re="0" data-im="0"');
  });
  it('keeps the geometry and load traversal steps without inventing forbidden-region branches', () => {
    const html = renderToStaticMarkup(<DoubleStubConstruction input={{ ...input, distance: 0, load: { kind: 'impedance', resistance: 10, reactance: 0 } }} />);
    expect(html).toContain('data-status="forbidden"');
    expect(html).toContain('1 / 7');
    expect(html).toContain('data-stage-name="matched"');
    expect(html).not.toContain('data-summary-branch');
  });
  it('keeps the continuous half-wave family distinct from two discrete branches', () => {
    const html = renderToStaticMarkup(<DoubleStubConstruction input={{ ...input, distance: 0, separation: 0.5, load: { kind: 'impedance', resistance: 50, reactance: 0 } }} />);
    expect(html).toContain('data-status="continuous"');
    expect(html).toContain('1 / 7');
    expect(html).not.toContain('data-summary-branch');
  });
});

function lessonAt(stage: number, locale: 'en' | 'es', progress = 1, parameters: DoubleStubInput = input): string {
  const controls = { next: () => {}, previous: () => {}, restart: () => {}, setSpeed: () => {} };
  const hook = vi.spyOn(playback, 'useStepPlayback').mockReturnValue({
    ...controls, stage, progress, playing: progress < 1, direction: 1, speed: 1,
    reducedMotion: false, completed: progress === 1, canNext: progress === 1, canPrevious: progress === 1,
  });
  try {
    const html = renderToStaticMarkup(<I18nProvider initialLocale={locale}><DoubleStubConstruction input={parameters} /></I18nProvider>);
    const start = html.indexOf('class="ss-construction__lesson');
    expect(start).toBeGreaterThan(0);
    return html.slice(start, html.indexOf('class="ds-construction__legend', start) > 0 ? html.indexOf('class="ds-construction__legend', start) : undefined);
  } finally { hook.mockRestore(); }
}

describe('double-stub physical step explanations', () => {
  it.each(['en', 'es'] as const)('explains the matching operations without navigation instructions in %s', (locale) => {
    for (let stage = 0; stage < 15; stage += 1) {
      const lesson = lessonAt(stage, locale);
      expect(lesson).not.toMatch(/\bNext\b|\bPrevious\b|\bRestart\b|Siguiente|Anterior|Reiniciar|marker|marcador/);
      expect(lesson).not.toMatch(/formula--error|katex-error|NaN/);
    }
    expect(lessonAt(7, locale)).toContain(locale === 'es' ? 'diferencia de susceptancia' : 'susceptance difference');
    expect(lessonAt(9, locale)).toContain(locale === 'es' ? 'susceptancia opuesta' : 'opposite susceptance');
    expect(lessonAt(10, locale)).toContain(locale === 'es' ? 'desaparece la reflexión' : 'reflection vanishes');
    const alternative = lessonAt(11, locale, 0.1);
    expect(alternative).toContain(locale === 'es' ? 'misma carga y las mismas posiciones' : 'same load and fixed positions');
    expect(alternative).not.toMatch(/Undo|Deshaz|remove|retira|Next|Siguiente/);
  });

  it.each(['en', 'es'] as const)('explains continuous and forbidden cases through their electrical constraints in %s', (locale) => {
    const continuous = lessonAt(6, locale, 1, { ...input, distance: 0, separation: 0.5, load: { kind: 'impedance', resistance: 50, reactance: 0 } });
    expect(continuous).toContain(locale === 'es' ? 'cancele la susceptancia total' : 'cancels the total susceptance');
    const forbidden = lessonAt(6, locale, 1, { ...input, distance: 0, load: { kind: 'impedance', resistance: 10, reactance: 0 } });
    expect(forbidden).toContain(locale === 'es' ? 'conductancia disponible' : 'available conductance');
    expect(forbidden).not.toMatch(/Next|Siguiente|formula--error|NaN/);
  });
});
