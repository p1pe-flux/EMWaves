import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { LCNetworkOptions } from '../components/LCNetworkOptions';
import { LCMatchingDiagram } from '../components/LCMatchingDiagram';
import { solveLumpedMatching, type LumpedMatchingInput, type LumpedMatchingTopology } from '../domain/lumpedMatching';
import { I18nProvider, translateMessage } from '../i18n';
import LCMatching from './LCMatching';

vi.mock('../components/LCMatchingConstruction', () => ({
  LCMatchingConstruction: ({ input }: { input: LumpedMatchingInput }) => <section data-lc-construction data-input={JSON.stringify(input)} />,
}));

function inputElement(html: string, label: string) {
  return html.match(new RegExp('<input[^>]*aria-label="' + label + '"[^>]*>'))?.[0] ?? '';
}

const topology: LumpedMatchingTopology = {
  elements: [{ component: 'L', connection: 'series' }, { component: 'C', connection: 'parallel' }],
};
const input: LumpedMatchingInput = {
  z0: 50, frequencyHz: 1e9, load: { kind: 'impedance', resistance: 100, reactance: 50 }, ...topology,
};

describe('two-component matching laboratory', () => {
  it('uses compact electrical fields, MHz, and physical source-to-load component positions', () => {
    const html = renderToStaticMarkup(<LCMatching />);
    expect(html).toContain('parameters-panel--compact');
    for (const [label, value] of [['Reference impedance', '50'], ['Frequency', '1000'], ['Load resistance', '100'], ['Load reactance', '50']]) {
      expect(inputElement(html, label)).toContain('value="' + value + '"');
      expect(inputElement(html, label)).not.toContain('disabled');
    }
    expect(html).toContain('MHz');
    expect(html).toContain('&quot;frequencyHz&quot;:1000000000');
    expect(html).toContain('&quot;elements&quot;:[{&quot;component&quot;:&quot;L&quot;,&quot;connection&quot;:&quot;series&quot;},{&quot;component&quot;:&quot;C&quot;,&quot;connection&quot;:&quot;parallel&quot;}]');
    expect(html).toContain('data-lc-construction');
    expect(html).toContain('aria-label="Reset"');
    expect(html).toContain('title="Reset to initial values"');
    expect(html).not.toMatch(/Load type|Manual tuning|Equivalent designs|repetitions|<select\b|type="range"|inductorConnection|capacitorConnection/);
  });

  it('offers an independent type and connection for each numbered position', () => {
    const html = renderToStaticMarkup(<LCMatching />);
    expect(html.match(/type="radio"/g)).toHaveLength(8);
    expect(inputElement(html, 'Component 1: inductor')).toContain('checked=""');
    expect(inputElement(html, 'Component 1: capacitor')).not.toContain('checked');
    expect(inputElement(html, 'Component 1 in series')).toContain('checked=""');
    expect(inputElement(html, 'Component 1 in parallel')).not.toContain('checked');
    expect(inputElement(html, 'Component 2: capacitor')).toContain('checked=""');
    expect(inputElement(html, 'Component 2: inductor')).not.toContain('checked');
    expect(inputElement(html, 'Component 2 in parallel')).toContain('checked=""');
    expect(inputElement(html, 'Component 2 in series')).not.toContain('checked');
    expect(html.indexOf('generator side')).toBeLessThan(html.indexOf('load side'));
    expect(html).not.toMatch(/then capacitor|then inductor|name="[^"]*-order"/);
  });

  it('translates all fields, positions, types and connections', () => {
    const html = renderToStaticMarkup(<I18nProvider initialLocale="es"><LCMatching /></I18nProvider>);
    for (const label of ['Impedancia de referencia', 'Frecuencia', 'Resistencia de la carga', 'Reactancia de la carga', 'Componente 1: inductor', 'Componente 1: capacitor', 'Componente 2: inductor', 'Componente 2: capacitor', 'Componente 1 en serie', 'Componente 1 en paralelo', 'Componente 2 en serie', 'Componente 2 en paralelo', 'Restablecer']) {
      expect(html).toContain('aria-label="' + label + '"');
    }
    expect(html).toContain('<legend>Componente 1');
    expect(html).toContain('<legend>Componente 2');
    expect(html).toContain('lado del generador');
    expect(html).toContain('lado de la carga');
    expect(html).toContain('>Serie</label>');
    expect(html).toContain('>Paralelo</label>');
    expect(html).not.toMatch(/formula--error|katex-error|NaN|Infinity/);
  });
});

