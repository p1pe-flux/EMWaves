import { renderToReadableStream } from 'react-dom/server';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App, { pageForHash } from './App';
import { DoubleStubGuidePage, GuidesLanding, LCMatchingGuidePage, QuarterWaveGuidePage, SeriesStubGuidePage, SingleStubGuidePage } from './components/LabGuides';
import { I18nProvider } from './i18n';
import { SmithGuidePage } from './components/SmithGuidePage';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';

vi.mock('./components/SingleStubGuide', () => ({
  SingleStubGuideContent: () => (
    <section data-single-stub-guide-content>Single-stub worked example</section>
  ),
}));

vi.mock('./components/SeriesStubGuide', () => ({
  SeriesStubGuideContent: () => (
    <section data-series-stub-guide-content>Series-stub worked example</section>
  ),
}));

vi.mock('./components/LCMatchingGuide', () => ({
  LCMatchingGuideContent: () => (
    <section data-lc-matching-guide-content>LC worked example</section>
  ),
}));

vi.mock('./components/QuarterWaveGuide', () => ({
  QuarterWaveGuideContent: () => (
    <section data-quarter-wave-guide-content>Quarter-wave worked example</section>
  ),
}));

vi.mock('./components/DoubleStubGuide', () => ({
  DoubleStubGuideContent: () => (
    <section data-double-stub-guide-content>Double-stub backward worked example</section>
  ),
}));

afterEach(() => vi.unstubAllGlobals());

async function renderComplete(node: ReactNode): Promise<string> {
  const stream = await renderToReadableStream(node);
  await stream.allReady;
  return new Response(stream).text();
}

function expectFullGuideLink(html: string, href: string, label = 'Read guide') {
  const link = html.match(new RegExp('<a\\b[^>]*>' + label + '<\\/a>'))?.[0];
  expect(link).toBeDefined();
  expect(link).toContain('href="' + href + '"');
  expect(link).not.toMatch(/aria-(?:expanded|controls)=/);
  expect(html).not.toMatch(new RegExp('<button\\b[^>]*>' + label + '<\\/button>'));
  expect(html).not.toContain('class="guide-panel"');
}

describe('laboratory landing page', () => {
  it('opens the catalog and offers the existing Smith chart laboratory', async () => {
    const html = await renderComplete(<App />);
    expect(html).toContain('Introduction to Smith Chart');
    expect(html).toContain('href="#/labs/introduction-to-smith-chart"');
    expect(html).toContain('href="#/guides"');
    expect(html).toContain('href="#/guides/introduction-to-smith-chart"');
    expect(html).toContain('Read guide');
    expect(html).not.toContain('id="line-length"');
    expect(html).not.toContain('formula--error');
  });

  it('offers all six implemented laboratories with direct routes', async () => {
    const html = await renderComplete(<App />);
    expect(html).toContain('Double-Stub Matching');
    expect(html).not.toContain('Coming soon');
    const laboratoryLinks = html.match(/href="#\/labs\/[^\"]+"/g);
    expect([...new Set(laboratoryLinks)]).toEqual([
      'href="#/labs/introduction-to-smith-chart"',
      'href="#/labs/single-stub-matching"',
      'href="#/labs/series-stub-matching"',
      'href="#/labs/lc-matching"',
      'href="#/labs/quarter-wave-transformer"',
      'href="#/labs/double-stub-matching"',
    ]);
  });

  it('offers the single-stub laboratory and its guide', async () => {
    const html = await renderComplete(<App />);
    expect(html).toContain('Single-Stub Matching');
    expect(html).toContain('href="#/labs/single-stub-matching"');
    expect(html).toContain('href="#/guides/single-stub-matching"');
  });

  it('draws the series stub in a break in the line and preserves the shunt schematic', async () => {
    const html = await renderComplete(<App />);
    const series = html.match(/<svg\b[^>]*data-schematic-kind="series-stub"[\s\S]*?<\/svg>/)?.[0];
    const shunt = html.match(/<svg\b[^>]*data-schematic-kind="single-stub"[\s\S]*?<\/svg>/)?.[0];
    expect(series).toContain('data-series-insertion="true"');
    expect(series).toContain('d="M22 57H139M167 57H268V77M268 95V104"');
    expect(series).not.toContain('d="M22 57H268V77M268 95V104"');
    expect(shunt).toContain('d="M22 57H268V77M268 95V104"');
    expect(shunt).not.toContain('data-series-insertion');
  });

  it('illustrates the LC laboratory with an inductor in the line and a shunt capacitor', async () => {
    const html = await renderComplete(<App />);
    const circuit = html.match(/<svg\b[^>]*data-schematic-kind="lc-matching"[\s\S]*?<\/svg>/)?.[0];
    expect(circuit).toContain('data-lc-network="series-inductor-parallel-capacitor"');
    expect(circuit).toContain('data-lc-element="inductor"');
    expect(circuit).toContain('data-lc-element="capacitor"');
    expect(circuit).toContain('d="M22 57H101M157 57H268V77M268 95V104"');
    expect(html).toContain('href="#/guides/lc-matching"');
  });
});

