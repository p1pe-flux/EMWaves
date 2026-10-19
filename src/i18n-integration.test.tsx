import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { I18nProvider, translateMessage } from './i18n';
import SmithIntroduction from './labs/SmithIntroduction';
import SingleStubMatching from './labs/SingleStubMatching';
import SeriesStubMatching from './labs/SeriesStubMatching';
import LCMatching from './labs/LCMatching';
import DoubleStubMatching from './labs/DoubleStubMatching';
import QuarterWaveTransformer from './labs/QuarterWaveTransformer';
import { ReflectionExplorer } from './components/ReflectionExplorer';
import { SmithProjectionAnimation } from './components/SmithProjectionAnimation';
import { TransmissionLineExample } from './components/TransmissionLineExample';
import { SingleStubGuideContent } from './components/SingleStubGuide';
import { SeriesStubGuideContent } from './components/SeriesStubGuide';
import { LCMatchingGuideContent } from './components/LCMatchingGuide';
import { DoubleStubGuideContent } from './components/DoubleStubGuide';
import { MathMarkdown } from './components/MathMarkdown';
import { QuarterWaveGuideContent } from './components/QuarterWaveGuide';
import smithEnglish from './content/smith-intro.md?raw';
import smithSpanish from './content/smith-intro.es.md?raw';
import theoryEnglish from './content/transmission-line-theory.md?raw';
import theorySpanish from './content/transmission-line-theory.es.md?raw';
import exampleEnglish from './content/transmission-line-example.md?raw';
import exampleSpanish from './content/transmission-line-example.es.md?raw';
import smithEnglishCompiled from './content/smith-intro.md?compiled-math';
import smithSpanishCompiled from './content/smith-intro.es.md?compiled-math';
import theoryEnglishCompiled from './content/transmission-line-theory.md?compiled-math';
import theorySpanishCompiled from './content/transmission-line-theory.es.md?compiled-math';
import exampleEnglishCompiled from './content/transmission-line-example.md?compiled-math';
import exampleSpanishCompiled from './content/transmission-line-example.es.md?compiled-math';

function render(node: ReactNode, locale: 'en' | 'es') {
  return renderToStaticMarkup(<I18nProvider initialLocale={locale}>{node}</I18nProvider>);
}
function equations(html: string) {
  return [...html.matchAll(/<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/g)]
    .map((match) => match[1]).filter((tex) => !tex.includes('\\text{'));
}

