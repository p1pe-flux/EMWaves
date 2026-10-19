import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { compiledGuideMarkdown } from './scripts/compile-guide-markdown.ts';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  plugins: [compiledGuideMarkdown(), react(), {
    name: 'emwaves-version',
    transformIndexHtml: (html) => html.replaceAll('%EMWAVES_VERSION%', version),
  }],
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: { license: { fileName: 'THIRD-PARTY-NOTICES.md' } },
  base: './',
  // Scan the application, excluding archived benchmark HTML under test-results.
  optimizeDeps: { entries: ['index.html'] },
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
});
