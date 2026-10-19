# Windows installers and trust

Build separate installers for Intel/AMD x64 and native Windows ARM64:

```sh
npm ci
npm run package:win
npm run package:win:arm64
```

The installers are written to `release/`. Copy the installer matching the PC's architecture; the destination PC does not need Node.js. Desktop and setup icons are generated from the site's Smith-diagram logo. Packaging commands do not upload artifacts. A successful cross-build on macOS checks packaging, not installation or runtime behavior on Windows. Test installation, all six laboratories, the guides available on the packaged branch, shortcuts, and uninstallation on each Windows architecture before broad distribution.

The shared packaging wrapper stages a dependency-free Electron app under ignored `.desktop/app`. The built frontend and third-party notices are included; frontend `node_modules` are excluded. Archive verification checks every frontend/runtime file against the current build and rejects stale content, extra dependencies, and missing notices. The ARM64-compatible BCJ compression setting remains in force.

The ARM64 installer is for a native ARM64 Windows PC, such as a Snapdragon device. An Intel or AMD PC needs the x64 installer. The setup wrapper itself is x86 so it can start on both kinds of PC; its PE architecture does not identify the architecture of the application embedded inside it.

Both Windows packaging commands use a cross-platform Node wrapper that pins the embedded application's compression filter to single-stream `BCJ`, then run an offline artifact check. The check verifies installer and embedded-uninstaller NSIS CRCs, install-time-compatible payload codecs, the architecture-specific payload, the actual application PE machine, required Electron resources and DLLs, application entry point/version, and logo image bytes in the executable and packaged resources. To repeat the check on an existing installer, use `node scripts/verify-windows-artifact.mjs arm64` or `x64`; an optional third argument selects a different installer path. `npm run test:windows-artifacts` checks the verifier against altered, truncated, disabled-CRC, wrong-architecture, and unsupported-codec fixtures. These checks do not establish antivirus trust or validate installation/runtime on Windows.

## Missing shortcut or missing EMWaves.exe

A “Missing Shortcut” dialog means Windows cannot resolve the shortcut target at that moment. It does not establish whether antivirus removed the file, extraction failed, or the wrong installer was used.

