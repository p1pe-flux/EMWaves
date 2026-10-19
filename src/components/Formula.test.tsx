import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import katex from 'katex';
import { Formula } from './Formula';
import { MathMarkdown } from './MathMarkdown';
import { compileGuideMarkdown } from '../../scripts/compile-guide-markdown';

describe('Formula', () => {
  it.each([
    ['fractions and subscripts', String.raw`\Gamma_L = \frac{Z_L-Z_0}{Z_L+Z_0}`],
    ['vectors, phasors, and the imaginary unit', String.raw`\phasor{\vect{E}} = E_0 e^{-\iu k z}`],
    ['matrices', String.raw`\begin{pmatrix} 1 & 0 \\ 0 & 1 \end{pmatrix}`],
    ['aligned equations', String.raw`\begin{aligned} z_L &= Z_L/Z_0 \\ \Gamma_L &= (z_L-1)/(z_L+1) \end{aligned}`],
  ])('renders %s with HTML and MathML', (_name, tex) => {
    const html = renderToStaticMarkup(<Formula tex={tex} display />);

    expect(html).toContain('class="katex"');
    expect(html).toContain('class="katex-mathml"');
    expect(html).toContain('class="katex-html"');
    expect(html).toContain('<math');
    expect(html).not.toContain('formula--error');
    expect(html).not.toContain('katex-error');
  });

  it('supports inline formulas and preserves presentation classes', () => {
    const html = renderToStaticMarkup(<Formula tex="z_L" className="point-label" />);

    expect(html).toMatch(/^<span class="formula formula--inline point-label"/);
    expect(html).not.toContain('katex-display');
  });

  it('shows the source and error without interrupting the application', () => {
    const html = renderToStaticMarkup(<Formula tex={String.raw`\unknownCommand{x}`} />);

    expect(html).toContain('role="alert"');
    expect(html).toContain('Invalid TeX formula');
    expect(html).toContain(String.raw`\unknownCommand{x}`);
    expect(html).not.toContain('class="katex"');
  });

  it('escapes HTML in authoring errors', () => {
    const html = renderToStaticMarkup(<Formula tex={String.raw`\unknownCommand{<script>}`} />);

    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('does not allow TeX links that require trust', () => {
    const html = renderToStaticMarkup(<Formula tex={String.raw`\href{https://example.com}{link}`} />);

    expect(html).not.toContain('<a ');
  });

  it('does not propagate macro redefinitions to other formulas', () => {
    const baseline = renderToStaticMarkup(<Formula tex={String.raw`\iu`} />);
    renderToStaticMarkup(<Formula tex={String.raw`\gdef\iu{X}`} />);

    expect(renderToStaticMarkup(<Formula tex={String.raw`\iu`} />)).toBe(baseline);
  });
});

describe('shared Formula rendering cache', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.restoreAllMocks());

  it('reuses pure output across remounts while preserving wrapper classes and display mode', async () => {
    const { Formula: CachedFormula } = await import('./Formula');
    const render = vi.spyOn(katex, 'renderToString');
    const first = renderToStaticMarkup(<CachedFormula tex="z_L" className="first" />);
    const second = renderToStaticMarkup(<CachedFormula tex="z_L" className="second" />);
    const displayed = renderToStaticMarkup(<CachedFormula tex="z_L" display />);

    expect(render).toHaveBeenCalledTimes(2);
    expect(first).toContain('formula--inline first');
    expect(second).toContain('formula--inline second');
    expect(displayed).toContain('katex-display');
    expect(second).toContain('katex-mathml');
    expect(render.mock.calls[0][1]).toMatchObject({
      output: 'htmlAndMathml', trust: false, throwOnError: true, displayMode: false,
    });
    expect(render.mock.calls[1][1]).toMatchObject({ displayMode: true });
    renderToStaticMarkup(<CachedFormula tex="z_0" />);
    expect(render).toHaveBeenCalledTimes(3);
  });

  it('caches parse failures but translates and escapes their presentation on each mount', async () => {
    const { Formula: CachedFormula } = await import('./Formula');
    const { I18nProvider } = await import('../i18n');
    const render = vi.spyOn(katex, 'renderToString');
    const tex = String.raw`\unknownCachedCommand{<script>}`;
    const english = renderToStaticMarkup(
      <I18nProvider initialLocale="en"><CachedFormula tex={tex} /></I18nProvider>,
    );
    const spanish = renderToStaticMarkup(
      <I18nProvider initialLocale="es"><CachedFormula tex={tex} /></I18nProvider>,
    );

    expect(render).toHaveBeenCalledTimes(1);
    expect(english).toContain('Invalid TeX formula');
    expect(spanish).toContain('Fórmula TeX no válida');
    expect(spanish).toContain('role="alert"');
    expect(spanish).toContain('&lt;script&gt;');
    expect(spanish).not.toContain('<script>');
  });

  it('does not share new or redefined macros between cache misses', async () => {
    const { Formula: CachedFormula } = await import('./Formula');
    const defining = String.raw`\gdef\localAuditMacro{X}\gdef\iu{Y}\localAuditMacro`;
    const first = renderToStaticMarkup(<CachedFormula tex={defining} />);
    expect(first).not.toContain('formula--error');
    expect(renderToStaticMarkup(<CachedFormula tex={String.raw`\localAuditMacro`} />))
      .toContain('formula--error');
    const independent = renderToStaticMarkup(<CachedFormula tex={String.raw`\iu+1`} />);
    expect(independent).toContain('>j</mi>');
    expect(independent).not.toContain('>Y</mi>');
    expect(renderToStaticMarkup(<CachedFormula tex={defining} />)).toBe(first);
  });

  it('evicts the least recently used source after 256 entries', async () => {
    const { Formula: CachedFormula } = await import('./Formula');
    const render = vi.spyOn(katex, 'renderToString');
    const mount = (tex: string) => renderToStaticMarkup(<CachedFormula tex={tex} />);
    mount('a=-1');
    for (let index = 0; index < 255; index += 1) mount(`a=${index}`);
    mount('a=-1');
    mount('a=255');
    mount('a=-1');
    expect(render.mock.calls.filter(([tex]) => tex === 'a=-1')).toHaveLength(1);
    mount('a=0');
    expect(render.mock.calls.filter(([tex]) => tex === 'a=0')).toHaveLength(2);
  });

  it('also bounds retained source/output characters and skips oversized output', async () => {
    const { Formula: CachedFormula } = await import('./Formula');
    const render = vi.spyOn(katex, 'renderToString').mockReturnValue('x'.repeat(600_000));
    const mount = (tex: string) => renderToStaticMarkup(<CachedFormula tex={tex} />);
    mount('a');
    mount('b');
    mount('a');
    expect(render).toHaveBeenCalledTimes(3);
    render.mockReturnValue('x'.repeat(1_000_001));
    mount('oversized');
    mount('oversized');
    expect(render).toHaveBeenCalledTimes(5);
  });
});

