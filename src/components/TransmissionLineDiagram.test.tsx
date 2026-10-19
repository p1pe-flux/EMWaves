import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TransmissionLineDiagram, type TransmissionLineDiagramProps } from './TransmissionLineDiagram';
import { SingleStubConstruction } from './SingleStubConstruction';
import { SingleStubDiagram } from './SingleStubDiagram';
import { SingleStubDeduction } from './SingleStubDeduction';

const baseline: TransmissionLineDiagramProps = {
  lengthInWavelengths: 1,
  distanceInWavelengths: 0,
  z0: 50,
  load: { kind: 'impedance', resistance: 100, reactance: 50 },
  onDistanceChange: () => {},
};

function render(props: Partial<TransmissionLineDiagramProps> = {}): string {
  return renderToStaticMarkup(<TransmissionLineDiagram {...baseline} {...props} />);
}

function tagWithClass(html: string, className: string): string {
  const tag = html.match(new RegExp('<[^>]+class="' + className + '"[^>]*>'))?.[0];
  expect(tag, 'Missing element ' + className).toBeDefined();
  return tag!;
}

function attribute(tag: string, name: string): string | undefined {
  return tag.match(new RegExp('(?:^| )' + name + '="([^"]*)"'))?.[1];
}

function tagWithAttribute(html: string, name: string, value: string): string {
  const tag = html.match(new RegExp('<[^>]+(?:^| )' + name + '="' + value + '"[^>]*>'))?.[0];
  expect(tag, 'Missing element ' + name + '=' + value).toBeDefined();
  return tag!;
}

function pathEndpoints(path: string): { start: [number, number]; end: [number, number] } {
  let start: [number, number] | undefined;
  let end: [number, number] = [0, 0];
  for (const match of path.matchAll(/([MLHVQC])([^MLHVQC]*)/g)) {
    const values = match[2].trim().split(/[ ,]+/).map(Number);
    if (match[1] === 'H') end = [values.at(-1)!, end[1]];
    else if (match[1] === 'V') end = [end[0], values.at(-1)!];
    else {
      if (match[1] === 'M' && start === undefined) start = [values[0], values[1]];
      end = [values.at(-2)!, values.at(-1)!];
    }
  }
  expect(start).toBeDefined();
  return { start: start!, end };
}

