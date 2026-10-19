export interface SeriesStubConstructionStep {
  key: string;
  phase: 'load' | 'circles' | 'follow' | 'cancel' | 'stub' | 'verify';
  title: string;
  spanishTitle: string;
  duration: number;
  branchIndex: number;
}

export interface SeriesStubStepPosition { stepIndex: number; completed: boolean }

const branchPhases: Omit<SeriesStubConstructionStep, 'key' | 'branchIndex'>[] = [
  { phase: 'follow', title: 'Follow SWR to Re(z) = 1', spanishTitle: 'Seguir la ROE hasta Re(z) = 1', duration: 3500 },
  { phase: 'cancel', title: 'Determine the required series reactance', spanishTitle: 'Determinar la reactancia en serie necesaria', duration: 2400 },
  { phase: 'stub', title: 'Build the isolated series stub', spanishTitle: 'Construir el stub en serie aislado', duration: 3800 },
  { phase: 'verify', title: 'Connect in series and verify', spanishTitle: 'Conectar en serie y verificar', duration: 3400 },
];

/** Complete each impedance construction before introducing the other branch. */
export function getSeriesStubConstructionSteps(branchCount = 2): SeriesStubConstructionStep[] {
  return [
    { key: 'load', phase: 'load', title: 'Plot the load impedance', spanishTitle: 'Representar la impedancia de la carga', duration: 1400, branchIndex: 0 },
    { key: 'circles', phase: 'circles', title: 'Draw the SWR and unity-resistance circles', spanishTitle: 'Dibujar los círculos de ROE y resistencia unitaria', duration: 2200, branchIndex: 0 },
    ...Array.from({ length: branchCount }, (_, branchIndex) => branchPhases.map((phase) => ({
      ...phase, key: 'branch-' + (branchIndex + 1) + '-' + phase.phase, branchIndex,
      duration: phase.phase === 'follow' && branchIndex > 0 ? 4800 : phase.duration,
    }))).flat(),
  ];
}


/** Derive disclosures from the current completed steps, so reversing hides them. */
export function seriesStubResultMilestones(steps: readonly SeriesStubConstructionStep[], position: SeriesStubStepPosition) {
  const found = new Map<number, { placement: boolean; stub: boolean }>();
  for (let index = 0; index < steps.length; index += 1) {
    if (index > position.stepIndex || (index === position.stepIndex && !position.completed)) break;
    const step = steps[index];
    if (step.phase !== 'follow' && step.phase !== 'stub') continue;
    const branch = found.get(step.branchIndex) ?? { placement: false, stub: false };
    branch[step.phase === 'follow' ? 'placement' : 'stub'] = true;
    found.set(step.branchIndex, branch);
  }
  return found;
}
