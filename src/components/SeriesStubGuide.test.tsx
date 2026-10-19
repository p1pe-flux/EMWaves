import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../i18n';
import { SeriesStubGuideContent } from './SeriesStubGuide';

describe('series-stub guide', () => {
  it.each(['en', 'es'] as const)('explains impedance addition with valid equations in %s', (locale) => {
    const html = renderToStaticMarkup(<I18nProvider initialLocale={locale}><SeriesStubGuideContent /></I18nProvider>);
    expect(html).toContain('z_v=z_\\ell(d)+z_{\\mathrm{stub}}');
    expect(html).toContain('\\operatorname{Re}z_\\ell(d)=1');
    expect(html).toContain('Z_{0s}');
    expect(html).toContain('href="#/labs/series-stub-matching"');
    expect(html).toContain(locale === 'es' ? 'impedancias' : 'impedances');
    expect(html).not.toMatch(/formula--error|katex-error|NaN/);
    expect(html).not.toContain('Manual tuning');
  });
});
