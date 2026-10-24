# Portability and distribution

EMWaves uses relative application assets and shared JavaScript electrical models. The compiled frontend includes its equations, KaTeX fonts, styles, and guide content. Laboratories and guides do not need an external service to calculate or render; external references require a connection when opened. The desktop package includes Electron and does not require Node.js on the destination computer.

## Targets and names

| Target | Package command | Distribution filename |
| --- | --- | --- |
| Windows Intel/AMD 64-bit | `npm run package:win` | `EMWaves-<version>-Windows-x64-Setup.exe` |
| Windows ARM64 | `npm run package:win:arm64` | `EMWaves-<version>-Windows-arm64-Setup.exe` |
| macOS Intel and Apple Silicon | `npm run package:mac` | `EMWaves-<version>-macOS-universal.dmg` |
| Linux Intel/AMD 64-bit | `npm run package:linux` | `EMWaves-<version>-Linux-x64.AppImage` |
| Linux ARM64 | `npm run package:linux:arm64` | `EMWaves-<version>-Linux-arm64.AppImage` |

These commands create local files. A target in this table does not mean a download has been published or tested on every operating-system version. Use the [release assets](https://github.com/p1pe-flux/EMWaves/releases) to establish what is available. There are no 32-bit installers. Operating-system and graphics requirements follow the pinned Electron runtime; older operating systems and arbitrary Linux distributions are not implied to work.

The application name is **EMWaves** in the window, desktop metadata, menus, and packaged manifest. The npm package identifier remains `emwaves`, and the desktop identifier is `org.emwaves.lab`. The desktop runtime may keep its locale and cache in the operating system's normal application-data directory; no personal directory from a build machine is required. Earlier builds with a lowercase runtime name may use a separate locale/cache folder on case-sensitive filesystems.

## Browser and native checks

The browser suite runs the desktop interactions in Chromium, Firefox, and WebKit, plus a narrow mobile viewport in Chromium. It checks a production build served from a subdirectory, local assets across all twelve laboratory/guide routes, denied browser storage, and unavailable optional observation/font APIs. WebKit testing is useful engine coverage; it does not establish behavior on every Safari or iOS release. Use a modern browser compatible with [Vite's build target](https://vite.dev/guide/build#browser-compatibility).

CI defines a Linux x64 application job and native desktop jobs for Windows x64/ARM64, macOS Intel/Apple Silicon, and Linux ARM64. Those jobs run unit/tooling checks, launch the production Electron entry, and verify the native application archive. The runner labels are selected from [GitHub's supported runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners). Newly configured jobs must run successfully before being described as validated.

Archive checks establish packaged application contents. The platform-specific Windows and macOS artifact verifiers also inspect executable architectures. These checks do not establish interactive installation, uninstallation, signing trust, or compatibility with every GPU, security product, desktop session, and operating-system version. Keep native installation/removal checks for both Windows architectures and native launch checks for both macOS architectures in the release checklist. See the platform guides for signing status and the Linux AppImage launcher limitation.

## File locations

- `src/`, `public/`, and `electron/` contain application sources and runtime assets.
- `docs/` contains reusable public documentation; `docs/media/` contains generated README media.
- `dist/`, `.desktop/`, and `release/` contain ignored generated output. Distribute installers through Releases, outside the source tree.
- `.local/` contains ignored private reports and working notes. Local assistant/editor configuration and test output remain ignored.

`npm run check:public` checks current publishable files and the Git index. It cannot remove old commits, pull-request references, cached pages, or previously uploaded artifacts. Review those publication surfaces separately when preparing a release.
