import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, LOCALE_STORAGE_KEY, translateMessage, useI18n } from './i18n';

function Reading() {
  const { locale, t } = useI18n();
  return <p data-locale={locale}>{t('Read guide', 'Leer guía')}</p>;
}

afterEach(() => vi.unstubAllGlobals());

describe('application language context', () => {
  it('defaults to English outside a provider even if a browser preference exists', () => {
    const getItem = vi.fn(() => 'es');
    vi.stubGlobal('window', { localStorage: { getItem } });
    expect(renderToStaticMarkup(<Reading />)).toBe('<p data-locale="en">Read guide</p>');
    expect(getItem).not.toHaveBeenCalled();
  });

  it.each(['en', 'es'] as const)('uses an explicit %s locale for server-rendered content', (locale) => {
    const html = renderToStaticMarkup(<I18nProvider initialLocale={locale}><Reading /></I18nProvider>);
    expect(html).toContain('data-locale="' + locale + '"');
    expect(html).toContain(locale === 'es' ? 'Leer guía' : 'Read guide');
  });

  it('restores a valid Spanish browser preference using the shared storage key', () => {
    const getItem = vi.fn(() => 'es');
    vi.stubGlobal('window', { localStorage: { getItem } });
    expect(renderToStaticMarkup(<I18nProvider><Reading /></I18nProvider>)).toBe('<p data-locale="es">Leer guía</p>');
    expect(getItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY);
  });

  it('lets an explicit initial locale override browser storage', () => {
    const getItem = vi.fn(() => 'es');
    vi.stubGlobal('window', { localStorage: { getItem } });
    expect(renderToStaticMarkup(<I18nProvider initialLocale="en"><Reading /></I18nProvider>)).toBe('<p data-locale="en">Read guide</p>');
    expect(getItem).not.toHaveBeenCalled();
  });

  it.each([null, '', 'fr', 'ES', 'es-AR'])('falls back to English for unsupported stored locale %s', (value) => {
    vi.stubGlobal('window', { localStorage: { getItem: () => value } });
    expect(renderToStaticMarkup(<I18nProvider><Reading /></I18nProvider>)).toBe('<p data-locale="en">Read guide</p>');
  });

  it('keeps the default language available when storage access throws', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => { throw new Error('Storage blocked'); } } });
    expect(renderToStaticMarkup(<I18nProvider><Reading /></I18nProvider>)).toBe('<p data-locale="en">Read guide</p>');
    vi.stubGlobal('window', Object.defineProperty({}, 'localStorage', { get: () => { throw new Error('Storage unavailable'); } }));
    expect(renderToStaticMarkup(<I18nProvider><Reading /></I18nProvider>)).toBe('<p data-locale="en">Read guide</p>');
  });

  it('renders without browser globals and preserves unknown messages in either locale', () => {
    expect(renderToStaticMarkup(<I18nProvider><Reading /></I18nProvider>)).toBe('<p data-locale="en">Read guide</p>');
    expect(translateMessage('__unmapped_message__', 'en')).toBe('__unmapped_message__');
    expect(translateMessage('__unmapped_message__', 'es')).toBe('__unmapped_message__');
  });
});
