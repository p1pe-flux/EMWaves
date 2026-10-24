# Linux packages

Build on a Linux desktop with the repository's Node.js/npm prerequisites:

```sh
npm ci
npm run package:linux
```

For a native ARM64 machine, use `npm run package:linux:arm64`. Output is written to `release/` with the current package version and target architecture in the filename, for example `EMWaves-1.0.1-Linux-x64.AppImage` or `EMWaves-1.0.1-Linux-arm64.AppImage`. Packaging commands do not upload files. Use a matching Linux build host for release validation; a package for another architecture does not demonstrate that it runs there.

The AppImage bundles the application and Electron; the destination computer does not need Node.js, npm, this repository, or the build computer's directories. It still requires a graphical Linux environment and the system libraries supported by the pinned Electron version. There is no 32-bit Linux package in this project.

## Running and validating

Make the downloaded file executable using the file manager or `chmod +x` and open it as an ordinary user. The default electron-builder AppImage toolset uses FUSE 2; distributions with only FUSE 3 may need their distribution's FUSE 2 compatibility library. See the [AppImage FUSE documentation](https://docs.appimage.org/user-guide/troubleshooting/fuse.html) for distribution-specific prerequisites.

Before distributing an AppImage, test launch, all six laboratories and guides in both languages, external guide citations, and removal on each target architecture. Record the distribution, architecture, desktop session, and package SHA-256 alongside the result. A successful frontend build or archive check does not establish those native behaviors.

The packaging wrapper checks the actual `resources/app.asar` against the completed frontend and desktop sources, including every bundled application file, dependency notices, entry point and version. It rejects redundant `node_modules` and unexpected files. To repeat that check on an unpacked application:

```sh
node scripts/verify-desktop-archive.mjs release/linux-unpacked/resources/app.asar
```

For ARM64, replace `linux-unpacked` with `linux-arm64-unpacked`. This checks application contents; it does not test the AppImage runtime, FUSE, graphics, or installation on another computer.

## AppImage sandbox limitation

The pinned electron-builder AppImage launcher adds `--no-sandbox` when its user-namespace probe fails. The project supplies an empty `appImage.executableArgs` list so the desktop entry does not request that flag unconditionally; the launcher's fallback remains. The direct Electron smoke test exercises the production application entry without the AppImage launcher. Its sandbox result therefore does not establish the sandbox state of an AppImage launch. Review this launcher behavior before publishing Linux packages; no Linux download is claimed merely because packaging is available. The [portability guide](portability.md) records the broader platform scope and validation limits.