describe('shared transmission-line schematic', () => {
  it('reserves the matching stub canvas before the stub becomes visible', () => {
    const props = { z0: 50, stubZ0: 50, loadLabel: '100+j50 Ω', distance: 0.2, stubLength: 0.125, termination: 'short' as const };
    const initial = renderToStaticMarkup(<SingleStubDiagram {...props} showStub={false} />);
    const constructed = renderToStaticMarkup(<SingleStubDiagram {...props} showStub />);
    expect(initial.match(/viewBox="([^"]+)"/)?.[1]).toEqual(constructed.match(/viewBox="([^"]+)"/)?.[1]);
    expect(initial).toContain('data-stub-present="false"');
    expect(initial).not.toContain('data-stub-length=');
    expect(constructed).toContain('data-stub-present="true"');
  });

  it('preserves the original guide circuit when no stub is requested', () => {
    const html = render();
    expect(html).toContain('viewBox="0 0 600 320"');
    expect(html).toContain('data-line-start="110"');
    expect(html).toContain('data-line-end="480"');
    expect(html).toContain('data-line-top="70"');
    expect(html).toContain('data-line-bottom="150"');
    expect(attribute(tagWithClass(html, 'transmission-line-diagram__line'), 'd')).toBe('M110 70H480M110 150H480');
    const source = tagWithClass(html, 'transmission-line-diagram__source');
    expect(attribute(source, 'cx')).toBe('60');
    expect(attribute(source, 'cy')).toBe('110');
    expect(attribute(source, 'r')).toBe('24');
    const load = tagWithClass(html, 'transmission-line-diagram__load');
    expect(attribute(load, 'x')).toBe('471');
    expect(attribute(load, 'y')).toBe('90');
    expect(attribute(load, 'width')).toBe('18');
    expect(attribute(load, 'height')).toBe('40');
    expect(html).toContain('data-stub-present="false"');
    expect(html).not.toContain('data-port=');
    expect(html).not.toContain('transmission-line-diagram__origin-label');
    expect(html).toContain('L = λ');
  });

  it('measures distance from the load toward the generator without changing the base circuit', () => {
    for (const [distance, position] of [[0, 480], [0.25, 387.5], [1, 110]]) {
      const html = render({ distanceInWavelengths: distance });
      const measure = tagWithClass(html, 'transmission-line-diagram__distance-measure');
      expect(attribute(measure, 'data-origin')).toBe('480');
      expect(Number(attribute(measure, 'data-position'))).toBe(position);
      expect(html).toContain('aria-valuenow="' + distance + '"');
      expect(attribute(tagWithClass(html, 'transmission-line-diagram__line'), 'd')).toBe('M110 70H480M110 150H480');
    }
  });

  it('keeps the compact guide rail spacing and exact tiny-line endpoints', () => {
    const html = render({ compact: true, lengthInWavelengths: 1e-6, distanceInWavelengths: 1e-6 });
    expect(html).toContain('viewBox="0 0 600 228"');
    expect(html).toContain('data-line-top="40"');
    expect(html).toContain('data-line-bottom="120"');
    expect(attribute(tagWithClass(html, 'transmission-line-diagram__source'), 'cx')).toBe('60');
    expect(attribute(tagWithClass(html, 'transmission-line-diagram__distance-measure'), 'data-position')).toBe('110');
    expect(html).toContain('aria-valuenow="0.000001"');
    expect(html).toContain('aria-valuemax="0.000001"');
    expect(html).toContain('data-disabled="false"');
  });

  it('clamps positions and disables invalid or zero-length line controls', () => {
    expect(render({ distanceInWavelengths: -1 })).toContain('data-distance="0"');
    expect(render({ distanceInWavelengths: 2 })).toContain('data-distance="1"');
    expect(render({ distanceInWavelengths: NaN })).toContain('data-distance="0"');
    for (const lengthInWavelengths of [0, -1, NaN, Infinity]) {
      const html = render({ lengthInWavelengths });
      expect(html).toContain('data-disabled="true"');
      expect(html).toContain('aria-disabled="true"');
      expect(html).toContain('tabindex="-1"');
      expect(html).not.toContain('NaN');
      expect(html).not.toContain('Infinity');
    }
  });

  it('projects both shunt conductors from the exact rail nodes, including both placement endpoints', () => {
    for (const [distance, expectedX] of [[0, 480], [0.125, 387.5], [0.5, 110]]) {
      const html = render({
        lengthInWavelengths: 0.5, distanceInWavelengths: distance, showTotalLength: false,
        stub: { z0: 75, lengthInWavelengths: 0.125, termination: 'short' },
      });
      expect(html).toContain('viewBox="0 0 600 450"');
      expect(html).toContain('data-stub-present="true"');
      const branch = tagWithAttribute(html, 'data-stub-junction-x', String(expectedX));
      expect(Number(attribute(branch, 'data-stub-junction-x'))).toBe(expectedX);
      expect(attribute(branch, 'data-stub-projection')).toBe('out-of-plane');
      const upper = tagWithAttribute(html, 'data-stub-conductor', 'upper');
      const lower = tagWithAttribute(html, 'data-stub-conductor', 'lower');
      const upperPath = pathEndpoints(attribute(upper, 'd')!);
      const lowerPath = pathEndpoints(attribute(lower, 'd')!);
      expect(upperPath.start).toEqual([expectedX, 70]);
      expect(lowerPath.start).toEqual([expectedX, 150]);
      expect(upperPath.end).toEqual([Number(attribute(branch, 'data-stub-end-upper-x')), Number(attribute(branch, 'data-stub-end-upper-y'))]);
      expect(lowerPath.end).toEqual([Number(attribute(branch, 'data-stub-end-lower-x')), Number(attribute(branch, 'data-stub-end-lower-y'))]);
      expect(lowerPath.end[0] - upperPath.end[0]).toBe(0);
      expect(lowerPath.end[1] - upperPath.end[1]).toBe(80);
      expect(upperPath.end[0]).toBeLessThan(expectedX);
      expect(upperPath.end[1]).toBeGreaterThan(150);
      // Each actual rail connection has a node; the crossing has none.
      const nodes = [...html.matchAll(/<circle class="transmission-line-diagram__stub-node"[^>]*>/g)].map((match) => match[0]);
      expect(nodes).toHaveLength(2);
      expect(nodes.map((node) => Number(attribute(node, 'cx')))).toEqual([expectedX, expectedX]);
      expect(nodes.map((node) => Number(attribute(node, 'cy')))).toEqual([70, 150]);
      const crossing = tagWithAttribute(html, 'data-stub-crossover', 'true');
      // Render the insulating crossover before the upper branch crosses the return rail.
      expect(html.indexOf(crossing)).toBeLessThan(html.indexOf(upper));
      expect(attribute(tagWithClass(html, 'transmission-line-diagram__line'), 'd')).toBe('M110 70H480M110 150H480');
    }
  });

  it('anchors the admittance leaders to their exact reference planes around the junction', () => {
    for (const [distance, junctionX] of [[0, 480], [0.375, 202.5], [0.5, 110]]) {
      const html = render({
        lengthInWavelengths: 0.5, distanceInWavelengths: distance, showAdmittancePorts: true,
        stub: { z0: 50, lengthInWavelengths: 0.125, termination: 'open' },
      });
      for (const [port, expectedX] of [['y-v', Math.max(90, junctionX - 20)], ['y-ell', Math.min(480, junctionX + 20)], ['y-stub', junctionX]] as const) {
        const group = html.match(new RegExp('<g[^>]*data-port="' + port + '"[^>]*>([\\s\\S]*?)<\\/g>'));
        expect(group).not.toBeNull();
        const tag = tagWithAttribute(html, 'data-port', port);
        expect(Number(attribute(tag, 'data-junction-x'))).toBe(junctionX);
        expect(Number(attribute(tag, 'data-port-anchor-x'))).toBe(expectedX);
        expect(Number(attribute(tag, 'data-port-anchor-y'))).toBe(110);
        const leader = tagWithAttribute(group![1], 'data-port-leader', 'true');
        expect(pathEndpoints(attribute(leader, 'd')!).end).toEqual([expectedX, 110]);
        const plane = tagWithAttribute(group![1], 'data-port-plane', 'true');
        expect(pathEndpoints(attribute(plane, 'd')!)).toEqual({ start: [expectedX, 70], end: [expectedX, 150] });
      }
    }
    const withoutStub = render({ showAdmittancePorts: true });
    expect(withoutStub).toContain('data-port="y-v"');
    expect(withoutStub).toContain('data-port="y-ell"');
    expect(withoutStub).not.toContain('data-port="y-stub"');
  });

  it('distinguishes static open and short terminations at the same projected stub end', () => {
    for (const termination of ['open', 'short'] as const) {
      const html = render({
        stub: { z0: 75, lengthInWavelengths: 0.125, termination },
      });
      expect(html).toContain('data-stub-termination="' + termination + '"');
      expect(html).toContain('data-termination-symbol="' + termination + '"');
      expect(html).not.toContain('data-control="stub-length"');
      expect(html).not.toContain('aria-label="Stub length"');
      expect(html).not.toContain('transmission-line-diagram__stub-hit');
      const opens = [...html.matchAll(/class="transmission-line-diagram__stub-open"/g)];
      expect(opens).toHaveLength(termination === 'open' ? 2 : 0);
      const branch = tagWithAttribute(html, 'data-stub-termination', termination);
      const upperEnd: [number, number] = [Number(attribute(branch, 'data-stub-end-upper-x')), Number(attribute(branch, 'data-stub-end-upper-y'))];
      const lowerEnd: [number, number] = [Number(attribute(branch, 'data-stub-end-lower-x')), Number(attribute(branch, 'data-stub-end-lower-y'))];
      if (termination === 'short') {
        const short = tagWithAttribute(html, 'data-termination-symbol', 'short');
        expect(pathEndpoints(attribute(short, 'd')!)).toEqual({ start: upperEnd, end: lowerEnd });
      } else {
        const rings = [...html.matchAll(/<circle class="transmission-line-diagram__stub-open"[^>]*>/g)];
        expect(rings.map(([tag]) => [Number(attribute(tag, 'cx')), Number(attribute(tag, 'cy'))])).toEqual([upperEnd, lowerEnd]);
      }
    }
  });

  it('labels independent half-wave extensions without moving their base positions', () => {
    const props: Partial<TransmissionLineDiagramProps> = {
      lengthInWavelengths: 0.5, distanceInWavelengths: 0.375, distanceSymbol: 'd', positionLabel: 'Stub placement',
      periodicDistance: 1, showTotalLength: false,
      stub: { z0: 75, lengthInWavelengths: 0.125, termination: 'open', periodicLength: 1.5 },
    };
    const html = render(props);
    expect(html).toContain('data-distance="0.375"');
    expect(html).toContain('data-total-distance="1.375"');
    expect(html).toContain('data-stub-length="0.125"');
    expect(html).toContain('data-total-stub-length="1.625"');
    expect(html).toContain('data-stub-junction-x="202.5"');
    const branch = tagWithAttribute(html, 'data-stub-junction-x', '202.5');
    expect(Number(attribute(branch, 'data-stub-end-upper-y'))).toBe(176);
    expect(Number(attribute(branch, 'data-stub-end-lower-y'))).toBe(256);
    expect(html).toContain('d = 1.375λ');
    expect(html).toContain('ℓₛ = 1.625λₛ');
    expect(html).toContain('aria-label="Stub placement"');
    expect(html).not.toContain('transmission-line-diagram__length-label');
  });

  it('changes projected depth along one fixed axis while keeping the two conductors parallel', () => {
    const ends: { x: number; y: number }[] = [];
    for (const [length, expectedX, expectedY] of [[0, 251, 158], [0.125, 242, 176], [0.5, 215, 230]]) {
      const html = render({ distanceInWavelengths: 0.5, stub: { z0: 50, lengthInWavelengths: length, termination: 'open' } });
      const branch = tagWithAttribute(html, 'data-stub-junction-x', '295');
      const upperX = Number(attribute(branch, 'data-stub-end-upper-x'));
      const upperY = Number(attribute(branch, 'data-stub-end-upper-y'));
      const lowerX = Number(attribute(branch, 'data-stub-end-lower-x'));
      const lowerY = Number(attribute(branch, 'data-stub-end-lower-y'));
      expect(lowerX - upperX).toBe(0);
      expect(lowerY - upperY).toBe(80);
      expect((upperY - 70) / (upperX - 295)).toBeCloseTo(-2, 12);
      expect(upperX).toBeCloseTo(expectedX, 12);
      expect(upperY).toBeCloseTo(expectedY, 12);
      expect(html).not.toContain('data-control="stub-length"');
      ends.push({ x: upperX, y: upperY });
    }
    expect(ends[0].x).toBeGreaterThan(ends[1].x);
    expect(ends[1].x).toBeGreaterThan(ends[2].x);
    expect(ends[0].y).toBeLessThan(ends[1].y);
    expect(ends[1].y).toBeLessThan(ends[2].y);
  });

  it('moves the generator label above a projected stub near the source while preserving its baseline placement', () => {
    const plain = render();
    expect(attribute(tagWithClass(plain, 'transmission-line-diagram__generator-label'), 'y')).toBe('186');
    const leftmost = render({
      lengthInWavelengths: 0.5, distanceInWavelengths: 0.5,
      stub: { z0: 50, lengthInWavelengths: 0.5, termination: 'short' },
    });
    const branch = tagWithAttribute(leftmost, 'data-stub-junction-x', '110');
    expect(Number(attribute(branch, 'data-stub-end-upper-x'))).toBe(30);
    const label = tagWithClass(leftmost, 'transmission-line-diagram__generator-label');
    expect(attribute(label, 'x')).toBe('60');
    expect(attribute(label, 'y')).toBe('40');
    expect(Number(attribute(label, 'y'))).toBeLessThan(70);
    expect(attribute(tagWithClass(leftmost, 'transmission-line-diagram__source'), 'cy')).toBe('110');
    const nearLoad = render({
      lengthInWavelengths: 0.5, distanceInWavelengths: 0,
      stub: { z0: 50, lengthInWavelengths: 0.5, termination: 'short' },
    });
    expect(attribute(tagWithClass(nearLoad, 'transmission-line-diagram__generator-label'), 'y')).toBe('186');
  });

  it('bounds static stub lengths without adding keyboard controls', () => {
    for (const [length, expected] of [[-1, 0], [1, 0.5], [NaN, 0]]) {
      const html = render({ stub: { z0: 50, lengthInWavelengths: length, termination: 'short' } });
      expect(html).toContain('data-stub-length="' + expected + '"');
      expect(html).not.toContain('data-control="stub-length"');
      expect(html).not.toContain('aria-label="Stub length"');
      expect(html).not.toContain('NaN');
    }
    const plain = render();
    expect(plain).not.toContain('data-control="stub-length"');
    expect(plain).not.toContain('data-termination-symbol');
  });

  it('starts line-propagation lessons without a stub and keeps the deduction branch visible', () => {
    const input = { z0: 50, stubZ0: 50, load: { kind: 'impedance' as const, resistance: 100, reactance: 50 } };
    const html = renderToStaticMarkup(<SingleStubConstruction input={input} />);
    expect(html).toContain('transmission-line-diagram');
    expect(html).toContain('ss-diagram');
    expect(html).toContain('data-stub-present="false"');
    expect(html).not.toContain('data-stub-junction-x=');
    expect(html).not.toContain('data-termination-symbol=');
    const deduction = renderToStaticMarkup(<SingleStubDeduction />);
    expect(deduction).toContain('data-stub-present="true"');
    expect(deduction).toContain('data-port="y-v"');
    expect(deduction).toContain('data-port="y-ell"');
    expect(deduction).toContain('data-port="y-stub"');
  });
});
