import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import SingleStubMatching from '../labs/SingleStubMatching';
import { Catalog } from './Catalog';
import { StudyGuide } from './StudyGuide';

type Design = 'editorial' | 'precision';
type Screen = 'home' | 'lab' | 'guide';
type Device = 'desktop' | 'mobile';

const designs: { id: Design; name: string }[] = [
  { id: 'editorial', name: 'Warm Paper' },
  { id: 'precision', name: 'Precision Studio' },
];

function initialChoice<T extends string>(key: string, options: readonly T[], fallback: T): T {
  const value = new URLSearchParams(window.location.search).get(key);
  return options.includes(value as T) ? value as T : fallback;
}

function BrandMark() {
  return <svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="20" cy="20" r="17" /><circle cx="28" cy="20" r="9" /><path d="M3 20h34M9 7c0 13 11 13 28 13M9 33c0-13 11-13 28-13" /><circle className="preview-brand__point" cx="16" cy="12" r="3" /></svg>;
}

function DeviceIcon({ mobile }: { mobile?: boolean }) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">{mobile ? <><rect x="5" y="2" width="10" height="16" rx="2" /><path d="M8 15h4" /></> : <><rect x="2" y="3" width="16" height="11" rx="1.5" /><path d="M7 18h6M10 14v4" /></>}</svg>;
}

export function DesignPreview() {
  const { t, locale, setLocale } = useI18n();
  const [design, setDesign] = useState<Design>(() => initialChoice('design', ['editorial', 'precision'], 'editorial'));
  const [screen, setScreen] = useState<Screen>(() => initialChoice('screen', ['home', 'lab', 'guide'], 'home'));
  const [device, setDevice] = useState<Device>(() => initialChoice('device', ['desktop', 'mobile'], 'desktop'));
  const [replay, setReplay] = useState(0);
  const page = useRef<HTMLDivElement>(null);
  const previousScreen = useRef(screen);
  const activeDesign = designs.find((direction) => direction.id === design) ?? designs[0];

  useEffect(() => {
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({ design: activeDesign.id, screen, device, locale }).toString();
    if (screen !== 'guide') url.hash = '';
    window.history.replaceState(null, '', url);
    document.title = `EMWaves — ${activeDesign.name}`;
  }, [design, screen, device, locale, activeDesign.name]);

  useEffect(() => {
    if (previousScreen.current !== screen) {
      page.current?.focus({ preventScroll: true });
      document.querySelector('.review-toolbar')?.scrollIntoView({ behavior: 'instant', block: 'start' });
      previousScreen.current = screen;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = page.current?.animate(
      [{ opacity: 0.45, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 280, easing: 'cubic-bezier(.2,.7,.2,1)' },
    );
    // Decorative replay never changes the construction's step or progress.
    const traces = page.current?.getAnimations({ subtree: true }).filter((item) => item instanceof CSSAnimation && item.animationName.startsWith('pv-catalog')) ?? [];
    traces.forEach((item) => { item.cancel(); item.play(); });
    return () => { animation?.cancel(); };
  }, [design, screen, replay]);

  const openLab = () => setScreen('lab');
  const openGuide = () => setScreen('guide');

  return <div className="design-review">
    <a className="review-skip" href="#prototype-content">{t('Skip to prototype', 'Ir al prototipo')}</a>
    <header className="review-header">
      <div className="review-heading"><span className="review-eyebrow">EMWAVES <span>/</span> {t('DESIGN', 'DISEÑO')}</span></div>
      <div className="review-directions" role="group" aria-label={t('Design direction', 'Dirección de diseño')}>
        {designs.map((direction) => <button key={direction.id} type="button" aria-pressed={activeDesign.id === direction.id} onClick={() => setDesign(direction.id)} data-direction={direction.id}><span>{direction.name}</span><span className="review-direction-dot" aria-hidden="true" /></button>)}
      </div>
    </header>

    <div className="review-toolbar">
      <div className="review-screens" role="group" aria-label={t('Preview screen', 'Pantalla de vista previa')}>
        {([['home', 'Catalog', 'Catálogo'], ['lab', 'Laboratory', 'Laboratorio'], ['guide', 'Guide', 'Guía']] as const).map(([id, en, es]) => <button type="button" key={id} aria-pressed={screen === id} onClick={() => setScreen(id)}>{t(en, es)}</button>)}
      </div>
      <div className="review-tools">
        <div className="review-devices" role="group" aria-label={t('Preview size', 'Tamaño de vista previa')}>
          <button type="button" aria-pressed={device === 'desktop'} aria-label={t('Desktop view', 'Vista de escritorio')} title={t('Desktop', 'Escritorio')} onClick={() => setDevice('desktop')}><DeviceIcon /></button>
          <button type="button" aria-pressed={device === 'mobile'} aria-label={t('Mobile view', 'Vista móvil')} title={t('Mobile · 390 px', 'Móvil · 390 px')} onClick={() => setDevice('mobile')}><DeviceIcon mobile /></button>
        </div>
        <button className="review-replay" type="button" onClick={() => setReplay((value) => value + 1)} title={t('Replay interface motion; keeps your lab step', 'Repetir el movimiento de la interfaz; conserva el paso')}><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 6a7 7 0 1 1-1 7M4 2v5h5" /></svg><span>{t('Replay motion', 'Repetir movimiento')}</span></button>
        <label className="review-language"><span className="parameter-visually-hidden">{t('Language', 'Idioma')}</span><select aria-label={t('Language', 'Idioma')} value={locale} onChange={(event) => setLocale(event.target.value === 'en' ? 'en' : 'es')}><option value="es">ES</option><option value="en">EN</option></select></label>
      </div>
    </div>

    <div className="preview-stage" data-device={device}>
      <div className="prototype-viewport" data-device={device}>
        <div className="design-preview" data-design={activeDesign.id} lang={locale}>
          <header className="preview-product-header">
            <button className="preview-brand" type="button" onClick={() => setScreen('home')} aria-label={t('EMWaves home', 'Inicio de EMWaves')}><BrandMark /><span>EM<span>Waves</span></span></button>
            <nav aria-label={t('Prototype navigation', 'Navegación del prototipo')}><button type="button" aria-current={screen !== 'guide' ? 'page' : undefined} onClick={() => setScreen('home')}>{t('Laboratories', 'Laboratorios')}</button><button type="button" aria-current={screen === 'guide' ? 'page' : undefined} onClick={openGuide}>{t('Guides', 'Guías')}</button></nav>
          </header>
          <main id="prototype-content" className="preview-product-main">
            <div className="preview-page" ref={page} tabIndex={-1}>
              {screen === 'home' ? <Catalog onOpenLab={openLab} /> : screen === 'guide' ? <StudyGuide onOpenLab={openLab} /> : <>
                <div className="preview-lab-heading"><button type="button" className="preview-back" onClick={() => setScreen('home')}><span aria-hidden="true">↖</span>{t('All laboratories', 'Todos los laboratorios')}</button><div className="preview-lab-title"><h1>{t('Single-stub matching', 'Adaptación con un stub')}</h1><button className="preview-guide-link" type="button" onClick={openGuide}>{t('Read guide', 'Leer guía')}<span aria-hidden="true">↗</span></button></div></div>
                <div className="prototype-lab"><SingleStubMatching /></div>
              </>}
            </div>
          </main>
          <footer className="preview-product-footer"><span>EMWaves <span>© {new Date().getFullYear()}</span></span></footer>
        </div>
      </div>
    </div>
    <footer className="review-footer"><a href="/" target="_blank" rel="noreferrer">{t('Current application', 'Aplicación actual')} ↗</a></footer>
  </div>;
}
