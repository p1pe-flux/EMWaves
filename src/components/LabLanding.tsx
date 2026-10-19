import { useId } from 'react';
import { useI18n } from '../i18n';
import '../landing.css';

function SmithIllustration() {
  const clipId = 'landing-smith-' + useId().replaceAll(':', '');
  const centerX = 205;
  const centerY = 138;
  const radius = 97;

  return (
    <svg className="landing-smith" viewBox="0 0 410 280" fill="none" aria-hidden="true">
      <defs>
        <clipPath id={clipId}><circle cx={centerX} cy={centerY} r={radius} /></clipPath>
      </defs>
      <circle className="landing-smith__outer" cx={centerX} cy={centerY} r="115" />
      <g clipPath={'url(#' + clipId + ')'}>
        {[0.2, 0.5, 1, 2, 5].map((resistance) => (
          <circle
            key={'r-' + resistance}
            className="landing-smith__grid"
            cx={centerX + radius * resistance / (1 + resistance)}
            cy={centerY}
            r={radius / (1 + resistance)}
          />
        ))}
        {[0.5, 1, 2].flatMap((reactance) => [-1, 1].map((sign) => (
          <circle
            key={'x-' + sign * reactance}
            className="landing-smith__grid"
            cx={centerX + radius}
            cy={centerY - radius / (sign * reactance)}
            r={radius / reactance}
          />
        )))}
        <path className="landing-smith__axis" d="M108 138H302" />
        <circle className="landing-smith__swr" cx={centerX} cy={centerY} r="43.38" />
        <path className="landing-smith__trajectory" d="M243.8 118.6A43.38 43.38 0 0 1 224.4 176.8" />
        <path className="landing-smith__vector" d="M205 138L243.8 118.6" />
      </g>
      <circle className="landing-smith__boundary" cx={centerX} cy={centerY} r={radius} />
      <circle className="landing-smith__center" cx={centerX} cy={centerY} r="2.3" />
      <circle className="landing-smith__halo" cx="243.8" cy="118.6" r="10" />
      <circle className="landing-smith__load" cx="243.8" cy="118.6" r="4.5" />
      <circle className="landing-smith__input" cx="224.4" cy="176.8" r="4.5" />
      <text className="landing-smith__label landing-smith__label--load" x="257" y="112">z<tspan dy="3" fontSize="9">L</tspan></text>
      <text className="landing-smith__label" x="237" y="190">z(l)</text>
    </svg>
  );
}

type SchematicKind = 'single-stub' | 'series-stub' | 'lc-matching' | 'double-stub' | 'quarter-wave';

function LineSchematic({ kind }: { kind: SchematicKind }) {
  const { t } = useI18n();
  const stubs = kind === 'single-stub' ? [151] : kind === 'double-stub' ? [115, 191] : [];

  return (
    <svg className="landing-schematic" data-schematic-kind={kind} viewBox="0 0 300 134" fill="none" aria-hidden="true">
      <path className="landing-schematic__guide" d={kind === 'series-stub' ? 'M20 57H139M167 57H280' : kind === 'lc-matching' ? 'M20 57H101M157 57H280' : 'M20 57H280'} />
      <path className="landing-schematic__line" d={kind === 'series-stub' ? 'M22 57H139M167 57H268V77M268 95V104' : kind === 'lc-matching' ? 'M22 57H101M157 57H268V77M268 95V104' : 'M22 57H268V77M268 95V104'} />
      <path className="landing-schematic__terminal" d="M23 49V65" />
      <rect className="landing-schematic__load" x="261" y="77" width="14" height="18" rx="1" />
      <path className="landing-schematic__ground" d="M258 104H278M261 108H275M264 112H272" />
      {stubs.map((x) => (
        <g key={x}>
          <path className="landing-schematic__stub" d={'M' + x + ' 57V100'} />
          <path className="landing-schematic__ground" d={'M' + (x - 10) + ' 100H' + (x + 10) + 'M' + (x - 7) + ' 104H' + (x + 7) + 'M' + (x - 4) + ' 108H' + (x + 4)} />
          <circle className="landing-schematic__junction" cx={x} cy="57" r="2.5" />
        </g>
      ))}
      {kind === 'series-stub' && <g data-series-insertion="true">
        <path className="landing-schematic__stub" d="M139 57L112 91L140 91L167 57" />
        <circle className="landing-schematic__junction" cx="139" cy="57" r="2.5" />
        <circle className="landing-schematic__junction" cx="167" cy="57" r="2.5" />
      </g>}
      {kind === 'lc-matching' && <g data-lc-network="series-inductor-parallel-capacitor">
        <path className="landing-schematic__stub" data-lc-element="inductor" d="M101 57a7 7 0 0 1 14 0a7 7 0 0 1 14 0a7 7 0 0 1 14 0a7 7 0 0 1 14 0" />
        <path className="landing-schematic__stub" data-lc-element="capacitor" d="M203 57V77M191 77H215M191 85H215M203 85V104" />
        <path className="landing-schematic__ground" d="M193 104H213M196 108H210M199 112H207" />
        <circle className="landing-schematic__junction" cx="203" cy="57" r="2.5" />
        <text className="landing-schematic__math" x="129" y="85" textAnchor="middle">L</text>
        <text className="landing-schematic__math" x="223" y="85">C</text>
      </g>}
      {kind === 'quarter-wave' && (
        <>
          <path className="landing-schematic__section" d="M106 57H210" />
          <path className="landing-schematic__measure" d="M106 92H210M106 87V97M210 87V97" />
          <text className="landing-schematic__math" x="158" y="115" textAnchor="middle">λ / 4</text>
        </>
      )}
      <text className="landing-schematic__label" x="23" y="29">{kind === 'lc-matching' ? t('INPUT', 'ENTRADA') : t('LINE', 'LÍNEA')}</text>
      <text className="landing-schematic__label" x="268" y="29" textAnchor="middle">{t('LOAD', 'CARGA')}</text>
    </svg>
  );
}

