import { MathMarkdown } from './MathMarkdown';
import { SmithProjectionAnimation } from './SmithProjectionAnimation';
import { ReflectionExplorer } from './ReflectionExplorer';
import { TransmissionLineExample } from './TransmissionLineExample';
import { TransmissionLineDiagram } from './TransmissionLineDiagram';
import { GuidePage } from './LabGuides';
import { smithGuide } from '../content/guides';
import { useI18n } from '../i18n';
import introductionEnglish from '../content/smith-intro.md?compiled-math';
import introductionSpanish from '../content/smith-intro.es.md?compiled-math';
import theoryEnglish from '../content/transmission-line-theory.md?compiled-math';
import theorySpanish from '../content/transmission-line-theory.es.md?compiled-math';
import exampleEnglish from '../content/transmission-line-example.md?compiled-math';
import exampleSpanish from '../content/transmission-line-example.es.md?compiled-math';

/** Locale changes replace lesson prose without remounting any interactive example. */
export function SmithGuidePage() {
  const { locale, t } = useI18n();
  const [beforeAnimation, afterAnimation] = locale === 'es' ? introductionSpanish : introductionEnglish;
  const theory = locale === 'es' ? theorySpanish : theoryEnglish;
  const example = locale === 'es' ? exampleSpanish : exampleEnglish;
  return <GuidePage guide={smithGuide} id="smith-guide">
    <div className="guide-article"><MathMarkdown className="guide-document" html={beforeAnimation} /></div>
    <SmithProjectionAnimation />
    <div className="guide-article"><MathMarkdown className="guide-document" html={afterAnimation} /></div>
    <div className="guide-reflection-explorer"><ReflectionExplorer /></div>
    <div className="guide-article guide-line-theory">
      <MathMarkdown className="guide-document" html={theory[0]} />
      <figure className="guide-line-theory__diagram" data-transmission-line-concept aria-label={t('Generic lossless transmission line', 'Línea de transmisión genérica sin pérdidas')}>
        <TransmissionLineDiagram
          lengthInWavelengths={1}
          distanceInWavelengths={0.45}
          z0={null}
          load={null}
          loadLabel=""
          disabled
          abstractLabels
          showTotalLength={false}
          positionLabel={t('Observation section', 'Sección de observación')}
          onDistanceChange={() => {}}
        />
      </figure>
      <MathMarkdown className="guide-document" html={theory[1]} />
    </div>
    <TransmissionLineExample><MathMarkdown className="guide-document" html={example[0]} /></TransmissionLineExample>
  </GuidePage>;
}
