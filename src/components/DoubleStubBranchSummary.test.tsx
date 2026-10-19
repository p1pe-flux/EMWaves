import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { solveDoubleStub, type DoubleStubInput } from '../domain/doubleStub';
import { I18nProvider } from '../i18n';
import { DoubleStubBranchSummary, type DoubleStubBranchSummaryProps } from './DoubleStubBranchSummary';
import { doubleStubSteps, type DoubleStubPhase, type DoubleStubStepPosition } from './doubleStubPlayback';

const input: DoubleStubInput = {
  z0: 50, load: { kind: 'impedance', resistance: 100, reactance: 50 },
  distance: 0.125, separation: 0.125, stub1Z0: 50, stub2Z0: 50,
};
const solution = solveDoubleStub(input);
const steps = doubleStubSteps(solution.branches.length);

function at(phase: DoubleStubPhase, branchIndex = 0, completed = true): DoubleStubStepPosition {
  const stepIndex = steps.findIndex((step) => step.phase === phase && step.branchIndex === branchIndex);
  expect(stepIndex).toBeGreaterThanOrEqual(0);
  return { stepIndex, completed };
}

function render(position: DoubleStubStepPosition, options: Partial<Omit<DoubleStubBranchSummaryProps, 'position'>> = {}): string {
  return renderToStaticMarkup(<DoubleStubBranchSummary solution={options.solution ?? solution} position={position}
    termination1={options.termination1 ?? 'short'} termination2={options.termination2 ?? 'short'}
    periodicLength1={options.periodicLength1} periodicLength2={options.periodicLength2} />);
}

