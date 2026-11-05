import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../i18n';
import { createFrequencyResponse, type FrequencyResponseBranch } from '../domain/frequencyResponse';
import { FrequencyResponsePanel, FrequencyResponsePlot } from './FrequencyResponsePanel';

const branches: FrequencyResponseBranch[] = [
  { id: 'branch-1', labelIndex: 1, evaluate: ratio => Math.min(1, Math.abs(ratio - 1)) },
  { id: 'branch-2', labelIndex: 2, evaluate: ratio => Math.min(1, 2 * Math.abs(ratio - 1)) },
];
const settings = { designFrequencyHz: 1e9, startHz: .5e9, stopHz: 1.5e9 };

function expectOnlyFrequencyCurves(html: string) {
  expect(html).not.toContain('Maximum reflection magnitude');
  expect(html).not.toContain('Módulo de reflexión máximo');
  expect(html).not.toContain('frequency-response__threshold');
  expect(html).not.toContain('frequency-response__swatch--threshold');
  expect(html).not.toContain('frequency-response__bandwidths');
  expect(html).not.toContain('data-bandwidth-status');
  expect(html).not.toContain('Bandwidth is the continuous interval');
  expect(html).not.toContain('El ancho de banda es el intervalo continuo');
}

function expectAutomaticResponse(html: string) {
  expect(html).not.toMatch(/<button\b/);
  expect(html).not.toContain('Plot frequency response');
  expect(html).not.toContain('Hide plot');
  expect(html).not.toContain('Graficar respuesta en frecuencia');
  expect(html).not.toContain('Ocultar gráfica');
  expect(html).not.toContain('aria-expanded=');
  expect(html).not.toContain('Ideal lossless, nondispersive lines and fixed L/C values.');
  expect(html).not.toContain('Líneas ideales sin pérdidas ni dispersión y valores L/C fijos.');
  expect(html).not.toContain('the network is not matched again at each frequency');
  expect(html).not.toContain('la red no se vuelve a adaptar en cada frecuencia');
}

