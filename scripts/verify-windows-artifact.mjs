import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSevenZipExecutable } from './desktop-tooling.mjs'
import { readDesktopArchiveFile, verifyDesktopArchive } from './verify-desktop-archive.mjs'
import { verifyNsisCrc, verifyPeArchitecture, verifyNsisPayloadMethods } from './windows-artifact-integrity.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const architecture = process.argv[2]
if (!['x64', 'arm64'].includes(architecture)) throw new Error('Usage: node scripts/verify-windows-artifact.mjs x64|arm64 [installer-path]')
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const installer = path.resolve(root, process.argv[3] ?? `release/EMWaves-${packageJson.version}-Windows-${architecture}-Setup.exe`)
const installerBytes = await readFile(installer)
const installerCrc = verifyNsisCrc(installerBytes)
const sevenZip = await getSevenZipExecutable()
const temporary = await mkdtemp(path.join(tmpdir(), 'emwaves-verify-'))
const run7z = (args) => execFileSync(sevenZip, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
const archivePaths = (listing) => listing.split(/\r?\n/).filter((line) => line.startsWith('Path = ')).map((line) => line.slice(7).replaceAll('\\', '/'))
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
function verifyLogoImages(executable, icon) {
  if (icon.length < 6 || icon.readUInt16LE(2) !== 1) throw new Error('Invalid desktop ICO')
  const sizes = []
  for (let index = 0; index < icon.readUInt16LE(4); index++) {
    const directoryOffset = 6 + 16 * index
    const size = icon.readUInt32LE(directoryOffset + 8)
    const offset = icon.readUInt32LE(directoryOffset + 12)
    if (!size || offset + size > icon.length || !executable.includes(icon.subarray(offset, offset + size))) {
      throw new Error('An expected Smith-logo image is missing from the PE executable')
    }
    sizes.push(icon[directoryOffset] || 256)
  }
  if (!sizes.length) throw new Error('Desktop ICO contains no logo images')
  return sizes
}

try {
  const setupPaths = archivePaths(run7z(['l', '-slt', installer]))
  const expectedPayload = `$PLUGINSDIR/app-${architecture === 'x64' ? '64' : 'arm64'}.7z`
  const payloads = setupPaths.filter((entry) => /\/app-[^/]+\.7z$/.test(entry))
  if (payloads.length !== 1 || payloads[0] !== expectedPayload) throw new Error(`Unexpected embedded application payloads: ${payloads.join(', ')}`)
  const uninstallers = setupPaths.filter((entry) => entry.endsWith('/Uninstall EMWaves.exe'))
  if (uninstallers.length !== 1) throw new Error('Expected one embedded EMWaves uninstaller')
  run7z(['e', installer, `-o${temporary}`, '-y', expectedPayload, uninstallers[0]])
  const uninstallerCrc = verifyNsisCrc(await readFile(path.join(temporary, 'Uninstall EMWaves.exe')))
  const payload = path.join(temporary, path.basename(expectedPayload))
  const payloadListing = run7z(['l', '-slt', payload])
  const payloadMethods = verifyNsisPayloadMethods(payloadListing)
  const applicationPaths = archivePaths(payloadListing)
  for (const required of ['EMWaves.exe', 'ffmpeg.dll', 'd3dcompiler_47.dll', 'vulkan-1.dll', 'vk_swiftshader.dll', 'resources/app.asar', 'icudtl.dat', 'resources.pak', 'locales/es.pak']) {
    if (!applicationPaths.includes(required)) throw new Error(`Application payload is missing ${required}`)
  }
  run7z(['x', payload, `-o${temporary}`, '-y', 'EMWaves.exe', 'resources/app.asar'])
  const applicationBytes = await readFile(path.join(temporary, 'EMWaves.exe'))
  const peMachine = verifyPeArchitecture(applicationBytes, architecture)
  const desktopIcon = await readFile(path.join(root, 'electron', 'assets', 'icon.ico'))
  const logoSizes = verifyLogoImages(applicationBytes, desktopIcon)
  const appAsar = path.join(temporary, 'resources', 'app.asar')
  const packagedConfig = JSON.parse(readDesktopArchiveFile(appAsar, 'package.json').toString())
  if (packagedConfig.version !== packageJson.version || packagedConfig.main !== 'electron/main.cjs') throw new Error('Unexpected packaged application metadata')
  for (const required of ['dist/index.html', 'electron/main.cjs', 'electron/assets/icon.ico', 'electron/assets/icon.png']) {
    if (!readDesktopArchiveFile(appAsar, required).length) throw new Error(`Empty packaged resource: ${required}`)
  }
  const packagedIcon = readDesktopArchiveFile(appAsar, 'electron/assets/icon.ico')
  if (!packagedIcon.equals(desktopIcon)) throw new Error('Packaged logo differs from the current desktop icon')
  const archiveVerification = await verifyDesktopArchive(appAsar, root)
  console.log(JSON.stringify({ installer: path.relative(root, installer), architecture, sha256: sha256(installerBytes), installerCrc, uninstallerCrc, payloadMethods, application: 'EMWaves.exe', peMachine, applicationSha256: sha256(applicationBytes), logoSizes, ...archiveVerification, resourcesVerified: true, windowsRuntimeTested: false }, null, 2))
} finally {
  await rm(temporary, { recursive: true, force: true })
}