describe('application language selection', () => {
  it('offers a labeled native footer selector with English and Spanish options', async () => {
    const html = await renderComplete(<App />);
    const footer = html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)?.[1];
    expect(footer).toBeDefined();
    expect(footer).toContain('for="app-language"');
    expect(footer).toContain('>Language</span>');
    expect(footer).toContain('<select id="app-language"');
    expect(footer).toContain('<option value="en" selected="">English</option>');
    expect(footer).toContain('<option value="es">Español</option>');
  });

  it('translates the catalog and navigation without changing their routes', async () => {
    const html = await renderComplete(<I18nProvider initialLocale="es"><App /></I18nProvider>);
    expect(html).toContain('<h1 id="landing-title">Laboratorios</h1>');
    expect(html).toContain('Introducción al diagrama de Smith');
    expect(html).toContain('Adaptación con un stub');
    expect(html).toContain('Adaptación con un stub en serie');
    expect(html).toContain('Adaptación con L y C');
    expect(html).toContain('Transformador de cuarto de onda');
    expect(html).toContain('Adaptación con dos stubs');
    expect(html).toContain('Abrir laboratorio');
    expect(html).toContain('Leer guía');
    expect(html).toContain('aria-label="Navegación principal"');
    expect(html).toContain('>Idioma</span>');
    expect(html).toContain('<option value="es" selected="">Español</option>');
    expect(html).toContain('href="#/labs/single-stub-matching"');
    expect(html).toContain('href="#/labs/quarter-wave-transformer"');
  });

  it.each([
    ['#/labs/introduction-to-smith-chart', 'Introducción al diagrama de Smith', '#/guides/introduction-to-smith-chart'],
    ['#/labs/single-stub-matching', 'Adaptación con un stub', '#/guides/single-stub-matching'],
    ['#/labs/series-stub-matching', 'Adaptación con un stub en serie', '#/guides/series-stub-matching'],
    ['#/labs/lc-matching', 'Adaptación con L y C', '#/guides/lc-matching'],
    ['#/labs/quarter-wave-transformer', 'Transformador de cuarto de onda', '#/guides/quarter-wave-transformer'],
    ['#/labs/double-stub-matching', 'Adaptación con dos stubs', '#/guides/double-stub-matching'],
  ])('translates the lab heading and guide action on %s', async (hash, title, guideHref) => {
    vi.stubGlobal('window', { location: { hash } });
    const html = await renderComplete(<I18nProvider initialLocale="es"><App /></I18nProvider>);
    expect(html).toContain('<h1>' + title + '</h1>');
    expect(html).toContain('Todos los laboratorios');
    expect(html).toContain(hash === '#/labs/lc-matching' ? 'Adaptación de impedancias' : 'Líneas de transmisión');
    expectFullGuideLink(html, guideHref, 'Leer guía');
  });

  it('translates the guide index and shared full-page labels', async () => {
    const index = await renderComplete(<I18nProvider initialLocale="es"><GuidesLanding /></I18nProvider>);
    const full = await renderComplete(<I18nProvider initialLocale="es"><QuarterWaveGuidePage /></I18nProvider>);
    expect(index).toContain('>Guías</h1>');
    expect(index).toContain('Adaptación con un stub');
    expect(index).toContain('Transformador de cuarto de onda');
    expect(full).toContain('Todas las guías');
    expect(full).toContain('Abrir laboratorio');
    expect(full).toContain('Contenido de la guía');
    expect(full).not.toContain('class="guide-panel"');
  });

  it('loads Spanish Smith lessons around the same mathematical and interactive sections', async () => {
    const html = await renderComplete(<I18nProvider initialLocale="es"><SmithGuidePage /></I18nProvider>);
    expect(html).toContain('Una breve historia');
    expect(html).toContain('Una transformación de Möbius en el plano complejo');
    expect(html).toContain('Impedancia a lo largo de una línea de transmisión');
    expect(html).toContain('Para esta línea, sustituimos la carga');
    expect(html).toContain('smith-projection');
    expect(html).toContain('reflection-explorer');
    expect(html).toContain('line-example');
    expect(html).not.toContain('formula--error');
  });
});

