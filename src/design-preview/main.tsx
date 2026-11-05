import React from 'react';
import ReactDOM from 'react-dom/client';
import 'katex/dist/katex.min.css';
import '../styles/global.css';
import { I18nProvider } from '../i18n';
import { DesignPreview } from './DesignPreview';
import './preview-shell.css';
import './workspace.css';

const initialLocale = new URLSearchParams(window.location.search).get('locale') === 'en' ? 'en' : 'es';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider initialLocale={initialLocale} persistLocale={false}><DesignPreview /></I18nProvider>
  </React.StrictMode>,
);
