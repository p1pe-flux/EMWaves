import { useId } from 'react';
import type { LumpedMatchingTopology } from '../domain/lumpedMatching';
import { useI18n } from '../i18n';
import './lc-network-options.css';

export interface LCNetworkOptionsProps {
  value: LumpedMatchingTopology;
  onChange: (value: LumpedMatchingTopology) => void;
}

export function LCNetworkOptions({ value, onChange }: LCNetworkOptionsProps) {
  const { t } = useI18n();
  const groupId = useId();

  return <div className="lc-network-options">
    {([0, 1] as const).map((index) => {
      const element = value.elements[index];
      const update = (patch: Partial<typeof element>) => onChange({
        ...value,
        elements: index === 0
          ? [{ ...element, ...patch }, value.elements[1]]
          : [value.elements[0], { ...element, ...patch }],
      });
      const number = index + 1;
      return <fieldset className="lc-network-options__section" key={index}>
        <legend>{t('Component', 'Componente')} {number}<span className="lc-network-options__position">{index === 0 ? t('generator side', 'lado del generador') : t('load side', 'lado de la carga')}</span></legend>
        <div className="lc-network-options__choices" role="group" aria-label={t('Component ' + number + ' type', 'Tipo del componente ' + number)}>
          {(['L', 'C'] as const).map((component) => <label key={component}>
            <input
              type="radio"
              name={groupId + '-type-' + index}
              value={component}
              checked={element.component === component}
              aria-label={t('Component ' + number + ': ' + (component === 'L' ? 'inductor' : 'capacitor'), 'Componente ' + number + ': ' + (component === 'L' ? 'inductor' : 'capacitor'))}
              onChange={() => update({ component })}
            />
            {component === 'L' ? t('Inductor', 'Inductor') : t('Capacitor', 'Capacitor')}
          </label>)}
        </div>
        <div className="lc-network-options__choices" role="group" aria-label={t('Component ' + number + ' connection', 'Conexión del componente ' + number)}>
          {(['series', 'parallel'] as const).map((connection) => <label key={connection}>
            <input
              type="radio"
              name={groupId + '-connection-' + index}
              value={connection}
              checked={element.connection === connection}
              aria-label={t('Component ' + number + ' in ' + connection, 'Componente ' + number + ' en ' + (connection === 'series' ? 'serie' : 'paralelo'))}
              onChange={() => update({ connection })}
            />
            {connection === 'series' ? t('Series', 'Serie') : t('Parallel', 'Paralelo')}
          </label>)}
        </div>
      </fieldset>;
    })}
  </div>;
}
