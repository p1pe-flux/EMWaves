import { DOMAIN_ERROR_MESSAGES, DomainError, type FixedDomainErrorCode, type DomainValueLabel, type DomainParameterLabel } from './domain/errors';

const spanishMessages: Record<string, string> = {
  'The selected two elements cannot match this load with positive, finite values. Change their types, connections, or positions.': 'Los dos componentes elegidos no pueden adaptar esta carga con valores positivos y finitos. Cambia sus tipos, conexiones o posiciones.',
  'The selected two elements match this load with positive, finite values.': 'Los dos componentes elegidos adaptan esta carga con valores positivos y finitos.',
  'The load is already matched. Two reactive elements of the same type and connection cannot cancel each other with positive, finite values.': 'La carga ya está adaptada. Dos componentes reactivos del mismo tipo y con la misma conexión no pueden cancelarse con valores positivos y finitos.',
  'The load is already matched. This mixed topology needs a zero or infinite component, so it has no positive, finite pair.': 'La carga ya está adaptada. Esta topología mixta necesita un componente nulo o infinito, por lo que no tiene un par de valores positivos y finitos.',
  'This topology has a continuous family of positive, finite matches. Split the required reactive contribution using the indicated strict lower bound.': 'Esta topología tiene una familia continua de adaptaciones con valores positivos y finitos. Reparte la contribución reactiva necesaria respetando el límite inferior estricto indicado.',
  'This topology has a continuous family of positive, finite matches. Split the required reactive contribution between the two elements within the indicated open interval.': 'Esta topología tiene una familia continua de adaptaciones con valores positivos y finitos. Reparte la contribución reactiva necesaria entre ambos componentes dentro del intervalo abierto indicado.',
  'This topology cannot match this load with one positive, finite inductor and one positive, finite capacitor. Change the connections or their order.': 'Esta topología no puede adaptar esta carga con un inductor y un capacitor de valores positivos y finitos. Cambia las conexiones o su orden.',
  'This series topology has a continuous family of matches. Choose any normalized inductive reactance q above the indicated lower bound; the capacitor cancels the remaining reactance.': 'Esta topología en serie tiene una familia continua de adaptaciones. Elige una reactancia inductiva normalizada q por encima del límite inferior indicado; el capacitor cancela la reactancia restante.',
  'This parallel topology has a continuous family of matches. Choose any normalized inductive susceptance magnitude q above the indicated lower bound; the capacitor cancels the remaining susceptance.': 'Esta topología en paralelo tiene una familia continua de adaptaciones. Elige una magnitud de susceptancia inductiva normalizada q por encima del límite inferior indicado; el capacitor cancela la susceptancia restante.',
  'The load is already matched. This mixed topology needs a zero or infinite component, so it has no positive, finite L–C pair.': 'La carga ya está adaptada. Esta topología mixta necesita un componente nulo o infinito, por lo que no tiene un par L–C de valores positivos y finitos.',
  'A positive, finite inductor and capacitor match this load with the selected topology.': 'Un inductor y un capacitor de valores positivos y finitos adaptan esta carga con la topología elegida.',
  'A half-wavelength separation repeats the same admittance. There is a continuous family of matches: b1 + b2 = -Im(yR).': 'Una separación de media longitud de onda repite la misma admitancia. Existe una familia continua de adaptaciones: b₁ + b₂ = −Im(yR).',
  'At a half-wavelength separation, the two stubs cannot change conductance. Matching requires Re(yR) = 1.': 'Con una separación de media longitud de onda, los dos stubs no pueden cambiar la conductancia. La adaptación requiere Re(yR) = 1.',
  'The conductance at stub 2 exceeds the matching limit for this separation. Change the separation or the load-to-stub-2 distance.': 'La conductancia en el stub 2 supera el límite de adaptación para esta separación. Cambia la separación o la distancia entre la carga y el stub 2.',
  'The two matching branches meet at tangency, leaving one distinct solution.': 'Las dos ramas de adaptación coinciden en la tangencia, por lo que hay una única solución distinta.',
  'Two distinct double-stub matching branches are available. Stub 2 is applied first from the load, then stub 1 completes the match toward the generator. Each stub length repeats every half of its own wavelength.': 'Hay dos ramas distintas de adaptación con doble stub. Desde la carga se aplica primero el stub 2; después el stub 1 completa la adaptación hacia el generador. La longitud de cada stub se repite cada media longitud de onda de su propio medio.',
  'Enter all electrical parameters to calculate a match.': 'Introduce todos los parámetros eléctricos para calcular la adaptación.',
  'Enter valid line and load values.': 'Introduce valores válidos para la línea y la carga.',
  'Check the electrical parameters.': 'Revisa los parámetros eléctricos.',
  'Check the parameters.': 'Revisa los parámetros.',
  'Use nonnegative whole numbers for half-wavelength repetitions.': 'Usa números enteros no negativos para las repeticiones de media longitud de onda.',
  'Enter the values to plot the load on the chart.': 'Introduce los valores para representar la carga en el diagrama.',
  'Check the load values.': 'Revisa los valores de la carga.',
  'Check the line length.': 'Revisa la longitud de la línea.',
  'Characteristic impedance must be greater than zero.': 'La impedancia característica debe ser mayor que cero.',
  'Stub characteristic impedance must be greater than zero.': 'La impedancia característica del stub debe ser mayor que cero.',
  'Transformer characteristic impedance must be greater than zero.': 'La impedancia característica del transformador debe ser mayor que cero.',
  'Line length must be greater than or equal to zero.': 'La longitud de la línea debe ser mayor o igual que cero.',
  'Resistance must be greater than or equal to zero.': 'La resistencia debe ser mayor o igual que cero.',
  'The construction is outside the numeric range.': 'La construcción está fuera del intervalo numérico.',
  'A lossless reactive network cannot match a load that absorbs no real power. Use a load with R > 0.': 'Una red reactiva sin pérdidas no puede adaptar una carga que no absorbe potencia real. Usa una carga con R > 0.',
  'A lossless network cannot match a load that absorbs no real power. Use a load with R > 0.': 'Una red sin pérdidas no puede adaptar una carga que no absorbe potencia real. Usa una carga con R > 0.',
  'The load is already matched. No stub is needed; its position is arbitrary. A zero-susceptance open stub has length 0 modulo λs/2, and a short stub has length λs/4 modulo λs/2.': 'La carga ya está adaptada. No hace falta un stub; su posición es arbitraria. Un stub abierto de susceptancia nula tiene longitud 0 módulo λs/2, y uno en cortocircuito tiene longitud λs/4 módulo λs/2.',
  'The load is already matched. No series stub is needed; its position is arbitrary. A zero-reactance short stub has length 0 modulo λs/2, and an open stub has length λs/4 modulo λs/2.': 'La carga ya está adaptada. No hace falta un stub en serie; su posición es arbitraria. Un stub cortocircuitado de reactancia nula tiene longitud 0 módulo λs/2, y uno abierto tiene longitud λs/4 módulo λs/2.',
  'The load is already matched. Its placement is arbitrary, and a section with Zt = Z0 preserves the match at any length. The displayed quarter-wave section is one canonical realization.': 'La carga ya está adaptada. Su posición es arbitraria y un tramo con Zt = Z0 conserva la adaptación a cualquier longitud. El tramo de cuarto de onda mostrado es una realización canónica.',
  'Two distinct attachment positions occur in each half wavelength of the main line. Each has an open and a short stub realization; line position and stub length repeat independently every half wavelength.': 'Hay dos posiciones de conexión distintas en cada media longitud de onda de la línea principal. Cada una admite un stub abierto o en cortocircuito; la posición y la longitud del stub se repiten de forma independiente cada media longitud de onda.',
  'Move to either real-axis intersection, then use a quarter-wave transformer with Zt = √(Z0 Ri). Main-line positions and transformer lengths repeat independently every half of their respective wavelength.': 'Avanza hasta cualquiera de los cruces con el eje real y usa un transformador de cuarto de onda con Zt = √(Z0 Ri). Las posiciones sobre la línea y las longitudes del transformador se repiten de forma independiente cada media longitud de onda de su respectivo medio.',
};

