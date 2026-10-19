import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

// Keep the desktop identity identical to the Smith diagram used by the website.
// PNG-compressed ICO entries are supported by the Windows versions Electron supports.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = await readFile(path.join(root, 'public', 'favicon.svg'))
const output = path.join(root, 'electron', 'assets')
const sizes = [16, 24, 32, 48, 64, 128, 256]
const png = await sharp(source, { density: 1152 })
  .resize(1024, 1024)
  .ensureAlpha()
  .png()
  .toBuffer()

const entries = await Promise.all(sizes.map(async (size) => ({
  size,
  data: await sharp(png).resize(size, size).png().toBuffer(),
})))

const directory = Buffer.alloc(6 + entries.length * 16)
directory.writeUInt16LE(1, 2) // Image type: icon.
directory.writeUInt16LE(entries.length, 4)
let offset = directory.length

for (const [index, { size, data }] of entries.entries()) {
  const entry = 6 + index * 16
  directory.writeUInt8(size === 256 ? 0 : size, entry)
  directory.writeUInt8(size === 256 ? 0 : size, entry + 1)
  directory.writeUInt16LE(1, entry + 4) // Color planes.
  directory.writeUInt16LE(32, entry + 6) // RGBA color depth.
  directory.writeUInt32LE(data.length, entry + 8)
  directory.writeUInt32LE(offset, entry + 12)
  offset += data.length
}

await mkdir(output, { recursive: true })
await writeFile(path.join(output, 'icon.png'), png)
await writeFile(path.join(output, 'icon.ico'), Buffer.concat([
  directory,
  ...entries.map(({ data }) => data),
]))
// Use Apple's icon compiler on macOS; other platforms retain the committed ICNS.
if (process.platform === 'darwin') {
  const temporary = await mkdtemp(path.join(tmpdir(), 'emwaves-icon-'))
  const iconset = path.join(temporary, 'EMWaves.iconset')
  try {
    await mkdir(iconset)
    for (const size of [16, 32, 128, 256, 512]) {
      for (const scale of [1, 2]) {
        const pixels = size * scale
        const name = `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`
        await writeFile(path.join(iconset, name), await sharp(png).resize(pixels, pixels).png().toBuffer())
      }
    }
    execFileSync('/usr/bin/iconutil', ['--convert', 'icns', '--output', path.join(output, 'icon.icns'), iconset])
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}
console.log('Generated desktop PNG/ICO icons' + (process.platform === 'darwin' ? ' and macOS ICNS.' : '.'))
