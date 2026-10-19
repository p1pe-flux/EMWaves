import { impedanceToReflection, type ComplexValue } from './transmission';

const SEGMENTS = 192;
const FULL_TURN = 2 * Math.PI;

type Sample = { parameter: number; point: ComplexValue };

function sinc(angle: number): number {
  return angle === 0 ? 1 : Math.sin(angle) / angle;
}

function atanRatio(value: number): number {
  return value === 0 ? 1 : Math.atan(value) / value;
}

/**
 * Constant-resistance circle and visible constant-reactance arc through a load.
 * Coordinates are reflection coefficients, independent of display dimensions.
 * Both arrays include the exact result of impedanceToReflection(z), in curve order.
 */
export function loadCurves(z: ComplexValue | null): {
  resistance: ComplexValue[];
  reactance: ComplexValue[];
} | null {
  if (z === null) return null;
  // Reuse the model's finite/passive validation and exact load coordinates.
  const load = impedanceToReflection(z);
  const radius = 1 / (1 + z.re);
  const center = 1 - radius;
  const loadAngle = Math.atan2(load.im, load.re - center);
  const resistanceSamples: Sample[] = Array.from({ length: SEGMENTS }, (_, index) => {
    const angle = FULL_TURN * index / SEGMENTS;
    return {
      parameter: angle,
      point: index === 0 ? { re: 1, im: 0 } : {
        re: center + radius * Math.cos(angle),
        im: radius * Math.sin(angle),
      },
    };
  });
  resistanceSamples.push({ parameter: loadAngle < 0 ? loadAngle + FULL_TURN : loadAngle, point: load });
  resistanceSamples.sort((a, b) => a.parameter - b.parameter);
  const resistance = resistanceSamples.map(({ point }) => point);
  resistance.push({ ...resistance[0] });

  const magnitude = Math.abs(z.im);
  const sign = Math.sign(z.im);
  const maxAngle = Math.atan(magnitude);
  const angleOverReactance = atanRatio(magnitude);

  /**
   * With t = r + 1 and θ = atan(|x|/t), Γ = 1 - 2/(t + jx):
   * Re Γ = 1 - sin(2θ)/|x|, Im Γ = sign(x)·2sin²(θ)/|x|.
   * θ = u·atan(|x|) samples the visible circle arc uniformly by angle.
   * Factoring θ/|x| and sinc avoids huge 1/x circles and cancellation near x=0.
   * Its continuous x=0 limit is exactly the diameter Γ = 1 - 2u.
   */
  function reactancePoint(u: number): ComplexValue {
    const angle = u * maxAngle;
    const ratio = u * angleOverReactance;
    return {
      re: 1 - 2 * ratio * sinc(2 * angle),
      im: sign * 2 * ratio * Math.sin(angle) * sinc(angle),
    };
  }

  const reactanceSamples: Sample[] = Array.from({ length: SEGMENTS - 1 }, (_, index) => {
    const u = 1 - (index + 1) / SEGMENTS;
    return { parameter: u, point: reactancePoint(u) };
  });
  const reciprocalT = 1 / (1 + z.re);
  // The ratio form also works for subnormal x where x/(1+r) underflows to zero.
  const loadParameter = magnitude <= 1
    ? reciprocalT * atanRatio(magnitude * reciprocalT) / angleOverReactance
    : Math.atan(magnitude * reciprocalT) / maxAngle;
  reactanceSamples.push({ parameter: loadParameter, point: load });
  reactanceSamples.sort((a, b) => b.parameter - a.parameter);
  const reactance = [
    impedanceToReflection({ re: 0, im: z.im }),
    ...reactanceSamples.map(({ point }) => point),
    { re: 1, im: 0 },
  ];

  return { resistance, reactance };
}
