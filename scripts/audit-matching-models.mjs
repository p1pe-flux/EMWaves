import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// The verifier deliberately uses elementary physical-circuit arithmetic rather
// than the production evaluators. Keep this seed and draw order reproducible.
const INITIAL_SEED = 0x20261017;
const RESIDUAL_TOLERANCE = 1e-8;
const EXPECTED_COUNTS = { single: 4800, series: 4800, quarter: 2400, double: 8336, lumped: 1600 };
const TERMINATIONS = ['open', 'short'];

const complex = (re, im = 0) => ({ re, im });
const add = (a, b) => complex(a.re + b.re, a.im + b.im);
const multiply = (a, b) => complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);

function divide(a, b) {
  const denominator = b.re * b.re + b.im * b.im;
  return complex(
    (a.re * b.re + a.im * b.im) / denominator,
    (a.im * b.re - a.re * b.im) / denominator,
  );
}

const reciprocal = value => divide(complex(1), value);

/** Physical impedance transfer, Zin = (ZL cos θ + jZ0 sin θ)/(cos θ + jZL sin θ/Z0). */
function transferLine(impedance, z0, length) {
  const angle = 2 * Math.PI * length;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return divide(
    add(multiply(impedance, complex(cos)), complex(0, z0 * sin)),
    add(complex(cos), multiply(impedance, complex(0, sin / z0))),
  );
}

function reflectionMagnitude(impedance, z0) {
  const gamma = divide(add(impedance, complex(-z0)), add(impedance, complex(z0)));
  return Math.hypot(gamma.re, gamma.im);
}

function addShunt(impedance, susceptance) {
  return reciprocal(add(reciprocal(impedance), complex(0, susceptance)));
}

/** Reactance in ohms for series stubs; susceptance in siemens for shunt stubs. */
function stubContribution(z0, length, termination, series) {
  const tangent = Math.tan(2 * Math.PI * length);
  if (series) return termination === 'short' ? z0 * tangent : -z0 / tangent;
  return termination === 'open' ? tangent / z0 : -1 / (z0 * tangent);
}

function stubLength(branch, termination) {
  return termination === 'open' ? branch.openLength : branch.shortLength;
}

