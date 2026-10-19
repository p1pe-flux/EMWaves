import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import rehypeSanitize from 'rehype-sanitize';
import { mathMacros } from '../src/math/notation.ts';

const COMPONENT_MARKER = /<!-- (?:smith-chart-animation|transmission-line-diagram) -->/;

/** Compile repository-owned lessons only; raw HTML in Markdown is discarded. */
export async function compileGuideMarkdown(source: string): Promise<string[]> {
  return Promise.all(source.split(COMPONENT_MARKER).map(async (section) => {
    const result = await unified()
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeKatex, {
      output: 'htmlAndMathml', trust: false, macros: { ...mathMacros }, strict: 'error',
    })
    .use(rehypeStringify)
    .process(section.trim());
    if (result.messages.length) throw new Error(result.messages.map(String).join('\n'));
    return String(result);
  }));
}

export function compiledGuideMarkdown(): Plugin {
  let contentRoot: string;
  return {
    name: 'emwaves-compiled-guide-markdown',
    enforce: 'pre',
    configResolved(config) { contentRoot = resolve(config.root, 'src/content') + sep; },
    async load(id) {
      if (!id.endsWith('.md?compiled-math')) return;
      const file = resolve(id.slice(0, -'?compiled-math'.length));
      if (!file.startsWith(contentRoot)) throw new Error('Compiled lessons must be inside src/content.');
      this.addWatchFile(file);
      return 'export default ' + JSON.stringify(await compileGuideMarkdown(await readFile(file, 'utf8'))) + ';';
    },
  };
}
