import { useI18n } from '../i18n';
import type { StubTermination } from '../domain/singleStub';
import { TransmissionLineDiagram } from './TransmissionLineDiagram';

export interface SingleStubDiagramProps {
  z0: number;
  stubZ0: number;
  loadLabel: string;
  distance: number;
  stubLength: number;
  termination: StubTermination;
  attached?: boolean;
  showStub?: boolean;
  stubOpacity?: number;
  /** Additional half-wave equivalents, in main-line wavelengths. */
  periodicDistance?: number;
  /** Additional half-wave equivalents, in stub wavelengths. */
  periodicStubLength?: number;
}

const baseLength = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(0.5, value)) : 0;

/** Matching controls use the same source, line, load, and dimensions as the first guide. */
export function SingleStubDiagram({ z0, stubZ0, loadLabel, distance, stubLength, termination, attached = true, showStub = true, stubOpacity = 1, periodicDistance = 0, periodicStubLength = 0 }: SingleStubDiagramProps) {
  const { t } = useI18n();
  return <TransmissionLineDiagram
    className="ss-diagram"
    lengthInWavelengths={0.5}
    distanceInWavelengths={baseLength(distance)}
    z0={z0}
    load={null}
    loadLabel={loadLabel}
    distanceSymbol="d"
    positionLabel={t("Stub placement", "Posición del stub")}
    showTotalLength={false}
    reserveStubSpace
    periodicDistance={periodicDistance}
    disabled
    onDistanceChange={() => {}}
    stub={showStub ? {
      z0: stubZ0,
      lengthInWavelengths: baseLength(stubLength),
      termination,
      attached,
      opacity: stubOpacity,
      periodicLength: periodicStubLength,
    } : undefined}
  />;
}
