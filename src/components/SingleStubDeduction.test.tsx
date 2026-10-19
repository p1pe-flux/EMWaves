import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SingleStubDeduction } from './SingleStubDeduction';

function formulas(html: string): string[] {
  return [...html.matchAll(/<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/g)]
    .map((match) => match[1].replace(/\s+/g, ''));
}

describe('general shunt-stub matching deduction', () => {
  it('defines all three junction admittances with the same main-line normalization', () => {
    const html = renderToStaticMarkup(<SingleStubDeduction />);
    const tex = formulas(html);
    for (const port of ['y-v', 'y-ell', 'y-stub']) expect(html).toContain('data-port="' + port + '"');
    expect(tex).toContain('y_v');
    expect(tex).toContain('y_\\ell');
    expect(tex).toContain('y_{\\mathrm{stub}}');
    expect(tex).toContain('Y_0=\\frac{1}{Z_0},\\qquady_k=\\frac{Y_k}{Y_0}=Z_0Y_k,\\qquadz_k=\\frac{Z_k}{Z_0}=\\frac{1}{y_k}');
    expect(html).toContain('transformed line admittance');
    expect(html).toContain('All three admittances refer to the same junction.');
    expect(html).not.toContain('formula--error');
  });

  it('deduces the real and imaginary matching conditions from the transformed line and stub', () => {
    const tex = formulas(renderToStaticMarkup(<SingleStubDeduction />));
    expect(tex).toContain('y_v=y_\\ell+y_{\\mathrm{stub}}');
    expect(tex).toContain('\\frac{1}{z_v}=\\frac{1}{z_\\ell}+\\frac{1}{z_{\\mathrm{stub}}}');
    expect(tex).toContain('z_v=y_v=1\\quad\\Longrightarrow\\quad\\Gamma_v=0');
    expect(tex).toContain('y_\\ell=g_\\ell+\\iub_\\ell,\\qquady_{\\mathrm{stub}}=\\iub_s');
    expect(tex).toContain('\\operatorname{Re}y_\\ell=1,\\qquadb_s=-\\operatorname{Im}y_\\ell=-b_\\ell');
    expect(tex).not.toContain('\\frac{1}{z_v}=\\frac{1}{z_L}+\\frac{1}{z_{\\mathrm{stub}}}');
  });

  it('provides both termination formulas with the correct signs and shared normalization', () => {
    const html = renderToStaticMarkup(<SingleStubDeduction />);
    const open = html.match(/<div([^>]*data-stub-formula="open"[^>]*)>([\s\S]*?)<\/div>/);
    const short = html.match(/<div([^>]*data-stub-formula="short"[^>]*)>([\s\S]*?)<\/div>/);
    expect(open).not.toBeNull();
    expect(short).not.toBeNull();
    expect(open![1]).toContain('hidden');
    expect(short![1]).not.toContain('hidden');
    expect(formulas(open![2])).toContain('y_{\\mathrm{stub}}=\\iu\\frac{Z_0}{Z_{0s}}\\tan\\left(\\beta_s\\ell_s\\right)');
    expect(formulas(short![2])).toContain('y_{\\mathrm{stub}}=-\\iu\\frac{Z_0}{Z_{0s}}\\cot\\left(\\beta_s\\ell_s\\right)');
  });

  it('keeps the diagram and normalized deduction without the removed interactive block', () => {
    const html = renderToStaticMarkup(<SingleStubDeduction />);
    const tex = formulas(html);
    expect(html).toContain('class="ss-deduction"');
    expect(html).toContain('What must the shunt stub do?');
    expect(html).toContain('transmission-line-diagram');
    for (const port of ['y-v', 'y-ell', 'y-stub']) expect(html).toContain('data-port="' + port + '"');
    expect(tex).toContain('Y_0=\\frac{1}{Z_0},\\qquady_k=\\frac{Y_k}{Y_0}=Z_0Y_k,\\qquadz_k=\\frac{Z_k}{Z_0}=\\frac{1}{y_k}');
    expect(tex).toContain('\\operatorname{Re}y_\\ell=1,\\qquadb_s=-\\operatorname{Im}y_\\ell=-b_\\ell');
    expect(html).toContain('data-stub-formula="open"');
    expect(html).toContain('data-stub-formula="short"');
    expect(tex).toContain('y_{\\mathrm{stub}}=\\iu\\frac{Z_0}{Z_{0s}}\\tan\\left(\\beta_s\\ell_s\\right)');
    expect(tex).toContain('y_{\\mathrm{stub}}=-\\iu\\frac{Z_0}{Z_{0s}}\\cot\\left(\\beta_s\\ell_s\\right)');
    expect(html).not.toContain('Where can a reactive stub move?');
    expect(html).not.toContain('sd-admittance-plane');
    expect(html).not.toContain('smith-chart');
    expect(html).not.toContain('aria-label="Stub susceptance"');
    expect(html).not.toContain('Line admittance example');
    expect(html).not.toContain('Set required susceptance');
    expect(html).not.toContain('data-matched=');
    expect(html).not.toContain('formula--error');
  });
});
