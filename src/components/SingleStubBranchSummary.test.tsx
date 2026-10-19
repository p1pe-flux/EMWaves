import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { solveSingleStub, type SingleStubInput } from '../domain/singleStub';
import { SingleStubBranchSummary, type SingleStubBranchSummaryProps } from './SingleStubBranchSummary';
import { getSingleStubConstructionSteps, type SingleStubConstructionStep } from './singleStubPlayback';
import type { SingleStubStepPosition } from './singleStubResultMilestones';

const input: SingleStubInput = { z0: 50, stubZ0: 50, load: { kind: 'impedance', resistance: 100, reactance: 50 } };
const steps = getSingleStubConstructionSteps();

function at(phase: SingleStubConstructionStep['phase'], branchIndex = 0, completed = true): SingleStubStepPosition {
  const stepIndex = steps.findIndex((step) => step.phase === phase && step.branchIndex === branchIndex);
  expect(stepIndex).toBeGreaterThanOrEqual(0);
  return { stepIndex, completed };
}

function render(position: SingleStubStepPosition, options: Partial<Omit<SingleStubBranchSummaryProps, 'position'>> = {}): string {
  return renderToStaticMarkup(<SingleStubBranchSummary
    solution={options.solution ?? solveSingleStub(input)} steps={options.steps ?? steps} position={position}
    termination={options.termination ?? 'short'} periodicDistance={options.periodicDistance} periodicStubLength={options.periodicStubLength}
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
  return ['distance', 'stub-length'].map((key) => rowTex(branch, key));
}

describe('compact single-stub branch summary', () => {
  it('retains both empty branch headings before placement is completed', () => {
    for (const position of [at('z_load'), at('load'), at('circles'), at('follow', 0, false)]) {
      const html = render(position);
      expect(html).toContain('aria-label="Matching solutions found"');
      expect(html).toContain('Branch 1');
      expect(html).toContain('Branch 2');
      const summaries = branches(html);
      expect(summaries).toHaveLength(2);
      for (const branch of summaries) expect(values(branch)).toEqual([null, null]);
      expect(html).not.toContain('data-summary-field="stub-admittance"');
      expect(html).not.toContain('application/x-tex');
    }
  });

  it('reveals placement and stub length only after their own steps finish', () => {
    const placement = ['d=0.198792\\,\\lambda', null];
    const found = render(at('follow'));
    expect(values(branches(found)[0])).toEqual(placement);
    expect(found).toContain('matching-branch-summary--highlighted');
    expect(found).toContain('\\mathbf{0.198792}');
    expect(values(branches(render(at('cancel')))[0])).toEqual(placement);
    expect(values(branches(render(at('stub', 0, false)))[0])).toEqual(placement);
    expect(values(branches(render(at('stub')))[0])).toEqual(['d=0.198792\\,\\lambda', '\\ell_s=0.125\\,\\lambda_s']);
    expect(values(branches(render(at('verify')))[0])).toEqual(values(branches(render(at('stub')))[0]));
  });

  it.each(['short', 'open'] as const)('uses the selected %s lengths independently for both branches', (termination) => {
    const html = render(at('verify', 1), { termination });
    const summaries = branches(html);
    expect(rowTex(summaries[0], 'stub-length')).toBe('\\ell_s=' + (termination === 'short' ? '0.125' : '0.375') + '\\,\\lambda_s');
    expect(rowTex(summaries[1], 'stub-length')).toBe('\\ell_s=' + (termination === 'short' ? '0.375' : '0.125') + '\\,\\lambda_s');
    expect(html).not.toContain('data-summary-field="stub-admittance"');
    expect(html).not.toMatch(/formula--error|NaN|Infinity/);
  });

  it('uses solved unequal-impedance lengths and applies periodic offsets only to dimensions', () => {
    const solution = solveSingleStub({ ...input, stubZ0: 75 });
    const short = branches(render(at('verify', 1), { solution, termination: 'short' }));
    const open = branches(render(at('verify', 1), { solution, termination: 'open' }));
    expect(rowTex(short[0], 'stub-length')).toBe('\\ell_s=0.093584\\,\\lambda_s');
    expect(rowTex(open[0], 'stub-length')).toBe('\\ell_s=0.343584\\,\\lambda_s');
    const extended = branches(render(at('verify', 1), { periodicDistance: 1, periodicStubLength: 1.5 }));
    expect(values(extended[0])).toEqual(['d=1.198792\\,\\lambda', '\\ell_s=1.625\\,\\lambda_s']);
    expect(values(extended[1])).toEqual(['d=1.375\\,\\lambda', '\\ell_s=1.875\\,\\lambda_s']);
  });

  it('retains the first branch during handoff and hides future rows on rewind or restart', () => {
    const handoff = branches(render(at('follow', 1, false)));
    expect(values(handoff[0]).every((value) => value !== null)).toBe(true);
    expect(values(handoff[1])).toEqual([null, null]);
    const second = branches(render(at('follow', 1)));
    expect(values(second[1])).toEqual(['d=0.375\\,\\lambda', null]);
    const rewind = branches(render(at('cancel')));
    expect(values(rewind[0])).toEqual(['d=0.198792\\,\\lambda', null]);
    expect(values(rewind[1])).toEqual([null, null]);
    for (const branch of branches(render(at('z_load')))) expect(values(branch)).toEqual([null, null]);
  });

  it('renders no summary for matched or unmatchable special statuses', () => {
    for (const load of [{ kind: 'impedance', resistance: 50, reactance: 0 } as const, { kind: 'open' } as const]) {
      expect(render(at('verify', 1), { solution: solveSingleStub({ ...input, load }) })).toBe('');
    }
  });
});
