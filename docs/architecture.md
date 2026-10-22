# Frontend architecture

EMWaves is a browser application built with React, TypeScript, and Vite. The same production frontend runs inside an optional Electron desktop shell. Electrical calculations are shared by the six laboratories and their guides.

## Application and routes

`src/main.tsx` mounts the application and the translation provider. `src/App.tsx` maps hash routes to lazy-loaded laboratories and guides, with loading and error boundaries. Hash routes let the browser build and the local desktop build use the same navigation without server-side route rewriting.

Each laboratory in `src/labs/` owns its parameter state and computes a model result. Shared components render that result as a circuit, a Smith chart, and step explanations. Parameters and construction position are held in memory. Only the interface language is saved in `localStorage`, through `src/i18n.tsx`.

## Electrical models

`src/domain/` contains pure calculations for transmission lines, single and double stubs, series stubs, quarter-wave transformers, and lumped reactive networks. `src/math/` supplies complex arithmetic, number formatting, and shared notation.

Models distinguish invalid inputs, discrete solutions, continuous families, already-matched loads, and unmatchable loads where those states apply. They describe ideal lossless lines and reactive components at one design frequency. Components consume those states rather than reproducing the solver's calculations in JSX or translation code.

## Visual construction

`src/components/` contains SVG chart and circuit primitives, matching constructions, progressive result summaries, and parameter controls. The geometry modules convert electrical results and animation progress into drawable coordinates. Playback modules describe the sequence; `useStepPlayback` manages stepping and direction across matching constructions.

The matching laboratories animate one operation per **Next** action and can reverse that operation with **Previous**. Results are revealed when the step obtaining them completes. The introductory Smith explorer has its own free traversal and playback controls. It shares diagrams and mathematical helpers while keeping that different interaction model.

`src/styles/global.css` defines the shared color and typography conventions. The other files in `src/styles/` hold shared controls, parameter panels, laboratory layouts, and diagram styles. Narrowly scoped styles remain beside their components. Topic-specific styles support the different diagrams and layouts without introducing a separate design system for each laboratory.

## Content and mathematics

`src/content/` contains the guide catalog and paired English/Spanish Markdown for the introductory guide. The other guides compose React components with the same models and constructions used in laboratories. Interface strings use `src/i18n.tsx` and the shared message catalog.

`scripts/compile-guide-markdown.ts` is a Vite plugin that compiles repository-owned Markdown and TeX at build time. It discards raw HTML, sanitizes Markdown output, and renders equations with KaTeX. Interactive markers split an article into sections where React inserts the corresponding visual component. Runtime equations use the shared `Formula` component.

## Tests and tooling

| Location | Purpose | Command |
| --- | --- | --- |
| `src/**/*.test.ts` and `.tsx` | Numerical, geometry, playback, content, and rendered-markup checks | `npm test` |
| `scripts/audit-matching-models.mjs` | Independent physical-circuit reconstruction with deterministic cases | `npm run test:models` |
| `e2e/` | Browser navigation, interactions, animation, and responsive layout | `npm run test:browser` |
| `scripts/*.test.mjs` and `.cjs` | Desktop staging, archive verification, navigation, and download logging | `npm run test:desktop` and `npm run test:windows-artifacts` |
| `scripts/check-public-files.test.mjs` | Public source-file policy | `npm run test:public` |

The Vitest suite uses a Node environment and includes server-rendered markup checks. Playwright exercises browser state and motion that those tests cannot establish. CI also builds the production frontend, runs Electron in a Linux virtual display, and verifies an unpacked desktop archive. See [CONTRIBUTING.md](../CONTRIBUTING.md) for the development workflow.

## Build and desktop boundaries

`index.html`, `vite.config.ts`, and `tsconfig.json` define the web build. `public/` contains static browser assets. The generated frontend and dependency notices are written to `dist/`.

The Electron runtime is limited to `electron/main.cjs` and `electron/external-navigation.cjs`. Packaging tools stage the built frontend, runtime, icons, and license notices into a dependency-free app under `.desktop/app`. Archive verification compares packaged files with the completed build and rejects unexpected files or bundled frontend dependencies. Source code, contributor documentation, test fixtures, and local reports are not runtime resources.

Desktop installation and publisher trust require platform-specific checks beyond a successful web build. The [Windows](windows-distribution.md) and [macOS](macos-distribution.md) distribution guides document those workflows. Generated artifacts live outside tracked source in `dist/`, `.desktop/`, `release/`, and test-report directories.
