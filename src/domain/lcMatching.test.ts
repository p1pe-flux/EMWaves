import { describe, expect, it } from 'vitest';
import {
  applyLCStage, evaluateLCMatching, solveLCMatching,
  type LCMatchingInput, type LCMatchingTopology,
} from './lcMatching';
import type { ComplexValue, Load } from './transmission';

const example: LCMatchingInput = {
  z0: 50, frequencyHz: 1e9, load: { kind: 'impedance', resistance: 100, reactance: 50 },
  order: 'LC', inductorConnection: 'series', capacitorConnection: 'parallel',
};

function expectComplex(value: ComplexValue | null, re: number, im: number, digits = 12): void {
  expect(value).not.toBeNull();
  expect(value!.re).toBeCloseTo(re, digits);
  expect(value!.im).toBeCloseTo(im, digits);
}

/** Independent direct circuit equations, in ohms and siemens. */
function circuitStage(z: ComplexValue, connection: 'series' | 'parallel', value: number): ComplexValue {
  if (connection === 'series') return { re: z.re, im: z.im + value };
  const modulusSquared = z.re * z.re + z.im * z.im;
  const g = z.re / modulusSquared;
  const b = -z.im / modulusSquared + value;
  const denominator = g * g + b * b;
  return { re: g / denominator, im: -b / denominator };
}

const mixed: (LCMatchingTopology & { r: number; x: number })[] = [
  { order: 'LC', inductorConnection: 'series', capacitorConnection: 'parallel', r: 2, x: 1 },
  { order: 'LC', inductorConnection: 'parallel', capacitorConnection: 'series', r: 0.4, x: 0.2 },
  { order: 'CL', inductorConnection: 'parallel', capacitorConnection: 'series', r: 2, x: -1 },
  { order: 'CL', inductorConnection: 'series', capacitorConnection: 'parallel', r: 0.4, x: -0.2 },
];

