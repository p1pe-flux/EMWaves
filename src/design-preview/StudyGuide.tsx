import { useState } from 'react';
import { Formula } from '../components/Formula';
import { SINGLE_STUB_EXAMPLE } from '../components/SingleStubGuide';
import { TransmissionLineDiagram } from '../components/TransmissionLineDiagram';
import { solveSingleStub, type StubTermination } from '../domain/singleStub';
import { useI18n } from '../i18n';
import './study-guide.css';

const exampleBranch = solveSingleStub(SINGLE_STUB_EXAMPLE).branches[0];

export function StudyGuide({ onOpenLab }: { onOpenLab: () => void }) {
  const { t } = useI18n();
  const [termination, setTermination] = useState<StubTermination>('short');
  const stubLength = termination === 'short' ? exampleBranch.shortLength : exampleBranch.openLength;

  return <article className="prototype-guide">
    <header className="study-intro">
      <h1>{t('Single-stub matching', 'Adaptación con un stub')}</h1>
    </header>

    <div className="study-reader">
      <aside className="study-index" aria-label={t('In this excerpt', 'En este fragmento')}>
        <a href="#study-load">{t('Read the load', 'Leer la carga')}</a>
        <a href="#study-junction">{t('Find the junction', 'Encontrar la unión')}</a>
        <a href="#study-cancel">{t('Cancel and match', 'Cancelar y adaptar')}</a>
        <button type="button" className="study-lab-link" onClick={onOpenLab}>{t('Open laboratory', 'Abrir laboratorio')}<span aria-hidden="true">↗</span></button>
      </aside>

      <div className="study-prose">
        <section id="study-load" className="study-section">
          <h2>{t('Start with a concrete load', 'Comenzamos con una carga concreta')}</h2>
          <p>{t('Consider an ideal, lossless line with ', 'Consideramos una línea ideal sin pérdidas con ')}<Formula tex="Z_0=50\;\Omega" />{t(' and a complex load ', ' y una carga compleja ')}<Formula tex="Z_L=(100+\iu\,50)\;\Omega" />{t('. Dividing by the line impedance gives a simpler, dimensionless reading.', '. Dividir por la impedancia de la línea nos da una lectura más sencilla, sin unidades.')}</p>
          <div className="study-equation study-equation--load">
            <Formula display tex="z_L=\frac{Z_L}{Z_0}=2+\iu" />
            <Formula display tex="y_L=\frac{1}{z_L}=0.4-\iu\,0.2" />
          </div>
          <p>{t('An open or short lossless stub supplies only imaginary admittance. It cannot change conductance. The line must first transform the load to a point where ', 'Un stub abierto o en cortocircuito sin pérdidas solo aporta admitancia imaginaria. No puede cambiar la conductancia. Primero, la línea debe transformar la carga hasta un punto donde ')}<Formula tex="\operatorname{Re}y_\ell(d)=1" />.</p>
        </section>

        <section id="study-junction" className="study-section study-section--network">
          <h2>{t('Meet at the same junction', 'Nos encontramos en la misma unión')}</h2>
          <p>{t('The distance ', 'La distancia ')}<Formula tex="d" />{t(' changes the admittance seen toward the load. At the chosen junction, the line and stub are parallel branches, so their admittances add.', ' cambia la admitancia vista hacia la carga. En la unión elegida, la línea y el stub forman ramales en paralelo; sus admitancias se suman.')}</p>
          <figure className="study-network">
            <TransmissionLineDiagram
              lengthInWavelengths={0.5}
              distanceInWavelengths={exampleBranch.distance}
              z0={SINGLE_STUB_EXAMPLE.z0}
              load={SINGLE_STUB_EXAMPLE.load}
              onDistanceChange={() => {}}
              disabled
              showTotalLength={false}
              distanceSymbol="d"
              positionLabel={t('Stub junction', 'Unión del stub')}
              showAdmittancePorts
              stub={{ z0: SINGLE_STUB_EXAMPLE.stubZ0, lengthInWavelengths: stubLength, termination, attached: true }}
            />
          </figure>
          <div className="study-equation study-equation--principal"><Formula display tex="y_v=y_\ell(d)+y_{\mathrm{stub}}" /></div>
          <p>{t('For the first branch, the solver gives ', 'Para la primera rama, el modelo obtiene ')}<Formula tex={String.raw`d=${exampleBranch.distance.toFixed(6)}\,\lambda`} />{t(' and ', ' e ')}<Formula tex="y_\ell(d)=1+\iu" />{t('. The missing piece is therefore ', '. La pieza que falta es, por tanto, ')}<Formula tex="y_{\mathrm{stub}}=-\iu" />.</p>
        </section>

        <section id="study-cancel" className="study-section">
          <h2>{t('Cancel the imaginary part', 'Cancelamos la parte imaginaria')}</h2>
          <p>{t('The same condition can be realized with either termination. Only the relation between stub length and input admittance changes.', 'La misma condición se puede realizar con ambas terminaciones. Solo cambia la relación entre la longitud del stub y su admitancia de entrada.')}</p>
          <div className="study-termination" role="group" aria-label={t('Guide stub termination', 'Terminación del stub en la guía')}>
            <button type="button" aria-pressed={termination === 'short'} onClick={() => setTermination('short')}>{t('Short stub', 'Stub en corto')}</button>
            <button type="button" aria-pressed={termination === 'open'} onClick={() => setTermination('open')}>{t('Open stub', 'Stub abierto')}</button>
          </div>
          <div className="study-equation">
            <Formula display tex={termination === 'short' ? String.raw`y_{\mathrm{stub}}=-\iu\frac{Z_0}{Z_{0s}}\cot(\beta_s\ell_s)` : String.raw`y_{\mathrm{stub}}=\iu\frac{Z_0}{Z_{0s}}\tan(\beta_s\ell_s)`} />
          </div>
          <p>{t('With ', 'Con ')}<Formula tex="Z_{0s}=Z_0" />{t(', the fundamental length is ', ', la longitud fundamental es ')}<Formula tex={String.raw`\ell_s=${stubLength.toFixed(3)}\,\lambda_s`} />{t('. The stub has its own wavelength ', '. El stub tiene su propia longitud de onda ')}<Formula tex="\lambda_s" />{t('; it need not equal the main line wavelength.', '; no tiene por qué coincidir con la de la línea principal.')}</p>
          <div className="study-conclusion">
            <Formula display tex="y_v=(1+\iu)-\iu=1" />
            <Formula display tex="Z_v=50\;\Omega,\qquad\Gamma_v=0" />
          </div>
          <button type="button" className="study-open-lab" onClick={onOpenLab}>{t('Open laboratory', 'Abrir laboratorio')}<span aria-hidden="true">→</span></button>
        </section>
      </div>
    </div>
  </article>;
}