describe('shared numbered network options', () => {
  const choices = (['L', 'C'] as const).flatMap(component =>
    (['series', 'parallel'] as const).map(connection => ({ component, connection })));
  const topologies = choices.flatMap(first => choices.map(second => ({ elements: [first, second] } as LumpedMatchingTopology)));

  it.each(topologies)('preserves each of the 16 type/connection combinations: %j', value => {
    const html = renderToStaticMarkup(<LCNetworkOptions value={value} onChange={() => {}} />);
    value.elements.forEach((element, index) => {
      for (const component of ['L', 'C']) {
        const label = 'Component ' + (index + 1) + ': ' + (component === 'L' ? 'inductor' : 'capacitor');
        expect(inputElement(html, label).includes('checked=""')).toBe(element.component === component);
      }
      for (const connection of ['series', 'parallel']) {
        expect(inputElement(html, 'Component ' + (index + 1) + ' in ' + connection).includes('checked=""')).toBe(element.connection === connection);
      }
    });
    expect(html).not.toContain('type="number"');
  });

  it('gives each component type and connection a distinct radio group across lab and guide', () => {
    const html = renderToStaticMarkup(<><LCNetworkOptions value={topology} onChange={() => {}} /><LCNetworkOptions value={topology} onChange={() => {}} /></>);
    const names = [...html.matchAll(/\bname="([^"]+)"/g)].map(match => match[1]);
    expect(names).toHaveLength(16);
    expect(new Set(names).size).toBe(8);
    for (const name of new Set(names)) expect(names.filter(candidate => candidate === name)).toHaveLength(2);
  });

  it.each(['L', 'C'] as const)('keeps repeated %s elements distinct in the circuit and discloses only the obtained value', component => {
    const html = renderToStaticMarkup(<LCMatchingDiagram
      input={{ ...input, elements: [{ component, connection: 'parallel' }, { component, connection: 'series' }] }}
      values={component === 'L' ? [10e-9, 20e-9] : [2e-12, 4e-12]}
      progress={[0, 1]}
      revealed={[false, true]}
    />);
    expect(html).toContain('data-component-order="' + component + component + '"');
    expect(html.match(/data-element-index=/g)).toHaveLength(2);
    expect(html).toContain('data-element-index="0" data-component-progress="0.000"');
    expect(html).toContain('data-element-index="1" data-component-progress="1.000"');
    expect(html).not.toContain('data-value-index="0"');
    expect(html).toContain('data-value-index="1"');
    expect(html).toContain('data-main-conductor="lower" data-continuous="true"');
    expect(html).toContain('data-' + (component === 'L' ? 'inductor-symbol="coil"' : 'capacitor-symbol="plates"'));
    expect(html).not.toMatch(/formula--error|NaN|Infinity/);
  });
});

describe('two-component matching messages', () => {
  it('localizes finite solutions, both kinds of families, matched loads and impossible loads', () => {
    const seriesPair = (first: 'L' | 'C', second: 'L' | 'C', reactance: number): LumpedMatchingInput => ({
      ...input, elements: [{ component: first, connection: 'series' }, { component: second, connection: 'series' }],
      load: { kind: 'impedance', resistance: 50, reactance },
    });
    const cases: LumpedMatchingInput[] = [
      input,
      { ...input, elements: [{ component: 'L', connection: 'series' }, { component: 'L', connection: 'series' }] },
      { ...input, load: { kind: 'impedance', resistance: 0, reactance: 50 } },
      { ...input, load: { kind: 'impedance', resistance: 50, reactance: 0 } },
      seriesPair('L', 'L', -50),
      seriesPair('L', 'C', 50),
      seriesPair('L', 'L', 0),
    ];
    for (const parameters of cases) {
      const solution = solveLumpedMatching(parameters);
      expect(translateMessage(solution.message, 'es')).not.toBe(solution.message);
      expect(translateMessage(solution.message, 'en')).toBe(solution.message);
    }
  });

  it('localizes frequency validation', () => {
    expect(translateMessage('Frequency must be greater than zero.', 'es')).toBe('La frecuencia debe ser mayor que cero.');
    expect(translateMessage('Frequency must be a finite number.', 'es')).toBe('La frecuencia debe ser un número finito.');
    expect(translateMessage('Element 1 value must be greater than zero.', 'es')).toBe('El valor del componente 1 debe ser mayor que cero.');
    expect(translateMessage('Element 2 value must be a finite number.', 'es')).toBe('El valor del componente 2 debe ser un número finito.');
  });
});
