export const matchingLabs = [
  ['single-stub-matching', 'Adaptación con un stub', 'ss'],
  ['series-stub-matching', 'Adaptación con un stub en serie', 'series'],
  ['lc-matching', 'Adaptación con L y C', 'lc'],
  ['quarter-wave-transformer', 'Transformador de cuarto de onda', 'qw'],
  ['double-stub-matching', 'Adaptación con dos stubs', 'ds'],
] as const;

export const allRoutes = [
  ['#/labs/introduction-to-smith-chart', 'Introducción al diagrama de Smith'],
  ...matchingLabs.map(([route, title]) => ['#/labs/' + route, title]),
  ['#/guides/introduction-to-smith-chart', 'Introducción al diagrama de Smith'],
  ...matchingLabs.map(([route, title]) => ['#/guides/' + route, title]),
] as const;
