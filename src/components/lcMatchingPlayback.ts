export type LCMatchingPhase = 'load' | 'read-load' | 'circles' | 'return' | 'add-load' | 'convert' | 'add-source' | 'verify' | 'case';
export interface LCMatchingConstructionStep {
  key: string;
  phase: LCMatchingPhase;
  title: string;
  spanishTitle: string;
  duration: number;
  branchIndex: number;
}
export interface LCMatchingStepPosition { stepIndex: number; completed: boolean }

/** Connections are supplied in physical load-to-source order. */
export function getLCMatchingConstructionSteps(loadSideParallel: boolean, branchCount = 1, discrete = true): LCMatchingConstructionStep[] {
  const common: LCMatchingConstructionStep[] = [
    { key: 'load', phase: 'load', title: 'Plot the load impedance', spanishTitle: 'Representar la impedancia de la carga', duration: 1400, branchIndex: 0 },
  ];
  if (loadSideParallel) common.push({ key: 'read-load', phase: 'read-load', title: 'Read the load admittance', spanishTitle: 'Leer la admitancia de la carga', duration: 2400, branchIndex: 0 });
  common.push({ key: 'circles', phase: 'circles', title: 'Draw the two matching loci', spanishTitle: 'Dibujar los dos lugares geométricos', duration: 2600, branchIndex: 0 });
  if (!discrete) return [...common, { key: 'case', phase: 'case', title: 'Interpret the selected topology', spanishTitle: 'Interpretar la topología elegida', duration: 1400, branchIndex: 0 }];
  return [...common, ...Array.from({ length: Math.max(1, branchCount) }, (_, branchIndex) => {
    const steps: LCMatchingConstructionStep[] = [];
    const add = (phase: LCMatchingPhase, title: string, spanishTitle: string, duration: number) => steps.push({ key: `branch-${branchIndex + 1}-${phase}`, phase, title, spanishTitle, duration, branchIndex });
    if (branchIndex > 0) add('return', 'Return to the load for the next branch', 'Volver a la carga para la siguiente rama', 2400);
    add('add-load', 'Add element 2, next to the load', 'Añadir el elemento 2, junto a la carga', 3600);
    add('convert', 'Read the input of element 1', 'Leer la entrada del elemento 1', 2400);
    add('add-source', 'Add element 1, next to the generator', 'Añadir el elemento 1, junto al generador', 3600);
    add('verify', 'Verify the input match', 'Verificar la adaptación de entrada', 1200);
    return steps;
  }).flat()];
}


/** Current completed operations alone determine disclosure, including on rewind. */
export function lcMatchingResultMilestones(steps: readonly LCMatchingConstructionStep[], position: LCMatchingStepPosition) {
  const found = new Map<number, { load: boolean; source: boolean }>();
  for (let index = 0; index < steps.length; index += 1) {
    if (index > position.stepIndex || (index === position.stepIndex && !position.completed)) break;
    const step = steps[index];
    if (step.phase !== 'add-load' && step.phase !== 'add-source') continue;
    const branch = found.get(step.branchIndex) ?? { load: false, source: false };
    branch[step.phase === 'add-load' ? 'load' : 'source'] = true;
    found.set(step.branchIndex, branch);
  }
  return found;
}