describe('Smith chart guide navigation', () => {
  it.each(['#/labs/introduction-to-smith-chart', '#/labs/introduction-to-smith-chart/'])('links the laboratory route %s directly to its full guide', async (hash) => {
    vi.stubGlobal('window', { location: { hash } });
    const html = await renderComplete(<App />);
    expect(html).toMatch(/<h1(?: id="[^"]+")?>Introduction to Smith Chart<\/h1>/);
    expectFullGuideLink(html, '#/guides/introduction-to-smith-chart');
  });
});

describe('single-stub navigation and guide', () => {
  it.each(['#/labs/single-stub-matching', '#/labs/single-stub-matching/'])('recognizes the direct laboratory route %s', async (hash) => {
    vi.stubGlobal('window', { location: { hash } });
    const html = await renderComplete(<App />);
    expect(html).toMatch(/<h1(?: id="[^"]+")?>Single-Stub Matching<\/h1>/);
    expectFullGuideLink(html, '#/guides/single-stub-matching');
    expect(html).not.toContain('Coming soon');
  });

  it('recognizes the direct guide route and marks Guides as current', async () => {
    vi.stubGlobal('window', { location: { hash: '#/guides/single-stub-matching' } });
    const html = await renderComplete(<App />);
    expect(html).toContain('href="#/guides" aria-current="page"');
    expect(html).not.toContain('Coming soon');
  });

  it('lists all available guides with their laboratory links', async () => {
    const html = await renderComplete(<GuidesLanding />);
    expect(html.match(/class="guide-entry"/g)).toHaveLength(6);
    expect(html).toContain('Introduction to Smith Chart');
    expect(html).toContain('Single-Stub Matching');
    expect(html).toContain('Series-Stub Matching');
    expect(html).toContain('LC Matching');
    expect(html).toContain('Quarter-Wave Transformer');
    expect(html).toContain('href="#/guides/single-stub-matching"');
    expect(html).toContain('href="#/labs/single-stub-matching"');
    expect(html).toContain('href="#/guides/series-stub-matching"');
    expect(html).toContain('href="#/labs/series-stub-matching"');
    expect(html).toContain('href="#/guides/lc-matching"');
    expect(html).toContain('href="#/labs/lc-matching"');
    expect(html).toContain('href="#/guides/quarter-wave-transformer"');
    expect(html).toContain('href="#/labs/quarter-wave-transformer"');
    expect(html).toContain('href="#/guides/double-stub-matching"');
    expect(html).toContain('href="#/labs/double-stub-matching"');
  });

  it('opens the complete worked example with its accessible contents and direct laboratory link', async () => {
    const full = await renderComplete(<SingleStubGuidePage />);
    expect(full).toMatch(/<h1(?: id="[^"]+")?>Single-Stub Matching<\/h1>/);
    expect(full).toContain('href="#/labs/single-stub-matching"');
    expect(full).toContain('aria-labelledby="single-stub-guide-content-title"');
    expect(full).toContain('Guide contents');
    expect(full).toContain('Single-stub worked example');
    expect(full).not.toContain('class="guide-panel"');
  });
});

describe('series-stub navigation and guide', () => {
  it.each(['#/labs/series-stub-matching', '#/labs/series-stub-matching/'])('recognizes the direct laboratory route %s', async (hash) => {
    vi.stubGlobal('window', { location: { hash } });
    const html = await renderComplete(<App />);
    expect(html).toMatch(/<h1(?: id="[^"]+")?>Series-Stub Matching<\/h1>/);
    expectFullGuideLink(html, '#/guides/series-stub-matching');
    expect(html).not.toContain('Coming soon');
  });

  it.each(['#/guides/series-stub-matching', '#/guides/series-stub-matching/'])('recognizes the complete guide route %s', async (hash) => {
    vi.stubGlobal('window', { location: { hash } });
    const html = await renderComplete(<App />);
    expect(html).toContain('href="#/guides" aria-current="page"');
    expect(html).not.toContain('id="landing-title"');
  });

  it('opens the complete series guide with a direct laboratory link', async () => {
    const full = await renderComplete(<SeriesStubGuidePage />);
    const spanish = await renderComplete(<I18nProvider initialLocale="es"><SeriesStubGuidePage /></I18nProvider>);
    expect(full).toMatch(/<h1(?: id="[^"]+")?>Series-Stub Matching<\/h1>/);
    expect(full).toContain('href="#/labs/series-stub-matching"');
    expect(full).toContain('Series-stub worked example');
    expect(full).not.toContain('class="guide-panel"');
    expect(spanish).toMatch(/<h1(?: id="[^"]+")?>Adaptación con un stub en serie<\/h1>/);
    expect(spanish).toContain('Abrir laboratorio');
  });
});

describe('LC navigation and guide', () => {
  it.each(['#/labs/lc-matching', '#/labs/lc-matching/'])('recognizes the direct laboratory route %s', async (hash) => {
    vi.stubGlobal('window', { location: { hash } });
    const html = await renderComplete(<App />);
    expect(html).toMatch(/<h1(?: id="[^"]+")?>LC Matching<\/h1>/);
    expectFullGuideLink(html, '#/guides/lc-matching');
    expect(html).not.toContain('Coming soon');
  });

  it.each(['#/guides/lc-matching', '#/guides/lc-matching/'])('recognizes the complete guide route %s', async (hash) => {
    vi.stubGlobal('window', { location: { hash } });
    const html = await renderComplete(<App />);
    expect(html).toContain('href="#/guides" aria-current="page"');
    expect(html).not.toContain('id="landing-title"');
  });

  it('opens the complete LC guide with a direct laboratory link in both languages', async () => {
    const full = await renderComplete(<LCMatchingGuidePage />);
    const spanish = await renderComplete(<I18nProvider initialLocale="es"><LCMatchingGuidePage /></I18nProvider>);
    expect(full).toMatch(/<h1(?: id="[^"]+")?>LC Matching<\/h1>/);
    expect(full).toContain('href="#/labs/lc-matching"');
    expect(full).toContain('LC worked example');
    expect(full).not.toContain('class="guide-panel"');
    expect(spanish).toMatch(/<h1(?: id="[^"]+")?>Adaptación con L y C<\/h1>/);
    expect(spanish).toContain('Abrir laboratorio');
  });
});

describe('double-stub navigation and guide', () => {
  it.each(['#/labs/double-stub-matching', '#/labs/double-stub-matching/'])('recognizes the direct laboratory route %s', async (hash) => {
    vi.stubGlobal('window', { location: { hash } });
    const html = await renderComplete(<App />);
    expect(html).toMatch(/<h1(?: id="[^"]+")?>Double-Stub Matching<\/h1>/);
    expectFullGuideLink(html, '#/guides/double-stub-matching');
    expect(html).not.toContain('Coming soon');
  });

  it('opens the complete backward guide from the guide catalog', async () => {
    const html = await renderComplete(<DoubleStubGuidePage />);
    expect(html).toMatch(/<h1(?: id="[^"]+")?>Double-Stub Matching<\/h1>/);
    expect(html).toContain('href="#/labs/double-stub-matching"');
    expect(html).toContain('Double-stub backward worked example');
    expect(html).not.toContain('class="guide-panel"');
  });

  it('recognizes the complete guide route', async () => {
    vi.stubGlobal('window', { location: { hash: '#/guides/double-stub-matching' } });
    const html = await renderComplete(<App />);
    expect(html).toContain('href="#/guides" aria-current="page"');
  });
});

describe('quarter-wave navigation and guide', () => {
  it('offers the available quarter-wave laboratory and guide in the catalog', async () => {
    const html = await renderComplete(<App />);
    expect(html).toContain('Quarter-Wave Transformer');
    expect(html).toContain('href="#/labs/quarter-wave-transformer"');
    expect(html).toContain('href="#/guides/quarter-wave-transformer"');
  });

  it.each(['#/labs/quarter-wave-transformer', '#/labs/quarter-wave-transformer/'])('recognizes the direct laboratory route %s', async (hash) => {
    vi.stubGlobal('window', { location: { hash } });
    const html = await renderComplete(<App />);
    expect(html).toMatch(/<h1(?: id="[^"]+")?>Quarter-Wave Transformer<\/h1>/);
    expectFullGuideLink(html, '#/guides/quarter-wave-transformer');
    expect(html).not.toContain('Coming soon');
  });

  it('recognizes the direct guide route and marks Guides as current', async () => {
    vi.stubGlobal('window', { location: { hash: '#/guides/quarter-wave-transformer' } });
    const html = await renderComplete(<App />);
    expect(html).toContain('href="#/guides" aria-current="page"');
    expect(html).not.toContain('Coming soon');
  });

  it('opens the complete quarter-wave example with its accessible contents and direct laboratory link', async () => {
    const full = await renderComplete(<QuarterWaveGuidePage />);
    expect(full).toMatch(/<h1(?: id="[^"]+")?>Quarter-Wave Transformer<\/h1>/);
    expect(full).toContain('href="#/labs/quarter-wave-transformer"');
    expect(full).toContain('aria-labelledby="quarter-wave-guide-content-title"');
    expect(full).toContain('Guide contents');
    expect(full).toContain('Quarter-wave worked example');
    expect(full).not.toContain('class="guide-panel"');
  });
});


describe('complete bilingual route inventory', () => {
  it.each([
    ['#/guides', 'guides'],
    ['#/guides/introduction-to-smith-chart', 'smith-guide'],
    ['#/guides/single-stub-matching', 'single-stub-guide'],
    ['#/guides/series-stub-matching', 'series-stub-guide'],
    ['#/guides/lc-matching', 'lc-matching-guide'],
    ['#/guides/quarter-wave-transformer', 'quarter-wave-guide'],
    ['#/guides/double-stub-matching', 'double-stub-guide'],
  ])('keeps %s available, including a trailing slash', (hash, page) => {
    expect(pageForHash(hash)).toBe(page);
    expect(pageForHash(hash + '/')).toBe(page);
  });

  it.each(['', '#/', '#/unknown'])('maps unsupported or empty route %s to the catalog', hash => {
    expect(pageForHash(hash)).toBe('laboratories');
  });

  it.each([
    ['en', 'Could not open this content', 'Reload', 'Return to the catalog'],
    ['es', 'No se pudo abrir este contenido', 'Recargar', 'Volver al catálogo'],
  ] as const)('localizes route recovery in %s', async (locale, title, reload, catalog) => {
    const boundary = new RouteErrorBoundary({ children: null });
    boundary.state = { failed: true };
    const html = await renderComplete(<I18nProvider initialLocale={locale}>{boundary.render()}</I18nProvider>);
    expect(html).toContain(title);
    expect(html).toContain('>' + reload + '</button>');
    expect(html).toContain('href="#/">' + catalog + '</a>');
  });
});
