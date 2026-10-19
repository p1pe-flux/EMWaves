import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyDesktopArchive } from './verify-desktop-archive.mjs'

if (process.platform !== 'darwin') throw new Error('Verify macOS packages on macOS.')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const app = path.resolve(root, process.argv[2] ?? 'release/mac-universal/EMWaves.app')
const dmg = path.resolve(root, process.argv[3] ?? `release/EMWaves-${config.version}-macOS-universal.dmg`)
const info = JSON.parse(execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', path.join(app, 'Contents', 'Info.plist')], { encoding: 'utf8' }))
if (info.CFBundleShortVersionString !== config.version || info.CFBundleIdentifier !== config.build.appId) {
  throw new Error('Unexpected macOS bundle version or identifier.')
}
const executable = path.join(app, 'Contents', 'MacOS', info.CFBundleExecutable)
const architectures = execFileSync('/usr/bin/lipo', ['-archs', executable], { encoding: 'utf8' }).trim().split(/\s+/).sort()
if (architectures.join(',') !== 'arm64,x86_64') throw new Error(`Expected a universal Mac app; found ${architectures.join(', ')}.`)
execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', app], { stdio: ['ignore', 'pipe', 'pipe'] })
const resources = path.join(app, 'Contents', 'Resources')
const iconName = info.CFBundleIconFile.endsWith('.icns') ? info.CFBundleIconFile : `${info.CFBundleIconFile}.icns`
if (!(await readFile(path.join(resources, iconName))).equals(await readFile(path.join(root, 'electron', 'assets', 'icon.icns')))) {
  throw new Error('The macOS app logo does not match the source icon.')
}
const archive = path.join(resources, 'app.asar')
const archiveVerification = await verifyDesktopArchive(archive, root)
execFileSync('/usr/bin/hdiutil', ['verify', dmg], { stdio: ['ignore', 'pipe', 'pipe'] })
const bytes = await readFile(dmg)
console.log(JSON.stringify({
  app: path.relative(root, app), dmg: path.relative(root, dmg), version: config.version,
  architectures, ...archiveVerification, sizeBytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  signatureVerified: true, signingIdentity: 'ad-hoc', notarized: false,
}, null, 2))
