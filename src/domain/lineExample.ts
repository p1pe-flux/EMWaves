import { DomainError } from './errors';
import { solveLine, type ComplexValue, type LineSolution } from './transmission';

/** A one-wavelength lossless line; positions are measured from its load. */
export const LINE_EXAMPLE = Object.freeze({
  z0: 50,
  load: Object.freeze({ kind: 'impedance', resistance: 100, reactance: 50 } as const),
  lengthInWavelengths: 1,
} as const);

export type LineExampleSolution = {
  solution: LineSolution;
  normalizedInput: ComplexValue | null;
  /** Principal argument of the local reflection coefficient Γ(ℓ), in radians. */
  inputPhase: number | null;
};

/** See the fixed load through a line segment of length distanceInWavelengths·λ. */
export function solveLineExample(distanceInWavelengths: number): LineExampleSolution {
  if (!Number.isFinite(distanceInWavelengths)
    || distanceInWavelengths < 0 || distanceInWavelengths > LINE_EXAMPLE.lengthInWavelengths) {
    throw new DomainError('example.invalid-position');
  }
  const solution = solveLine({ ...LINE_EXAMPLE, lengthInWavelengths: distanceInWavelengths });
  const normalizedInput = solution.inputImpedance === null ? null : {
    re: solution.inputImpedance.re / LINE_EXAMPLE.z0,
    im: solution.inputImpedance.im / LINE_EXAMPLE.z0,
  };
  const gamma = solution.inputReflection;
  const phase = gamma.re === 0 && gamma.im === 0 ? null
    : Math.atan2(gamma.im === 0 ? 0 : gamma.im, gamma.re === 0 ? 0 : gamma.re);
  return { solution, normalizedInput, inputPhase: phase === 0 ? 0 : phase };
}
