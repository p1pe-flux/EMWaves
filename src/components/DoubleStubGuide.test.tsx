import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../i18n';
import { DOUBLE_STUB_EXAMPLE, DoubleStubGuideContent } from './DoubleStubGuide';
import { solveDoubleStub } from '../domain/doubleStub';

describe('double-stub backward guide', () => {
  it.each(['en', 'es'] as const)('explains the backward locus with valid formulas in %s', (locale) => {
    const html = renderToStaticMarkup(<I18nProvider initialLocale={locale}><DoubleStubGuideContent /></I18nProvider>);
    expect(html).toContain(locale === 'es' ? 'Comenzamos por la izquierda' : 'Start at the left');
    expect(html).toContain(locale === 'es' ? 'sentido antihorario' : 'counterclockwise');
    expect(html).toContain('data-stage-name="matched"');
    expect(html).toContain('href="#/labs/double-stub-matching"');
    expect(html).toContain('sin');
    expect(html).toContain('frac');
    expect(html).toContain('T_{d_1}(y_L)');
    expect(html).toContain('T_{d_2}(y_2)');
    const loadConstruction = locale === 'es' ? 'Construimos la admitancia del lado de la carga' : 'Construct the load-side admittance';
    const intersections = locale === 'es' ? 'Cruzamos el lugar geométrico' : 'Intersect the locus';
    expect(html.indexOf(loadConstruction)).toBeLessThan(html.indexOf(intersections));
    expect(html).toContain(String.raw`p(y_L)=-p_z=-\Gamma_L`);
    expect(html).toContain(String.raw`y_R=y_\ell(d_1)=T_{d_1}(y_L)=g+\iu b_R`);
    expect(html).not.toMatch(/formula--error|katex-error|NaN/);
    expect(html).not.toContain('>Play</button>');
    expect(html).not.toContain('Manual tuning');
  });

  it('lets the guide independently choose each termination and keeps the example consistent with the solver', () => {
    const html = renderToStaticMarkup(<DoubleStubGuideContent />);
    expect(html.match(/type="radio"/g)).toHaveLength(4);
    expect(html).toContain('name="guide-double-stub-1"');
    expect(html).toContain('name="guide-double-stub-2"');
    const result = solveDoubleStub(DOUBLE_STUB_EXAMPLE);
    expect(result.branches).toHaveLength(2);
    expect(result.branches[0].stub1.shortLength).toBeCloseTo(0.14942771357499135, 9);
    expect(result.branches[0].stub2.shortLength).toBeCloseTo(0.1941558073305081, 9);
    expect(result.branches[1].stub1.shortLength).toBeCloseTo(0.4441558073305081, 9);
    expect(result.branches[1].stub2.shortLength).toBeCloseTo(0.39942771357499135, 9);
    for (const branch of result.branches) expect(branch.residual).toBeLessThan(1e-10);
  });
});
