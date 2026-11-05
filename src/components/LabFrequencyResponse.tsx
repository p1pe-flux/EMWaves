import { useMemo } from 'react';
import { createFrequencyResponse, type FrequencyResponseDesign } from '../domain/frequencyResponse';
import { FrequencyResponsePanel } from './FrequencyResponsePanel';
import { useI18n } from '../i18n';

interface Props {
  design: FrequencyResponseDesign | null;
  designFrequencyHz: number;
  emptyMessage?: string;
}

export function LabFrequencyResponse({ design, designFrequencyHz, emptyMessage }: Props) {
  const { t } = useI18n();
  // Explorer playback and language changes preserve the same physical network.
  const designKey = JSON.stringify(design);
  const response = useMemo(() => {
    try { return { branches: design ? createFrequencyResponse(design) : [], invalid: false }; }
    catch { return { branches: [], invalid: true }; }
  }, [designKey]);
  return <FrequencyResponsePanel branches={response.branches} designFrequencyHz={designFrequencyHz} emptyMessage={response.invalid
    ? t('These parameters exceed the numeric range of the frequency response. Adjust the electrical parameters.', 'Estos parámetros exceden el rango numérico de la respuesta en frecuencia. Ajusta los parámetros eléctricos.')
    : emptyMessage} />;
}