describe('LC matching synthesis', () => {
  it('solves the default source-series L, load-parallel C example', () => {
    const result = solveLCMatching(example);
    expect(result.status).toBe('solved');
    expectComplex(result.normalizedLoad, 2, 1);
    expectComplex(result.loadReflection, 0.4, 0.2);
    expect(result.branches).toHaveLength(1);
    const branch = result.branches[0];
    expect(branch.inductance * 1e9).toBeCloseTo(9.746210015420953, 11);
    expect(branch.capacitance * 1e12).toBeCloseTo(2.196013374834934, 11);
    expect(branch.stages.map(stage => [stage.component, stage.connection])).toEqual([['C', 'parallel'], ['L', 'series']]);
    expect(branch.stages[0].normalizedValue).toBeCloseTo(0.2 + Math.sqrt(0.24), 13);
    expectComplex(branch.stages[0].impedance, 1, -Math.sqrt(1.5));
    expectComplex(branch.stages[1].impedance, 1, 0);
    expect(branch.residual).toBeLessThan(1e-14);
  });

  it.each(mixed)('solves and verifies the mixed topology %j', topology => {
    for (const z0 of [25, 50, 100]) {
      const input: LCMatchingInput = { ...example, ...topology, z0, load: { kind: 'impedance', resistance: topology.r * z0, reactance: topology.x * z0 } };
      const result = solveLCMatching(input);
      expect(result.status).toBe('solved');
      expect(result.branches).toHaveLength(1);
      const branch = result.branches[0];
      expect(branch.inductance).toBeGreaterThan(0);
      expect(branch.capacitance).toBeGreaterThan(0);
      expect(Number.isFinite(branch.inductance)).toBe(true);
      expect(Number.isFinite(branch.capacitance)).toBe(true);
      expect(branch.stages.map(stage => stage.component).join('')).toBe(topology.order.split('').reverse().join(''));
      for (const stage of branch.stages) {
        const inductor = stage.component === 'L';
        const expectedSign = inductor === (stage.connection === 'series') ? 1 : -1;
        expect(Math.sign(stage.normalizedValue)).toBe(expectedSign);
      }
      const evaluation = evaluateLCMatching({ ...input, ...branch });
      expectComplex(evaluation.normalizedInput, 1, 0);
      expectComplex(evaluation.inputImpedance, z0, 0);
      expect(evaluation.reflectionMagnitude).toBeLessThan(1e-14);
      expect(evaluation.vswr).toBeCloseTo(1, 13);
    }
  });

  it.each(['LC', 'CL'] as const)('preserves the continuous series family for order %s', order => {
    for (const x of [-2, 0, 2]) {
      const input: LCMatchingInput = { ...example, order, inductorConnection: 'series', capacitorConnection: 'series', load: { kind: 'impedance', resistance: 50, reactance: 50 * x } };
      const result = solveLCMatching(input);
      expect(result.status).toBe('continuous');
      expect(result.branches).toEqual([]);
      expect(result.family).toEqual({ connection: 'series', minimum: Math.max(0, -x), loadImaginary: x });
      for (const q of [result.family!.minimum + 0.5, result.family!.minimum + 3]) {
        const inductance = q * input.z0 / (2 * Math.PI * input.frequencyHz);
        const capacitance = 1 / (2 * Math.PI * input.frequencyHz * input.z0 * (q + x));
        expectComplex(evaluateLCMatching({ ...input, inductance, capacitance }).normalizedInput, 1, 0);
      }
    }
  });

  it.each(['LC', 'CL'] as const)('preserves the continuous parallel family for order %s', order => {
    for (const x of [-0.5, 0, 0.5]) {
      const r = x === 0 ? 1 : 0.5;
      const b = x === 0 ? 0 : -2 * x;
      const input: LCMatchingInput = { ...example, order, inductorConnection: 'parallel', capacitorConnection: 'parallel', load: { kind: 'impedance', resistance: 50 * r, reactance: 50 * x } };
      const result = solveLCMatching(input);
      expect(result.status).toBe('continuous');
      expect(result.branches).toEqual([]);
      expect(result.family).toEqual({ connection: 'parallel', minimum: Math.max(0, b), loadImaginary: b });
      for (const q of [result.family!.minimum + 0.5, result.family!.minimum + 3]) {
        const inductance = input.z0 / (2 * Math.PI * input.frequencyHz * q);
        const capacitance = (q - b) / (2 * Math.PI * input.frequencyHz * input.z0);
        expectComplex(evaluateLCMatching({ ...input, inductance, capacitance }).normalizedInput, 1, 0);
      }
    }
  });

  it('rejects same-connection topologies outside their exact real-part family', () => {
    for (const order of ['LC', 'CL'] as const) {
      for (const connection of ['series', 'parallel'] as const) {
        const result = solveLCMatching({ ...example, order, inductorConnection: connection, capacitorConnection: connection });
        expect(result.status).toBe('no-solution');
        expect(result.branches).toEqual([]);
        expect(result.family).toBeUndefined();
      }
    }
  });

  it('classifies parallel families from the physical load without normalization, overflow, or underflow drift', () => {
    for (const order of ['LC', 'CL'] as const) {
      for (const scale of [2 ** -1000, 1, 2 ** 900]) {
        const result = solveLCMatching({
          ...example, order, z0: 50 * scale, inductorConnection: 'parallel', capacitorConnection: 'parallel',
          load: { kind: 'impedance', resistance: 5 * scale, reactance: 15 * scale },
        });
        // R² + X² = R Z0 exactly, even though r=0.1 and x=0.3 acquire division roundoff.
        expect(result.status).toBe('continuous');
        expect(result.branches).toEqual([]);
        expect(result.family).toEqual({ connection: 'parallel', minimum: 0, loadImaginary: -3 });
      }
    }
    for (const sign of [-1, 1]) {
      const load = { kind: 'impedance' as const, resistance: 5, reactance: 15 + sign * 15 * Number.EPSILON };
      const mixedResult = solveLCMatching({ ...example, load });
      expect(mixedResult.status).toBe(sign < 0 ? 'no-solution' : 'solved');
      const parallelResult = solveLCMatching({ ...example, inductorConnection: 'parallel', load });
      expect(parallelResult.status).toBe('no-solution');
    }
  });

  it('does not turn negative or missing components into realizable branches', () => {
    const inputs: LCMatchingInput[] = [
      { ...example, load: { kind: 'impedance', resistance: 50 * 0.4 / 1.16, reactance: -50 / 1.16 } },
      { ...example, order: 'CL', inductorConnection: 'parallel', capacitorConnection: 'series', load: { kind: 'impedance', resistance: 50 * 0.4 / 1.16, reactance: 50 / 1.16 } },
      { ...example, inductorConnection: 'parallel', capacitorConnection: 'series', load: { kind: 'impedance', resistance: 20, reactance: -50 } },
      { ...example, order: 'CL', load: { kind: 'impedance', resistance: 20, reactance: 50 } },
      { ...example, order: 'CL', load: { kind: 'impedance', resistance: 100, reactance: 0 } },
      { ...example, order: 'CL', load: { kind: 'impedance', resistance: 50, reactance: -50 } },
      { ...example, load: { kind: 'impedance', resistance: 25, reactance: 25 } },
    ];
    for (const input of inputs) {
      const result = solveLCMatching(input);
      expect(result.status).toBe('no-solution');
      expect(result.branches).toEqual([]);
    }
  });

  it('rejects exact zero-component boundaries before a rounded root creates a fictitious positive part', () => {
    const cases: LCMatchingInput[] = [
      { ...example, order: 'CL', load: { kind: 'impedance', resistance: 25, reactance: 25 } },
      { ...example, inductorConnection: 'parallel', capacitorConnection: 'series', load: { kind: 'impedance', resistance: 25, reactance: -25 } },
      { ...example, order: 'CL', load: { kind: 'impedance', resistance: 5, reactance: 15 } },
      { ...example, inductorConnection: 'parallel', capacitorConnection: 'series', load: { kind: 'impedance', resistance: 5, reactance: -15 } },
    ];
    for (const input of cases) {
      const result = solveLCMatching(input);
      expect(result.status).toBe('no-solution');
      expect(result.branches).toEqual([]);
    }
  });

  it('retains the finite pair on the opposite side of a strict zero-component boundary', () => {
    for (const sign of [-1, 1]) {
      const input: LCMatchingInput = {
        ...example, order: sign > 0 ? 'CL' : 'LC',
        inductorConnection: sign > 0 ? 'series' : 'parallel',
        capacitorConnection: sign > 0 ? 'parallel' : 'series',
        load: { kind: 'impedance', resistance: 25, reactance: sign * (25 - 25 * Number.EPSILON) },
      };
      const result = solveLCMatching(input);
      expect(result.status).toBe('solved');
      expect(result.branches).toHaveLength(1);
      expect(result.branches[0].inductance).toBeGreaterThan(0);
      expect(result.branches[0].capacitance).toBeGreaterThan(0);
      expect(result.branches[0].residual).toBeLessThan(1e-14);
    }
  });

  it.each(mixed)('recognizes a matched load without a fabricated finite mixed pair: %j', topology => {
    const result = solveLCMatching({ ...example, ...topology, load: { kind: 'impedance', resistance: 50, reactance: 0 } });
    expect(result.status).toBe('already-matched');
    expect(result.branches).toEqual([]);
  });

  it.each<Load>([
    { kind: 'open' }, { kind: 'short' },
    { kind: 'impedance', resistance: 0, reactance: 0 },
    { kind: 'impedance', resistance: 0, reactance: 50 },
    { kind: 'impedance', resistance: 0, reactance: -50 },
  ])('marks a zero-real-power load unmatchable: %j', load => {
    const result = solveLCMatching({ ...example, load });
    expect(result.status).toBe('unmatchable');
    expect(result.branches).toEqual([]);
  });

  it('keeps tiny feasible mismatches and exact boundaries distinct', () => {
    for (const reactance of [1e-8, 1e-17, 1e-100]) {
      const result = solveLCMatching({ ...example, load: { kind: 'impedance', resistance: 50, reactance } });
      expect(result.status).toBe('solved');
      expect(result.branches).toHaveLength(1);
      expect(result.branches[0].inductance).toBeGreaterThan(0);
      expect(result.branches[0].capacitance).toBeGreaterThan(0);
      const parallelFamily = solveLCMatching({ ...example, inductorConnection: 'parallel', load: { kind: 'impedance', resistance: 50, reactance } });
      expect(parallelFamily.status).toBe('no-solution');
    }
    for (const r of [1 - Number.EPSILON, 1 + Number.EPSILON]) {
      const result = solveLCMatching({ ...example, z0: 1, order: 'CL', load: { kind: 'impedance', resistance: r, reactance: 0 } });
      expect(result.status).toBe(r < 1 ? 'solved' : 'no-solution');
      const seriesFamily = solveLCMatching({ ...example, z0: 1, capacitorConnection: 'series', load: { kind: 'impedance', resistance: r, reactance: 0 } });
      expect(seriesFamily.status).toBe('no-solution');
    }
  });

  it('scales both physical component values inversely with frequency', () => {
    const first = solveLCMatching(example).branches[0];
    const second = solveLCMatching({ ...example, frequencyHz: 2e9 }).branches[0];
    expect(second.inductance).toBe(first.inductance / 2);
    expect(second.capacitance).toBe(first.capacitance / 2);
    expect(second.stages).toEqual(first.stages);
  });

  it('verifies solved outputs with independent physical circuit equations over a broad passive grid', () => {
    for (const topology of mixed) {
      for (const z0 of [25, 75]) {
        for (const frequencyHz of [1e3, 1e12]) {
          for (const r of [0.001, 0.1, 0.5, 1, 2, 10, 1000]) {
            for (const x of [-1000, -10, -0.2, 0, 0.2, 10, 1000]) {
              const input: LCMatchingInput = { ...example, ...topology, z0, frequencyHz, load: { kind: 'impedance', resistance: r * z0, reactance: x * z0 } };
              const solution = solveLCMatching(input);
              for (const branch of solution.branches) {
                let z = { re: r * z0, im: x * z0 };
                const omega = 2 * Math.PI * frequencyHz;
                for (const component of [...input.order].reverse()) {
                  const connection = component === 'L' ? input.inductorConnection : input.capacitorConnection;
                  const value = component === 'L'
                    ? connection === 'series' ? omega * branch.inductance : -1 / (omega * branch.inductance)
                    : connection === 'series' ? -1 / (omega * branch.capacitance) : omega * branch.capacitance;
                  z = circuitStage(z, connection, value);
                }
                expect(Math.hypot(z.re / z0 - 1, z.im / z0)).toBeLessThan(1e-8);
              }
            }
          }
        }
      }
    }
  });

  it('rejects an ill-conditioned resonance whose rounded physical components cannot retain the match', () => {
    expect(() => solveLCMatching({
      ...example, z0: 1.5482673533900106, frequencyHz: 257437429.1518924,
      load: { kind: 'impedance', resistance: 0.0000023399395704436903, reactance: 346435.4929848486 },
    })).toThrow(/reliable numeric range/);
  });

  it.each([
    { ...example, frequencyHz: 0 }, { ...example, frequencyHz: -1 },
    { ...example, frequencyHz: NaN }, { ...example, frequencyHz: Infinity },
    { ...example, z0: 0 }, { ...example, z0: -1 }, { ...example, z0: Infinity },
    { ...example, load: { kind: 'impedance' as const, resistance: -1, reactance: 0 } },
    { ...example, load: { kind: 'impedance' as const, resistance: 1, reactance: NaN } },
    { ...example, order: 'LL' as 'LC' },
    { ...example, capacitorConnection: 'shunt' as 'parallel' },
  ])('rejects invalid input: %j', input => {
    expect(() => solveLCMatching(input)).toThrow(RangeError);
  });
});