async function auditModels() {
  const counts = { single: 0, series: 0, quarter: 0, double: 0, lumped: 0 };
  const doubleCases = { solved: 0, forbidden: 0 };
  const failures = [];
  let maxResidual = 0;
  let seed = INITIAL_SEED;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };

  function verify(name, impedance, z0, input) {
    const residual = reflectionMagnitude(impedance, z0);
    counts[name] += 1;
    maxResidual = Math.max(maxResidual, residual);
    if (!(residual < RESIDUAL_TOLERANCE)) failures.push({ name, residual, input });
  }

  function verifyTwoPlacements(name, result, input) {
    if (result.status !== 'solved' || result.branches.length !== 2) {
      failures.push({ name, error: 'Expected two solved placement branches.',
        status: result.status, branches: result.branches.length, input });
      return;
    }
    const [first, second] = result.branches;
    if (!(first.distance >= 0 && first.distance < second.distance && second.distance < 0.5)) {
      failures.push({ name,
        error: 'Placements must be distinct, sorted, and within the first half wavelength.', input });
    }
  }

  // Vite loads the repository's TypeScript on every supported Node version;
  // this script does not require native TypeScript stripping or module hooks.
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    logLevel: 'silent',
    server: { middlewareMode: true },
    appType: 'custom',
  });
  try {
    const [single, series, quarter, double, lumped] = await Promise.all([
      server.ssrLoadModule('/src/domain/singleStub.ts'),
      server.ssrLoadModule('/src/domain/seriesStub.ts'),
      server.ssrLoadModule('/src/domain/quarterWave.ts'),
      server.ssrLoadModule('/src/domain/doubleStub.ts'),
      server.ssrLoadModule('/src/domain/lumpedMatching.ts'),
    ]);

    for (let index = 0; index < 1200; index += 1) {
      const z0 = 10 + random() * 190;
      const stubZ0 = 10 + random() * 190;
      const impedance = complex(z0 * (0.03 + random() * 8), z0 * (-6 + random() * 12));
      const load = { kind: 'impedance', resistance: impedance.re, reactance: impedance.im };
      const input = { z0, stubZ0, load };

      for (const [name, solve, isSeries] of [
        ['single', single.solveSingleStub, false],
        ['series', series.solveSeriesStub, true],
      ]) {
        try {
          const result = solve(input);
          verifyTwoPlacements(name, result, input);
          for (const branch of result.branches) {
            for (const termination of TERMINATIONS) {
              const placed = transferLine(impedance, z0, branch.distance);
              const contribution = stubContribution(
                stubZ0, stubLength(branch, termination), termination, isSeries,
              );
              const final = isSeries ? add(placed, complex(0, contribution)) : addShunt(placed, contribution);
              verify(name, final, z0, input);
            }
          }
        } catch (error) {
          failures.push({ name, input, error: String(error) });
        }
      }

      try {
        const result = quarter.solveQuarterWave(input);
        verifyTwoPlacements('quarter', result, input);
        for (const branch of result.branches) {
          if (!(branch.transformerZ0 > 0 && Number.isFinite(branch.transformerZ0)
            && branch.transformerLength === 0.25)) {
            failures.push({ name: 'quarter', error: 'Expected a finite positive quarter-wave transformer.', input });
          }
          const placed = transferLine(impedance, z0, branch.distance);
          verify('quarter', transferLine(placed, branch.transformerZ0, branch.transformerLength), z0, input);
        }
      } catch (error) {
        failures.push({ name: 'quarter', input, error: String(error) });
      }

      const doubleInput = {
        z0, stub1Z0: stubZ0, stub2Z0: 10 + random() * 190, load,
        distance: random() * 0.5, separation: 0.01 + random() * 0.48,
      };
      try {
        // Independent geometry classification prevents an empty branch array
        // from passing vacuously. These seeded cases are not tangent/half-wave.
        const rightImpedance = transferLine(impedance, z0, doubleInput.distance);
        const rightConductance = z0 * reciprocal(rightImpedance).re;
        const maxConductance = 1 / Math.sin(2 * Math.PI * doubleInput.separation) ** 2;
        const expectedStatus = rightConductance < maxConductance ? 'solved' : 'forbidden';
        const expectedBranches = expectedStatus === 'solved' ? 2 : 0;
        doubleCases[expectedStatus] += 1;
        const result = double.solveDoubleStub(doubleInput);
        if (result.status !== expectedStatus || result.branches.length !== expectedBranches) {
          failures.push({ name: 'double', error: 'Result disagrees with independent conductance-limit classification.',
            expectedStatus, expectedBranches, status: result.status,
            branches: result.branches.length, input: doubleInput });
        }
        for (const branch of result.branches) {
          for (const termination1 of TERMINATIONS) {
            for (const termination2 of TERMINATIONS) {
              const stub2 = stubContribution(
                doubleInput.stub2Z0, stubLength(branch.stub2, termination2), termination2, false,
              );
              let final = addShunt(rightImpedance, stub2);
              final = transferLine(final, z0, doubleInput.separation);
              const stub1 = stubContribution(
                doubleInput.stub1Z0, stubLength(branch.stub1, termination1), termination1, false,
              );
              final = addShunt(final, stub1);
              verify('double', final, z0, doubleInput);
            }
          }
        }
      } catch (error) {
        failures.push({ name: 'double', input: doubleInput, error: String(error) });
      }
    }

    const allElements = ['L', 'C'].flatMap(component =>
      ['series', 'parallel'].map(connection => ({ component, connection })));
    for (const source of allElements) {
      for (const loadElement of allElements) {
        if (source.connection === loadElement.connection) continue;
        for (let index = 0; index < 200; index += 1) {
          const elements = [source, loadElement];
          const z0 = 10 + random() * 190;
          const frequencyHz = 1e6 + random() * 1e10;
          const omega = 2 * Math.PI * frequencyHz;
          const signed = elements.map(element =>
            ((element.component === 'L') === (element.connection === 'series') ? 1 : -1)
            * (0.05 + 3 * random()));
          // Undo known positive components from a matched input to generate a
          // physically matchable load, without any production transformation.
          let impedance = complex(z0);
          for (let elementIndex = 0; elementIndex < 2; elementIndex += 1) {
            impedance = elements[elementIndex].connection === 'series'
              ? add(impedance, complex(0, -signed[elementIndex] * z0))
              : addShunt(impedance, -signed[elementIndex] / z0);
          }
          const input = { z0, frequencyHz, elements,
            load: { kind: 'impedance', resistance: impedance.re, reactance: impedance.im } };
          try {
            const result = lumped.solveLumpedMatching(input);
            if (result.status !== 'solved' || result.branches.length !== 1) {
              failures.push({ name: 'lumped', error: 'Expected one positive finite realization of the generated circuit.',
                status: result.status, branches: result.branches.length, input });
            }
            for (const branch of result.branches) {
              if (branch.elements.some((element, elementIndex) =>
                !(element.value > 0 && Number.isFinite(element.value))
                || element.component !== elements[elementIndex].component
                || element.connection !== elements[elementIndex].connection)) {
                failures.push({ name: 'lumped',
                  error: 'Expected positive finite components in the selected physical order.', input });
              }
              let final = impedance;
              for (const elementIndex of [1, 0]) {
                const element = branch.elements[elementIndex];
                const reactance = element.component === 'L'
                  ? omega * element.value : -1 / (omega * element.value);
                final = element.connection === 'series'
                  ? add(final, complex(0, reactance)) : addShunt(final, -1 / reactance);
              }
              verify('lumped', final, z0, input);
            }
          } catch (error) {
            failures.push({ name: 'lumped', input, error: String(error) });
          }
        }
      }
    }

    for (const [name, expected] of Object.entries(EXPECTED_COUNTS)) {
      if (counts[name] !== expected) failures.push({ name,
        error: 'The deterministic realization count changed.', expected, actual: counts[name] });
    }
    return { seed: `0x${INITIAL_SEED.toString(16)}`, residualTolerance: RESIDUAL_TOLERANCE,
      counts, doubleCases, maxResidual, failures };
  } finally {
    await server.close();
  }
}

let result;
try {
  result = await auditModels();
} catch (error) {
  result = { failures: [{ name: 'initialization', error: String(error) }] };
}
console.log(JSON.stringify(result, null, 2));
if (result.failures.length > 0) process.exitCode = 1;
