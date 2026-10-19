# Animation performance and Windows validation

This is a historical validation record from before 1.0.0. Branch scopes, version numbers, and test counts below describe those checkpoints; see the [README](../README.md) for the current release.

This follow-up preserves the full `development` application: six laboratories, six guides, and both interface languages. The public README remains in English. The initial [test audit](test-audit-2026-10-17.md) remains the record of legacy-code removal and numerical fixes.

## Windows ARM64 extraction failure

The reported installation directory contained data files and the generated uninstaller, but no `EMWaves.exe` or Chromium DLLs. The original ARM64 installer was intact: its embedded application contained the correctly named ARM64 executable, and installer/uninstaller CRCs passed. Modern 7-Zip could extract it successfully.

The missing compatibility check was the compression method. The original PE files used `ARM64 LZMA2`, which the installer-time `Nsis7z` decoder cannot decode. This matches the corrected upstream diagnosis for [electron-builder issue 9983](https://github.com/electron-userland/electron-builder/issues/9983) and its [v26 fix](https://github.com/electron-userland/electron-builder/pull/9989).

Windows packaging now runs through a cross-platform Node wrapper that explicitly selects the compatible `BCJ` filter. This changes archive encoding, not the application's native ARM64 architecture. The post-package verifier checks codec compatibility, actual executable architecture, required executable/DLL/resource files, the packaged entry point/version/logo, and installer/uninstaller CRCs. The original failing installer is rejected specifically for its unsupported ARM64 filter.

An additional installer guard rejects an ARM64-only installer on a non-ARM64 PC. A post-extraction guard stops setup before registration/shortcut creation if `EMWaves.exe` is missing. The reported PC was ARM64, so the architecture guard alone would not have addressed this failure.

The logo and x64/ARM64 packaging configuration have been merged from the saved Windows work without replacing development's descriptions, guides, languages, or model-audit command. `release/` remains ignored. Builds do not upload artifacts or disable Windows protections. Signing and suspected false-positive review are documented in [Windows distribution](windows-distribution.md).

## Performance changes

- Memoized the fixed Smith grid, scale, and numeric grid labels separately from moving overlays. Seven before/after scenarios, including impedance, admittance, and combined readings, produced byte-identical chart markup. Label-coordinate regression tests guard reference and reactance signs independently.
- Reused completed circles, matching loci, propagation traces, and stub paths instead of regenerating them on every frame. Cache dependencies include the relevant electrical inputs, branch, termination, and reference. Partial/reverse paths remain dynamic; shared completed arrays are not mutated.
- Cached quarter-wave transformer samples in their fixed reference instead of renormalizing all 121 samples every frame. Dynamic physical branch-handoff evaluations remain unchanged.
- Reused exact LC feasibility classification and completed element paths while inputs remain unchanged.
- Added a bounded formula LRU shared across component mounts: at most 256 entries and one million retained source/output characters. KaTeX still produces HTML and accessible MathML with `trust: false` and isolated macro dictionaries. Display mode and source are part of the cache key; errors remain localized at presentation time.
- Reused up to sixteen `Intl.NumberFormat` instances while preserving precision validation, rounding, and output.

Playback still follows real elapsed time with `requestAnimationFrame`. No frames, geometric samples, steps, or mathematical readings were removed to make these measurements look faster.

## Measurements

The browser comparison used a preserved pre-optimization source snapshot and the optimized code under the same local React development profiler. Both ran the complete eleven-step single-stub sequence at 4× movement speed. The figures measure React render work, not native Windows performance or a guaranteed frame rate.

| Browser metric | Before | After |
| --- | ---: | ---: |
| Median React commit duration | 1.9 ms | 1.1 ms |
| 95th-percentile React commit duration | 11.1 ms | 5.2 ms |
| Median sampled animation-frame interval | 8.3 ms | 8.3 ms |
| 95th-percentile sampled frame interval | 16.6 ms | 9.2 ms |

In a separate identical 120-frame formula replay, KaTeX conversions fell from 960 to 246. A 7,200-value number-formatting workload created three formatter objects instead of 7,200, with an identical output checksum. Geometry microbenchmarks showed less CPU work across all five matching constructions; 231 strict sample-array comparisons checked branch, termination, unequal-impedance, and forward/reverse cases. These microbenchmarks are not end-to-end FPS claims.

Local baseline snapshots, profiling harness, JSON observations, and equality probes are saved under ignored `test-results/performance/` and `test-results/animation-performance/`. The normal suites permanently cover formula cache bounds, macro isolation, localized errors, numeric edge behavior, diagram labels, and existing construction semantics.

## Final combined checks

- `npm test`: 842 tests passed in 52 suites.
- `npm run test:windows-artifacts`: eight verifier fixture tests passed, including rejection of the original unsupported ARM64 filter.
- `npm run test:models`: 21,936 independently checked circuit realizations, no failures, maximum sampled residual approximately `1.74e-11`.
- Both Windows packaging scripts completed their TypeScript/production builds and post-package verification. Every packaged frontend file matched the final `dist` output; executable architecture, seven logo sizes, required DLLs/resources, codecs, and CRCs were checked.
- Browser traversal completed all five matching constructions and reverse steps, with no formula errors. Shared chart markup matched all seven baseline scenarios exactly, and 231 geometry sample comparisons passed.
- The original failing ARM64 installer passes basic CRC checks but fails the new codec check; the rebuilt ARM64 and x64 installers use only compatible BCJ/LZMA2 methods.

## Native validation limits

The new installers still require installation, launch, and uninstallation on Windows. A successful cross-build or extraction with modern 7-Zip cannot establish installer-time decoder compatibility by itself; codec validation is now explicit for that reason.

The user's screenshot also showed a UTM Windows guest. Graphics performance can depend on the selected virtual display and installed guest drivers; check [UTM's display documentation](https://docs.getutm.app/settings-qemu/devices/display/) rather than assuming native-PC GPU behavior. EMWaves retains Electron's normal hardware-acceleration defaults. No experimental GPU flags or protection bypasses were introduced.

If a missing-executable problem remains after the compatible-codec rebuild, the read-only Windows diagnostic in `scripts/diagnose-windows.ps1` checks actual shortcut targets, installed files, native architecture, and available Defender history. That script has not been executed on the remote PC.

## Initial review implementation — October 17, 2026

This section records the review implementation initially validated in a `main` working tree with all six laboratories, the introductory guide, and a fixed Spanish interface. These changes were subsequently integrated into `development` with its complete guide and language inventory, as described below. This section's measurements belong to the narrower review snapshot; no new release was published.

- Corrected the single-stub reflection lesson, with exhaustive phase handling, the reciprocal load admittance, and unchanged physical reading position.
- Preserved keyboard focus during single-step navigation and ignored secondary pointer gestures in the introductory chart.
- Bounded double-stub propagation and transported-center trails to one revolution, preserving their physical endpoints for tiny and very long distances.
- Shared playback state, reversal, speed changes, cancellation, and reduced-motion behavior across the five matching constructions. Laboratories synthesize once and pass their results to the construction; the shunt/series stub parameter controls are shared.
- Deferred the guide route, compiled its static Markdown/KaTeX at build time with HTML sanitization and accessible MathML, and paused the projection when outside the viewport or in a hidden document.
- Replaced the narrow MathJS dependency with the same underlying Complex.js arithmetic through a typed adapter. Domain errors now carry stable codes and parameters with exhaustive Spanish mappings.
- Removed confirmed orphan selectors and the unused LC geometry helper. Memoized completed SVG path serialization and injected the package version into the web and Electron entry points.
- Added route error recovery and a validated HTTPS citation opener in Electron. Desktop packaging now stages an application without redundant frontend dependency trees, includes bundled-dependency notices, and verifies every packaged frontend/runtime file against the current build.
- Added browser interaction coverage and CI for numerical, browser, desktop, installer-fixture, and Linux packaging checks. The workflow has been prepared locally; no remote CI run is claimed.

| Current verification | Result |
| --- | --- |
| `npm test` | 896 tests passed in 53 files. |
| `npm run build` | TypeScript, trusted guide compilation, notices, and Vite production build passed. |
| `npm run test:models` | 21,936 independently checked circuit realizations; maximum sampled residual approximately `1.74e-11`. |
| `npx playwright test` | 24 browser tests passed: complete matching sequences, reverse/result disclosure, focus, speed changes, invalid inputs, reduced motion, deferred loading, recovery, secondary pointers, viewport suspension, and seven mobile routes. |
| `npm run test:desktop` | 12 policy, staging, archive, and tooling tests passed. |
| `npm run test:windows-artifacts` | Eight installer-integrity fixture tests passed. |
| Production dependency audit | No known vulnerabilities reported by `npm audit --omit=dev`. |
| Native Electron/macOS ARM64 | Production navigation smoke passed; final signed packaged application launched through `app.asar`, including the corrected reflection lesson. The final OS browser launch is stubbed in the automated smoke test. |
| Windows x64 and ARM64 packages | Both rebuilt into ignored `test-results/review-release/`; PE architecture, BCJ/LZMA2 compatibility, installer/uninstaller CRC, icons, and complete frontend/runtime equality passed. |
| Linux x64 unpacked package | Built and passed the shared archive checks. |

| Size measurement | Before | Current |
| --- | ---: | ---: |
| Catalogue initial JavaScript, Vite gzip estimate | 261 kB | 78 kB |
| Windows application archive (`app.asar`) | 29,779,333 bytes | 2,786,591 bytes |
| Redundant `node_modules` contents in that archive | 25,841,110 bytes | 0 bytes |

The initial JavaScript reduction is approximately 70%; the combined frontend and archive cleanup reduces `app.asar` by approximately 90.6%. These are payload/disk measurements, not a measured FPS or resident-memory improvement, and `app.asar` is only part of the desktop distribution. All 72 source formulas and 20 display formulas in the introductory guide retain their TeX annotations and display modes.

Windows installation, execution, and uninstallation remain untested natively. The full Linux AppImage target cannot execute its downloaded packaging tool on this Apple Silicon macOS host (OS error `-86`); use a compatible Linux host. CI includes the Linux AppImage target, but has not been run remotely. Generated artifacts, local logs, and screenshots remain ignored; existing `release/` files were preserved.

## Development integration — October 18, 2026

The review improvements are integrated on `development`, retaining **all six full guides**, all six laboratories, English and Spanish, and the footer language selector. The English README introduces the project's teaching purpose, provides the basic development commands, and retains the three generated animations in a collapsible gallery. The public `main` branch is unchanged by this integration; development keeps its existing package version, `0.1.0`.

The guide catalog uses lightweight metadata, each matching article loads on demand, and the introductory article compiles both languages at build time. Locale changes preserve the existing interactive subtree, parameters, and playback state. Guide-catalog, language-picker, and double-stub termination styles remain because they are active on this branch. Electron's HTTPS citation policy covers all sources in both languages and every matching article.

Verification on the integrated development tree:

- `npm test`: **964 tests passed in 58 files**, including the original full-guide and deduction coverage.
- `npm run build`: TypeScript, all six compiled English/Spanish Markdown sources, notices, and the production build passed. Initial catalogue JavaScript is approximately **79 kB gzip** while all six guides remain available.
- `npm run test:models`: **21,936 circuit realizations** passed, with maximum sampled residual approximately `1.74e-11`.
- `npm run test:desktop` and `npm run test:windows-artifacts`: **20 policy, staging, archive, tooling, and installer-fixture checks** passed.
- `npx playwright test`: **42 browser tests passed**, including all six complete articles in both languages, direct laboratory links, six-entry guide catalog, language changes during playback, matching sequences, and all twelve mobile lab/guide routes.
- Native Electron on macOS ARM64: the production entry point loaded in a fresh English profile, listed six guides, switched English/Spanish in place, delegated approved citations, blocked unknown navigation, and retained renderer isolation/sandbox settings. The native ARM64 package passed signature/staging checks with **102 frontend files** equal to `dist/`, **zero `node_modules`**, and a **3,117,262-byte `app.asar`** containing the full bilingual guide inventory.

Detailed logs remain under ignored `test-results/development-integration-*`. Native installation limits from the preceding sections still apply; a successful local build does not establish Windows installation/runtime or a remote CI result.
