# Development test and legacy-code audit

Date: October 17, 2026. Branch: `development`, starting from `9b6fb8b`.

The baseline passed **832 tests in 54 suites** and the production build. No code or test was classified as obsolete because it failed. The audit used three parallel reviews, a separate review of the numerical fixes, import/call-site tracing, deterministic circuit verification, and browser checks.

## Removal evidence

The application roots are `index.html`, `src/main.tsx`, and `src/App.tsx`, including all six laboratory routes and all six full-guide routes. The documentation renderer (`scripts/readme-scenes.ts` and `scripts/generate-readme-media.mjs`) was checked separately. Electron loads the same production web build. Repository searches included tests, scripts, and documentation before deletion.

| Removed code | Evidence of obsolescence | Coverage retained or migrated |
| --- | --- | --- |
| `SingleStubResults` and `QuarterWaveResults`, with their dedicated render suites | Their only consumers were their own tests. Active constructions use the upper branch summaries; the former bottom result cards are no longer part of the product. | Existing single-stub summary and milestone coverage retained; seven quarter-wave summary tests cover completion-gated results, both branches, rewind/restart, canonical matches, and dimension offsets. Numerical verification remains in the domain suites. |
| `GuidePanel`, `SmithGuidePanel`, `SingleStubGuidePanel`, and `QuarterWaveGuidePanel` | App imports only full-page guide exports. Every Read guide action is a direct route link; only old tests manually mounted the panels. | App tests now assert the actual full articles, direct guide/lab links, and bilingual content. |
| Single-stub selected-branch five-step variant | Both production consumers explicitly selected the eleven-step flow. The README renderer never consumed the old timeline. The alternative default existed only in tests. | One shared eleven-step API, both actual mounted surfaces, forward/reverse traversal, every result-disclosure boundary, and invalid milestone positions. The active initial construction markup was byte-for-byte identical before and after cleanup. |
| `lcFeasibilityGeometry` and its dedicated tests | Only its own test imported it. `LCMatchingConstruction` uses `lumpedFeasibilityGeometry`, which covers all sixteen LL/CC/LC/CL connection configurations. | The active renderer retains mathematical region/interior/boundary checks. Physical reflection-coordinate invariance was expanded to all eight mixed-connection topologies. |
| Stub-only manual tuning props and handlers in `SingleStubDiagram` and `TransmissionLineDiagram` | Only a legacy test enabled the wrapper's manual callbacks. All current constructions, deductions, and media scenes use static animated stub drawings. | Static projected endpoints, open/short symbols, finite bounds, and periodic labels remain tested. The introductory explorer's main-line pointer and keyboard handlers are unchanged. |
| CSS for the retired panels, result cards, manual stub handles, periodic forms, and old load-type fields | No surviving component or script produces those selector families. Mixed selector groups were split to preserve live layout rules. | Shared chart, line/circuit geometry, responsive layout, focus styling, and guide prose rules remain. |

The import graph was a conservative cross-check, including type-only edges, rather than a proof that every exported symbol is live. The final graph contains no orphan source modules relative to the checked roots. Removal decisions above also required direct call-site and product-behavior evidence.

## Genuine bugs fixed

### Finite pole neighbors became ideal opens or shorts

The shunt evaluator rounded tiny sine/cosine values to zero. For example, an open stub at `0.25 - Number.EPSILON / 8` was treated as an exact infinite-admittance short, and a finite `1e-17` stub could lose its contribution. Separate denominator tolerances similarly collapsed neighboring reactive-line values into exact poles in shunt, quarter-wave, and double-stub evaluation.

The evaluators now preserve exact endpoint and octant cases while evaluating neighboring values with centered trigonometry. Only an exactly zero denominator identifies an ideal pole. Regression tests distinguish both sides of poles from the exact pole; existing open/short and periodic-equivalence tests remain. No infinity was replaced by an arbitrary large constant.

### Finite impedance was lost through rounded reflection coordinates

The shared `solveLine` model reconstructed impedance from the reflection coefficient. Finite extreme loads such as `1e18 Ω` and `1e-18 Ω` could round to `Γ = ±1`, then become an ideal open or short even at distance zero. Their finite VSWR and quarter-wave reciprocal impedances were also lost.

