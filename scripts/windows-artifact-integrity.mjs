// Offline integrity checks. These do not execute Windows binaries or assess malware.
const nsisSignature = Buffer.from('efbeadde4e756c6c736f6674496e7374', 'hex')
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0)
  return value >>> 0
})

export function crc32(bytes) {
  let value = 0xffffffff
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}

export function verifyNsisCrc(bytes) {
  const offsets = []
  for (let offset = 512; offset + 28 <= bytes.length; offset += 512) {
    if (bytes.subarray(offset + 4, offset + 20).equals(nsisSignature)) offsets.push(offset)
  }
  if (offsets.length !== 1) throw new Error(`Expected one aligned NSIS header, found ${offsets.length}`)
  const offset = offsets[0]
  if (bytes.readUInt32LE(offset) & 4) throw new Error('NSIS CRC is disabled')
  const size = bytes.readUInt32LE(offset + 24)
  const end = offset + size
  if (size < 32 || end > bytes.length) throw new Error('Invalid NSIS block size')
  const expected = bytes.readUInt32LE(end - 4)
  const actual = crc32(bytes.subarray(512, end - 4))
  if (actual !== expected) throw new Error(`NSIS CRC mismatch: expected ${expected.toString(16)}, got ${actual.toString(16)}`)
  return { headerOffset: offset, crc32: expected.toString(16).padStart(8, '0') }
}

export function verifyPeArchitecture(bytes, architecture) {
  const expected = { arm64: 0xaa64, x64: 0x8664 }[architecture]
  if (!expected) throw new Error(`Unsupported application architecture: ${architecture}`)
  if (bytes.length < 64 || bytes.readUInt16LE(0) !== 0x5a4d) throw new Error('Missing DOS executable header')
  const offset = bytes.readUInt32LE(0x3c)
  if (offset + 6 > bytes.length || bytes.readUInt32LE(offset) !== 0x00004550) throw new Error('Invalid PE header')
  const actual = bytes.readUInt16LE(offset + 4)
  if (actual !== expected) throw new Error(`Wrong application architecture: expected ${architecture}, got 0x${actual.toString(16)}`)
  return `0x${actual.toString(16)}`
}

// Nsis7z's install-time decoder cannot read modern ARM64 branch filters.
// Match the upstream NSIS fix: single-stream BCJ with LZMA2, or unfiltered data.
export function verifyNsisPayloadMethods(listing) {
  const methods = new Set()
  for (const line of listing.split(/\r?\n/)) {
    if (!line.startsWith('Method = ')) continue
    for (const method of line.slice(9).trim().split(/\s+/).filter(Boolean)) {
      if (!/^(?:Copy|BCJ|LZMA2(?::\d+)?)$/.test(method)) {
        throw new Error(`NSIS payload uses an unsupported install-time compression filter: ${method}`)
      }
      methods.add(method)
    }
  }
  if (!methods.size) throw new Error('No NSIS payload compression method found')
  return [...methods].sort()
}
