import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { QUARTER_WAVE_EXAMPLE, QuarterWaveGuideContent } from './QuarterWaveGuide';

vi.mock('./QuarterWaveConstruction', () => ({
  QuarterWaveConstruction: () => (
    <section data-quarter-wave-construction>Animated quarter-wave construction</section>
  ),
}));

function formulas(html: string): string[] {
  return [...html.matchAll(/<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/g)]
    .map((match) => match[1].replace(/\s+/g, ''));
}

describe('quarter-wave matching guide', () => {
  it('anchors the deduction to an abstract series transformer drawing and defines both input planes', () => {
    const html = renderToStaticMarkup(<QuarterWaveGuideContent />);
    const figure = html.match(/<figure class="qw-guide__circuit">([\s\S]*?)<\/figure>/);
    expect(figure).not.toBeNull();
    expect(html.indexOf('class="qw-guide__circuit"')).toBeLessThan(html.indexOf('Why a quarter wavelength matches a real resistance'));
    expect(figure![1]).toContain('transmission-line-diagram');
    expect(figure![1]).toContain('data-series-section="transformer"');
    expect(figure![1]).toContain('data-distance="0.2"');
    expect(figure![1]).toContain('data-transformer-length="0.25"');
    expect(figure![1]).toContain('data-input-plane="transformer-input"');
    expect(figure![1]).toContain('load-side junction');
    expect(figure![1]).toContain('generator-side junction');
    expect(formulas(figure![1])).toEqual(['Z_\\ell(d)', 'd', 'Z_L', 'Z_v', 'Z_t', '\\ell_t']);
    expect(figure![1]).not.toContain('75 Ω');
    expect(figure![1]).not.toContain('50 Ω');
    expect(figure![1]).not.toContain('0.2λ');
    expect(figure![1]).not.toContain('formula--error');
  });

  it('deduces resistance inversion from the sine–cosine formula using the transformer phase constant', () => {
    const html = renderToStaticMarkup(<QuarterWaveGuideContent />);
    const tex = formulas(html);
    expect(tex).toContain('Z_v(\\ell_t)=Z_t\\frac{R\\cos(\\beta_t\\ell_t)+\\iuZ_t\\sin(\\beta_t\\ell_t)}{Z_t\\cos(\\beta_t\\ell_t)+\\iuR\\sin(\\beta_t\\ell_t)}');
    expect(tex).toContain('Z_v=Z_t\\frac{\\iuZ_t}{\\iuR}=\\frac{Z_t^2}{R}');
    expect(tex).toContain('Z_t=\\sqrt{Z_0R},\\qquad\\ell_t=\\lambda_t/4');
    expect(html.indexOf('Why a quarter wavelength matches a real resistance')).toBeLessThan(html.indexOf('Animated quarter-wave construction'));
    expect(html).not.toContain('formula--error');
    expect(html).not.toMatch(/2\\pi|4\\pi/);
  });

  it('finds complex-load placements on the real axis and includes both numerical branches', () => {
    const html = renderToStaticMarkup(<QuarterWaveGuideContent />);
    expect(QUARTER_WAVE_EXAMPLE).toEqual({ z0: 50, load: { kind: 'impedance', resistance: 100, reactance: 50 } });
    expect(formulas(html)).toContain('\\operatorname{Im}Z_\\ell(d)=0');
    expect(html).toContain('real axis');
    for (const value of ['0.0368959044', '0.2868959044', '130.9016994', '19.0983006', '80.9016994', '30.9016994']) expect(html).toContain(value);
    expect(html).toContain('Two quarter-wave matching networks for the same load');
    expect(html).not.toContain('g=1');
    expect(html).not.toContain('unit-conductance');
  });

  it('distinguishes chart-reference changes from propagation and verifies in the main-line reference', () => {
    const html = renderToStaticMarkup(<QuarterWaveGuideContent />);
    const tex = formulas(html);
    expect(tex).toContain('z_t(0)=R/Z_t,\\qquad\\Gamma_t(0)=\\frac{R-Z_t}{R+Z_t}');
    expect(tex).toContain('\\Gamma_t(\\ell_t)=\\Gamma_t(0)e^{-\\iu\\,2\\beta_t\\ell_t}=-\\Gamma_t(0),\\qquad\\beta_t\\ell_t=\\pi/2');
    expect(html).toContain('generally remains away from the center in the transformer reference');
    expect(html).toContain('neither the physical impedance nor the selected lengths');
    expect(tex).toContain('Z_v=Z_tz_t(\\ell_t)=Z_0,\\qquad\\Gamma_v=\\frac{Z_v-Z_0}{Z_v+Z_0}=0,\\qquad\\mathrm{VSWR}=1');
  });

  it('preserves independent wavelength families in the full guide', () => {
    const html = renderToStaticMarkup(<QuarterWaveGuideContent />);
    expect(formulas(html)).toContain('d=d_i+n\\lambda/2,\\qquad\\ell_t=(1/4+m/2)\\lambda_t,\\qquadn,m\\in\\{0,1,2,\\ldots\\}');
    expect(formulas(html)).toContain('\\beta_t\\ell_t=\\pi/2+m\\pi');
    expect(html).toContain('href="#/labs/quarter-wave-transformer"');
    expect(html).not.toContain('formula--error');
  });
});
