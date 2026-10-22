import { useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { LINE_EXAMPLE, solveLineExample } from '../domain/lineExample';
import { complexTex, texNumber } from '../math/format';
import { Formula } from './Formula';
import { SmithChart } from './SmithChart';
import { TransmissionLineDiagram } from './TransmissionLineDiagram';
import { useI18n } from '../i18n';
import '../styles/transmission-line-example.css';

export interface TransmissionLineExampleProps {
  children?: ReactNode;
}

export function TransmissionLineExample({ children }: TransmissionLineExampleProps) {
  const { t } = useI18n();
  const prefix = 'line-example-' + useId().replaceAll(':', '');
  const [distance, setDistance] = useState(0.25);
  const { solution, normalizedInput, inputPhase } = useMemo(() => solveLineExample(distance), [distance]);
  const impedance = complexTex(solution.inputImpedance, 3);

  return (
    <section className="line-example" aria-labelledby={prefix + '-title'} data-distance={distance.toFixed(3)}>
      <h3 id={prefix + '-title'}>{t('Example: a one-wavelength transmission line', 'Ejemplo: una línea de una longitud de onda')}</h3>
      <div className="line-example__parameters">
        <Formula tex={'Z_0=' + texNumber(LINE_EXAMPLE.z0) + '\\;\\Omega'} />
        <Formula tex={'Z_L=(100+\\iu\\,50)\\;\\Omega'} />
        <Formula tex={'L=\\lambda'} />
      </div>
      {children && <div className="line-example__deduction">{children}</div>}
      <div className="line-example__interactive">
        <div className="line-example__line-panel">
          <figure className="line-example__circuit">
            <TransmissionLineDiagram
              lengthInWavelengths={LINE_EXAMPLE.lengthInWavelengths}
              distanceInWavelengths={distance}
              z0={LINE_EXAMPLE.z0}
              load={LINE_EXAMPLE.load}
              onDistanceChange={setDistance}
            />
          </figure>
          <div className="line-example__results" aria-label={t('Values at the selected line position', 'Valores en la posición seleccionada de la línea')}>
            <div><Formula display tex={'\\begin{aligned}Z(\\ell)&=' + (solution.inputImpedance?.im ? '\\left(' + impedance + '\\right)' : impedance) + '\\;\\Omega\\\\z_L(\\ell)&=' + complexTex(normalizedInput, 3) + '\\end{aligned}'} /></div>
            <div><Formula display tex={'\\begin{aligned}\\Gamma(\\ell)&=' + complexTex(solution.inputReflection, 4) + '\\\\|\\Gamma(\\ell)|&=' + texNumber(solution.reflectionMagnitude, 4) + '\\\\\\arg\\Gamma(\\ell)&=' + (inputPhase === null ? '\\text{' + t('Undefined', 'Indefinido') + '}' : texNumber(inputPhase, 4) + '\\;\\mathrm{rad}') + '\\end{aligned}'} /></div>
          </div>
        </div>
        <div className="line-example__smith-panel">
          <div className="line-example__chart">
            <SmithChart solution={solution} length={distance} showCurves={false} showGamma={false} showSwr interactive={false} pointLabels={{ load: 'z_L(0)', input: 'z_L(\\ell)' }} onSelectReflection={() => {}} />
          </div>
          <div className="line-example__readings">
            <span><i className="line-example__dot line-example__dot--load" />{t('Load', 'Carga')} <Formula tex={'z_L(0)'} /></span>
            <span><i className="line-example__dot line-example__dot--position" />{t('Selected', 'Seleccionada')} <Formula tex={'z_L(\\ell)'} /></span>
            <span><Formula tex={'\\mathrm{SWR}=' + texNumber(solution.vswr, 3)} /></span>
          </div>
        </div>
      </div>
    </section>
  );
}
