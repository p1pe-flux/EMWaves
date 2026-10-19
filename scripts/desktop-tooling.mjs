import { createRequire } from 'node:module';
import './proxy-log-redaction.cjs';

const require = createRequire(import.meta.url);

// electron-builder does not expose its downloaded 7-Zip as a public API.
// Keep this version-sensitive access in one place and fail with an actionable
// message if a future builder upgrade changes it.
export async function getSevenZipExecutable() {
  try {
    const toolset = require('app-builder-lib/out/toolsets/7zip.js');
    if (typeof toolset.getPath7za !== 'function') throw new Error('getPath7za is unavailable');
    return await toolset.getPath7za();
  } catch (cause) {
    throw new Error('Cannot resolve electron-builder 7-Zip. Install the pinned app-builder-lib dependency or update scripts/desktop-tooling.mjs for the new builder version.', { cause });
  }
}
