import { useId } from 'react';
import { toLumpedMatchingInput, type LumpedMatchingInput } from '../domain/lumpedMatching';
import { useI18n } from '../i18n';
import { formatNumber } from '../math/format';
import { formattedLCValue } from './LCMatchingBranchSummary';
import '../styles/lc-matching.css';

export interface LCMatchingDiagramProps {
  input: LumpedMatchingInput;
  /** Values in SI units, in physical order from the generator to the load. */
  values?: [number?, number?];
  progress?: [number, number];
  revealed?: [boolean, boolean];
  abstractLabels?: boolean;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Fixed topology. A muted symbol is planned; it brightens as its x/b is added. */
export function LCMatchingDiagram({ input: inputValue, values, progress, revealed, abstractLabels = false }: LCMatchingDiagramProps) {
  const input = toLumpedMatchingInput(inputValue);
  const { t } = useI18n();
  const prefix = 'lc-diagram-' + useId().replaceAll(':', '');
  const slots = [225, 380];
  const top = 120;
  const bottom = 220;
  const configuration = input.elements.map(({ component, connection }, index) => ({ component, connection, index, x: slots[index], progress: clamp(progress?.[index] ?? 0) }));
  const series = configuration.filter((item) => item.connection === 'series');
  let cursor = 110;
  const upper: string[] = [];
  series.forEach(({ x }) => { upper.push('M' + cursor + ' ' + top + 'H' + (x - 36)); cursor = x + 36; });
  upper.push('M' + cursor + ' ' + top + 'H515');
  const load = input.load;
  const loadLabel = load.kind === 'open' ? t('Open circuit', 'Circuito abierto') : load.kind === 'short' ? t('Short circuit', 'Cortocircuito') : formatNumber(load.resistance, 3) + (load.reactance === 0 ? '' : (load.reactance < 0 ? ' − j' : ' + j') + formatNumber(Math.abs(load.reactance), 3)) + ' Ω';
  return <svg className="transmission-line-diagram lc-matching-diagram" viewBox="0 0 600 300" role="img" aria-label={t('Two-component reactive matching network', 'Red de adaptación con dos componentes reactivos')} aria-describedby={prefix + '-desc'} data-component-order={input.elements.map(({ component }) => component).join('')}>
    <desc id={prefix + '-desc'}>{t('Sinusoidal generator on the left and load on the right. The component order is read from the generator toward the load. Series elements interrupt the upper rail; parallel elements join the two rails. Muted symbols indicate components still to be obtained.', 'Generador sinusoidal a la izquierda y carga a la derecha. El orden de los componentes se lee desde el generador hacia la carga. Los elementos en serie interrumpen el conductor superior; los elementos en paralelo unen ambos conductores. Los símbolos atenuados indican componentes todavía por obtener.')}</desc>
    <path className="transmission-line-diagram__wire" d="M60 146V120H110M60 194V220H110" />
    <circle className="transmission-line-diagram__source" cx="60" cy="170" r="24" />
    <path className="transmission-line-diagram__sine" d="M40 170C47 154 53 154 60 170S73 186 80 170" />
    <text className="transmission-line-diagram__generator-label" x="60" y="260" textAnchor="middle">{t('Generator', 'Generador')}</text>
    <path className="transmission-line-diagram__line" data-main-conductor="upper" d={upper.join('')} />
    <path className="transmission-line-diagram__line" data-main-conductor="lower" data-continuous="true" d="M110 220H515" />
    {configuration.map(({ component, connection, index, x, progress }) => {
      const value = values?.[index];
      const reveal = revealed?.[index] ?? false;
      const symbol = component === 'L' ? <path data-inductor-symbol="coil" d="M-36 0a9 9 0 0 1 18 0a9 9 0 0 1 18 0a9 9 0 0 1 18 0a9 9 0 0 1 18 0" /> : <path data-capacitor-symbol="plates" d="M-36 0H-6M-6 -18V18M6 -18V18M6 0H36" />;
      return <g className="lc-matching-diagram__component" key={index} data-lc-component={component} data-connection={connection} data-component-position={x} data-element-index={index} data-component-progress={progress.toFixed(3)} opacity={0.28 + 0.72 * progress}>
        {connection === 'series' ? <g transform={'translate(' + x + ' ' + top + ')'}>{symbol}</g> : <><path d={'M' + x + ' ' + top + 'V134M' + x + ' 206V' + bottom} /><g transform={'translate(' + x + ' 170) rotate(90)'}>{symbol}</g><circle cx={x} cy={top} r="3" /><circle cx={x} cy={bottom} r="3" /></>}
        <text className="lc-matching-diagram__symbol" x={x} y="69" textAnchor="middle">{component}<tspan baselineShift="sub" fontSize="16">{index + 1}</tspan></text>
        {!abstractLabels && reveal && value !== undefined && Number.isFinite(value) && <text className="lc-matching-diagram__value" data-component-value={component} data-value-index={index} x={x} y="94" textAnchor="middle">{formatNumber(formattedLCValue(component, value).value, 5)} {formattedLCValue(component, value).unit}</text>}
      </g>;
    })}
    <path className="transmission-line-diagram__load-connection" d="M515 120V150M515 190V220" />
    {load.kind === 'short' ? <path className="transmission-line-diagram__load-connection" d="M515 150V190" /> : load.kind === 'open' ? <g className="lc-matching-diagram__open"><circle cx="515" cy="150" r="3.5" /><circle cx="515" cy="190" r="3.5" /></g> : <rect className="transmission-line-diagram__load" x="506" y="150" width="18" height="40" />}
    <text className="transmission-line-diagram__load-symbol" x="535" y="179">Z<tspan baselineShift="sub" fontSize="18">L</tspan></text>
    <text className="transmission-line-diagram__circuit-label" x="300" y="260" textAnchor="middle">Z<tspan baselineShift="sub" fontSize="15">0</tspan>{!abstractLabels && ' = ' + formatNumber(input.z0, 3) + ' Ω'}</text>
    {!abstractLabels && <text className="transmission-line-diagram__load-value" x="590" y="285" textAnchor="end">{loadLabel}</text>}
    {abstractLabels && <text className="lc-matching-diagram__port" x="137" y="105">Z<tspan baselineShift="sub" fontSize="15">v</tspan></text>}
  </svg>;
}
