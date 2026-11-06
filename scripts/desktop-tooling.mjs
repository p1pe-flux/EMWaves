import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import './proxy-log-redaction.cjs';

const require = createRequire(import.meta.url);

function isTransientDownloadFailure(error) {
  const seen = new Set();
  for (let current = error; current && typeof current === 'object' && !seen.has(current); current = current.cause) {
    seen.add(current);
    const status = current.response?.statusCode ?? current.statusCode;
    if (typeof status === 'number') return [408, 429, 500, 502, 503, 504].includes(status);
    if (['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'ENETUNREACH', 'EHOSTUNREACH', 'EPIPE'].includes(current.code)) return true;
  }
  return false;
}

/** Retry only transient download failures; integrity and local tool failures
 * must fail immediately. Preserve the final error and its diagnostic cause.
 */
export async function retryToolDownload(resolveTool, {
  attempts = 2,
  wait = setTimeout,
  onRetry = (nextAttempt, limit) => console.warn(`7-Zip download encountered a transient network error; retrying (${nextAttempt}/${limit}).`),
} = {}) {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 5) throw new RangeError('Use between one and five tool download attempts.');
  for (let attempt = 1; ; attempt++) {
    try { return await resolveTool(); }
    catch (error) {
      if (attempt >= attempts || !isTransientDownloadFailure(error)) throw error;
      // The pinned downloader also has bounded per-request retries. This outer
      // bound handles a failed tool resolution without retrying test suites.
      onRetry(attempt + 1, attempts);
      await wait(2000 * attempt);
    }
  }
}

// electron-builder does not expose its downloaded 7-Zip as a public API.
// Keep this version-sensitive access in one place and fail with an actionable
// message if a future builder upgrade changes it.
export async function getSevenZipExecutable({ retryDownload = false } = {}) {
  let resolveTool;
  try {
    const toolset = require('app-builder-lib/out/toolsets/7zip.js');
    if (typeof toolset.getPath7za !== 'function') throw new Error('getPath7za is unavailable');
    resolveTool = toolset.getPath7za;
  } catch (cause) {
    throw new Error('Cannot resolve electron-builder 7-Zip. Install the pinned app-builder-lib dependency or update scripts/desktop-tooling.mjs for the new builder version.', { cause });
  }
  // The pinned builder validates its downloaded archive against its SHA-256
  // table. Also exercise the actual native executable, including cache hits.
  const executable = await (retryDownload ? retryToolDownload(resolveTool) : resolveTool());
  await access(executable, constants.X_OK);
  const information = execFileSync(executable, ['i'], { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  if (!information.includes('7-Zip')) throw new Error('The resolved desktop tool did not identify itself as 7-Zip.');
  return executable;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await getSevenZipExecutable({ retryDownload: true });
  console.log('Pinned 7-Zip toolset is ready and its executable has been verified.');
}
