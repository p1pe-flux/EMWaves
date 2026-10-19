import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SingleStubConstruction } from './SingleStubConstruction';
import { SingleStubDiagram } from './SingleStubDiagram';
import SingleStubMatching from '../labs/SingleStubMatching';
import { SINGLE_STUB_EXAMPLE, SingleStubGuideContent } from './SingleStubGuide';
import * as playback from './useStepPlayback';
import { I18nProvider } from '../i18n';

function divByClass(html: string, className: string): string {
  const start = html.indexOf('<div class="' + className + '"');
  expect(start, 'Missing group ' + className).toBeGreaterThanOrEqual(0);
  const tail = html.slice(start);
  let depth = 0;
  for (const tag of tail.matchAll(/<div\b[^>]*>|<\/div>/g)) {
    depth += tag[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return tail.slice(0, tag.index + tag[0].length);
  }
  throw new Error('Unclosed group ' + className);
}

describe('single-stub lesson and schematic', () => {
  it('starts paused by plotting z_L before reflecting to admittance', () => {
    const html = renderToStaticMarkup(<SingleStubConstruction input={SINGLE_STUB_EXAMPLE} />);
    expect(html).toMatch(/<h4[^>]*>Plot the load impedance<\/h4>/);
    expect(html).toContain('data-stage-name="z_load"');
    expect(html).toContain('data-tracked-quantity="z_L"');
    expect(html).toContain('data-playing="false"');
    expect(html).toContain('data-stage-progress="1.000"');
    expect(html).toContain('data-chart-convention="printed"');
    expect(html).toContain('data-grid="impedance"');
    expect(html).not.toContain('data-grid="admittance"');
    expect(html).toContain('data-chart-marker="tracked-load"');
    const load = html.match(/data-chart-marker="tracked-load" data-re="([^"]+)" data-im="([^"]+)"/);
    expect(load).not.toBeNull();
    expect(Number(load![1])).toBeCloseTo(0.4, 12);
    expect(Number(load![2])).toBeCloseTo(0.2, 12);
    const labels = html.match(/<div class="smith-label-layer" aria-hidden="true">([\s\S]*?)<\/div>/);
    expect(labels).not.toBeNull();
    expect(labels![1]).toContain('<annotation encoding="application/x-tex">z_L</annotation>');
    expect(labels![1]).not.toContain('<annotation encoding="application/x-tex">y_L</annotation>');
    expect(labels![1]).not.toContain('\\Gamma_L');
    expect(labels![1]).not.toContain('y(d)');
    expect(html).toContain('Movement speed');
    expect(html).toContain('aria-valuetext="1 times normal speed"');
    expect(html).not.toContain('Construction progress');
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toContain('Construction branch');
    expect(html).toContain('>Previous</button>');
    expect(html).toContain('>Next</button>');
    expect(html).toContain('>Restart</button>');
    expect(html).not.toMatch(/<button\b[^>]*>\s*(?:Play|Pause)\s*<\/button>/);
    expect(html).toContain('data-stub-present="false"');
    expect(html).toContain('transmission-line-diagram');
    expect(html).not.toContain('formula--error');
  });

  it('puts numbered-step controls above the chart with only a movement-speed slider', () => {
    const html = renderToStaticMarkup(<SingleStubConstruction input={SINGLE_STUB_EXAMPLE} />);
    const toolbar = html.indexOf('class="ss-construction__toolbar"');
    const chart = html.indexOf('class="ss-construction__body"');
    expect(toolbar).toBeGreaterThan(0);
    expect(chart).toBeGreaterThan(toolbar);
    const controls = html.slice(toolbar, chart);
    expect(controls).toContain('Construction termination');
    expect(controls).toContain('>Previous</button>');
    expect(controls).toContain('>Next</button>');
    expect(controls).toContain('>Restart</button>');
    expect(controls).not.toMatch(/<button\b[^>]*>\s*(?:Play|Pause)\s*<\/button>/);
    expect(controls.match(/type="range"/g)).toHaveLength(1);
    expect(html.match(/type="range"/g)).toHaveLength(1);
    expect(controls).toContain('aria-label="Movement speed"');
    expect(controls).not.toContain('Construction branch');
    expect(html).not.toContain('Construction progress');
    expect(html).not.toContain('role="progressbar"');
    expect(controls).toMatch(/<button\b[^>]*aria-disabled="true"[^>]*>Previous<\/button>/);
    const next = controls.match(/<button\b[^>]*>Next<\/button>/)?.[0];
    expect(next).toBeDefined();
    expect(next).toContain('aria-disabled="false"');
    expect(next).not.toMatch(/\sdisabled=/);
    expect(html).toContain('1 / 11');
  });

  it('keeps the chart beside a circuit followed by its explanation', () => {
    const html = renderToStaticMarkup(<SingleStubConstruction input={SINGLE_STUB_EXAMPLE} />);
    const body = divByClass(html, 'ss-construction__body');
    const visual = divByClass(body, 'ss-construction__visual');
    const details = divByClass(body, 'ss-construction__details');
    const circuit = divByClass(details, 'ss-construction__circuit');
    const lesson = divByClass(details, 'ss-construction__lesson');
    expect(visual).toContain('ss-construction__chart');
    expect(visual).toContain('data-chart-marker="tracked-load"');
    expect(visual).not.toContain('ss-reading-caption');
    expect(visual).not.toContain('ss-reference');
    expect(visual).not.toContain('transmission-line-diagram');
    expect(circuit).toContain('transmission-line-diagram');
    expect(lesson).toMatch(/<h4\b[^>]*>/);
    expect(details.indexOf('ss-construction__circuit')).toBeLessThan(details.indexOf('ss-construction__lesson'));
    expect(body).toContain(visual);
    expect(body).toContain(details);
  });

  it('renders the deduction, worked example and periodic families with valid formulas', () => {
    const html = renderToStaticMarkup(<SingleStubGuideContent />);
    const deduction = html.indexOf('class="ss-deduction');
    const example = html.indexOf('Start with a concrete load');
    expect(deduction).toBeGreaterThanOrEqual(0);
    expect(html).toContain('What must the shunt stub do?');
    expect(example).toBeGreaterThan(deduction);
    expect(html).toContain('data-variant="guide"');
    expect(html).toContain('data-stage-name="z_load"');
    expect(html).toContain('y_\\ell(d)');
    expect(html).not.toContain('y_{\\mathrm{total}}');
    expect(html).toContain('Z_0=Z_{0s}=50');
    expect(html).toContain('z_L=\\frac{Z_L}{Z_0}=2+\\iu');
    expect(html).toContain('All independent solutions and periodic equivalents');
    expect(html).toContain('d=d_i+n\\lambda/2');
    expect(html).toContain('\\ell_s=\\ell_{s,i}+m\\lambda_s/2');
    expect(html).not.toContain('formula--error');
    expect(html).not.toContain('NaN');
  });

  it('uses the same complete z_L-first construction in the actual guide and laboratory', () => {
    for (const html of [renderToStaticMarkup(<SingleStubGuideContent />), renderToStaticMarkup(<SingleStubMatching />)]) {
      const point = html.match(/data-chart-marker="tracked-load" data-re="([^"]+)" data-im="([^"]+)"/);
      expect(point).not.toBeNull();
      expect(Number(point![1])).toBeCloseTo(0.4, 12);
      expect(Number(point![2])).toBeCloseTo(0.2, 12);
      expect(html).toContain('data-stage-name="z_load"');
      expect(html).toContain('data-tracked-quantity="z_L"');
      expect(html).toContain('1 / 11');
      expect(html).not.toContain('formula--error');
    }
  });

  it('explains matched and unmatchable loads without stale construction markers', () => {
    const matched = renderToStaticMarkup(<SingleStubConstruction input={{ ...SINGLE_STUB_EXAMPLE, load: { kind: 'impedance', resistance: 50, reactance: 0 } }} />);
    const reactive = renderToStaticMarkup(<SingleStubConstruction input={{ ...SINGLE_STUB_EXAMPLE, load: { kind: 'impedance', resistance: 0, reactance: 50 } }} />);
    expect(matched).toContain('The load is already matched');
    expect(reactive).toContain('cannot be matched');
    expect(matched).not.toContain('data-chart-marker');
    expect(reactive).not.toContain('data-chart-marker');
    expect(matched).not.toContain('formula--error');
  });

  it('clears the chart for invalid electrical inputs', () => {
    const html = renderToStaticMarkup(<SingleStubConstruction input={{ ...SINGLE_STUB_EXAMPLE, stubZ0: 0 }} />);
    expect(html).toContain('role="status"');
    expect(html).not.toContain('data-chart-marker');
    expect(html).not.toContain('NaN');
  });

  it('labels independent period extensions on the static stub drawing', () => {
    const html = renderToStaticMarkup(<SingleStubDiagram z0={50} stubZ0={75} loadLabel="100 + j50 Ω" distance={0.375} stubLength={0.125} periodicDistance={1} periodicStubLength={1.5} termination="open" />);
    expect(html).toContain('data-total-distance="1.375"');
    expect(html).toContain('data-total-stub-length="1.625"');
    expect(html).toContain('d = 1.375λ');
    expect(html).toContain('ℓₛ = 1.625λₛ');
    expect(html).toContain('aria-label="Stub placement"');
    expect(html).toContain('data-disabled="true"');
    expect(html).not.toContain('aria-label="Stub length"');
    expect(html).not.toContain('data-control="stub-length"');
    expect(html).not.toContain('transmission-line-diagram__stub-hit');
    expect(html).toContain('transmission-line-diagram__source');
    expect(html).toContain('data-stub-present="true"');
  });

  it('uses the first guide drawing without a stub before the branch is needed', () => {
    const html = renderToStaticMarkup(<SingleStubDiagram z0={50} stubZ0={50} loadLabel="100 + j50 Ω" distance={0.2} stubLength={0.125} termination="short" showStub={false} attached={false} />);
    expect(html).toContain('data-line-start="110"');
    expect(html).toContain('data-line-end="480"');
    expect(html).toContain('data-line-top="70"');
    expect(html).toContain('data-line-bottom="150"');
    expect(html).toContain('data-stub-present="false"');
    expect(html).not.toContain('aria-label="Stub length"');
  });
});


describe('single-stub reflection lesson', () => {
  it.each([0, 0.5, 1])('explains coordinate conversion without adding a stub at progress %s', (progress) => {
    const controls = { next: () => {}, previous: () => {}, restart: () => {}, setSpeed: () => {} };
    const hook = vi.spyOn(playback, 'useStepPlayback').mockReturnValue({ ...controls, stage: 1, progress, playing: progress < 1, direction: 1, speed: 1, reducedMotion: false, completed: progress === 1, canNext: progress === 1, canPrevious: progress === 1 });
    try {
      const html = renderToStaticMarkup(<I18nProvider initialLocale="es"><SingleStubConstruction input={SINGLE_STUB_EXAMPLE} /></I18nProvider>);
      expect(html).toContain('data-stage-name="admittance"');
      expect(html).toContain('y_L=1/z_L=');
      expect(html).toContain('p_y=-\\Gamma_L,\\qquad d=0');
      expect(html).not.toContain('y_v=');
      expect(html).toContain('data-stub-present="false"');
      expect(html).not.toMatch(/formula--error|NaN/);
      if (progress === 1) {
        expect(html).not.toContain('data-chart-marker="impedance-origin"');
        expect(html).not.toContain('data-chart-path="admittance-diameter"');
      }
    } finally { hook.mockRestore(); }
  });
});
