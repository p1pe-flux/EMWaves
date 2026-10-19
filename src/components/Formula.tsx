import { useMemo } from 'react';
import katex from 'katex';
import { mathMacros } from '../math/notation';
import { useI18n } from '../i18n';

export interface FormulaProps {
  tex: string;
  display?: boolean;
  className?: string;
}

type RenderedFormula = { html: string; error?: never } | { error: string; html?: never };

// Animated explanations are remounted as their steps change. Keep their pure
// KaTeX output across mounts, without retaining an unbounded history of values.
const MAX_CACHE_ENTRIES = 256;
const MAX_CACHE_CHARACTERS = 1_000_000;
const renderCache = new Map<string, { result: RenderedFormula; characters: number }>();
let cachedCharacters = 0;

function renderFormula(tex: string, display: boolean): RenderedFormula {
  const key = (display ? 'display:' : 'inline:') + tex;
  const cached = renderCache.get(key);
  if (cached !== undefined) {
    renderCache.delete(key);
    renderCache.set(key, cached);
    return cached.result;
  }

  let result: RenderedFormula;
  try {
    result = {
      html: katex.renderToString(tex, {
        displayMode: display,
        output: 'htmlAndMathml',
        throwOnError: true,
        trust: false,
        // Each source gets its own macros, including when it contains \gdef.
        // mathMacros is frozen, so this source and display mode identify output.
        macros: { ...mathMacros },
      }),
    };
  } catch (error) {
    result = {
      error: error instanceof Error ? error.message : 'Unable to parse TeX.',
    };
  }

  const characters = key.length + (result.html ?? result.error).length;
  if (characters <= MAX_CACHE_CHARACTERS) {
    while (renderCache.size >= MAX_CACHE_ENTRIES
      || cachedCharacters + characters > MAX_CACHE_CHARACTERS) {
      const oldestKey = renderCache.keys().next().value!;
      cachedCharacters -= renderCache.get(oldestKey)!.characters;
      renderCache.delete(oldestKey);
    }
    renderCache.set(key, { result, characters });
    cachedCharacters += characters;
  }
  return result;
}

/** Render raw TeX with accessible MathML; report authoring errors in place. */
export function Formula({ tex, display = false, className = '' }: FormulaProps) {
  const { t } = useI18n();
  const result = useMemo(() => renderFormula(tex, display), [tex, display]);

  const Tag = display ? 'div' : 'span';
  const classes = `formula formula--${display ? 'display' : 'inline'} ${className}`.trim();

  if (result.error !== undefined) {
    return (
      <Tag className={`${classes} formula--error`} role="alert">
        <span className="formula__error-label">{t('Invalid TeX formula: ', 'Fórmula TeX no válida: ')}</span>
        <code>{tex}</code>
        <span className="formula__error-detail">{result.error}</span>
      </Tag>
    );
  }

  return <Tag className={classes} dangerouslySetInnerHTML={{ __html: result.html! }} />;
}