describe('MathMarkdown', () => {
  it('renders compiled inline and display formulas with shared macros', async () => {
    const markdown = String.raw`The load is $z_L = 1 + \iu$.

$$
\phasor{\vect{E}} = \frac{1}{2}
$$`;
    const [compiled] = await compileGuideMarkdown(markdown);
    const html = renderToStaticMarkup(<MathMarkdown html={compiled} />);

    expect(html.match(/class="katex"/g)).toHaveLength(2);
    expect(html).toContain('class="katex-display"');
    expect(html).not.toContain('katex-error');
  });

  it('rejects invalid authored Markdown formulas before shipping them', async () => {
    await expect(compileGuideMarkdown(String.raw`Error: $\unknownCommand{x}$.`)).rejects.toThrow('Could not render math');
  });

  it('rejects incomplete syntax at build time', async () => {
    await expect(compileGuideMarkdown(String.raw`Error: $\frac{1}{$. The text remains visible.`)).rejects.toThrow('Could not render math');
  });

  it('does not propagate macro redefinitions between compiled documents', async () => {
    const baseline = await compileGuideMarkdown(String.raw`$\iu$`);
    await compileGuideMarkdown(String.raw`$\gdef\iu{X}$`);
    expect(await compileGuideMarkdown(String.raw`$\iu$`)).toEqual(baseline);
  });

  it.each([
    'smith-intro.md', 'smith-intro.es.md',
    'transmission-line-theory.md', 'transmission-line-theory.es.md',
    'transmission-line-example.md', 'transmission-line-example.es.md',
  ])('renders the compiled %s guide content without TeX errors', async (filename) => {
    const lesson = readFileSync(new URL('../content/' + filename, import.meta.url), 'utf8');
    const compiled = await compileGuideMarkdown(lesson);
    const html = renderToStaticMarkup(<MathMarkdown html={compiled.join('')} />);

    expect(html).not.toContain('katex-error');
  });
});
