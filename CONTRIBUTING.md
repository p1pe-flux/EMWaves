# Contributing to EMWaves

EMWaves is a React and TypeScript frontend with an optional Electron desktop shell. Start with the [README](README.md) and [architecture guide](docs/architecture.md).

## Development

Use Node.js 26, which is also used by CI. The package supports Node.js 22.12+, 24, and 26 or later as specified in `package.json`.

```sh
npm ci
npm run dev
```

The development server listens on the loopback interface. Open the address printed by Vite. `npm run build` performs TypeScript checking and creates the production frontend in `dist/`; `npm run preview` serves that build locally.

## Project structure

- `src/domain/` and `src/math/`: electrical calculations and numerical helpers, independent of React and language.
- `src/labs/`: laboratory pages and parameter state.
- `src/components/`: SVG diagrams, worked constructions, guides, and shared controls.
- `src/content/`: guide metadata and English/Spanish Markdown lessons.
- `src/styles/`: global tokens, shared controls, and laboratory styles; narrowly scoped component styles stay beside their components.
- `e2e/`: browser interaction and layout tests.
- `scripts/`: build tools, independent circuit verification, and desktop packaging tests.
- `electron/`: desktop runtime, installer configuration, and icons.
- `docs/`: public architecture, media-generation, and distribution documentation.

Unit tests sit beside the modules they exercise. Keep calculations shared between laboratories and guides; a translation should change the explanation, not the model.

## Checks

Run the checks relevant to a change, then the full application checks before proposing changes to shared models or constructions:

```sh
npm run typecheck
npm test
npm run test:models
npm run build
```

`test:models` independently reconstructs physical circuits with deterministic inputs and verifies matching residuals. It complements the unit suite rather than replacing it.

For browser behavior and responsive layout:

```sh
npx playwright install chromium
npm run test:browser
```

Browser tests cover navigation, translations, animation, invalid inputs, mobile layouts, and line traversal. For animation changes, inspect the construction in both directions, result timing, branch changes, reduced motion, and keyboard access. Static markup tests do not demonstrate animation behavior.

For desktop tooling changes:

```sh
npm run test:desktop
npm run test:windows-artifacts
```

`npm run test:desktop:smoke` requires an installed Electron binary and a graphical session. CI runs it in a virtual display on Linux. The [Windows](docs/windows-distribution.md) and [macOS](docs/macos-distribution.md) guides distinguish artifact verification from native platform testing.

Before committing, review the changed files and the public-file checks:

```sh
git diff --check
npm run check:public
npm run test:public
git status --short
```

The public-file guard checks tracked and unignored paths, plus common credential signatures in the Git index and working copy. It also rejects private paths added with `git add --force`. `.gitignore` keeps local configuration, credentials, reports, and generated output out of ordinary staging. These checks do not scan past commits or replace reviewing content for sensitive information. Keep private working notes under the ignored `.local/` directory. Tests and their fixtures belong in source control; logs, screenshots, build output, and coverage reports are generated locally or in CI.

## Review expectations

Describe the visible behavior, the reason for the change, and the checks performed. Report a failed check with its cause or limitation. Remove a test or implementation only after establishing that its behavior has no active caller or requirement; retain meaningful coverage for the supported behavior. Add a focused regression test when fixing a genuine bug.

Keep interface copy available in English and Spanish through the existing translation helpers. Use the existing visual styles, mathematical notation, and accessible controls. The public README and contributor documentation are written in English.

If a change affects the README animation geometry, regenerate and inspect the [media](docs/media/README.md). Package commands create local artifacts and do not publish a release.
