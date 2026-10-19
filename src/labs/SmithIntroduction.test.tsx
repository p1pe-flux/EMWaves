import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import SmithIntroduction from './SmithIntroduction';

describe('initial Smith chart', () => {
  it('preserves TeX commands in JSX attributes and displays the initial solution', () => {
    const html = renderToStaticMarkup(<SmithIntroduction />);
    expect(html).not.toContain('formula--error');
    expect(html).toContain('R_L');
    expect(html).toContain('X_L');
    expect(html).toContain('l/\\lambda');
    expect(html).toContain('100 + \\iu\\,50');
    expect(html).toContain('2.618');
    expect(html).toContain('0.447');
    expect(html).toContain('0.464');
    expect(html).toContain('id="total-line-length"');
    expect(html).toContain('data-distance="0"');
  });
});
