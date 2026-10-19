import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { crc32, verifyNsisCrc, verifyPeArchitecture, verifyNsisPayloadMethods } from './windows-artifact-integrity.mjs'

function nsisFixture() {
  const bytes = Buffer.alloc(1100)
  bytes.writeUInt32LE(0, 512)
  Buffer.from('efbeadde4e756c6c736f6674496e7374', 'hex').copy(bytes, 516)
  bytes.writeUInt32LE(80, 536)
  bytes.writeUInt32LE(crc32(bytes.subarray(512, 588)), 588)
  return bytes
}

function peFixture(machine) {
  const bytes = Buffer.alloc(256)
  bytes.writeUInt16LE(0x5a4d)
  bytes.writeUInt32LE(128, 0x3c)
  bytes.writeUInt32LE(0x00004550, 128)
  bytes.writeUInt16LE(machine, 132)
  return bytes
}

test('CRC uses the published CRC-32 check vector', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926)
})

test('NSIS verification accepts a valid block with trailing installer data', () => {
  assert.equal(verifyNsisCrc(nsisFixture()).headerOffset, 512)
})

test('NSIS verification rejects altered payloads and disabled CRC', () => {
  const damaged = nsisFixture()
  damaged[550] ^= 1
  assert.throws(() => verifyNsisCrc(damaged), /CRC mismatch/)
  const disabled = nsisFixture()
  disabled.writeUInt32LE(4, 512)
  assert.throws(() => verifyNsisCrc(disabled), /disabled/)
})

test('NSIS verification rejects missing, duplicated and truncated headers', () => {
  assert.throws(() => verifyNsisCrc(Buffer.alloc(1024)), /found 0/)
  const duplicated = Buffer.concat([nsisFixture(), Buffer.alloc(1024)])
  Buffer.from('efbeadde4e756c6c736f6674496e7374', 'hex').copy(duplicated, 1028)
  assert.throws(() => verifyNsisCrc(duplicated), /found 2/)
  assert.throws(() => verifyNsisCrc(nsisFixture().subarray(0, 580)), /block size/)
})

test('PE architecture verification distinguishes ARM64 from x64', () => {
  assert.equal(verifyPeArchitecture(peFixture(0xaa64), 'arm64'), '0xaa64')
  assert.equal(verifyPeArchitecture(peFixture(0x8664), 'x64'), '0x8664')
  assert.throws(() => verifyPeArchitecture(peFixture(0x8664), 'arm64'), /Wrong application architecture/)
  assert.throws(() => verifyPeArchitecture(peFixture(0xaa64), 'x64'), /Wrong application architecture/)
})

test('PE architecture verification rejects malformed and truncated executables', () => {
  assert.throws(() => verifyPeArchitecture(Buffer.alloc(4), 'arm64'), /DOS/)
  assert.throws(() => verifyPeArchitecture(peFixture(0xaa64).subarray(0, 130), 'arm64'), /PE header/)
  assert.throws(() => verifyPeArchitecture(peFixture(0xaa64), 'ia32'), /Unsupported/)
})

test('NSIS payload accepts the upstream supported BCJ/LZMA2 or Copy codecs', () => {
  assert.deepEqual(verifyNsisPayloadMethods('Method = LZMA2:20 BCJ\n\nPath = data\nMethod = LZMA2:20\n\nPath = folder\nMethod = '), ['BCJ', 'LZMA2:20'])
  assert.deepEqual(verifyNsisPayloadMethods('Method = Copy'), ['Copy'])
})

test('NSIS payload rejects the exact ARM64 method in the reported broken installer', () => {
  assert.throws(() => verifyNsisPayloadMethods('Path = EMWaves.exe\nMethod = ARM64 LZMA2:20'), /unsupported.*ARM64/)
  assert.throws(() => verifyNsisPayloadMethods('Method = LZMA2:20 BCJ2'), /unsupported.*BCJ2/)
  assert.throws(() => verifyNsisPayloadMethods('Method =\n'), /No NSIS payload/)
})