const spanishLabels = {
  'Element 1 value': 'El valor del componente 1',
  'Element 2 value': 'El valor del componente 2',
  'Frequency': 'La frecuencia',
  'Normalized element value': 'El valor normalizado del componente',
  'Load-to-stub-2 distance': 'La distancia entre la carga y el stub 2',
  'Stub separation': 'La separación entre los stubs',
  'Stub 1 characteristic impedance': 'La impedancia característica del stub 1',
  'Stub 2 characteristic impedance': 'La impedancia característica del stub 2',
  'Characteristic impedance': 'La impedancia característica',
  'Stub characteristic impedance': 'La impedancia característica del stub',
  'Transformer characteristic impedance': 'La impedancia característica del transformador',
  'Line length': 'La longitud de la línea',
  'Stub length': 'La longitud del stub',
  'Transformer length': 'La longitud del transformador',
  'Distance from the load': 'La distancia desde la carga',
  'Load-to-transformer distance': 'La distancia entre la carga y el transformador',
  'Resistance': 'La resistencia',
  'Reactance': 'La reactancia',
  'Normalized impedance': 'La impedancia normalizada',
  'Reflection coefficient': 'El coeficiente de reflexión',
  'Calculated impedance': 'La impedancia calculada',
  'Normalized impedance outside the numeric range': 'La impedancia normalizada, fuera del intervalo numérico',
  'Input impedance outside the numeric range': 'La impedancia de entrada, fuera del intervalo numérico',
} satisfies Record<DomainValueLabel, string>;

