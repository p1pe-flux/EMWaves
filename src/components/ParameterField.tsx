import { Formula } from './Formula';
import '../parameter-panel.css';

export interface ParameterFieldProps {
  label: string;
  tex: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  disabled?: boolean;
  min?: number;
  wide?: boolean;
  id?: string;
}

export function ParameterField({ label, tex, value, onChange, unit = 'Ω', disabled = false, min, wide = false, id }: ParameterFieldProps) {
  return <label className={'parameter-field' + (wide ? ' parameter-field--wide' : '')} htmlFor={id} title={label}>
    <span><Formula tex={tex} /></span>
    <div className="number-field"><input id={id} aria-label={label} type="number" step="any" min={min} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} /><span>{unit}</span></div>
  </label>;
}