describe('Spanish interface and mathematical content', () => {
  it('translates the Smith lab controls and diagrams without altering any displayed equation', () => {
    const es = render(<SmithIntroduction />, 'es');
    expect(es).toContain('Parámetros');
    expect(es).toContain('Diagrama de Smith');
    expect(es).toContain('Mostrar círculo de ROE');
    expect(es).toContain('aria-label="Resistencia de la carga"');
    expect(es).toContain('Longitud total de la línea');
    expect(es).toContain('aria-label="Línea de transmisión"');
    expect(es).not.toContain('Load resistance');
    expect(es).not.toContain('Toward generator');
    expect(equations(es)).toEqual(equations(render(<SmithIntroduction />, 'en')));
    expect(es).not.toMatch(/formula--error|katex-error|NaN/);
  });

  it('localizes the shared Smith guide interactives and keeps their equations unchanged', () => {
    const content = <><ReflectionExplorer /><SmithProjectionAnimation /><TransmissionLineExample /></>;
    const es = render(content, 'es');
    expect(es).toContain('Leer el diagrama de Smith');
    expect(es).toContain('La impedancia normalizada de la carga determina el módulo y la fase del coeficiente de reflexión.');
    expect(es).toContain('Plano de impedancias');
    expect(es).toContain('Generador');
    expect(es).toContain('Ejemplo: una línea de una longitud de onda');
    expect(es).not.toContain('Drag the load point.');
    expect(equations(es)).toEqual(equations(render(content, 'en')));
    expect(es).not.toMatch(/formula--error|katex-error|NaN/);
  });

  it.each([
    ['stub', <SingleStubMatching />, 'tracked-load', 'Rama 1'],
    ['series stub', <SeriesStubMatching />, 'tracked-load', 'Rama 1'],
    ['LC', <LCMatching />, 'tracked-load', 'Solución'],
    ['quarter wave', <QuarterWaveTransformer />, 'tracked-quarter-wave', 'Rama 1'],
    ['double stub', <DoubleStubMatching />, 'matched-input', 'Rama 1'],
  ] as const)(
    'translates the %s lab while retaining physical chart coordinates', (_, content, markerId, resultLabel) => {
      const es = render(content, 'es');
      const en = render(content, 'en');
      expect(es).toContain('>Siguiente</button>');
      expect(es).toContain('aria-label="Restablecer"');
      expect(es).toContain(resultLabel);
      const marker = new RegExp('data-chart-marker="' + markerId + '" data-re="([^"]+)" data-im="([^"]+)"');
      expect(es.match(marker)).not.toBeNull();
      expect(es.match(marker)?.slice(1)).toEqual(en.match(marker)?.slice(1));
      expect(equations(es)).toEqual(equations(en));
      expect(es).not.toMatch(/formula--error|katex-error|NaN/);
    },
  );

  it.each([['stub', <SingleStubGuideContent />], ['series stub', <SeriesStubGuideContent />], ['LC', <LCMatchingGuideContent />], ['quarter wave', <QuarterWaveGuideContent />], ['double stub', <DoubleStubGuideContent />]] as const)(
    'translates the full %s guide without changing its mathematical equations', (_, content) => {
      const es = render(content, 'es');
      expect(equations(es)).toEqual(equations(render(content, 'en')));
      expect(es).toContain('Abrir');
      expect(es).not.toContain('Use Next');
      expect(es).not.toContain('Choose a termination');
      expect(es).not.toMatch(/formula--error|katex-error|NaN/);
    },
  );

  it.each([['history', smithEnglish, smithSpanish], ['theory', theoryEnglish, theorySpanish], ['example', exampleEnglish, exampleSpanish]])(
    'preserves the %s Markdown display equations and supporting links', (_, en, es) => {
      expect([...es.matchAll(/\$\$([\s\S]*?)\$\$/g)].map((match) => match[1]))
        .toEqual([...en.matchAll(/\$\$([\s\S]*?)\$\$/g)].map((match) => match[1]));
      expect([...es.matchAll(/\]\(([^)]*)\)/g)].map((match) => match[1]))
        .toEqual([...en.matchAll(/\]\(([^)]*)\)/g)].map((match) => match[1]));
    },
  );

  it.each([
    ['history', 'en', smithEnglishCompiled], ['history', 'es', smithSpanishCompiled],
    ['theory', 'en', theoryEnglishCompiled], ['theory', 'es', theorySpanishCompiled],
    ['example', 'en', exampleEnglishCompiled], ['example', 'es', exampleSpanishCompiled],
  ] as const)('renders compiled %s content in %s with accessible math', (_, locale, sections) => {
    const html = render(<MathMarkdown html={sections.join('')} />, locale);
    expect(html).toContain('class="katex"');
    expect(html).toContain('<math');
    expect(html).toContain('application/x-tex');
    expect(html).not.toMatch(/formula--error|katex-error|NaN/);
  });

  it('localizes validation and special-load explanations while preserving the numerical API messages', () => {
    expect(translateMessage('Resistance must be greater than or equal to zero.', 'es')).toBe('La resistencia debe ser mayor o igual que cero.');
    expect(translateMessage('Reactance must be a finite number.', 'es')).toBe('La reactancia debe ser un número finito.');
    expect(translateMessage('Normalized impedance: imaginary part must be a finite number.', 'es')).toContain('parte imaginaria');
    const message = 'A lossless network cannot match a load that absorbs no real power. Use a load with R > 0.';
    expect(translateMessage(message, 'es')).toContain('no absorbe potencia real');
    expect(translateMessage(message, 'en')).toBe(message);
  });
});
