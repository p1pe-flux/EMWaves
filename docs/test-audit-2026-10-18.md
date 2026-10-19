# Development test, legacy-code and security audit

Date: October 18, 2026. Branch: `development`, starting at `71fbe21`.

Three parallel reviews covered legacy-code reachability, active test quality, and security/desktop tooling. The initial unit baseline passed **978 tests in 58 suites**, the production build, **21,936 independent circuit realizations**, and the existing desktop/installer checks. No code was called obsolete because a test failed. The final audit retains every test suite and increases the unit count to **980**.

The current checkout exposes six laboratories, six full guides and both languages. That live scope was preserved. The incoming README edits and Linux sandbox CI preparation were preserved; this audit adds one dependency-audit CI step. No commit, publication, repository-visibility change or release upload was performed.

## Evidence required before removal

The conservative import graph covered runtime entry points, dynamic guide routes, all source files, the README renderer, model-audit scripts, configuration and tests. All **82 non-test source modules** remain reachable. Type-only edges make this a candidate filter, so each removed symbol also required direct call-site inspection. No source module or complete test suite was deleted.

| Removed code | Proof of obsolescence | Coverage preserved |
| --- | --- | --- |
| Compact guide-panel props/classes in the five matching guides/constructions and the single-stub deduction | Live guide wrappers and laboratory consumers never enable them. Only tests and the obsolete prop-forwarding chain activated this mode; the former panels were already absent. README media uses diagrams directly. | Mathematical deductions, wavelength families, accessible lesson regions, formulas and branch assertions now target the actual full guides. Ten default guide renders, five topics in both languages, were byte-for-byte identical before and after. |
| Compact wrapper modes in `ReflectionExplorer` and `TransmissionLineExample` | Their only runtime consumer, `SmithGuidePage`, passes no compact flag. Media scripts import neither widget. | Four additional default English/Spanish renders were identical. Controlled impedance APIs and the live compact `TransmissionLineDiagram` remain. |
| `advanceSingleStubStep`, LC/series advance aliases, LC/series progress aliases, and `doubleStubProgress` | Searches found definitions, alias exports and their own tests, with no runtime caller. All matching constructions already use `useStepPlayback`. | Ten new cases exercise the active reducer through every real forward/reverse timeline, including canonical, tangent and no-discrete-solution states. Active interpolation, timing validation, endpoint, speed and disclosure tests remain. |
| Exclusive CSS for those compact modes | No surviving component or script produces the classes. | Live selectors and their specificity were retained. Existing negative compact-class exclusions remain semantically redundant to avoid changing the cascade during cleanup. |

Live LC compatibility adapters, numerical evaluators, periodic families, introductory drag/keyboard controls and geometry helpers were retained. Their names or test seams were insufficient evidence of obsolescence. A second reviewer independently checked the removals and coverage migration.

## Genuine defects fixed

### Secondary touches stole the transmission-line drag

The line diagram accepted a nonprimary second touch and replaced the active pointer. Ending an unrelated pointer also cleared the drag. The component now accepts only an idle primary pointer and releases only its owning pointer.

The new Chromium regression uses real simultaneous touch contacts through CDP. Before the fix a second finger changed the reading from approximately `0.25λ` to `0.75λ`; afterward it leaves the reading unchanged, and the first finger continues moving after the second is lifted. The failing-before trace and passing regression were retained locally.

### Electron permission checks contradicted denied requests

