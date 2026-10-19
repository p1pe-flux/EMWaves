import { useI18n } from '../i18n';
import { useId, useState } from 'react';
import type { StubTermination } from '../domain/singleStub';
import { Formula } from './Formula';
import { TransmissionLineDiagram } from './TransmissionLineDiagram';
import '../single-stub-deduction.css';

export function SingleStubDeduction() {
  const { t } = useI18n();
  const prefix = 'single-stub-deduction-' + useId().replaceAll(':', '');
  const [termination, setTermination] = useState<StubTermination>('short');

  return (
    <section className="ss-deduction" aria-labelledby={prefix + '-title'} data-termination={termination}>
      <header className="sd-heading"><span className="section-kicker">{t("THE MATCHING DEDUCTION", "DEDUCCIÓN DE LA ADAPTACIÓN")}</span><h2 id={prefix + '-title'}>{t("What must the shunt stub do?", "¿Qué debe hacer el stub en paralelo?")}</h2><p>{t("Start at the junction. The main line and the stub are two parallel branches, so define their admittances at that same point.", "Partimos de la unión. La línea principal y el stub forman dos ramales en paralelo; por eso definimos sus admitancias en ese mismo punto.")}</p></header>
      <figure className="sd-network-figure">
        <TransmissionLineDiagram
          lengthInWavelengths={0.5}
          distanceInWavelengths={0.25}
          z0={null}
          load={null}
          loadLabel=""
          onDistanceChange={() => {}}
          disabled
          distanceSymbol="d"
          positionLabel={t("Stub junction", "Unión del stub")}
          showTotalLength={false}
          showAdmittancePorts
          abstractLabels
          stub={{ z0: null, lengthInWavelengths: 0.2, termination, attached: true }}
        />
        <figcaption>{t("All three admittances refer to the same junction. The colored input sections mark where each admittance is read. ", "Las tres admitancias están referidas a la misma unión. Las secciones de entrada coloreadas indican dónde se lee cada admitancia. ")}<Formula tex={'y_\\ell'} />{t(" looks through the line section of length ", " mira a través del tramo de línea de longitud ")}<Formula tex={'d'} />{t(" toward the load. It is the transformed line admittance, not the bare load admittance ", " hacia la carga. Es la admitancia transformada de la línea, no la admitancia de la carga aislada ")}<Formula tex={'y_L'} />.</figcaption>
      </figure>
      <div className="sd-definitions">
        <p>{t("Normalize every quantity using the main line:", "Normalizamos todas las magnitudes respecto de la línea principal:")}</p>
        <Formula display tex={'Y_0=\\frac{1}{Z_0},\\qquad y_k=\\frac{Y_k}{Y_0}=Z_0Y_k,\\qquad z_k=\\frac{Z_k}{Z_0}=\\frac{1}{y_k}'} />
        <dl><div><dt><Formula tex={'y_v'} /></dt><dd>{t("Combined input, seen immediately before the junction.", "Entrada combinada, vista justo antes de la unión.")}</dd></div><div><dt><Formula tex={'y_\\ell'} /></dt><dd>{t("Line section and load, seen immediately after the junction.", "Tramo de línea y carga, vistos justo después de la unión.")}</dd></div><div><dt><Formula tex={'y_{\\mathrm{stub}}'} /></dt><dd>{t("Stub input, seen looking into the branch.", "Entrada del stub, vista hacia el interior del ramal.")}</dd></div></dl>
      </div>
      <div className="sd-derivation">
        <section><span className="sd-step-number">01</span><h3>{t("Add the two parallel branches", "Sumamos los dos ramales en paralelo")}</h3><Formula display tex={'y_v=y_\\ell+y_{\\mathrm{stub}}'} /><Formula display tex={'\\frac{1}{z_v}=\\frac{1}{z_\\ell}+\\frac{1}{z_{\\mathrm{stub}}}'} /><p>{t("The admittances add at the junction. Each ", "Las admitancias se suman en la unión. Cada ")}<Formula tex={'z_k'} />{t(" is the reciprocal of its corresponding normalized admittance.", " es el recíproco de su admitancia normalizada correspondiente.")}</p></section>
        <section><span className="sd-step-number">02</span><h3>{t("Make the combined input equal to one", "Hacemos que la entrada combinada sea uno")}</h3><Formula display tex={'z_v=y_v=1\\quad\\Longrightarrow\\quad\\Gamma_v=0'} /><Formula display tex={'y_\\ell=g_\\ell+\\iu b_\\ell,\\qquad y_{\\mathrm{stub}}=\\iu b_s'} /><Formula display tex={'y_v=g_\\ell+\\iu(b_\\ell+b_s)'} /><p>{t("A lossless open or short stub contributes only an imaginary admittance. It cannot change the line's conductance.", "Un stub sin pérdidas abierto o en cortocircuito solo aporta admitancia imaginaria. No puede modificar la conductancia de la línea.")}</p><div className="sd-matching-condition"><Formula display tex={'\\operatorname{Re}y_\\ell=1,\\qquad b_s=-\\operatorname{Im}y_\\ell=-b_\\ell'} /><Formula display tex={'y_\\ell=1-y_{\\mathrm{stub}}'} /></div></section>
        <section><span className="sd-step-number">03</span><h3>{t("Choose how to obtain that susceptance", "Elegimos cómo obtener esa susceptancia")}</h3><p>{t("The deduction is the same for either termination. Only the stub's length-to-admittance relation changes.", "La deducción es la misma para ambas terminaciones. Solo cambia la relación entre la longitud del stub y su admitancia.")}</p><div className="sd-termination-toggle" role="group" aria-label={t("Deduction stub termination", "Terminación del stub en la deducción")}>{(['short', 'open'] as const).map((value) => <button type="button" key={value} aria-pressed={termination === value} onClick={() => setTermination(value)}>{value === 'open' ? t('Open termination', 'Terminación abierta') : t('Short termination', 'Terminación en cortocircuito')}</button>)}</div><div hidden={termination !== 'open'} data-stub-formula="open"><Formula display tex={'y_{\\mathrm{stub}}=\\iu\\frac{Z_0}{Z_{0s}}\\tan\\left(\\beta_s\\ell_s\\right)'} /></div><div hidden={termination !== 'short'} data-stub-formula="short"><Formula display tex={'y_{\\mathrm{stub}}=-\\iu\\frac{Z_0}{Z_{0s}}\\cot\\left(\\beta_s\\ell_s\\right)'} /></div><p>{t("Here ", "Aquí, ")}<Formula tex={'\\beta_s'} />{t(" is the stub phase constant. The factor ", " es la constante de fase del stub. El factor ")}<Formula tex={'Z_0/Z_{0s}'} />{t(" expresses the stub admittance in the same normalization as ", " expresa la admitancia del stub con la misma normalización que ")}<Formula tex={'y_\\ell'} />{t(" and ", " y ")}<Formula tex={'y_v'} />.</p></section>
      </div>

    </section>
  );
}
