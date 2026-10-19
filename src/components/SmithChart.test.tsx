import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LINE_EXAMPLE } from '../domain/lineExample';
import { solveLine } from '../domain/transmission';
import { SmithChart, type SmithConstruction } from './SmithChart';

function renderChart(distance: number, interactive?: boolean): string {
  return renderToStaticMarkup(<SmithChart
    solution={solveLine({ ...LINE_EXAMPLE, lengthInWavelengths: distance })}
    length={distance}
    showCurves={false}
    showGamma={false}
    showSwr
    interactive={interactive}
    onSelectReflection={() => {}}
  />);
}

function marker(html: string, name: 'load' | 'input'): { x: number; y: number } {
  const group = html.match(new RegExp('<g class="smith-' + name + '">([\\s\\S]*?)</g>'));
  expect(group, `Expected a ${name} marker`).not.toBeNull();
  const point = group![1].match(/<circle class="smith-point"[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"/);
  expect(point).not.toBeNull();
  return { x: Number(point![1]), y: Number(point![2]) };
}

function chartSvg(html: string): string {
  const svg = html.match(/<svg\b[^>]*class="smith-chart__svg"[^>]*>/);
  expect(svg).not.toBeNull();
  return svg![0];
}

describe('Smith chart line-position markers', () => {
  it.each([
    ['impedance', 178.6, 124.8, 555.2],
    ['admittance', 501.4, 555.2, 124.8],
  ] as const)('keeps positive and negative grid labels on the correct %s contours', (grid, x, positiveY, negativeY) => {
    const html = renderToStaticMarkup(<SmithChart solution={null} length={0} showCurves={false} showGamma={false} showSwr={false} interactive={false} onSelectReflection={() => {}} construction={{ grid }} />);
    for (const [label, y] of [['+j0.5', positiveY], ['−j0.5', negativeY]] as const) {
      const tag = html.match(new RegExp('<text class="smith-reactance-label"[^>]*>' + label.replace('+', '\\+') + '</text>'))?.[0];
      expect(tag).toBeDefined();
      expect(Number(tag!.match(/x="([^"]+)"/)![1])).toBeCloseTo(x, 10);
      expect(Number(tag!.match(/y="([^"]+)"/)![1])).toBeCloseTo(y, 10);
    }
  });

  it('keeps a long line trajectory bounded while plotting its actual selected position', () => {
    const html = renderChart(1_000_000 + 0.125);
    const path = html.match(/class="smith-trajectory" d="([^"]+)"/);
    expect(path).not.toBeNull();
    expect(path![1].split(' ')).toHaveLength(161);
    expect(path![1]).not.toMatch(/NaN|Infinity/);
    const input = marker(html, 'input');
    expect(input.x).toBeCloseTo(390.4, 10);
    expect(input.y).toBeCloseTo(440.8, 10);
  });

  it.each([
    [0.625, 390.4, 440.8], // Γ = 0.2 − j0.4, one full turn plus λ/8.
    [0.75, 239.2, 390.4],  // Γ = −0.4 − j0.2.
    [0.875, 289.6, 239.2], // Γ = −0.2 + j0.4.
  ])('shows the moving input marker after half a wavelength at ℓ/λ=%s', (distance, x, y) => {
    const html = renderChart(distance);
    const input = marker(html, 'input');
    expect(input.x).toBeCloseTo(x, 10);
    expect(input.y).toBeCloseTo(y, 10);
    // The fixed load remains ΓL = 0.4+j0.2 throughout both revolutions.
    const load = marker(html, 'load');
    expect(load.x).toBeCloseTo(440.8, 10);
    expect(load.y).toBeCloseTo(289.6, 10);
    expect(html).toContain('smith-point-label--input');
  });

  it.each([0, 0.5, 1])('suppresses duplicate markers when load and input coincide at ℓ/λ=%s', (distance) => {
    const html = renderChart(distance);
    expect(html).toContain('class="smith-load"');
    expect(html).not.toContain('class="smith-input"');
    expect(html).not.toContain('smith-point-label--input');
    const load = marker(html, 'load');
    expect(load.x).toBeCloseTo(440.8, 10);
    expect(load.y).toBeCloseTo(289.6, 10);
  });

  it('keeps the read-only example out of the tab order while retaining its moving marker', () => {
    const html = renderChart(0.625, false);
    const svg = chartSvg(html);
    expect(svg).toContain('data-interactive="false"');
    expect(svg).not.toMatch(/\btabindex=/i);
    expect(svg).not.toContain('Drag inside');
    expect(svg).toContain('selected line position');
    expect(marker(html, 'input')).toEqual({ x: 390.4, y: 440.8 });
  });

  it('preserves keyboard access and editing instructions for the ordinary interactive chart', () => {
    const svg = chartSvg(renderChart(0.125));
    expect(svg).toContain('data-interactive="true"');
    expect(svg).toMatch(/\btabindex="0"/i);
    expect(svg).toContain('Drag inside the circle to change the load');
    expect(svg).toContain('use the arrow keys');
  });
});

describe('matching chart overlays', () => {
  function construction(grid: SmithConstruction['grid'], gridFocus?: number) {
    return renderToStaticMarkup(<SmithChart solution={null} length={0} showCurves={false} showGamma={false} showSwr={false} interactive={false} onSelectReflection={() => {}} construction={{
      grid, gridFocus, markers: [{ id: 'load', label: '\\Gamma_L', point: { re: 0.4, im: 0.2 } }],
      circles: [{ id: 'g1', center: { re: -0.5, im: 0 }, radius: 0.5 }],
      paths: [{ id: 'cancellation', points: [{ re: -0.2, im: -0.4 }, { re: 0, im: 0 }] }],
    }} />);
  }

  it('keeps physical markers fixed while mirroring the grid for admittance readings', () => {
    const z = construction('impedance'), y = construction('admittance');
    for (const html of [z, y]) {
      expect(html).toContain('data-chart-marker="load" data-re="0.4" data-im="0.2"');
      expect(html).toContain('cx="440.8" cy="289.6"');
      expect(html).toContain('data-chart-circle="g1" data-center-re="-0.5" data-center-im="0" data-radius="0.5"');
      expect(html).toContain('data-chart-path="cancellation"');
      expect(html).not.toMatch(/NaN|Infinity|formula--error/);
    }
    expect(z).toContain('data-grid="impedance"');
    expect(y).toContain('data-grid="admittance"');
    // The r=1 and g=1 grid circles lie on opposite sides of the origin.
    expect(z).toContain('cx="466" cy="340" r="126"');
    expect(y).toContain('cx="214" cy="340" r="126"');
  });

  it('overlays both physical grids without mirroring any construction geometry', () => {
    const html = construction('both');
    expect(html).toContain('data-grid="both" data-grid-focus="0.5"');
    for (const kind of ['impedance', 'admittance']) {
      expect(html).toContain('data-grid-layer="' + kind + '" opacity="0.79"');
    }
    const z = html.match(/data-grid-layer="impedance"[^>]*>([\s\S]*?)<\/g>/)![1];
    const y = html.match(/data-grid-layer="admittance"[^>]*>([\s\S]*?)<\/g>/)![1];
    // The r=1 and g=1 circles coexist at their physical Γ coordinates.
    expect(z).toContain('cx="466" cy="340" r="126"');
    expect(y).toContain('cx="214" cy="340" r="126"');
    // Positive reactance lies above, positive susceptance below.
    expect(z).toContain('cx="592" cy="88" r="252"');
    expect(y).toContain('cx="88" cy="592" r="252"');
    expect(html).toContain('data-chart-marker="load" data-re="0.4" data-im="0.2"');
    expect(html).toContain('cx="440.8" cy="289.6"');
    expect(html).toContain('data-chart-circle="g1" data-center-re="-0.5" data-center-im="0"');
    expect(html).toContain('data-chart-path="cancellation" d="M289.6,440.8 L340,340"');
    expect(html).not.toMatch(/NaN|Infinity|formula--error/);
  });

  it('keeps the combined grids free of annotations and draws shared chart features only once', () => {
    const html = construction('both');
    expect(html).not.toContain('data-grid-label');
    expect(html).not.toContain('data-grid-coordinate');
    expect(html).not.toContain('data-grid-perimeter');
    expect(html).not.toContain('smith-combined-labels');
    expect(html).not.toContain('smith-grid-label');
    expect(html).not.toContain('smith-reactance-label');
    expect(html).not.toContain('<text');
    expect(html).toContain('smith-point-label');
    expect(html).toContain('\\Gamma_L');
    expect(html.match(/class="smith-axis"/g)).toHaveLength(1);
    expect(html.match(/class="smith-boundary"/g)).toHaveLength(1);
    expect(html).not.toContain('class="smith-scale"');
    expect(html).not.toContain('class="smith-tick"');
    expect(html).toContain('Both grids use the same physical reflection coefficient');
  });

  it.each([[0, 0, '1', '0.58'], [1, 1, '0.58', '1'], [-1, 0, '1', '0.58'], [2, 1, '0.58', '1'], [NaN, 0.5, '0.79', '0.79'], [Infinity, 0.5, '0.79', '0.79']])('keeps both grids visible for focus=%s', (focus, expected, zOpacity, yOpacity) => {
    const html = construction('both', Number(focus));
    expect(html).toContain('data-grid-focus="' + expected + '"');
    const opacity = (kind: string) => Number(html.match(new RegExp('data-grid-layer="' + kind + '" opacity="([^"]+)"'))![1]);
    expect(opacity('impedance')).toBeCloseTo(Number(zOpacity), 12);
    expect(opacity('admittance')).toBeCloseTo(Number(yOpacity), 12);
    expect(html).toContain('cx="440.8" cy="289.6"');
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it('preserves the single-grid markup and scale when combined mode is not requested', () => {
    const html = construction('impedance', 1);
    expect(html).not.toContain('data-grid-layer');
    expect(html).not.toContain('data-grid-label');
    expect(html).not.toContain('data-grid-focus');
    expect(html).toContain('class="smith-scale"');
    expect(html.match(/class="smith-tick"/g)).toHaveLength(100);
    expect(html).toContain('class="smith-grid-label" x="345" y="355">1</text>');
  });
});

describe('filled chart regions', () => {
  const outer = [{ re: -2, im: -2 }, { re: 2, im: -2 }, { re: 2, im: 2 }, { re: -2, im: 2 }];
  const hole = [{ re: -0.2, im: -0.2 }, { re: 0.2, im: -0.2 }, { re: 0.2, im: 0.2 }, { re: -0.2, im: 0.2 }];

  function renderRegions(regions: SmithConstruction['regions'], grid: SmithConstruction['grid'] = 'impedance') {
    return renderToStaticMarkup(<SmithChart
      solution={null}
      length={0}
      showCurves={false}
      showGamma={false}
      showSwr={false}
      interactive={false}
      onSelectReflection={() => {}}
      construction={{ grid, regions, paths: [{ id: 'trace', points: hole }] }}
    />);
  }

  it('adds no region markup to existing charts without an opt-in region', () => {
    expect(renderChart(0.125)).not.toContain('data-chart-region');
    expect(renderRegions(undefined)).not.toContain('data-chart-region');
    expect(renderRegions([])).not.toContain('data-chart-region');
  });

  it('fills regions inside the existing disk clip, beneath the grid and construction', () => {
    const html = renderRegions([{ id: 'feasible', loops: [outer], ariaLabel: 'Loads that can be matched' }]);
    const clip = html.match(/<clipPath id="([^"]+)"><circle cx="340" cy="340" r="252"/);
    expect(clip).not.toBeNull();
    const region = html.match(/<path data-chart-region="feasible"[^>]+/);
    expect(region).not.toBeNull();
    expect(html.indexOf('class="smith-paper"')).toBeLessThan(html.indexOf('data-chart-region="feasible"'));
    expect(html.indexOf('clip-path="url(#' + clip![1] + ')"')).toBeLessThan(html.indexOf('data-chart-region="feasible"'));
    expect(html.indexOf('data-chart-region="feasible"')).toBeLessThan(html.indexOf('class="smith-grid '));
    expect(html.indexOf('data-chart-region="feasible"')).toBeLessThan(html.indexOf('data-chart-path="trace"'));
    expect(region![0]).toContain('fill="var(--teal)"');
    expect(region![0]).toContain('fill-opacity="0.12"');
    expect(region![0]).toContain('stroke="none"');
    expect(region![0]).toContain('pointer-events="none"');
    expect(region![0]).toContain('aria-label="Loads that can be matched"');
  });

  it('uses closed even-odd loops for holes without requiring reversed winding', () => {
    const html = renderRegions([{ id: 'ring', loops: [outer, hole], color: '#c56342', opacity: 0.2 }]);
    const region = html.match(/<path data-chart-region="ring" d="([^"]+)"([^>]+)/);
    expect(region).not.toBeNull();
    expect(region![1].match(/M/g)).toHaveLength(2);
    expect(region![1].match(/Z/g)).toHaveLength(2);
    expect(region![2]).toContain('fill-rule="evenodd"');
    expect(region![2]).toContain('fill="#c56342"');
    expect(region![2]).toContain('fill-opacity="0.2"');
    expect(region![2]).toContain('aria-hidden="true"');
  });

  it('keeps region coordinates in the caller-selected reading plane when the grid changes', () => {
    const regions = [{ id: 'same-plane', loops: [hole] }];
    const path = (grid: SmithConstruction['grid']) => renderRegions(regions, grid).match(/data-chart-region="same-plane" d="([^"]+)"/)![1];
    expect(path('impedance')).toBe(path('admittance'));
  });

  it('does not emit invalid geometry for an incomplete or nonfinite loop', () => {
    const html = renderRegions([{ id: 'valid-only', loops: [hole, [{ re: 0, im: 0 }], [{ re: 0, im: 0 }, { re: Infinity, im: 0 }, { re: 0, im: NaN }]] }]);
    const path = html.match(/data-chart-region="valid-only" d="([^"]+)"/)![1];
    expect(path.match(/M/g)).toHaveLength(1);
    expect(path).not.toMatch(/NaN|Infinity/);
  });
});
