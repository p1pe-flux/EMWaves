/** Stable numerical error identifiers; English messages remain API-compatible. */
export const DOMAIN_ERROR_MESSAGES = {
  "numeric.range": "These values are outside the reliable numeric range. Use a less extreme load or characteristic-impedance ratio.",
  "numeric.range-with-separation": "These values are outside the reliable numeric range. Use a less extreme load, separation, or characteristic-impedance ratio.",
  "network.negative-lengths": "Distances and stub lengths must be greater than or equal to zero.",
  "transformer.negative-lengths": "Line and transformer lengths must be greater than or equal to zero.",
  "stub.invalid-termination": "Choose an open or short stub termination.",
  "reflection.outside-passive-disk": "The reflection coefficient must lie within the passive disk |Γ| ≤ 1.",
  "line.invalid-total-length": "Total line length must be a finite number greater than or equal to zero.",
  "line.missing-total-length": "Enter the total line length in wavelengths.",
  "line.invalid-position": "Line position must be a finite number.",
  "line.invalid-elapsed-time": "Elapsed time must be a finite number greater than or equal to zero.",
  "example.invalid-position": "The example position must lie between zero and one wavelength.",
  "projection.invalid-progress": "Projection progress must lie between zero and one.",
  "projection.invalid-impedance": "Projection impedance must have finite real and imaginary parts.",
  "projection.invalid-bounds": "Projection bounds must be finite and have positive width and height.",
  "projection.invalid-segments": "Projection segments must be an integer between 16 and 4096.",
  "projection.invalid-grid-values": "Projection grid values must be finite.",
  "lumped.invalid-element-count": "Choose exactly two reactive elements.",
  "lumped.invalid-component": "Choose an inductor or capacitor for each element.",
  "lumped.missing-values": "Provide a value for each of the two elements.",
  "lumped.invalid-connection": "Choose a series or parallel connection for each component.",
  "load.nonfinite-normalized-impedance": "Normalized load impedance must be finite.",
  "load.nonfinite-impedance": "Load impedance must be finite.",
  "line.invalid-characteristic-impedance": "Characteristic impedance must be greater than zero and finite.",
} as const;

export const DOMAIN_VALUE_LABELS = [
  "Element 1 value",
  "Element 2 value",
  "Frequency",
  "Normalized element value",
  "Load-to-stub-2 distance",
  "Stub separation",
  "Stub 1 characteristic impedance",
  "Stub 2 characteristic impedance",
  "Characteristic impedance",
  "Stub characteristic impedance",
  "Transformer characteristic impedance",
  "Line length",
  "Stub length",
  "Transformer length",
  "Distance from the load",
  "Load-to-transformer distance",
  "Resistance",
  "Reactance",
  "Normalized impedance",
  "Reflection coefficient",
  "Calculated impedance",
  "Normalized impedance outside the numeric range",
  "Input impedance outside the numeric range",
] as const;

export type DomainValueLabel = typeof DOMAIN_VALUE_LABELS[number];
export type DomainParameterLabel = DomainValueLabel | `${DomainValueLabel}: real part` | `${DomainValueLabel}: imaginary part`;
export type FixedDomainErrorCode = keyof typeof DOMAIN_ERROR_MESSAGES;
export type ParameterDomainErrorCode = 'value.not-finite' | 'value.not-positive' | 'value.negative';
export type DomainErrorCode = FixedDomainErrorCode | ParameterDomainErrorCode;
export type DomainErrorParams = Readonly<{ label?: DomainParameterLabel }>;
type DomainErrorArguments = [code: FixedDomainErrorCode] | [code: ParameterDomainErrorCode, params: { label: DomainParameterLabel }];

/** A RangeError with structured metadata, independent of presentation locale. */
export class DomainError extends RangeError {
  readonly code: DomainErrorCode;
  readonly params: DomainErrorParams;

  constructor(...args: DomainErrorArguments) {
    const code = args[0];
    const params: DomainErrorParams = args[1] ?? {};
    const suffix = code === 'value.not-finite' ? ' must be a finite number.'
      : code === 'value.not-positive' ? ' must be greater than zero.'
      : code === 'value.negative' ? ' must be greater than or equal to zero.' : null;
    super(suffix === null ? DOMAIN_ERROR_MESSAGES[code as FixedDomainErrorCode] : (params.label ?? '') + suffix);
    this.name = 'DomainError';
    this.code = code;
    this.params = Object.freeze({ ...params });
  }
}
