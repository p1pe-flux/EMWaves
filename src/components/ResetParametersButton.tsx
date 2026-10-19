import { useI18n } from '../i18n';

export function ResetParametersButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return <button type="button" className="icon-button parameter-reset" onClick={onClick} aria-label={t('Reset', 'Restablecer')} title={t('Reset to initial values', 'Restablecer los valores iniciales')}>
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2.6 8.4" /><path d="M3 4v6h6" /></svg>
  </button>;
}
