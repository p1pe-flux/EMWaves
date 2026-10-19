import { packageDesktop } from './package-desktop.mjs'

const architecture = process.argv[2]
if (!['arm64', 'x64'].includes(architecture)) throw new Error('Usage: node scripts/package-windows.mjs arm64|x64 [output-directory]')
await packageDesktop('win', architecture, process.argv[3])