The line model now transfers the known impedance directly using scaled sine/cosine arithmetic and the positive-real-part identity. It computes VSWR from the load using

```text
VSWR = (|z + 1| + |z - 1|)² / (4 Re z).
```

This avoids cancellation in `1 - |Γ|`. Positive normalization underflow is rejected explicitly. Zero/half-wave identity, quarter-wave inversion, ordinary complex propagation, exact ideal loads, and finite extreme loads remain covered. The standalone `reflectionToImpedance` API retains its documented passive-disk tolerance: an already rounded reflection coefficient cannot recover information that it no longer contains.

These fixes added eight regression cases and strengthened normalization-underflow coverage. The new regressions were observed failing before the implementation changes. A second reviewer checked transfer signs, trigonometric branches, scaling identities, and test expectations.

## Verification

| Check | Result |
| --- | --- |
| `npm test` | **831 tests passed in 52 suites**, with no skipped/todo cases. The lower count reflects retired suites and migrated/expanded assertions. |
| `npm run build` | TypeScript checking and the production Vite build passed. |
| `npm run test:models` | **21,936 independently verified solved circuits**, zero failures; worst sampled residual approximately `1.74e-11`. |
| Numerical domain suites | 430 tests passed, including exact poles, finite neighbors, forbidden/continuous states, range guards, and all sixteen lumped configurations. |
| README scene consumers | 243 sampled scenes across Smith, single-stub, and quarter-wave paths rendered without invalid formulas or `NaN`; existing media was not regenerated. |
| Mobile route smoke check | All six laboratories and all six guides loaded at a 390-pixel viewport with no document-level horizontal overflow or formula errors. |
| Single-stub browser interaction | Both branches completed in order; only the active intersection was marked; values appeared on completion and retracted during reverse navigation; invalid inputs removed stale drawings. Termination changes reset the construction. |
| In-progress changes | Changing movement speed and language preserved the active step and progress. |
| Introduction explorer | Main-line Home/End/directional keyboard control and playback remain available. A finite `1e18 Ω` load displayed finite impedance and VSWR. |
| Production browser check | The built single-stub construction reached the verified first match, with no observed console warnings or errors. |
| `git diff --check` | Passed. |

The independent audit uses a fixed seed and elementary physical-unit circuit arithmetic. It verifies solver outputs without calling the production evaluators. Generated lumped networks are inverted from a matched input before synthesis. Pole and extreme-range regressions remain in the normal Vitest suite; the wider deterministic audit is available separately as `npm run test:models`.

The audit also checks branch counts, distinct placements, positive finite component values, and double-stub feasibility independently (1,042 solved and 158 forbidden sampled layouts). Deliberately modified probe solvers that dropped placement branches or classified every double-stub layout as forbidden both caused a nonzero audit exit; an empty solution list cannot pass the circuit checks vacuously.

## Retained code and limits

- `lcMatching` and `lcFeasibility` remain compatibility adapters: current components still use their helpers/types, and their tests contain meaningful edge/range assertions. They are not duplicate synthesis algorithms.
- Numerical evaluation, periodic dimensions/families, and exact-pole APIs remain useful after removal of manual-tuning controls. The introductory explorer remains interactive.
- Compact chart/diagram sizing was retained because the introductory guide and README renderer still use it; it was not stripped by keyword or file name.
- SSR tests establish markup, not React effect/event correctness. Browser checks cover the stated interactions, not every parameter/viewport combination. The operating system's reduced-motion preference was not toggled during this run.
- IEEE-754 representability limits remain: a mathematically finite VSWR above `Number.MAX_VALUE` can still produce `Infinity`. The audit does not claim arbitrary precision.
- Native Windows installation, execution, and uninstallation were not part of the initial audit. The Windows/logo changes were subsequently merged into `development` while retaining the original stash as a backup. See [the follow-up validation](performance-and-windows-validation.md) for the ARM64 packaging fix and animation measurements.

No failing test or build blocker remains in the audited development code. Local detailed logs, import graphs, before/after markup, browser observations, and screenshots are under ignored `test-results/`. The results above describe the initial audit; the follow-up report records subsequent changes and verification.
