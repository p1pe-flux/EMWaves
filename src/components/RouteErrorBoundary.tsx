import { Component } from 'react';
import type { ReactNode } from 'react';
import { useI18n } from '../i18n';

function RouteErrorFallback() {
  const { t } = useI18n();
  return <section className="route-error" role="alert" aria-labelledby="route-error-title">
    <h2 id="route-error-title">{t('Could not open this content', 'No se pudo abrir este contenido')}</h2>
    <p>{t('Try again by reloading the application.', 'Vuelve a intentarlo recargando la aplicación.')}</p>
    <div className="route-error__actions">
      <button className="lab-control lab-control--primary" type="button" onClick={() => window.location.reload()}>{t('Reload', 'Recargar')}</button>
      <a href="#/">{t('Return to the catalog', 'Volver al catálogo')}</a>
    </div>
  </section>;
}

export class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    return this.state.failed ? <RouteErrorFallback /> : this.props.children;
  }
}
