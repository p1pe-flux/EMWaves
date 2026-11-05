import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../i18n';
import { LCMatchingGuideContent } from './LCMatchingGuide';

describe('LC matching guide', () => {
  it.each(['en', 'es'] as const)('explains topology and valid component signs in %s', (locale) => {
    const html = renderToStaticMarkup(<I18nProvider initialLocale={locale}><LCMatchingGuideContent /></I18nProvider>);
    expect(html).toContain('x_L=\\omega L/Z_0');
    expect(html).toContain('b_L=-Z_0/(\\omega L)');
    expect(html).toContain('B_\\pm=\\pm\\sqrt{g-g^2}');
    expect(html).toContain('T_\\pm=\\pm\\sqrt{r-r^2}');
    expect(html).toContain('\\frac{1-y}{1+y}');
    expect(html).toContain('data-grid="both"');
    expect(html).toContain('data-lc-smith-reading');
    const readingTitle = locale === 'es' ? 'Cómo leer el diagrama doble de Smith' : 'How to read the combined Smith chart';
    const matchingTitle = locale === 'es' ? 'En serie sumamos impedancias; en paralelo, admitancias' : 'Series adds impedance; parallel adds admittance';
    expect(html).toContain(readingTitle);
    expect(html.indexOf(readingTitle)).toBeLessThan(html.indexOf(matchingTitle));
    expect(html).not.toContain('p_y=-\\Gamma');
    expect(html).toContain('href="#/labs/lc-matching"');
    expect(html).not.toMatch(/formula--error|katex-error|NaN/);
    expect(html).not.toContain('Manual tuning');
  });
});
