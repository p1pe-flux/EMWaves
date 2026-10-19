import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { LabLanding } from './components/LabLanding';
import { useI18n } from './i18n';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';

const SmithIntroduction = lazy(() => import('./labs/SmithIntroduction'));
const SingleStubMatching = lazy(() => import('./labs/SingleStubMatching'));
const SeriesStubMatching = lazy(() => import('./labs/SeriesStubMatching'));
const LCMatching = lazy(() => import('./labs/LCMatching'));
const QuarterWaveTransformer = lazy(() => import('./labs/QuarterWaveTransformer'));
const DoubleStubMatching = lazy(() => import('./labs/DoubleStubMatching'));
const GuidesLanding = lazy(() => import('./components/LabGuides').then((module) => ({ default: module.GuidesLanding })));
const SmithGuidePage = lazy(() => import('./components/SmithGuidePage').then((module) => ({ default: module.SmithGuidePage })));
const SingleStubGuidePage = lazy(() => import('./components/LabGuides').then((module) => ({ default: module.SingleStubGuidePage })));
const SeriesStubGuidePage = lazy(() => import('./components/LabGuides').then((module) => ({ default: module.SeriesStubGuidePage })));
const LCMatchingGuidePage = lazy(() => import('./components/LabGuides').then((module) => ({ default: module.LCMatchingGuidePage })));
const QuarterWaveGuidePage = lazy(() => import('./components/LabGuides').then((module) => ({ default: module.QuarterWaveGuidePage })));
const DoubleStubGuidePage = lazy(() => import('./components/LabGuides').then((module) => ({ default: module.DoubleStubGuidePage })));

type Page = 'laboratories' | 'smith-introduction' | 'single-stub' | 'series-stub' | 'lc-matching' | 'quarter-wave' | 'double-stub' | 'guides' | 'smith-guide' | 'single-stub-guide' | 'series-stub-guide' | 'lc-matching-guide' | 'quarter-wave-guide' | 'double-stub-guide';

const pageTitles: Record<Page, readonly [string, string]> = {
  laboratories: ['Interactive Electromagnetics Laboratories', 'Laboratorios interactivos de electromagnetismo'],
  'smith-introduction': ['Introduction to Smith Chart', 'Introducción al diagrama de Smith'],
  'single-stub': ['Single-Stub Matching', 'Adaptación con un stub'],
  'series-stub': ['Series-Stub Matching', 'Adaptación con un stub en serie'],
  'lc-matching': ['LC Matching', 'Adaptación con L y C'],
  'quarter-wave': ['Quarter-Wave Transformer', 'Transformador de cuarto de onda'],
  'double-stub': ['Double-Stub Matching', 'Adaptación con dos stubs'],
  guides: ['Guides', 'Guías'],
  'smith-guide': ['Introduction to Smith Chart Guide', 'Guía del diagrama de Smith'],
  'single-stub-guide': ['Single-Stub Matching Guide', 'Guía de adaptación con un stub'],
  'series-stub-guide': ['Series-Stub Matching Guide', 'Guía de adaptación con un stub en serie'],
  'lc-matching-guide': ['LC Matching Guide', 'Guía de adaptación con L y C'],
  'quarter-wave-guide': ['Quarter-Wave Transformer Guide', 'Guía del transformador de cuarto de onda'],
  'double-stub-guide': ['Double-Stub Matching Guide', 'Guía de adaptación con dos stubs'],
};

const routes: Record<Exclude<Page, 'laboratories'>, string> = {
  'smith-introduction': '#/labs/introduction-to-smith-chart',
  'single-stub': '#/labs/single-stub-matching',
  'series-stub': '#/labs/series-stub-matching',
  'lc-matching': '#/labs/lc-matching',
  'quarter-wave': '#/labs/quarter-wave-transformer',
  'double-stub': '#/labs/double-stub-matching',
  guides: '#/guides',
  'smith-guide': '#/guides/introduction-to-smith-chart',
  'single-stub-guide': '#/guides/single-stub-matching',
  'series-stub-guide': '#/guides/series-stub-matching',
  'lc-matching-guide': '#/guides/lc-matching',
  'quarter-wave-guide': '#/guides/quarter-wave-transformer',
  'double-stub-guide': '#/guides/double-stub-matching',
};

export function pageForHash(hash: string): Page {
  const normalized = hash.replace(/\/$/, '');
  for (const [page, route] of Object.entries(routes)) {
    if (normalized === route) return page as Exclude<Page, 'laboratories'>;
  }
  return 'laboratories';
}

function currentPage(): Page {
  return typeof window === 'undefined' ? 'laboratories' : pageForHash(window.location.hash);
}

