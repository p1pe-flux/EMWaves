# macOS package and signing

**EMWaves 1.0.0** includes all six laboratories and all six guides in English and Spanish.

Build on macOS with the repository's Node.js/npm prerequisites:

```sh
npm ci
npm run package:mac
```

The command generates the Smith-diagram desktop icons, builds the frontend, packages a universal app for **Apple Silicon (`arm64`) and Intel (`x86_64`)**, and runs the artifact verifier. Output filenames use the current package version, for example `release/EMWaves-1.0.0-macOS-universal.dmg`; packaging does not upload it. The disk image contains `EMWaves.app`. A universal package includes both processor architectures; runtime checks on one architecture do not establish behavior on the other.

`npm run icons:desktop` renders the site's SVG logo into desktop assets. On macOS, Apple's `iconutil` compiles the ICNS from the generated icon set. The committed `electron/assets/icon.icns` remains available on other build hosts; PNG and ICO generation also works there.

## Artifact verification

To repeat the macOS checks after packaging:

```sh
node scripts/verify-macos-artifact.mjs
```

Optional arguments select the `.app` path and then the `.dmg` path. The verifier checks:

- Both executable architectures with `lipo`, and the bundle identifier/version with `plutil`.
- The app's code-signature integrity with `codesign --verify --deep --strict`.
- The installed icon against the source ICNS, packaged entry point/version, required resources, and every frontend file against `dist/`.
- A dependency-free runtime manifest, absence of redundant `node_modules`, and the generated frontend license notices.
- The disk image with `hdiutil verify`, then reports its SHA-256.

These are archive, metadata, and signature-integrity checks. They do not prove that Gatekeeper trusts the publisher, that Apple notarized the app, or that every laboratory runs correctly on native macOS.

## Local signing and distribution limits

The test configuration explicitly uses `mac.identity: "-"` for **ad-hoc signing**, keeps hardened runtime enabled, and supplies `allow-jit` and `disable-library-validation` entitlements in `electron/entitlements.mac.plist`. These follow electron-builder 26's documented requirements for locally signed Electron apps without an Apple Team ID. See the [official macOS signing documentation](https://www.electron.build/v26/docs/features/code-signing/code-signing-mac/).

This is **not a Developer ID signature**, and notarization is disabled. The DMG itself is unsigned. An ad-hoc signature checks local code integrity without identifying an Apple-approved publisher. For trusted external distribution, configure a Developer ID Application certificate and Apple's notarization workflow; preserve private signing credentials outside Git. No macOS security settings are changed by the packaging command.

Validate installation, launch, all six laboratories and full guides in both languages, and removal on each supported processor architecture before broad distribution. Keep native execution results distinct from successful web builds and artifact verification.
