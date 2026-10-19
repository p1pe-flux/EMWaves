import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QuarterWaveDiagram } from './QuarterWaveDiagram';
import type { QuarterWaveDiagramProps } from './QuarterWaveDiagram';

const example: QuarterWaveDiagramProps = {
  z0: 50,
  loadLabel: '100 + j50 Ω',
  distance: 0.25,
  transformerZ0: 80.9016994,
  transformerLength: 0.25,
};

function render(props: Partial<QuarterWaveDiagramProps> = {}): string {
  return renderToStaticMarkup(<QuarterWaveDiagram {...example} {...props} />);
}

function tag(html: string, className: string): string {
  const match = html.match(new RegExp('<[^>]+class="' + className + '"[^>]*>'));
  expect(match, 'Missing ' + className).not.toBeNull();
  return match![0];
}

function attribute(element: string, name: string): string | undefined {
  return element.match(new RegExp('(?:^| )' + name + '="([^"]*)"'))?.[1];
}

function svg(html: string): string {
  return html.match(/^<svg\b[^>]*>/)![0];
}

describe('quarter-wave series-line schematic', () => {
  it('keeps the shared generator, two rails, and load without shunt controls or hover titles', () => {
    const html = render();
    expect(html).toContain('viewBox="0 0 600 270"');
    expect(attribute(tag(html, 'transmission-line-diagram__source'), 'cx')).toBe('60');
    expect(attribute(tag(html, 'transmission-line-diagram__source'), 'cy')).toBe('110');
    expect(attribute(tag(html, 'transmission-line-diagram__source'), 'r')).toBe('24');
    expect(attribute(tag(html, 'transmission-line-diagram__line'), 'd')).toBe('M110 70H480M110 150H480');
    const load = tag(html, 'transmission-line-diagram__load');
    expect(attribute(load, 'x')).toBe('471');
    expect(attribute(load, 'y')).toBe('90');
    expect(attribute(load, 'width')).toBe('18');
    expect(attribute(load, 'height')).toBe('40');
    expect(attribute(svg(html), 'role')).toBe('img');
    expect(attribute(svg(html), 'aria-label')).toContain('Series quarter-wave transformer');
    expect(attribute(svg(html), 'aria-describedby')).toBeDefined();
    expect(html).toMatch(/class="qw-diagram__junction-label"[^>]*>Z<tspan baseline-shift="sub">ℓ<\/tspan><tspan baseline-shift="baseline">\(d\)<\/tspan>/);
    expect(html).not.toMatch(/<title\b|role="slider"|data-stub|Stub length|Z₀ₛ|Toward generator|d = 0 at load/);
  });

  it.each([[0, 480, 360], [0.25, 400, 280], [0.5, 320, 200]])('inserts a true series section at d/λ=%s between the feed and load line', (distance, junction, start) => {
    const html = render({ distance });
    expect(attribute(svg(html), 'data-transformer-start')).toBe(String(start));
    expect(attribute(svg(html), 'data-transformer-end')).toBe(String(junction));
    expect(attribute(tag(html, 'qw-diagram__section-wire'), 'd')).toBe('M' + start + ' 70H' + junction + 'M' + start + ' 150H' + junction);
    const face = tag(html, 'qw-diagram__section-face');
    expect(Number(attribute(face, 'x'))).toBeGreaterThan(110);
    expect(Number(attribute(face, 'x')) + Number(attribute(face, 'width'))).toBe(junction);
    expect(Number(attribute(face, 'width'))).toBe(120);
    expect(Number(attribute(face, 'height'))).toBe(80);
    expect(attribute(tag(html, 'qw-diagram__junction'), 'data-junction-x')).toBe(String(junction));
  });

  it('shows the original main line and selected junction before the transformer is inserted', () => {
    const html = render({ showTransformer: false });
    expect(attribute(svg(html), 'data-transformer-present')).toBe('false');
    expect(attribute(svg(html), 'data-transformer-start')).toBeUndefined();
    expect(html).not.toContain('class="qw-diagram__section-wire"');
    expect(html).not.toContain('data-dimension="transformer-length"');
    expect(html).not.toContain('data-transformer-reading-progress');
    expect(attribute(tag(html, 'qw-diagram__junction'), 'data-junction-x')).toBe('400');
    expect(attribute(tag(html, 'transmission-line-diagram__line'), 'd')).toBe('M110 70H480M110 150H480');
  });

  it.each([[0, 400], [0.5, 340], [1, 280]])('moves the reading plane through the complete quarter-wave section at progress %s', (activeTransformerProgress, readingX) => {
    const html = render({ activeTransformerProgress });
    const plane = tag(html, 'qw-diagram__reading-plane');
    expect(Number(attribute(plane, 'data-transformer-reading-progress'))).toBe(activeTransformerProgress);
    expect(Number(attribute(plane, 'data-transformer-reading-x'))).toBe(readingX);
    expect(attribute(tag(html, 'qw-diagram__input-plane'), 'd')).toBe('M' + readingX + ' 62V162');
    const railNodes = [...html.matchAll(/<circle class="qw-diagram__input-node"[^>]*>/g)].map((match) => match[0]);
    expect(railNodes.map((node) => [Number(attribute(node, 'cx')), Number(attribute(node, 'cy'))])).toEqual([[readingX, 70], [readingX, 150]]);
    expect(attribute(svg(html), 'data-transformer-length')).toBe('0.25');
    expect(attribute(svg(html), 'data-transformer-start')).toBe('280');
    expect(attribute(svg(html), 'data-transformer-end')).toBe('400');
    expect(html).toContain('ℓₜ = 0.25λₜ');
    const label = html.match(/<text class="qw-diagram__reading-label"[^>]*>([\s\S]*?)<\/text>/)![1];
    if (activeTransformerProgress < 1) {
      expect(label).toContain('baseline-shift="super">(t)');
      expect(label).toContain('(ℓ)');
    } else expect(label).toContain('baseline-shift="sub">v');
  });

  it('preserves the static transformer input when no reading progress is requested', () => {
    const html = render();
    expect(html).toContain('data-input-plane="transformer-input"');
    expect(attribute(tag(html, 'qw-diagram__input-plane'), 'd')).toBe('M280 62V162');
    expect(html).not.toContain('data-transformer-reading-progress');
    expect(Number(attribute(tag(render({ activeTransformerProgress: -1 }), 'qw-diagram__reading-plane'), 'data-transformer-reading-x'))).toBe(400);
    expect(Number(attribute(tag(render({ activeTransformerProgress: 2 }), 'qw-diagram__reading-plane'), 'data-transformer-reading-x'))).toBe(280);
  });

  it('updates independent periodic dimensions while retaining the canonical series geometry', () => {
    const html = render({ periodicDistance: 1, periodicTransformerLength: 1.5 });
    expect(attribute(svg(html), 'data-total-distance')).toBe('1.25');
    expect(attribute(svg(html), 'data-total-transformer-length')).toBe('1.75');
    expect(html).toContain('d = 1.25λ');
    expect(html).toContain('ℓₜ = 1.75λₜ');
    expect(attribute(tag(html, 'qw-diagram__section-wire'), 'd')).toBe('M280 70H400M280 150H400');
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it('measures distance from the load toward the selected junction and suppresses false zero-length arrows', () => {
    const arrow = tag(render(), 'transmission-line-diagram__distance-arrow');
    expect(attribute(arrow, 'd')).toBe('M480 224H400');
    expect(attribute(arrow, 'marker-end')).toMatch(/^url\(#quarter-wave-diagram-/);
    expect(render({ distance: 0 })).not.toContain('class="transmission-line-diagram__distance-arrow"');
    expect(attribute(tag(render({ distance: 0.01 }), 'transmission-line-diagram__distance-arrow'), 'marker-end')).toBeUndefined();
  });
});
