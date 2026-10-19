import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import './step-explanation.css';

interface StepExplanationProps {
  active: ReactNode;
  measurements: readonly ReactNode[];
}

interface Measurement {
  content: readonly ReactNode[];
  revision: number;
  height: number;
}

/** Reserve the longest lesson before painting, without keeping future steps in the DOM. */
export function StepExplanation({ active, measurements }: StepExplanationProps) {
  const host = useRef<HTMLDivElement>(null);
  const samples = useRef<HTMLDivElement>(null);
  const [revision, setRevision] = useState(0);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const hasMeasurements = measurements.length > 0;
  const needsMeasurement = hasMeasurements && typeof window !== 'undefined'
    && (measurement?.content !== measurements || measurement.revision !== revision);

  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    let width = element.getBoundingClientRect().width;
    let mounted = true;
    const refresh = () => { if (mounted) setRevision(value => value + 1); };
    const observer = new ResizeObserver(entries => {
      const nextWidth = entries[0].contentRect.width;
      if (Math.abs(nextWidth - width) < 0.5) return;
      width = nextWidth;
      refresh();
    });
    observer.observe(element);
    void document.fonts.ready.then(refresh);
    document.fonts.addEventListener('loadingdone', refresh);
    return () => {
      mounted = false;
      observer.disconnect();
      document.fonts.removeEventListener('loadingdone', refresh);
    };
  }, []);

  useLayoutEffect(() => {
    if (!needsMeasurement || !samples.current) return;
    const height = Math.ceil(Math.max(0, ...Array.from(samples.current.children,
      element => element.getBoundingClientRect().height))) + 1;
    setMeasurement({ content: measurements, revision, height });
  }, [measurements, revision, needsMeasurement]);

  return <div ref={host} className="step-explanation" style={hasMeasurements && measurement ? { height: measurement.height } : undefined} data-step-explanation-ready={!needsMeasurement}>
    <div className="step-explanation__active">{active}</div>
    {needsMeasurement && <div ref={samples} className="step-explanation__measurements" aria-hidden="true" inert>
      {measurements.map((content, index) => <div className="step-explanation__sample" key={index}>{content}</div>)}
    </div>}
  </div>;
}