The production session denied permission requests but omitted the separate permission-check handler. In a fresh native profile, seven capability queries reported `granted`. Added regression assertions failed before the fix. Both handlers now deny access, following [Electron's permission-handling API](https://www.electronjs.org/docs/latest/api/session#sessetpermissioncheckhandlerhandler).

The native smoke test verifies geolocation, notifications, MIDI, camera, microphone and clipboard read/write queries, an actual notification request, sandboxing, context isolation, disabled Node integration, citation handling and both languages. This establishes the stated checks, without claiming that every device API was exploited before the fix.

### Vite scanned archived benchmarks as application entries

README preview generation exposed an optimizer warning: Vite followed ignored `test-results/performance/index.html` into historical source snapshots and attempted to resolve removed `mathjs` and `react-markdown` dependencies. Explicit `optimizeDeps.entries: ['index.html']` confines entry discovery to the application. The same preview command then completed without that warning. Historical evidence was preserved rather than deleted to conceal the failure.

## Security dependency remediation

The initial full npm audit reported **eight moderate affected package nodes from one advisory**, [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c): unbounded precision in `sprintf-js <=1.1.3`. The affected development chain was:

```text
app-builder-lib → @electron/get 3.1.0 → global-agent 3.0.0
  → roarr 2.15.4 → sprintf-js 1.1.3
```

A narrowly scoped override replaces only this `roarr` with **6.0.0**, removing `sprintf-js`. Builder and HTTP/TLS downloader versions are unchanged. Source review and independent enabled-logging probes verified the actual default logger, child contexts and log-level APIs. No caller consumes the changed log metadata described in the [roarr 6 release](https://github.com/gajus/roarr/releases/tag/v6.0.0).

Two committed integration tests use the downloader resolved from the pinned builder. Local fixtures verify proxy routing, good and corrupted SHA256 downloads, `NO_PROXY`, enabled JSON logging and remote precision-like text remaining literal context. Separate HTTPS CONNECT probes on the accepted dependency tree verified certificate rejection, explicit CA trust, hostname/SNI and checksums. Fixture private keys were ephemeral and removed.

Broader transport upgrades were rejected after real incompatibilities surfaced: global-agent 4 lost custom CA/SNI behavior, and downloader 5 does not honor builder's Got transport options/retry error shape. A clean advisory count alone was not accepted as proof of compatibility. No advisory was ignored and no security test was removed. Both final full and production-only audits report **zero known vulnerabilities** after a fresh `npm ci`. CI now runs `npm audit --audit-level=moderate`.

Other reviewed controls include restricted HTTPS citation hosts, denied navigation/popups, handled external-launch failures, sandbox/context isolation, build-time Markdown sanitization, KaTeX with trust disabled, bounded/escaped formula rendering, CSP, dependency-free staging and archive byte verification. This is a scoped audit, not a claim of comprehensive security certification. The proxy-log credential exposure identified here was subsequently fixed for the supported build tools, as described below.

## Final verification

| Check | Result |
| --- | --- |
| Fresh `npm ci` | Passed; zero reported vulnerabilities. |
| `npm test` | **980 passed / 58 suites**, no skipped/todo cases. |
| `npm run build` | TypeScript and production Vite passed. |
| `npm run test:models` | **21,936** realizations, zero failures, maximum sampled reflection residual approximately **1.74e-11**. |
| Audit negative controls | Missing branches, false forbidden classifications and wrong stub lengths each produced a nonzero exit and substantive failures. Production solvers were not modified for these probes. |
| `npm run test:desktop` | **14 passed**, including two real downloader/proxy/logging tests. |
| `npm run test:windows-artifacts` | **8 passed** CRC/header/architecture/codec fixtures. |
| Playwright | **43 passed**, covering all guides/languages, matching forward/reverse/reset/input behavior, reduced motion, focus, multitouch, mobile layouts, recovery and loading budget. |
| Native Electron smoke | Passed on macOS ARM64, Electron 44.7.1; all added permission checks denied, sandbox enabled. |
| macOS ARM64 directory package | Built and archive-verified: 102 frontend files, 2 runtime files, 110 archive files, zero bundled `node_modules`. |
| README SVG/PNG previews | All three generated successfully; existing GIF assets unchanged. |
| Full / production npm audit | Both passed with zero vulnerabilities. |
| `git diff --check` | Passed. |

The final logger-only dependency change was followed by another clean install and complete unit/build/model/desktop checks. All **102 production output files** had identical SHA256 hashes to the build that passed all 43 browser tests. The existing directory package was reverified against that final build. Browser tests were not needlessly repeated for byte-identical production output.

## Remaining limits

- No failing application test, build or known npm advisory remains. Native Windows/Linux execution and installation/uninstallation were not validated on this macOS host; fixture checks do not establish native installer behavior.
- The new multitouch regression uses Chromium emulation, not a physical phone or Safari. No exhaustive browser/parameter combination or percentage coverage claim is made.
- The audit package is ad-hoc signed and not notarized. Existing Windows distribution signing remains outside this audit. Publisher authentication requires a separate signing/release workflow.
- CI changes were inspected locally; a remote GitHub Actions run was not triggered or claimed.
- npm emitted install-script approval warnings for `electron-winstaller` and optional `fsevents`; they did not block the configured NSIS-oriented fixtures, native Electron smoke or macOS directory packaging. Their other installation paths were not validated.

Detailed local reports, import/markup evidence and command logs are retained under ignored `test-results/audit-2026-10-18/`; this document records the durable results.

## Follow-up: proxy-log credential redaction

The build tools now redact sensitive data at the pinned Roarr logger's serialized output sink, before any stdout/stderr/custom writer receives it. Logging remains opt-in with `ROARR_LOG=true`; enabled initialization, routing, connection, status, error and bypass diagnostics remain available. Proxy configuration, request headers and TLS options used by the actual connection are not modified.

`scripts/proxy-log-redaction.cjs` loads the exact logger resolved from the builder's downloader/proxy dependencies before wrapping its writer. Installing a writer before that first import would be overwritten by Roarr initialization. The guard is idempotent and retains the selected output stream, custom writer return values/receiver, and writer failures. Invalid serialized records produce a visible safe diagnostic without echoing their original contents.

The guard removes URL userinfo throughout messages and nested records, decoded proxy authorization, sensitive HTTP headers, password/passphrase/private-key fields, and TLS key/PFX buffers. It preserves endpoint hosts/ports/paths, timestamps, log levels, statuses, public certificate/CA data and ordinary headers. It also handles invalid proxy configuration logged before validation, such as a credential-bearing proxy setting without a scheme. Source objects are copied rather than changed; cycles and literal JSON prototype keys are handled safely.

Two independently reproduced edge cases were fixed during review: the pinned legacy URL parser accepts raw line breaks in userinfo and backslash authority delimiters. Both bypassed the first URL pattern and now have passing regressions, alongside percent-encoded, malformed and SOCKS-style URL cases.

The packaging Node child preloads the guard with `--require`, and `desktop-tooling.mjs` imports it before loading builder toolsets. These cover the supported package commands and Windows verification path. The guard is development-only and is excluded from staged application files. Direct third-party CLI calls outside these entry points require an explicit preload, for example:

```sh
node --require ./scripts/proxy-log-redaction.cjs ./node_modules/electron-builder/cli.js --help
```

Regression tests first observed an authenticated download complete successfully while credentials leaked into its logs. With the guard, both the builder-preload and actual tooling-import paths retain correct wire authentication, checksums, corruption rejection, `NO_PROXY` behavior and useful enabled logs, while raw, encoded and Basic credential forms are absent from captured output. Thirteen redactor/writer cases plus three downloader cases pass. No dependency or HTTP/TLS transport implementation was changed in this follow-up.

Follow-up verification: **28 desktop tests**, **8 installer fixtures**, **980 unit tests**, production build and full npm audit passed. An actual macOS ARM64 directory package also succeeded through a local authenticated forwarding proxy with tracing enabled: **2 authenticated requests, zero dummy credential matches in captured output**, and a verified dependency-free application archive. The forwarding proxy removed its authorization header before forwarding to the destination. Frontend behavior was unchanged; the earlier 43 browser checks were not repeated for this build-tool-only change.

This protection applies to the supported Roarr build-log paths. It does not claim to sanitize arbitrary unrelated debug libraries, third-party commands launched directly without the guard, or logs produced before the guard is installed. Native Windows/Linux and distribution-signing limitations from the audit remain.