describe('frequency response panel', () => {
  it('shows curves and numerical readouts automatically as soon as a valid network is available', () => {
    const html = renderToStaticMarkup(<FrequencyResponsePanel branches={branches} designFrequencyHz={1e9} />);
    expect(html).toMatch(/aria-label="Sweep start frequency"[^>]*value="500"/);
    expect(html).toMatch(/aria-label="Sweep stop frequency"[^>]*value="1500"/);
    expectOnlyFrequencyCurves(html);
    expectAutomaticResponse(html);
    expect(html).toContain('data-response-branch="branch-1"');
    expect(html).toContain('data-response-branch="branch-2"');
    expect(html).toContain('data-response-readout="branch-1"');
    expect(html).toContain('data-response-readout="branch-2"');
    expect(html.match(/data-magnitude="0"/g)).toHaveLength(2);
    expect(html).not.toMatch(/formula--error|NaN|Infinity/);
  });

  it.each([0, NaN, Infinity])('does not plot or expose invalid numbers for an invalid design frequency %s', (designFrequencyHz) => {
    const html = renderToStaticMarkup(<FrequencyResponsePanel branches={branches} designFrequencyHz={designFrequencyHz} />);
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('data-response-branch');
    expect(html).not.toContain('data-response-readout');
    expect(html).not.toMatch(/formula--error|NaN|Infinity/);
    expectAutomaticResponse(html);
  });

  it('renders accessible curves and numerical readouts for each fixed realization', () => {
    const html = renderToStaticMarkup(<FrequencyResponsePlot branches={branches} settings={settings} />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Reflection magnitude as a function of frequency"');
    const svg = html.match(/<svg\b[\s\S]*?<\/svg>/)?.[0];
    expect(svg).toBeDefined();
    expect(svg).not.toMatch(/<title\b|\btitle=/);
    expect(html).toContain('data-design-frequency-hz="1000000000"');
    expect(html).toContain('data-response-branch="branch-1"');
    expect(html).toContain('data-response-branch="branch-2"');
    expect(html.match(/data-magnitude="0"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Readout frequency"');
    expect(html).toContain('Branch 1');
    expect(html).toContain('Branch 2');
    expectOnlyFrequencyCurves(html);
    expect(html).not.toMatch(/formula--error|NaN|Infinity/);
  });

  it('plots arbitrary valid sweep ranges and reflections without applying a matching criterion', () => {
    const outside = renderToStaticMarkup(<FrequencyResponsePlot branches={branches} settings={{ ...settings, startHz: 1.1e9 }} />);
    expect(outside).toContain('data-response-branch="branch-1"');
    expect(outside).not.toContain('frequency-response__design-marker');
    expect(outside).toContain('data-frequency-hz="1100000000"');
    const reflected = renderToStaticMarkup(<FrequencyResponsePlot branches={[{ id: 'load', labelIndex: 0, evaluate: () => .8 }]} settings={settings} />);
    expect(reflected).toContain('data-response-branch="load"');
    expect(reflected).toContain('data-magnitude="0.8"');
    expectOnlyFrequencyCurves(reflected);
  });

  it('does not fabricate a network when no discrete realization exists', () => {
    const html = renderToStaticMarkup(<FrequencyResponsePanel branches={[]} designFrequencyHz={1e9} emptyMessage="This topology has a continuous family." />);
    expect(html).toContain('This topology has a continuous family.');
    expectAutomaticResponse(html);
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('data-response-branch');
    expect(html).not.toContain('data-response-readout');
  });

  it('distinguishes a bare lossless line from a synthesized match', () => {
    const inputBranches = createFrequencyResponse({ kind: 'line', input: { z0: 50, load: { kind: 'impedance', resistance: 100, reactance: 50 }, lengthInWavelengths: .4 } });
    const html = renderToStaticMarkup(<FrequencyResponsePanel branches={inputBranches} designFrequencyHz={1e9} />);
    expect(html).toContain('is independent of frequency; the line alone does not match the load');
    expect(html).not.toContain('Match at ');
  });

  it.each(['en', 'es'] as const)('localizes the pure frequency plot and controls in %s', (locale) => {
    const panel = renderToStaticMarkup(<I18nProvider initialLocale={locale}><FrequencyResponsePanel branches={branches} designFrequencyHz={1e9} /></I18nProvider>);
    expect(panel).toContain(locale === 'es' ? 'Respuesta en frecuencia' : 'Frequency response');
    expectAutomaticResponse(panel);
    expect(panel).toContain(locale === 'es' ? 'aria-label="Frecuencia inicial del barrido"' : 'aria-label="Sweep start frequency"');
    expect(panel).toContain('data-response-branch="branch-1"');
    expect(panel).toContain('data-response-readout="branch-1"');
    expect(panel).toContain(locale === 'es' ? 'aria-label="Frecuencia de lectura"' : 'aria-label="Readout frequency"');
    expectOnlyFrequencyCurves(panel);
    const chart = renderToStaticMarkup(<I18nProvider initialLocale={locale}><FrequencyResponsePlot branches={branches} settings={settings} /></I18nProvider>);
    expect(chart).toContain(locale === 'es' ? 'Módulo de reflexión en función de la frecuencia' : 'Reflection magnitude as a function of frequency');
    expect(chart.match(/<svg\b[\s\S]*?<\/svg>/)?.[0]).not.toMatch(/<title\b|\btitle=/);
    expect(chart).toContain(locale === 'es' ? 'Rama 1' : 'Branch 1');
    expect(chart).toContain(locale === 'es' ? 'aria-label="Frecuencia de lectura"' : 'aria-label="Readout frequency"');
    expectOnlyFrequencyCurves(chart);
    expect(chart).not.toMatch(/formula--error|NaN|Infinity/);
  });

  it('reports numeric-range failures without retaining curves or readouts', () => {
    const broken = [{ id: 'load', labelIndex: 0, evaluate: () => { throw new RangeError('outside numeric range'); } }];
    const html = renderToStaticMarkup(<FrequencyResponsePlot branches={broken} settings={settings} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('too wide to resolve reliably');
    expect(html).not.toContain('data-response-branch');
    expect(html).not.toContain('data-bandwidth-status');
  });

  it('resolves a broad sweep with more samples and rejects a range too broad to resolve', () => {
    const physicalBranches = createFrequencyResponse({
      kind: 'single-stub', termination: 'short',
      input: { z0: 50, stubZ0: 50, load: { kind: 'impedance', resistance: 100, reactance: 50 } },
    });
    const broad = renderToStaticMarkup(<FrequencyResponsePlot branches={physicalBranches} settings={{ ...settings, stopHz: 100e9 }} />);
    const paths = [...broad.matchAll(/<path[^>]*data-response-branch="[^"]+"[^>]*d="([^"]*)"/g)];
    expect(paths).toHaveLength(2);
    for (const path of paths) expect((path[1].match(/L/g) ?? []).length).toBeGreaterThan(801);
    expect(broad).not.toContain('role="alert"');
    const unresolved = renderToStaticMarkup(<FrequencyResponsePlot branches={physicalBranches} settings={{ ...settings, stopHz: 1000e9 }} />);
    expect(unresolved).toContain('role="alert"');
    expect(unresolved).toContain('Narrow the sweep');
    expect(unresolved).not.toContain('data-response-branch');
    expect(unresolved).not.toContain('data-bandwidth-status');
    expect(unresolved).not.toContain('data-response-readout');
  });
});
