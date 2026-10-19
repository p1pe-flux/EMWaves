export type GuideMetadata = { title: string; titleEs: string; href: string; labHref: string };

export const smithGuide = {
  title: 'Introduction to Smith Chart',
  titleEs: 'Introducción al diagrama de Smith',
  href: '#/guides/introduction-to-smith-chart',
  labHref: '#/labs/introduction-to-smith-chart',
} as const;

export const singleStubGuide = {
  title: 'Single-Stub Matching',
  titleEs: 'Adaptación con un stub',
  href: '#/guides/single-stub-matching',
  labHref: '#/labs/single-stub-matching',
} as const;

export const seriesStubGuide = {
  title: 'Series-Stub Matching',
  titleEs: 'Adaptación con un stub en serie',
  href: '#/guides/series-stub-matching',
  labHref: '#/labs/series-stub-matching',
} as const;

export const lcMatchingGuide = {
  title: 'LC Matching',
  titleEs: 'Adaptación con L y C',
  href: '#/guides/lc-matching',
  labHref: '#/labs/lc-matching',
} as const;

export const quarterWaveGuide = {
  title: 'Quarter-Wave Transformer',
  titleEs: 'Transformador de cuarto de onda',
  href: '#/guides/quarter-wave-transformer',
  labHref: '#/labs/quarter-wave-transformer',
} as const;

export const doubleStubGuide = {
  title: 'Double-Stub Matching',
  titleEs: 'Adaptación con dos stubs',
  href: '#/guides/double-stub-matching',
  labHref: '#/labs/double-stub-matching',
} as const;

export const laboratoryGuides = [smithGuide, singleStubGuide, seriesStubGuide, lcMatchingGuide, quarterWaveGuide, doubleStubGuide] as const;
