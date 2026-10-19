import { Formula } from './Formula';
import { ParameterField } from './ParameterField';
import { useI18n } from '../i18n';
import type { StubTermination } from '../domain/singleStub';

interface StubParametersProps {
  id: string;
  mainZ0: string;
  stubZ0: string;
  linked: boolean;
  termination: StubTermination;
  onStubZ0Change: (value: string) => void;
  onLinkedChange: (linked: boolean) => void;
  onTerminationChange: (termination: StubTermination) => void;
}

/** The shunt and series laboratories share the same compact stub settings. */
export function StubParameters({ id, mainZ0, stubZ0, linked, termination, onStubZ0Change, onLinkedChange, onTerminationChange }: StubParametersProps) {
  const { t } = useI18n();
  return <section className="parameter-stub parameter-stub--wide" aria-labelledby={id + '-settings'}>
    <h3 id={id + '-settings'}>Stub</h3>
    <label className="parameter-check"><input type="checkbox" aria-label={t('Same as main line', 'Igual a la línea principal')} checked={linked} onChange={(event) => onLinkedChange(event.target.checked)} /><span>{t('Same as ', 'Igual a ')}<Formula tex="Z_0" /></span></label>
    <ParameterField tex="Z_{0s}" label={t('Stub impedance', 'Impedancia del stub')} value={linked ? mainZ0 : stubZ0} min={0} disabled={linked} onChange={onStubZ0Change} />
    <fieldset className="parameter-termination"><legend className="parameter-visually-hidden">{t('Stub termination', 'Terminación del stub')}</legend>{(['short', 'open'] as const).map((end) => <label key={end}><input type="radio" aria-label={end === 'short' ? t('Short circuit', 'Cortocircuito') : t('Open circuit', 'Circuito abierto')} name={id + '-termination'} checked={termination === end} onChange={() => onTerminationChange(end)} />{end === 'short' ? t('Short', 'Corto') : t('Open', 'Abierto')}</label>)}</fieldset>
  </section>;
}
