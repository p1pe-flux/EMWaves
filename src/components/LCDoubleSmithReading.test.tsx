import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../i18n';
import { LCDoubleSmithReading } from './LCDoubleSmithReading';

function numericAttribute(tag: string, name: string): number {
  const match = tag.match(new RegExp(name + '="([^\"]+)"'));
  expect(match, name).not.toBeNull();
  return Number(match![1]);
}

describe('combined Smith chart reading in the LC guide', () => {
  it('keeps each reciprocal pair at the same physical reflection point with opposite x and b signs', () => {
    const html = renderToStaticMarkup(<LCDoubleSmithReading />);
    for (const [id, sign] of [['A', 1], ['B', -1]] as const) {
      const example = html.match(new RegExp('<div[^>]*data-lc-reading-example="' + id + '"[^>]*>'))?.[0];
      const marker = html.match(new RegExp('<g[^>]*data-chart-marker="lc-reading-' + id + '"[^>]*>'))?.[0];
      expect(example).toBeDefined();
      expect(marker).toBeDefined();
      const r = numericAttribute(example!, 'data-z-real');
      const x = numericAttribute(example!, 'data-z-imaginary');
      const g = numericAttribute(example!, 'data-y-real');
      const b = numericAttribute(example!, 'data-y-imaginary');
      expect([r, x, g, b]).toEqual([1, sign, .5, -.5 * sign]);
      expect(r * g - x * b).toBeCloseTo(1, 14);
      expect(r * b + x * g).toBeCloseTo(0, 14);
      expect(numericAttribute(marker!, 'data-re')).toBeCloseTo(.2, 14);
      expect(numericAttribute(marker!, 'data-im')).toBeCloseTo(.4 * sign, 14);
      expect(numericAttribute(example!, 'data-gamma-real')).toBe(numericAttribute(marker!, 'data-re'));
      expect(numericAttribute(example!, 'data-gamma-imaginary')).toBe(numericAttribute(marker!, 'data-im'));
    }
    expect(html.match(/data-chart-marker=/g)).toHaveLength(2);
    expect(html).not.toContain('p_y=-');
  });

  it('uses both shared grids without numeric background labels or interactive controls', () => {
    const html = renderToStaticMarkup(<LCDoubleSmithReading />);
    expect(html).toContain('data-grid="both"');
    expect(html).toContain('data-grid-focus="0.5"');
    expect(html).toContain('data-interactive="false"');
    expect(html).toContain('data-grid-layer="impedance"');
    expect(html).toContain('data-grid-layer="admittance"');
    expect(html).toContain('data-chart-circle="lc-reading-resistance"');
    expect(html).toContain('data-chart-circle="lc-reading-conductance"');
    expect(html).not.toMatch(/smith-grid-label|smith-reactance-label|smith-scale-label/);
    expect(html).not.toMatch(/<input\b|<button\b|<select\b|data-playing/);
    expect(html).not.toMatch(/formula--error|katex-error|NaN|Infinity/);
  });

  it.each(['en', 'es'] as const)('explains reactance, susceptance and series/parallel readings in %s', (locale) => {
    const html = renderToStaticMarkup(<I18nProvider initialLocale={locale}><LCDoubleSmithReading /></I18nProvider>);
    expect(html).toContain(locale === 'es' ? 'Cómo leer el diagrama doble de Smith' : 'How to read the combined Smith chart');
    expect(html).toContain(locale === 'es' ? 'es la parte imaginaria de la admitancia' : 'is the imaginary part of admittance');
    expect(html).toContain(locale === 'es' ? 'signos opuestos en el mismo punto' : 'opposite signs at the same point');
    expect(html).toContain(locale === 'es' ? 'Para un elemento en serie' : 'For an element in series');
    expect(html).toContain(locale === 'es' ? 'Para un elemento en paralelo' : 'For an element in parallel');
    expect(html).toContain(locale === 'es' ? 'Mitad superior' : 'Upper half');
    expect(html).toContain(locale === 'es' ? 'Mitad inferior' : 'Lower half');
    expect(html).toContain(locale === 'es' ? 'Eje real' : 'Real axis');
    expect(html).toContain('b=-\\frac{x}{r^2+x^2}');
    expect(html).toContain('\\frac{1-y}{1+y}');
    for (const sign of ['x&gt;0', 'b&lt;0', 'x&lt;0', 'b&gt;0', 'x=0', 'b=0']) expect(html).toContain(sign);
    expect(html).toContain('z_A=1+\\iu');
    expect(html).toContain('y_A=\\tfrac12-\\iu\\tfrac12');
    expect(html).toContain('z_B=1-\\iu');
    expect(html).toContain('y_B=\\tfrac12+\\iu\\tfrac12');
    expect(html).not.toMatch(/formula--error|katex-error|NaN|Infinity/);
  });
});
