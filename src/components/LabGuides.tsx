import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { doubleStubGuide, laboratoryGuides, lcMatchingGuide, quarterWaveGuide, seriesStubGuide, singleStubGuide } from '../content/guides';
import type { GuideMetadata } from '../content/guides';
import { useI18n } from '../i18n';
import '../guides.css';

const SingleStubGuideContent = lazy(() => import('./SingleStubGuide').then(module => ({ default: module.SingleStubGuideContent })));
const SeriesStubGuideContent = lazy(() => import('./SeriesStubGuide').then(module => ({ default: module.SeriesStubGuideContent })));
const LCMatchingGuideContent = lazy(() => import('./LCMatchingGuide').then(module => ({ default: module.LCMatchingGuideContent })));
const QuarterWaveGuideContent = lazy(() => import('./QuarterWaveGuide').then(module => ({ default: module.QuarterWaveGuideContent })));
const DoubleStubGuideContent = lazy(() => import('./DoubleStubGuide').then(module => ({ default: module.DoubleStubGuideContent })));

function LinkArrow() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10H16M11 5L16 10L11 15" /></svg>;
}

export function GuidesLanding() {
  const { t } = useI18n();
  return (
    <section className="guide-index" aria-labelledby="guide-index-title">
      <h1 id="guide-index-title">{t('Guides', 'Guías')}</h1>
      {laboratoryGuides.map((guide) => (
        <article className="guide-entry" key={guide.href}>
          <h2>{t(guide.title, guide.titleEs)}</h2>
          <div className="guide-entry__links">
            <a className="guide-link guide-link--primary" href={guide.href}>{t('Read guide', 'Leer guía')}<LinkArrow /></a>
            <a className="guide-link" href={guide.labHref}>{t('Open lab', 'Abrir laboratorio')}<LinkArrow /></a>
          </div>
        </article>
      ))}
    </section>
  );
}

export function GuidePage({ guide, id, children }: { guide: GuideMetadata; id: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <article className="guide-page" aria-labelledby={id + '-title'}>
      <a className="guide-back" href="#/guides"><span aria-hidden="true">←</span>{t('All guides', 'Todas las guías')}</a>
      <header className="guide-page__header">
        <h1 id={id + '-title'}>{t(guide.title, guide.titleEs)}</h1>
        <a className="guide-link guide-link--primary" href={guide.labHref}>{t('Open lab', 'Abrir laboratorio')}<LinkArrow /></a>
      </header>
      <section className="guide-content" aria-labelledby={id + '-content-title'}>
        <h2 id={id + '-content-title'} className="guide-visually-hidden">{t('Guide contents', 'Contenido de la guía')}</h2>
        <Suspense fallback={<p className="muted" role="status">{t('Loading guide…', 'Cargando guía…')}</p>}>{children}</Suspense>
      </section>
    </article>
  );
}

export function SingleStubGuidePage() {
  return <GuidePage guide={singleStubGuide} id="single-stub-guide"><SingleStubGuideContent /></GuidePage>;
}

export function SeriesStubGuidePage() {
  return <GuidePage guide={seriesStubGuide} id="series-stub-guide"><SeriesStubGuideContent /></GuidePage>;
}

export function LCMatchingGuidePage() {
  return <GuidePage guide={lcMatchingGuide} id="lc-matching-guide"><LCMatchingGuideContent /></GuidePage>;
}

export function QuarterWaveGuidePage() {
  return <GuidePage guide={quarterWaveGuide} id="quarter-wave-guide"><QuarterWaveGuideContent /></GuidePage>;
}

export function DoubleStubGuidePage() {
  return <GuidePage guide={doubleStubGuide} id="double-stub-guide"><DoubleStubGuideContent /></GuidePage>;
}
