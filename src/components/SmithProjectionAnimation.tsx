import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { projectImpedance, projectionGrid } from '../domain/smithProjection';
import type { ComplexValue } from '../domain/transmission';
import { useI18n } from '../i18n';
import '../styles/smith-projection.css';

const SCALE = 230;
const BOUNDS = { minRe: -1.45, maxRe: 1.45, minIm: -1.18, maxIm: 1.18 };
const project = (point: ComplexValue) => ({ x: 360 + SCALE * point.re, y: 300 - SCALE * point.im });
const pointPath = (points: ComplexValue[]) => points.map((point, index) => {
  const { x, y } = project(point);
  return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
}).join(' ');

export function SmithProjectionAnimation() {
  const { t } = useI18n();
  const id = 'smith-projection-' + useId().replaceAll(':', '');
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(() => typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [width, setWidth] = useState(720);
  const figure = useRef<HTMLDivElement>(null);
  const [inViewport, setInViewport] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(() => typeof document !== 'undefined' && !document.hidden);
  const position = useRef(0);
  const direction = useRef(1);
  const hold = useRef(900);

  useEffect(() => {
    const element = figure.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInViewport(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setInViewport(entry.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const update = () => setDocumentVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const respectMotion = () => { if (media.matches) setPlaying(false); };
    media.addEventListener('change', respectMotion);
    return () => media.removeEventListener('change', respectMotion);
  }, []);

  useEffect(() => {
    const element = figure.current;
    if (!element) return;
    const resize = () => setWidth(element.getBoundingClientRect().width);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || !inViewport || !documentVisible) return;
    let frame: number;
    let lastTime: number | null = null;
    const animate = (time: number) => {
      if (lastTime === null) lastTime = time;
      if (time - lastTime >= 32) {
        const elapsed = Math.min(time - lastTime, 100);
        lastTime = time;
        if (hold.current > 0) {
          hold.current = Math.max(0, hold.current - elapsed);
        } else {
          let next = position.current + direction.current * elapsed / 4500;
          if (next >= 1) { next = 1; direction.current = -1; hold.current = 900; }
          if (next <= 0) { next = 0; direction.current = 1; hold.current = 900; }
          position.current = next;
          setProgress(next);
        }
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [playing, inViewport, documentVisible]);

  const curves = useMemo(() => {
    const order = { active: 0, passive: 1, boundary: 2 };
    return projectionGrid(progress, { bounds: BOUNDS }).sort((a, b) => order[a.region] - order[b.region]).map((curve) => ({
      ...curve,
      paths: curve.paths.map(pointPath),
    }));
  }, [progress]);

  const markers = [
    { label: 'z = 0', point: projectImpedance({ re: 0, im: 0 }, progress), above: false },
    { label: 'z = 1', point: projectImpedance({ re: 1, im: 0 }, progress), above: true },
    { label: 'z → ∞', point: projectImpedance({ re: 1e12, im: 0 }, progress), above: false },
  ];
  const labelSize = Math.max(18, 12 * 720 / Math.max(280, width));

  function selectProgress(value: number) {
    setPlaying(false);
    position.current = value;
    direction.current = value === 1 ? -1 : 1;
    hold.current = 0;
    setProgress(value);
  }

  return (
    <section className="smith-projection" aria-label={t('Smith chart transformation', 'Transformación del diagrama de Smith')} data-progress={progress.toFixed(4)} data-running={playing && inViewport && documentVisible}>
      <div className="smith-projection__toolbar">
        <button className="smith-projection__play" type="button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? t('Pause Smith chart transformation', 'Pausar la transformación del diagrama de Smith') : t('Play Smith chart transformation', 'Reproducir la transformación del diagrama de Smith')}>{playing ? t('Pause', 'Pausar') : t('Play', 'Reproducir')}</button>
      </div>
      <div className="smith-projection__figure" ref={figure}>
        <svg className="smith-projection__svg" viewBox="0 0 720 600" role="img" aria-labelledby={id + '-title ' + id + '-description'}>
          <title id={id + '-title'}>{t('The impedance grid transforms into the Smith chart', 'La retícula de impedancias se transforma en el diagrama de Smith')}</title>
          <desc id={id + '-description'}>{t('Straight lines of constant resistance and reactance become circles and arcs. Passive impedances map inside the unit circle; negative resistances map outside it. Use the transformation slider to inspect each stage.', 'Las rectas de resistencia y reactancia constantes se convierten en circunferencias y arcos. Las impedancias pasivas quedan dentro del círculo unidad; las resistencias negativas, fuera. Usa el deslizador para examinar cada etapa.')}</desc>
          <defs><clipPath id={id + '-clip'}><rect x="20" y="20" width="680" height="560" /></clipPath></defs>
          <g clipPath={'url(#' + id + '-clip)'}>
            {curves.map((curve) => curve.paths.map((path, index) => (
              <path
                key={`${curve.kind}-${curve.value}-${curve.region}-${index}`}
                className={curve.region === 'boundary' ? 'smith-projection__boundary' : 'smith-projection__grid smith-projection__grid--' + curve.region}
                data-major={Number.isInteger(curve.value)}
                data-kind={curve.kind}
                data-region={curve.region}
                data-value={curve.value}
                d={path}
              />
            )))}
          </g>
          {markers.map(({ label, point, above }) => {
            if (!point || point.re < BOUNDS.minRe || point.re > BOUNDS.maxRe || Math.abs(point.im) > BOUNDS.maxIm) return null;
            const { x, y } = project(point);
            const nearRight = x > 610;
            return (
              <g key={label}>
                <circle className="smith-projection__marker" cx={x} cy={y} r="5" />
                <text className="smith-projection__label" x={x + (nearRight ? -12 : 12)} y={y + (above ? -14 : labelSize + 8)} textAnchor={nearRight ? 'end' : 'start'} style={{ fontSize: labelSize }}>{label}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="smith-projection__controls">
        <div className="smith-projection__slider">
          <label className="guide-visually-hidden" htmlFor={id + '-slider'}>{t('Smith chart transformation', 'Transformación del diagrama de Smith')}</label>
          <input id={id + '-slider'} type="range" min="0" max="1" step="0.001" value={progress} aria-valuetext={Math.round(progress * 100) + t('% toward the Smith chart', '% hacia el diagrama de Smith')} style={{ backgroundSize: (progress * 100) + '% 100%' }} onChange={(event) => selectProgress(Number(event.target.value))} />
          <div className="smith-projection__endpoints"><button type="button" onClick={() => selectProgress(0)}>{t('Impedance plane', 'Plano de impedancias')}</button><button type="button" onClick={() => selectProgress(1)}>{t('Smith chart', 'Diagrama de Smith')}</button></div>
        </div>
      </div>
    </section>
  );
}