export default function App() {
  const { locale, setLocale, t } = useI18n();
  const [page, setPage] = useState(currentPage);
  const isGuidesPage = page === 'guides' || page === 'smith-guide' || page === 'single-stub-guide' || page === 'series-stub-guide' || page === 'lc-matching-guide' || page === 'quarter-wave-guide' || page === 'double-stub-guide';
  const isSingleStub = page === 'single-stub';
  const isSeriesStub = page === 'series-stub';
  const isLCMatching = page === 'lc-matching';
  const isQuarterWave = page === 'quarter-wave';
  const isDoubleStub = page === 'double-stub';
  const guideHref = isDoubleStub ? '#/guides/double-stub-matching' : isQuarterWave ? '#/guides/quarter-wave-transformer' : isLCMatching ? '#/guides/lc-matching' : isSeriesStub ? '#/guides/series-stub-matching' : isSingleStub ? '#/guides/single-stub-matching' : '#/guides/introduction-to-smith-chart';
  const labTitle = isDoubleStub ? t('Double-Stub Matching', 'Adaptación con dos stubs') : isQuarterWave ? t('Quarter-Wave Transformer', 'Transformador de cuarto de onda') : isLCMatching ? t('LC Matching', 'Adaptación con L y C') : isSeriesStub ? t('Series-Stub Matching', 'Adaptación con un stub en serie') : isSingleStub ? t('Single-Stub Matching', 'Adaptación con un stub') : t('Introduction to Smith Chart', 'Introducción al diagrama de Smith');
  const main = useRef<HTMLElement>(null);
  const previousPage = useRef(page);

  useEffect(() => {
    const navigate = () => {
      const nextPage = currentPage();
      const canonical = nextPage === 'laboratories' ? '#/' : routes[nextPage];
      if (window.location.hash !== canonical) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search + canonical);
      }
      setPage(nextPage);
    };
    navigate();
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);

  useEffect(() => {
    document.title = `EMWaves ${__APP_VERSION__} — ` + t(...pageTitles[page]);
    if (previousPage.current !== page) {
      main.current?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
      previousPage.current = page;
    }
  }, [page, t]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content" onClick={(event) => {
        event.preventDefault();
        main.current?.focus();
      }}>{t('Skip to content', 'Ir al contenido')}</a>
      <header className="app-header">
        <a className="brand" href="#/" aria-label={t('EMWaves home', 'Inicio de EMWaves')}>
          <svg className="brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="20" cy="20" r="17" /><circle cx="28" cy="20" r="9" /><path d="M3 20h34M9 7c0 13 11 13 28 13M9 33c0-13 11-13 28-13" /><circle className="brand-mark__point" cx="16" cy="12" r="3" /></svg>
          <span>EM<span className="brand-light">Waves</span></span>
        </a>
        <nav className="main-nav" aria-label={t('Main navigation', 'Navegación principal')}>
          <a className={'nav-item nav-link' + (!isGuidesPage ? ' active' : '')} href="#/" aria-current={!isGuidesPage ? 'page' : undefined}>{t('Laboratories', 'Laboratorios')}</a>
          <a className={'nav-item nav-link' + (isGuidesPage ? ' active' : '')} href="#/guides" aria-current={isGuidesPage ? 'page' : undefined}>{t('Guides', 'Guías')}</a>
        </nav>
      </header>

      <main id="main-content" ref={main} tabIndex={-1} className={page === 'laboratories' ? 'catalog-main' : 'lab-main'}>
        <RouteErrorBoundary key={page}>
        {page === 'laboratories' ? <LabLanding /> : isGuidesPage ? (
          <Suspense fallback={<p className="muted" role="status">{t('Loading guide…', 'Cargando guía…')}</p>}>
            {page === 'guides' ? <GuidesLanding /> : page === 'double-stub-guide' ? <DoubleStubGuidePage /> : page === 'quarter-wave-guide' ? <QuarterWaveGuidePage /> : page === 'lc-matching-guide' ? <LCMatchingGuidePage /> : page === 'series-stub-guide' ? <SeriesStubGuidePage /> : page === 'single-stub-guide' ? <SingleStubGuidePage /> : <SmithGuidePage />}
          </Suspense>
        ) : (
          <>
            <div className="lab-page-heading">
              <a className="back-to-labs" href="#/"><span aria-hidden="true">←</span> {t('All laboratories', 'Todos los laboratorios')}</a>
              <div className="lab-page-title">
                <div><span className="section-kicker">{isLCMatching ? t('Impedance matching', 'Adaptación de impedancias') : t('Transmission lines', 'Líneas de transmisión')}</span><h1>{labTitle}</h1></div>
                <a className="read-guide-button" href={guideHref}>{t('Read guide', 'Leer guía')}</a>
              </div>
            </div>
            <div className="lab-with-guide">
              <div className="lab-workspace">
                <Suspense fallback={<p className="muted" role="status">{t('Loading laboratory…', 'Cargando laboratorio…')}</p>}>
                  {isDoubleStub ? <DoubleStubMatching /> : isQuarterWave ? <QuarterWaveTransformer /> : isLCMatching ? <LCMatching /> : isSeriesStub ? <SeriesStubMatching /> : isSingleStub ? <SingleStubMatching /> : <SmithIntroduction />}
                </Suspense>
              </div>
            </div>
          </>
        )}
        </RouteErrorBoundary>
      </main>
      <footer className="app-footer app-language-footer">
        <small className="app-copyright">© {new Date().getFullYear()} EMWaves</small>
        <label className="language-picker" htmlFor="app-language">
          <span>{t('Language', 'Idioma')}</span>
          <select id="app-language" value={locale} onChange={(event) => setLocale(event.target.value === 'es' ? 'es' : 'en')}>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </label>
      </footer>
    </div>
  );
}
