import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { solveLumpedMatching, type LumpedMatchingInput } from '../domain/lumpedMatching';
import { I18nProvider } from '../i18n';
import { LCMatchingConstruction } from './LCMatchingConstruction';
import { LCMatchingDiagram } from './LCMatchingDiagram';
import { LCMatchingBranchSummary } from './LCMatchingBranchSummary';
import { getLCMatchingConstructionSteps } from './lcMatchingPlayback';

const input: LumpedMatchingInput = { z0: 50, frequencyHz: 1e9, load: { kind: 'impedance', resistance: 100, reactance: 50 }, elements: [{ component: 'L', connection: 'series' }, { component: 'C', connection: 'parallel' }] };

describe('L–C construction and circuit', () => {
  it('starts paused at zL with one physical branch and no component-value spoilers', () => {
    const html = renderToStaticMarkup(<LCMatchingConstruction input={input} />);
    expect(html).toContain('data-tracked-quantity="z_L"');
    expect(html).toContain('data-reading="impedance"');
    expect(html).toContain('data-grid="both"');
    expect(html).toContain('data-chart-convention="physical-yz"');
    expect(html).toContain('data-grid-focus="0.000"');
    expect(html).toContain('data-playing="false"');
    expect(html).toContain('1 / 7');
    expect(html).toContain('data-chart-region="lc-matchable-loads"');
    expect(html).not.toContain('class="lc-feasibility__status"');
    expect(html).not.toContain('lc-feasibility__note');
    expect(html.match(/data-summary-branch=/g)).toHaveLength(1);
    expect(html.match(/data-found="false"/g)).toHaveLength(2);
    expect(html.match(/type="range"/g)).toHaveLength(1);
    expect(html).not.toMatch(/data-component-value=|data-chart-circle="swr"|load-reading-conversion|load-original|Construction progress|progressbar|<button[^>]*>(Play|Pause)<\/button>|formula--error|NaN/);
    const marker = html.match(/data-chart-marker="tracked-load" data-re="([^"]+)" data-im="([^"]+)"/)!;
    expect(Number(marker[1])).toBeCloseTo(0.4, 13);
    expect(Number(marker[2])).toBeCloseTo(0.2, 13);
    expect(html.indexOf('ss-construction__toolbar')).toBeLessThan(html.indexOf('ss-construction__body'));
    expect(html.indexOf('ss-construction__circuit')).toBeLessThan(html.indexOf('ss-construction__lesson'));
  });

  it.each(['LC', 'CL'] as const)('keeps source-to-load order %s fixed and the lower rail continuous', order => {
    const html = renderToStaticMarkup(<LCMatchingDiagram input={{ ...input, elements: order === 'LC' ? input.elements : [input.elements[1], input.elements[0]] }} progress={[1, 1]} />);
    expect(html).toContain('data-component-order="' + order + '"');
    expect(html).toContain('data-main-conductor="lower" data-continuous="true" d="M110 220H515"');
    expect(html).toContain('data-inductor-symbol="coil"');
    expect(html).toContain('data-capacitor-symbol="plates"');
    const first = html.indexOf('data-lc-component="' + order[0] + '"');
    const last = html.indexOf('data-lc-component="' + order[1] + '"');
    expect(first).toBeLessThan(last);
    expect(html).toContain('data-lc-component="' + order[0] + '" data-connection="' + (order[0] === 'L' ? 'series' : 'parallel') + '" data-component-position="225"');
    expect(html).not.toMatch(/role="slider"|data-component-value=/);
  });

  it('discloses C first and L second for the default network, and removes future values on rewind', () => {
    const solution = solveLumpedMatching(input);
    const steps = getLCMatchingConstructionSteps(true);
    const render = (stepIndex: number, completed = true) => renderToStaticMarkup(<LCMatchingBranchSummary solution={solution} steps={steps} position={{ stepIndex, completed }} />);
    expect(render(3, false).match(/data-found="false"/g)).toHaveLength(2);
    const withC = render(3);
    expect(withC).toContain('data-summary-field="element-1" data-found="false"');
    expect(withC).toContain('data-summary-field="element-2" data-found="true"');
    expect(withC).toContain('C_2=\\mathbf{2.19601}');
    expect(render(5).match(/data-found="true"/g)).toHaveLength(2);
    expect(render(5)).toContain('L_1=\\mathbf{9.74621}');
    expect(render(5, false).match(/data-found="true"/g)).toHaveLength(1);
    expect(render(2).match(/data-found="false"/g)).toHaveLength(2);
  });

  it('keeps the solution card for families and unavailable loads without manufacturing component values', () => {
    const cases: { input: LumpedMatchingInput; status: string; message: string }[] = [
      { input: { ...input, elements: [{ component: 'L', connection: 'series' }, { component: 'C', connection: 'series' }], load: { kind: 'impedance', resistance: 50, reactance: 20 } }, status: 'continuous', message: 'Continuous family of solutions' },
      { input: { ...input, elements: [{ component: 'L', connection: 'series' }, { component: 'C', connection: 'series' }] }, status: 'no-solution', message: 'No positive, finite pair for this topology' },
      { input: { ...input, load: { kind: 'open' } }, status: 'unmatchable', message: 'No positive, finite pair for this topology' },
      { input: { ...input, load: { kind: 'short' } }, status: 'unmatchable', message: 'No positive, finite pair for this topology' },
      { input: { ...input, load: { kind: 'impedance', resistance: 0, reactance: 50 } }, status: 'unmatchable', message: 'No positive, finite pair for this topology' },
      { input: { ...input, load: { kind: 'impedance', resistance: 50, reactance: 0 } }, status: 'already-matched', message: 'The load is already matched' },
    ];
    for (const testCase of cases) {
      const html = renderToStaticMarkup(<LCMatchingConstruction input={testCase.input} />);
      const summary = html.match(/<section class="matching-branch-summary__branch"[^>]*>[\s\S]*?<\/section>/)?.[0];
      expect(html).toContain('data-lc-status="' + testCase.status + '"');
      expect(html.match(/data-summary-branch=/g)).toHaveLength(1);
      expect(summary).toContain('<h4>Solution</h4>');
      expect(summary).toContain('role="status"');
      expect(summary).toContain(testCase.message);
      expect(summary).not.toMatch(/data-summary-field=|data-found=/);
      expect(html).not.toMatch(/data-component-value=|formula--error|NaN|Infinity/);
    }
    const matched = renderToStaticMarkup(<LCMatchingConstruction input={{ ...input, load: { kind: 'impedance', resistance: 50, reactance: 0 } }} />);
    expect(matched).toContain('is already matched; no additional network is needed.');
    const invalid = renderToStaticMarkup(<LCMatchingConstruction input={{ ...input, frequencyHz: 0 }} />);
    expect(invalid).toContain('role="status"');
    expect(invalid).not.toContain('data-chart-marker');
  });

  it.each([
    ['en', 'Solution', 'No positive, finite pair for this topology'],
    ['es', 'Solución', 'No existe un par positivo y finito para esta topología'],
  ] as const)('places the unavailable-topology message only in the persistent solution card in %s', (locale, title, message) => {
    const html = renderToStaticMarkup(<I18nProvider initialLocale={locale}><LCMatchingConstruction input={{ ...input, elements: [input.elements[1], input.elements[0]] }} /></I18nProvider>);
    const summary = html.match(/<section class="matching-branch-summary__branch"[^>]*>[\s\S]*?<\/section>/)?.[0];
    const lesson = html.slice(html.indexOf('ss-construction__lesson'));
    expect(summary).toContain('<h4>' + title + '</h4>');
    expect(summary).toContain(message);
    expect(html.split(message)).toHaveLength(2);
    expect(html.indexOf('matching-branch-summary')).toBeLessThan(html.indexOf('ss-construction__lesson'));
    expect(lesson).not.toContain(message);
    expect(lesson).not.toContain('lc-matching__case-hint');
    expect(summary).not.toMatch(/data-summary-field=|data-component-value=/);
  });

  it('translates the construction and controls into Spanish', () => {
    const html = renderToStaticMarkup(<I18nProvider initialLocale="es"><LCMatchingConstruction input={input} /></I18nProvider>);
    expect(html).toContain('Representar la impedancia de la carga');
    expect(html).toContain('>Siguiente</button>');
    expect(html).toContain('>Anterior</button>');
    expect(html).toContain('>Reiniciar</button>');
    expect(html).toContain('>Velocidad</span>');
    expect(html).toContain('Cargas adaptables');
    expect(html).toContain('Frontera excluida');
    expect(html).not.toContain('está dentro de la zona adaptable.');
    expect(html).not.toContain('Ambas lecturas comparten el mismo punto.');
    expect(html).not.toContain('>Next</button>');
  });

  it('shows the selected topology’s zone even for outside loads, but uses only a curve for equal connections', () => {
    const outside = renderToStaticMarkup(<LCMatchingConstruction input={{ ...input, elements: [input.elements[1], input.elements[0]] }} />);
    expect(outside).toContain('data-chart-region="lc-matchable-loads"');
    expect(outside).toContain('data-load-feasibility="outside"');
    expect(outside).toContain('lies outside the matching region.');
    const boundary = renderToStaticMarkup(<LCMatchingConstruction input={{ ...input, load: { kind: 'impedance', resistance: 25, reactance: 25 } }} />);
    expect(boundary).toContain('data-load-feasibility="boundary"');
    expect(boundary.match(/data-summary-branch=/g)).toHaveLength(1);
    expect(boundary).not.toMatch(/data-summary-field=|data-component-value=/);
    const curve = renderToStaticMarkup(<LCMatchingConstruction input={{ ...input, elements: [{ component: 'L', connection: 'series' }, { component: 'C', connection: 'series' }], load: { kind: 'impedance', resistance: 50, reactance: 50 } }} />);
    expect(curve).toContain('data-chart-path="lc-feasibility-curve"');
    expect(curve).toContain('data-load-feasibility="continuous"');
    expect(curve).not.toContain('data-chart-region');
    const invalid = renderToStaticMarkup(<LCMatchingConstruction input={{ ...input, frequencyHz: 0 }} />);
    expect(invalid).not.toContain('lc-feasibility');
  });

  it.each(['L', 'C'] as const)('keeps two %s elements distinct and reveals element 2 before element 1', component => {
    const network: LumpedMatchingInput = {
      z0: 50, frequencyHz: 1e9,
      load: { kind: 'impedance', resistance: 25, reactance: component === 'L' ? -50 : 50 },
      elements: [{ component, connection: 'series' }, { component, connection: 'parallel' }],
    };
    const solution = solveLumpedMatching(network);
    expect(solution.status).toBe('solved');
    const initial = renderToStaticMarkup(<I18nProvider initialLocale="es"><LCMatchingConstruction input={network} /></I18nProvider>);
    expect(initial).toContain('<h4>Solución</h4>');
    expect(initial).not.toMatch(/Rama|BRANCH|data-component-value=|formula--error|NaN/);
    expect(initial).toContain('data-element-index="0"');
    expect(initial).toContain('data-element-index="1"');
    const steps = getLCMatchingConstructionSteps(true);
    const summary = (stepIndex: number, completed = true) => renderToStaticMarkup(<LCMatchingBranchSummary solution={solution} steps={steps} position={{ stepIndex, completed }} />);
    const firstObtained = summary(3);
    expect(firstObtained).toContain('data-summary-field="element-1" data-found="false"');
    expect(firstObtained).toContain('data-summary-field="element-2" data-found="true"');
    expect(firstObtained).toContain(component + '_2=');
    const allObtained = summary(5);
    expect(allObtained).toContain(component + '_1=');
    expect(allObtained).toContain(component + '_2=');
    expect(allObtained.match(/data-found="true"/g)).toHaveLength(2);
    expect(summary(5, false).match(/data-found="true"/g)).toHaveLength(1);
    expect(summary(2).match(/data-found="false"/g)).toHaveLength(2);
  });
});