function branches(html: string): string[] {
  return [...html.matchAll(/<section\b[^>]*data-summary-branch="[^"]+"[^>]*>([\s\S]*?)<\/section>/g)].map((match) => match[0]);
}

function rowTex(branch: string, key: string): string | null {
  const row = branch.match(new RegExp('<span[^>]*data-summary-field="' + key + '"[^>]*>([\\s\\S]*?)<\\/span>'));
  expect(row, 'Expected summary row ' + key).not.toBeNull();
  if (row![1] === '') return null;
  const tex = row![1].match(/<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/)?.[1];
  expect(tex).toBeDefined();
  return tex!.replace(/\s+/g, '').replace(/\\mathbf\{([^{}]*)\}/g, '$1');
}

function values(branch: string): (string | null)[] {
  return ['stub-1-length', 'stub-2-length'].map((key) => rowTex(branch, key));
}

describe('compact double-stub branch summary', () => {
  it('keeps both branch headings and four blank value blocks during the common construction', () => {
    for (const position of [at('matched'), at('left-circle'), at('transport'), at('load'), at('admittance'), at('load-line'), at('intersections'), at('stub2', 0, false)]) {
      const html = render(position);
      expect(html).toContain('matching-branch-summary--highlighted');
      expect(html).toContain('Branch 1');
      expect(html).toContain('Branch 2');
      expect(branches(html).map(values)).toEqual([[null, null], [null, null]]);
      expect(html).not.toContain('application/x-tex');
      expect(html).not.toContain('data-summary-field="distance"');
    }
  });

  it('earns the right-hand Stub 2 length before the left-hand Stub 1 length', () => {
    const stub2 = render(at('stub2'));
    expect(values(branches(stub2)[0])).toEqual([null, '\\ell_2=0.194156\\,\\lambda_{s2}']);
    expect(stub2).toContain('\\mathbf{0.194156}');
    expect(values(branches(render(at('propagate')))[0])).toEqual(values(branches(stub2)[0]));
    expect(values(branches(render(at('stub1', 0, false)))[0])).toEqual(values(branches(stub2)[0]));
    const complete = ['\\ell_1=0.149428\\,\\lambda_{s1}', '\\ell_2=0.194156\\,\\lambda_{s2}'];
    expect(values(branches(render(at('stub1')))[0])).toEqual(complete);
    expect(values(branches(render(at('verify')))[0])).toEqual(complete);
  });

  it('selects each stub termination independently for both branches', () => {
    const mixed = branches(render(at('verify', 1), { termination1: 'open', termination2: 'short' }));
    expect(values(mixed[0])).toEqual(['\\ell_1=0.399428\\,\\lambda_{s1}', '\\ell_2=0.194156\\,\\lambda_{s2}']);
    expect(values(mixed[1])).toEqual(['\\ell_1=0.194156\\,\\lambda_{s1}', '\\ell_2=0.399428\\,\\lambda_{s2}']);
    const reversed = branches(render(at('verify', 1), { termination1: 'short', termination2: 'open' }));
    expect(values(reversed[0])).toEqual(['\\ell_1=0.149428\\,\\lambda_{s1}', '\\ell_2=0.444156\\,\\lambda_{s2}']);
    expect(values(reversed[1])).toEqual(['\\ell_1=0.444156\\,\\lambda_{s1}', '\\ell_2=0.149428\\,\\lambda_{s2}']);
  });

  it('applies independent half-wave additions only to their own earned length', () => {
    const first = branches(render(at('stub2'), { periodicLength1: 0.5, periodicLength2: 1.5 }));
    expect(values(first[0])).toEqual([null, '\\ell_2=1.694156\\,\\lambda_{s2}']);
    const completed = branches(render(at('verify', 1), { periodicLength1: 0.5, periodicLength2: 1.5 }));
    expect(values(completed[0])).toEqual(['\\ell_1=0.649428\\,\\lambda_{s1}', '\\ell_2=1.694156\\,\\lambda_{s2}']);
    expect(values(completed[1])).toEqual(['\\ell_1=0.944156\\,\\lambda_{s1}', '\\ell_2=1.899428\\,\\lambda_{s2}']);
  });

  it('uses each independently specified stub impedance when displaying its selected length', () => {
    const unequal = solveDoubleStub({ ...input, stub1Z0: 75, stub2Z0: 100 });
    const summaries = branches(render(at('verify', 1), { solution: unequal, termination1: 'open', termination2: 'short' }));
    expect(values(summaries[0])).toEqual(['\\ell_1=0.367566\\,\\lambda_{s1}', '\\ell_2=0.149428\\,\\lambda_{s2}']);
    expect(values(summaries[1])).toEqual(['\\ell_1=0.211908\\,\\lambda_{s1}', '\\ell_2=0.444156\\,\\lambda_{s2}']);
  });

  it('retains the first branch during handoff and hides later deductions on rewind', () => {
    const handoff = branches(render(at('stub2', 1, false)));
    expect(values(handoff[0]).every((value) => value !== null)).toBe(true);
    expect(values(handoff[1])).toEqual([null, null]);
    expect(values(branches(render(at('stub2', 1)))[1])).toEqual([null, '\\ell_2=0.399428\\,\\lambda_{s2}']);
    expect(branches(render(at('propagate'))).map(values)).toEqual([[null, '\\ell_2=0.194156\\,\\lambda_{s2}'], [null, null]]);
    expect(branches(render(at('matched'))).map(values)).toEqual([[null, null], [null, null]]);
  });

  it('uses one summary for tangency and none for forbidden or continuous cases', () => {
    const tangent = solveDoubleStub({ ...input, distance: 0, load: { kind: 'impedance', resistance: 25, reactance: 0 } });
    const tangentPosition = { stepIndex: doubleStubSteps(tangent.branches.length).length - 1, completed: true };
    expect(branches(render(tangentPosition, { solution: tangent }))).toHaveLength(1);
    for (const special of [
      solveDoubleStub({ ...input, distance: 0, load: { kind: 'impedance', resistance: 10, reactance: 0 } }),
      solveDoubleStub({ ...input, load: { kind: 'impedance', resistance: 0, reactance: 50 } }),
      solveDoubleStub({ ...input, distance: 0, separation: 0.5, load: { kind: 'impedance', resistance: 50, reactance: 0 } }),
    ]) expect(render(at('verify', 1), { solution: special })).toBe('');
  });

  it('localizes the branch headings without changing any earned mathematical values', () => {
    const en = render(at('verify', 1));
    const es = renderToStaticMarkup(<I18nProvider initialLocale="es"><DoubleStubBranchSummary solution={solution} position={at('verify', 1)} termination1="short" termination2="short" /></I18nProvider>);
    expect(es).toContain('Rama 1');
    expect(es).toContain('Rama 2');
    expect(es).toContain('Soluciones de adaptación encontradas');
    expect(branches(es).map(values)).toEqual(branches(en).map(values));
    expect(es).not.toMatch(/formula--error|katex-error|NaN|Infinity/);
  });
});