export function LabLanding() {
  const { t } = useI18n();
  return (
    <section className="landing-page" aria-labelledby="landing-title">
      <h1 id="landing-title">{t('Laboratories', 'Laboratorios')}</h1>
      <div className="landing-labs">
        <article className="landing-lab-card landing-lab-card--available">
          <div className="landing-card-status" aria-hidden="true" />
          <a className="landing-lab-link" href="#/labs/introduction-to-smith-chart">
            <div className="landing-lab-illustration"><SmithIllustration /></div>
            <h2>{t('Introduction to Smith Chart', 'Introducción al diagrama de Smith')}</h2>
          </a>
          <div className="landing-card-actions">
            <a className="landing-open" href="#/labs/introduction-to-smith-chart">{t('Open lab', 'Abrir laboratorio')}<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12H19M13 6L19 12L13 18" /></svg></a>
            <a className="landing-read-guide" href="#/guides/introduction-to-smith-chart">{t('Read guide', 'Leer guía')}</a>
          </div>
        </article>
        <article className="landing-lab-card landing-lab-card--available">
          <div className="landing-card-status" aria-hidden="true" />
          <a className="landing-lab-link" href="#/labs/single-stub-matching">
            <div className="landing-lab-illustration"><LineSchematic kind="single-stub" /></div>
            <h2>{t('Single-Stub Matching', 'Adaptación con un stub')}</h2>
          </a>
          <div className="landing-card-actions">
            <a className="landing-open" href="#/labs/single-stub-matching">{t('Open lab', 'Abrir laboratorio')}<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12H19M13 6L19 12L13 18" /></svg></a>
            <a className="landing-read-guide" href="#/guides/single-stub-matching">{t('Read guide', 'Leer guía')}</a>
          </div>
        </article>
        <article className="landing-lab-card landing-lab-card--available">
          <div className="landing-card-status" aria-hidden="true" />
          <a className="landing-lab-link" href="#/labs/series-stub-matching">
            <div className="landing-lab-illustration"><LineSchematic kind="series-stub" /></div>
            <h2>{t('Series-Stub Matching', 'Adaptación con un stub en serie')}</h2>
          </a>
          <div className="landing-card-actions">
            <a className="landing-open" href="#/labs/series-stub-matching">{t('Open lab', 'Abrir laboratorio')}<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12H19M13 6L19 12L13 18" /></svg></a>
            <a className="landing-read-guide" href="#/guides/series-stub-matching">{t('Read guide', 'Leer guía')}</a>
          </div>
        </article>
        <article className="landing-lab-card landing-lab-card--available">
          <div className="landing-card-status" aria-hidden="true" />
          <a className="landing-lab-link" href="#/labs/lc-matching">
            <div className="landing-lab-illustration"><LineSchematic kind="lc-matching" /></div>
            <h2>{t('LC Matching', 'Adaptación con L y C')}</h2>
          </a>
          <div className="landing-card-actions">
            <a className="landing-open" href="#/labs/lc-matching">{t('Open lab', 'Abrir laboratorio')}<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12H19M13 6L19 12L13 18" /></svg></a>
            <a className="landing-read-guide" href="#/guides/lc-matching">{t('Read guide', 'Leer guía')}</a>
          </div>
        </article>
        <article className="landing-lab-card landing-lab-card--available">
          <div className="landing-card-status" aria-hidden="true" />
          <a className="landing-lab-link" href="#/labs/quarter-wave-transformer">
            <div className="landing-lab-illustration"><LineSchematic kind="quarter-wave" /></div>
            <h2>{t('Quarter-Wave Transformer', 'Transformador de cuarto de onda')}</h2>
          </a>
          <div className="landing-card-actions">
            <a className="landing-open" href="#/labs/quarter-wave-transformer">{t('Open lab', 'Abrir laboratorio')}<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12H19M13 6L19 12L13 18" /></svg></a>
            <a className="landing-read-guide" href="#/guides/quarter-wave-transformer">{t('Read guide', 'Leer guía')}</a>
          </div>
        </article>
        <article className="landing-lab-card landing-lab-card--available">
          <div className="landing-card-status" aria-hidden="true" />
          <a className="landing-lab-link" href="#/labs/double-stub-matching">
            <div className="landing-lab-illustration"><LineSchematic kind="double-stub" /></div>
            <h2>{t('Double-Stub Matching', 'Adaptación con dos stubs')}</h2>
          </a>
          <div className="landing-card-actions">
            <a className="landing-open" href="#/labs/double-stub-matching">{t('Open lab', 'Abrir laboratorio')}<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12H19M13 6L19 12L13 18" /></svg></a>
            <a className="landing-read-guide" href="#/guides/double-stub-matching">{t('Read guide', 'Leer guía')}</a>
          </div>
        </article>
      </div>
    </section>
  );
}