describe('LC network evaluation', () => {
  it('evaluates a supplied network independently of the synthesis result', () => {
    const input = { ...example, frequencyHz: 1 / (2 * Math.PI), z0: 1, load: { kind: 'impedance' as const, resistance: 1, reactance: 1 }, inductance: 2, capacitance: 3 };
    const result = evaluateLCMatching(input);
    // y_L = (1-j)/2; adding j3 gives 1/2+j5/2, then adding series j2.
    expectComplex(result.stages[0].impedance, 1 / 13, -5 / 13);
    expectComplex(result.normalizedInput, 1 / 13, 21 / 13);
    expectComplex(result.inputImpedance, 1 / 13, 21 / 13);
    expect(result.reflectionMagnitude).toBeCloseTo(Math.hypot(result.reflection.re, result.reflection.im), 14);
    expect(result.vswr).toBeCloseTo((1 + result.reflectionMagnitude) / (1 - result.reflectionMagnitude), 10);
  });

  it.each([0, -1, Infinity, NaN])('rejects a nonpositive or nonfinite component: %s', value => {
    expect(() => evaluateLCMatching({ ...example, inductance: value, capacitance: 1e-12 })).toThrow(RangeError);
    expect(() => evaluateLCMatching({ ...example, inductance: 1e-9, capacitance: value })).toThrow(RangeError);
  });

  it('keeps ideal opens and shorts exact during stage interpolation', () => {
    expect(applyLCStage(null, 'series', 2)).toBeNull();
    expectComplex(applyLCStage(null, 'parallel', 2), 0, -0.5);
    expectComplex(applyLCStage({ re: 0, im: 0 }, 'parallel', 2), 0, 0);
    expectComplex(applyLCStage({ re: 0, im: -2 }, 'series', 2), 0, 0);
    expect(applyLCStage({ re: 0, im: 1 }, 'parallel', 1)).toBeNull();
    expect(applyLCStage(null, 'parallel', 0)).toBeNull();
    expectComplex(applyLCStage({ re: 1, im: -2 }, 'parallel', 0), 1, -2);
    for (const value of [NaN, Infinity, -Infinity]) expect(() => applyLCStage({ re: 1, im: 0 }, 'series', value)).toThrow(RangeError);
  });

  it('returns exact reflection endpoints and infinite VSWR for ideal reactive networks', () => {
    const input = { ...example, z0: 1, frequencyHz: 1 / (2 * Math.PI), order: 'CL' as const, inductorConnection: 'series' as const, capacitorConnection: 'parallel' as const, load: { kind: 'short' as const }, inductance: 1, capacitance: 1 };
    const result = evaluateLCMatching(input);
    expectComplex(result.stages[0].impedance, 0, 1);
    expect(result.normalizedInput).toBeNull();
    expect(result.inputImpedance).toBeNull();
    expect(result.reflection).toEqual({ re: 1, im: 0 });
    expect(result.reflectionMagnitude).toBe(1);
    expect(result.vswr).toBe(Infinity);
  });
});
