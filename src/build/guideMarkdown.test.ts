import { describe, expect, it } from 'vitest';
import { compileGuideMarkdown } from '../../scripts/compile-guide-markdown';

describe('build-time guide compiler', () => {
  it.each(['smith-chart-animation', 'transmission-line-diagram'])('preserves Markdown links and accessible math around the %s marker', async (marker) => {
    const sections = await compileGuideMarkdown('# Uno\n\n$z_L=2+\\iu$\n\n<!-- ' + marker + ' -->\n\n[Fuente](https://example.org)\n\n$$y_L=1/z_L$$');
    expect(sections).toHaveLength(2);
    expect(sections[0]).toContain('<h1>Uno</h1>');
    expect(sections.every((html) => html.includes('application/x-tex') && html.includes('<math'))).toBe(true);
    expect(sections[1]).toContain('href="https://example.org"');
    expect(sections.join('')).not.toMatch(/katex-error|<!--/);
  });

  it('discards raw HTML and unsafe link protocols before adding trusted KaTeX output', async () => {
    const [html] = await compileGuideMarkdown('<script>alert(1)</script>\n\n[x](javascript:alert%281%29)\n\n$z_L$');
    expect(html).not.toMatch(/<script|javascript:|onclick=/i);
    expect(html).toContain('katex-mathml');
  });

  it('fails the build when an authored formula cannot be parsed', async () => {
    await expect(compileGuideMarkdown('$\\invalidCommand{z}$')).rejects.toThrow('Could not render math');
  });
});