const spanishDomainErrors = {
  'numeric.range': 'Estos valores están fuera del intervalo numérico fiable. Usa una carga o una relación de impedancias características menos extrema.',
  'numeric.range-with-separation': 'Estos valores están fuera del intervalo numérico fiable. Usa una carga, separación o relación de impedancias características menos extrema.',
  'network.negative-lengths': 'Las distancias y las longitudes del stub deben ser mayores o iguales que cero.',
  'transformer.negative-lengths': 'Las longitudes de la línea y del transformador deben ser mayores o iguales que cero.',
  'stub.invalid-termination': 'Elige un stub abierto o en cortocircuito.',
  'reflection.outside-passive-disk': 'El coeficiente de reflexión debe estar dentro del disco pasivo |Γ| ≤ 1.',
  'line.invalid-total-length': 'La longitud total de la línea debe ser un número finito mayor o igual que cero.',
  'line.missing-total-length': 'Introduce la longitud total de la línea en longitudes de onda.',
  'line.invalid-position': 'La posición sobre la línea debe ser un número finito.',
  'line.invalid-elapsed-time': 'El tiempo transcurrido debe ser un número finito mayor o igual que cero.',
  'example.invalid-position': 'La posición del ejemplo debe estar entre cero y una longitud de onda.',
  'projection.invalid-progress': 'El progreso de la proyección debe estar entre cero y uno.',
  'projection.invalid-impedance': 'La impedancia de la proyección debe tener partes real e imaginaria finitas.',
  'projection.invalid-bounds': 'Los límites de la proyección deben ser finitos y tener anchura y altura positivas.',
  'projection.invalid-segments': 'El número de segmentos de la proyección debe ser un entero entre 16 y 4096.',
  'projection.invalid-grid-values': 'Los valores de la retícula de proyección deben ser finitos.',
  'lumped.invalid-element-count': 'Elige exactamente dos componentes reactivos.',
  'lumped.invalid-component': 'Elige un inductor o un capacitor para cada componente.',
  'lumped.missing-values': 'Introduce un valor para cada uno de los dos componentes.',
  'lumped.invalid-connection': 'Elige una conexión en serie o en paralelo para cada componente.',
  'load.nonfinite-normalized-impedance': 'La impedancia normalizada de la carga debe ser finita.',
  'load.nonfinite-impedance': 'La impedancia de la carga debe ser finita.',
  'line.invalid-characteristic-impedance': 'La impedancia característica debe ser mayor que cero y finita.',
} satisfies Record<FixedDomainErrorCode, string>;

// Keep older string-only callers compatible without duplicating translations.
const legacyDomainMessages = new Map(Object.entries(DOMAIN_ERROR_MESSAGES).map(([code, message]) => [
  message as string, spanishDomainErrors[code as FixedDomainErrorCode],
]));

function spanishParameterLabel(parameter: DomainParameterLabel): string {
  const part = parameter.endsWith(': real part') ? ': real part'
    : parameter.endsWith(': imaginary part') ? ': imaginary part' : '';
  const label = (part ? parameter.slice(0, -part.length) : parameter) as DomainValueLabel;
  return spanishLabels[label] + (part === ': real part' ? ', parte real,' : part === ': imaginary part' ? ', parte imaginaria,' : '');
}

function translateDomainError(error: DomainError): string {
  switch (error.code) {
    case 'value.not-finite': return spanishParameterLabel(error.params.label!) + ' debe ser un número finito.';
    case 'value.not-positive': return spanishParameterLabel(error.params.label!) + ' debe ser mayor que cero.';
    case 'value.negative': return spanishParameterLabel(error.params.label!) + ' debe ser mayor o igual que cero.';
    default: return spanishDomainErrors[error.code];
  }
}

/** Localize presentation messages while leaving the pure numerical API unchanged. */
export function translateMessage(source: string | Error, locale: 'en' | 'es'): string {
  if (locale === 'es' && source instanceof DomainError) return translateDomainError(source);
  const message = source instanceof Error ? source.message : source;
  if (locale === 'en') return message;
  if (Object.hasOwn(spanishMessages, message)) return spanishMessages[message];
  const domainMessage = legacyDomainMessages.get(message);
  if (domainMessage) return domainMessage;
  const finite = message.match(/^(.*?)(: real part|: imaginary part)? must be a finite number\.$/);
  if (finite && Object.hasOwn(spanishLabels, finite[1])) {
    const part = finite[2] === ': real part' ? ', parte real,' : finite[2] === ': imaginary part' ? ', parte imaginaria,' : '';
    return spanishLabels[finite[1] as DomainValueLabel] + part + ' debe ser un número finito.';
  }
  const nonnegative = message.match(/^(.*?) must be greater than or equal to zero\.$/);
  if (nonnegative && Object.hasOwn(spanishLabels, nonnegative[1])) return spanishLabels[nonnegative[1] as DomainValueLabel] + ' debe ser mayor o igual que cero.';
  const positive = message.match(/^(.*?) must be greater than zero\.$/);
  if (positive && Object.hasOwn(spanishLabels, positive[1])) return spanishLabels[positive[1] as DomainValueLabel] + ' debe ser mayor que cero.';
  return message;
}
