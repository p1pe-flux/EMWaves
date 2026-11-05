import { useId } from 'react';
import { useI18n } from '../i18n';
import './catalog.css';

type TopicKind = 'smith' | 'single-stub' | 'series-stub' | 'lc' | 'quarter-wave' | 'double-stub';

const topics: { kind: TopicKind; en: string; es: string; route: string }[] = [
  { kind: 'smith', en: 'Introduction to Smith Chart', es: 'Introducción al diagrama de Smith', route: 'introduction-to-smith-chart' },
  { kind: 'single-stub', en: 'Single-Stub Matching', es: 'Adaptación con un stub', route: 'single-stub-matching' },
  { kind: 'series-stub', en: 'Series-Stub Matching', es: 'Adaptación con un stub en serie', route: 'series-stub-matching' },
  { kind: 'lc', en: 'LC Matching', es: 'Adaptación con L y C', route: 'lc-matching' },
  { kind: 'quarter-wave', en: 'Quarter-Wave Transformer', es: 'Transformador de cuarto de onda', route: 'quarter-wave-transformer' },
  { kind: 'double-stub', en: 'Double-Stub Matching', es: 'Adaptación con dos stubs', route: 'double-stub-matching' },
];

function Arrow({ external = false }: { external?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={external ? 'M6 18 18 6M6 6h12v12' : 'M4 12h16m-6-6 6 6-6 6'} /></svg>;
}

function TopicSchematic({ kind }: { kind: TopicKind }) {
  if (kind === 'smith') return <svg className="pv-topic-schematic" viewBox="0 0 210 88" fill="none" aria-hidden="true">
    <circle className="pv-schematic-muted" cx="104" cy="44" r="35" /><circle className="pv-schematic-muted" cx="121.5" cy="44" r="17.5" /><circle className="pv-schematic-muted" cx="112.75" cy="44" r="26.25" />
    <path className="pv-schematic-muted" d="M69 44h70" /><circle className="pv-schematic-accent" cx="104" cy="44" r="18" strokeDasharray="2 3" /><path className="pv-schematic-accent" d="M120.1 36A18 18 0 0 1 112 60.1" /><circle className="pv-schematic-point" cx="120.1" cy="36" r="3" />
  </svg>;
  const stubs = kind === 'single-stub' ? [102] : kind === 'double-stub' ? [78, 132] : [];
  return <svg className="pv-topic-schematic" viewBox="0 0 210 88" fill="none" aria-hidden="true">
    <path className="pv-schematic-muted" d={kind === 'lc' ? 'M12 34h53m48 0h73M12 54h174' : kind === 'series-stub' ? 'M12 34h79m28 0h67M12 54h174' : 'M12 34h174M12 54h174'} />
    <path className="pv-schematic-muted" d="M12 30v8m0 12v8" /><path className="pv-schematic-load" d="M186 34v5m-4 0h8v10h-8zM186 49v5" />
    {stubs.map((x) => <g key={x}><path className="pv-schematic-accent" d={`M${x} 34l-16 28v20l16-28`} /><circle className="pv-schematic-junction" cx={x} cy="34" r="2" /><circle className="pv-schematic-junction" cx={x} cy="54" r="2" /></g>)}
    {kind === 'series-stub' && <path className="pv-schematic-accent" d="M91 34 73 67h28l18-33M73 67h28" />}
    {kind === 'lc' && <g className="pv-schematic-accent"><path d="M65 34a6 6 0 0 1 12 0a6 6 0 0 1 12 0a6 6 0 0 1 12 0a6 6 0 0 1 12 0M146 34v7m-7 0h14m-14 6h14m-7 0v7" /></g>}
    {kind === 'quarter-wave' && <g className="pv-schematic-accent"><path d="M78 34h62m-62 20h62" strokeWidth="3" /><path d="M78 68h62m-62-3v6m62-6v6" /><text x="109" y="82" textAnchor="middle">λ/4</text></g>}
  </svg>;
}

function SmithScene() {
  const clipId = `pv-smith-${useId().replaceAll(':', '')}`;
  const cx = 300;
  const cy = 245;
  const r = 170;
  return <svg className="pv-catalog-smith" viewBox="0 0 600 470" fill="none" aria-hidden="true">
    <defs><clipPath id={clipId}><circle cx={cx} cy={cy} r={r} /></clipPath></defs>
    <circle className="pv-orbit-guide" cx={cx} cy={cy} r="205" />
    <circle className="pv-orbit-guide pv-orbit-guide--inner" cx={cx} cy={cy} r="188" />
    <g clipPath={`url(#${clipId})`}>
      {[0.2, 0.5, 1, 2, 5].map((resistance) => <circle key={`r${resistance}`} className="pv-scene-grid" cx={cx + r * resistance / (1 + resistance)} cy={cy} r={r / (1 + resistance)} />)}
      {[0.2, 0.5, 1, 2, 5].flatMap((reactance) => [-1, 1].map((sign) => <circle key={`x${reactance * sign}`} className="pv-scene-grid" cx={cx + r} cy={cy - r / (reactance * sign)} r={r / reactance} />))}
      <path className="pv-scene-axis" d="M130 245H470" />
      <circle className="pv-scene-swr" cx={cx} cy={cy} r="76.0263" />
      <path className="pv-scene-vector" d="M300 245 368 211" />
      <path className="pv-scene-path" pathLength="1" d="M368 211A76.0263 76.0263 0 0 1 334 313" />
    </g>
    <circle className="pv-scene-boundary" cx={cx} cy={cy} r={r} />
    <circle className="pv-scene-center" cx={cx} cy={cy} r="2.7" />
    <path className="pv-scene-tick" d="M300 32v9m0 408v9M87 245h9m408 0h9" />
    <circle className="pv-scene-halo" cx="368" cy="211" r="15" />
    <circle className="pv-scene-load" cx="368" cy="211" r="5.5" />
    <circle className="pv-scene-input" cx="334" cy="313" r="4.5" />
    <text className="pv-scene-math pv-scene-math--load" x="390" y="205">z<tspan baselineShift="sub" fontSize="12">L</tspan></text>
    <text className="pv-scene-math" x="343" y="339">z(d)</text>
    <text className="pv-scene-axis-label" x="131" y="262">0</text><text className="pv-scene-axis-label" x="291" y="262">1</text><text className="pv-scene-axis-label" x="455" y="262">∞</text>
  </svg>;
}

export function Catalog({ onOpenLab }: { onOpenLab: () => void }) {
  const { t } = useI18n();
  return <section className="pv-catalog" aria-labelledby="pv-catalog-title">
    <div className="pv-catalog-intro">
      <h1 id="pv-catalog-title">{t('Laboratories', 'Laboratorios')}</h1>
    </div>
    <figure className="pv-catalog-figure"><SmithScene /></figure>
    <ol className="pv-topic-list">
      {topics.map((topic, index) => <li className={`pv-topic-row${topic.kind === 'single-stub' ? ' pv-topic-row--preview' : ''}`} key={topic.kind}>
        <span className="pv-topic-number">{String(index + 1).padStart(2, '0')}</span>
        <div className="pv-topic-copy"><h2>{topic.kind === 'single-stub' ? <button onClick={onOpenLab}>{t(topic.en, topic.es)}</button> : <a href={`/#/labs/${topic.route}`} target="_blank" rel="noreferrer" title={t('Current application · New tab', 'Aplicación actual · Nueva pestaña')}>{t(topic.en, topic.es)}<span className="pv-catalog-sr">{t(' (opens the current app in a new tab)', ' (abre la aplicación actual en una pestaña nueva)')}</span></a>}</h2></div>
        <TopicSchematic kind={topic.kind} />
        {topic.kind === 'single-stub' ? <button className="pv-topic-open" onClick={onOpenLab} aria-label={t('Open the single-stub design preview', 'Abrir el prototipo de adaptación con un stub')}><Arrow /></button> : <a className="pv-topic-open" href={`/#/labs/${topic.route}`} target="_blank" rel="noreferrer" aria-label={`${t(topic.en, topic.es)}${t(' — current app, new tab', ' — aplicación actual, pestaña nueva')}`}><Arrow external /></a>}
      </li>)}
    </ol>
  </section>;
}
