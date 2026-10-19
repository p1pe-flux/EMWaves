import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { solveQuarterWave, type QuarterWaveInput, type QuarterWaveSolution } from '../domain/quarterWave';
import { QuarterWaveBranchSummary } from './QuarterWaveBranchSummary';
import { quarterWaveSteps, type QuarterWavePhase, type QuarterWavePosition } from './quarterWavePlayback';

const input: QuarterWaveInput = { z0: 50, load: { kind: 'impedance', resistance: 100, reactance: 50 } };
const steps = quarterWaveSteps(2);

function at(phase: QuarterWavePhase, branchIndex = 0, completed = true): QuarterWavePosition {
  const stepIndex = steps.findIndex((step) => step.phase === phase && step.branchIndex === branchIndex);
  expect(stepIndex).toBeGreaterThanOrEqual(0);
  return { stepIndex, completed };
}

function render(position: QuarterWavePosition, options: {
  solution?: QuarterWaveSolution;
  periodicDistance?: number;
  periodicTransformerLength?: number;
} = {}): string {
  return renderToStaticMarkup(<QuarterWaveBranchSummary
    solution={options.solution ?? solveQuarterWave(input)} position={position}
    periodicDistance={options.periodicDistance} periodicTransformerLength={options.periodicTransformerLength}
  />);
}

function branches(html: string): string[] {
  return [...html.matchAll(/<section\b[^>]*data-summary-branch="[^"]+"[^>]*>([\s\S]*?)<\/section>/g)].map((match) => match[0]);
}

function rowTex(branch: string, key: string): string | null {
  const row = branch.match(new RegExp('<span[^>]*data-summary-field="' + key + '"[^>]*>([\\s\\S]*?)<\\/span>'));
  expect(row, 'Expected summary row ' + key).not.toBeNull();
  if (row![1] === '') return null;
  const tex = row![1].match(/<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/)?.[1];
  expect(tex, 'Expected formula in ' + key).toBeDefined();
  return tex!.replace(/\s+/g, '').replace(/\\mathbf\{([^{}]*)\}/g, '$1');
}

function values(branch: string): (string | null)[] {
  return ['distance', 'transformer-impedance', 'transformer-length'].map((key) => rowTex(branch, key));
}

describe('compact quarter-wave branch summary', () => {
  it('keeps both branch headings empty until a placement finishes', () => {
    for (const position of [at('load'), at('circles'), at('follow', 0, false)]) {
      const html = render(position);
      expect(html).toContain('aria-label="Matching solutions found"');
      expect(html).toContain('Branch 1');
      expect(html).toContain('Branch 2');
      expect(branches(html)).toHaveLength(2);
      for (const branch of branches(html)) expect(values(branch)).toEqual([null, null, null]);
      expect(html).not.toContain('application/x-tex');
    }
  });

  it('reveals placement, impedance and length only at their own completed steps', () => {
    const placement = ['d=0.036896\\,\\lambda', null, null];
    expect(values(branches(render(at('follow')))[0])).toEqual(placement);
    expect(values(branches(render(at('design', 0, false)))[0])).toEqual(placement);
    const designed = ['d=0.036896\\,\\lambda', 'Z_t=80.901699\\;\\Omega', null];
    const html = render(at('design'));
    expect(values(branches(html)[0])).toEqual(designed);
    expect(html).toContain('matching-branch-summary--highlighted');
    expect(html).toContain('\\mathbf{80.901699}');
    expect(values(branches(render(at('reference')))[0])).toEqual(designed);
    expect(values(branches(render(at('transform', 0, false)))[0])).toEqual(designed);
    const traversed = ['d=0.036896\\,\\lambda', 'Z_t=80.901699\\;\\Omega', '\\ell_t=0.25\\,\\lambda_t'];
    expect(values(branches(render(at('transform')))[0])).toEqual(traversed);
    expect(values(branches(render(at('verify', 0, false)))[0])).toEqual(traversed);
    expect(values(branches(render(at('verify')))[0])).toEqual(traversed);
  });

  it('shows both distinct networks with their own placement and transformer impedance', () => {
    const html = render(at('verify', 1));
    const summaries = branches(html);
    expect(summaries).toHaveLength(2);
    expect(values(summaries[0])).toEqual(['d=0.036896\\,\\lambda', 'Z_t=80.901699\\;\\Omega', '\\ell_t=0.25\\,\\lambda_t']);
    expect(values(summaries[1])).toEqual(['d=0.286896\\,\\lambda', 'Z_t=30.901699\\;\\Omega', '\\ell_t=0.25\\,\\lambda_t']);
    expect(html).not.toMatch(/formula--error|NaN|Infinity/);
  });

  it('keeps branch one through handoff and removes future values on rewind and restart', () => {
    const first = ['d=0.036896\\,\\lambda', 'Z_t=80.901699\\;\\Omega', '\\ell_t=0.25\\,\\lambda_t'];
    const handoff = branches(render(at('follow', 1, false)));
    expect(values(handoff[0])).toEqual(first);
    expect(values(handoff[1])).toEqual([null, null, null]);
    expect(values(branches(render(at('follow', 1)))[1])).toEqual(['d=0.286896\\,\\lambda', null, null]);
    const rewind = branches(render(at('design', 0, false)));
    expect(values(rewind[0])).toEqual(['d=0.036896\\,\\lambda', null, null]);
    expect(values(rewind[1])).toEqual([null, null, null]);
    for (const branch of branches(render(at('load')))) expect(values(branch)).toEqual([null, null, null]);
  });

  it('shows one canonical realization for an already-matched load', () => {
    const solution = solveQuarterWave({ z0: 50, load: { kind: 'impedance', resistance: 50, reactance: 0 } });
    const html = render(at('verify'), { solution });
    expect(html).toContain('Canonical matched realization');
    expect(branches(html)).toHaveLength(1);
    expect(values(branches(html)[0])).toEqual(['d=0\\,\\lambda', 'Z_t=50\\;\\Omega', '\\ell_t=0.25\\,\\lambda_t']);
  });

  it('applies independent periodic offsets to the displayed dimensions', () => {
    const extended = branches(render(at('verify', 1), { periodicDistance: 1, periodicTransformerLength: 1.5 }));
    expect(values(extended[0])).toEqual(['d=1.036896\\,\\lambda', 'Z_t=80.901699\\;\\Omega', '\\ell_t=1.75\\,\\lambda_t']);
    expect(values(extended[1])).toEqual(['d=1.286896\\,\\lambda', 'Z_t=30.901699\\;\\Omega', '\\ell_t=1.75\\,\\lambda_t']);
  });

  it('renders no stale branch values for loads with no matchable real power', () => {
    for (const load of [{ kind: 'open' } as const, { kind: 'impedance', resistance: 0, reactance: 50 } as const]) {
      const html = render(at('verify', 1), { solution: solveQuarterWave({ ...input, load }) });
      expect(branches(html)).toEqual([]);
      expect(html).not.toContain('data-summary-field');
      expect(html).not.toContain('application/x-tex');
    }
  });
});