The original ARM64 artifact contains a confirmed packaging defect: its embedded `app-arm64.7z` uses `ARM64 LZMA2:20` for `EMWaves.exe` and its DLLs. The `Nsis7z` decoder used at installation cannot read that branch-conversion filter. It can leave data files installed while omitting executable binaries, matching the reported ARM64 Windows directory. This is the defect documented by the electron-builder maintainer in [the v26 fix](https://github.com/electron-userland/electron-builder/pull/9989) and [its implementation](https://github.com/electron-userland/electron-builder/pull/9988). The final corrected diagnosis in [issue #9983](https://github.com/electron-userland/electron-builder/issues/9983) distinguishes the ARM64 filter failure from the initial BCJ2 hypothesis.

The original payload itself is intact: it includes `EMWaves.exe` with PE machine `0xaa64`, matching the unpacked build, and the setup/uninstaller CRCs pass. A modern desktop 7-Zip can extract it; that alone does not prove compatibility with the older decoder inside the installer. The permanent verifier now rejects that exact original artifact specifically for its `ARM64` codec. No executable-name mismatch or antivirus quarantine was established by the screenshots.

`scripts/package-windows.mjs` now forces `ELECTRON_BUILDER_7Z_FILTER=BCJ` for the pinned electron-builder version, matching the maintainer's supported-filter fix without changing the dependency tree. The verifier rejects `ARM64`, `BCJ2`, and unknown payload filters. New installers must pass that check before the packaging command succeeds. Installation, launch, all laboratories/guides, shortcuts, and uninstallation still require a smoke test on Windows.

Inspection of the installed electron-builder 26 NSIS templates also found a separate control-flow gap: an ARM64-only setup has no rejection path for a non-ARM64 PC; its payload selector remains empty on that path even though shortcut creation follows. This finding comes from tracing `common.nsh`, `include/extractAppPackage.nsh`, and `installSection.nsh`, not a Windows execution test. `electron/installer.nsh` now rejects that architecture before installation. It also checks that extraction produced `EMWaves.exe` before registry entries or shortcuts are created. The reported PC is ARM64, so that separate wrong-architecture path does not explain this incident.

Start with **Settings → System → About → System type** and **Windows Security → Virus & threat protection → Protection history**. Keep protections enabled. To gather the relevant local facts, run the read-only report from this repository in PowerShell:

```powershell
.\scripts\diagnose-windows.ps1 -InstallerPath 'C:\Users\me\Downloads\EMWaves-0.1.0-Windows-arm64-Setup.exe'
```

For a custom installation folder, add `-InstallDirectory 'D:\Apps\EMWaves'`. The report reads native processor architecture, registered EMWaves installation paths, matching Desktop/Start menu shortcut targets, executable presence/architecture/hash/signature, and EMWaves-related Defender detections. It does not execute EMWaves, write shortcuts, restore quarantined files, or change security settings. Missing Defender records do not rule out other security products or expired history. Paths may contain the Windows user name; review before sharing. If PowerShell policy prevents script execution, use the manual checks above rather than changing policy.

The architecture mapping comes from Microsoft's [Win32_Processor documentation](https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-processor), and detection history uses [Get-MpThreatDetection](https://learn.microsoft.com/en-us/powershell/module/defender/get-mpthreatdetection).

## Understand the warning

“Windows protected your PC” or an unrecognized publisher warning can indicate insufficient SmartScreen reputation; it is different from an antivirus report naming a threat. Signed new applications can still receive reputation warnings. EV certificates no longer provide an automatic SmartScreen exemption, and a self-signed certificate does not establish public trust. A logo identifies the app visually but does not establish security trust. See Microsoft's [SmartScreen guidance](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation).

## Prepare a signed release

Use a publicly trusted Authenticode code-signing certificate or an eligible managed signing service. Configure the signing provider for the installed electron-builder version, protect its private key, and sign both the packaged application executables and the final installer. Include a trusted timestamp so signatures can remain valid after the signing certificate expires. Keep the publisher identity consistent and do not modify signed files afterward. See the [Windows signing documentation](https://www.electron.build/docs/features/code-signing/code-signing-win/) and the [configuration reference for electron-builder 26](https://www.electron.build/v26/docs/win/).

For a supported certificate-file workflow, electron-builder accepts `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` through the build environment. Keep certificates and passwords outside Git; use the provider's secure key or cloud workflow when required. A build without signing credentials is an unsigned test build, not a signed public release.

## Check the exact files on Windows

In PowerShell, substitute the downloaded installer's actual path:

```powershell
$emwavesInstaller = '.\EMWaves-installer.exe'
Get-FileHash -LiteralPath $emwavesInstaller -Algorithm SHA256
Get-AuthenticodeSignature -LiteralPath $emwavesInstaller |
    Format-List Status, StatusMessage, SignerCertificate, TimeStamperCertificate
```

Compare SHA-256 with the checksum shared through the trusted release channel. A matching hash checks that the file is unchanged; it is not a malware verdict. A signed release should report `Valid` with the expected publisher. Check the installed `EMWaves.exe` the same way; unsigned test builds report `NotSigned`. See [Get-FileHash](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/get-filehash) and [Get-AuthenticodeSignature](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/get-authenticodesignature).

## If antivirus identifies a threat

Record the product, detection name, file path, SHA-256, and definition version. Investigate the reported file and submit a suspected false positive to [Microsoft Security Intelligence](https://www.microsoft.com/en-us/wdsi/filesubmission), selecting the software-developer route and the relevant security product. Submit the specific detected file, following the portal's current requirements. For another antivirus vendor, use that vendor's official review channel.

Signing and review can reduce interruptions; neither guarantees every security product will accept an application. Keep Windows protections enabled while testing. No installer has been submitted to a security vendor automatically.
