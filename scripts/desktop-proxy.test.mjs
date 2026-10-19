import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const builderPackage = createRequire(import.meta.url).resolve('app-builder-lib/package.json');
const redactionPreload = fileURLToPath(new URL('./proxy-log-redaction.cjs', import.meta.url));
const desktopTooling = new URL('./desktop-tooling.mjs', import.meta.url).href;
const payload = Buffer.from('Electron download fixture\n');
const checksum = createHash('sha256').update(payload).digest('hex');
const remoteLogValue = 'untrusted format: %.1000000000f <script>';
const proxyUsername = 'audit user@reserved';
const proxyPassword = 'audit:pass/word%+!';
const proxyAuthorization = `Basic ${Buffer.from(`${proxyUsername}:${proxyPassword}`).toString('base64')}`;

function assertCredentialsRedacted(output) {
  const secretForms = [proxyUsername, proxyPassword, encodeURIComponent(proxyUsername),
    encodeURIComponent(proxyPassword), proxyAuthorization, proxyAuthorization.slice('Basic '.length)];
  for (const secret of secretForms) {
    assert.equal(output.includes(secret), false, 'Proxy credentials must be absent from captured logs');
  }
}

// Exercise the downloader actually used by the pinned builder in a child:
// global-agent replaces process-wide HTTP methods when proxying is enabled.
const downloadInChild = String.raw`
  import assert from 'node:assert/strict';
  import { readFile } from 'node:fs/promises';
  import { createRequire } from 'node:module';
  const [builderPackage, cacheRoot, mirror, checksum, checkCorruption, desktopTooling] = process.argv.slice(1);
  if (desktopTooling) await import(desktopTooling);
  const { downloadArtifact } = createRequire(builderPackage)('@electron/get');
  const options = {
    version: '44.7.1', artifactName: 'electron', platform: 'linux', arch: 'x64',
    cacheRoot, tempDirectory: cacheRoot, force: true,
    mirrorOptions: { mirror, customDir: 'good' },
    checksums: { 'electron-v44.7.1-linux-x64.zip': checksum },
    downloadOptions: { quiet: true, retry: { limit: 0 }, timeout: { request: 3000 } },
  };
  const downloaded = await downloadArtifact(options);
  assert.equal(await readFile(downloaded, 'utf8'), 'Electron download fixture\n');
  if (checkCorruption === 'yes') {
    await assert.rejects(downloadArtifact({
      ...options, mirrorOptions: { mirror, customDir: 'corrupted' },
    }), /checksum|hash/i);
  }
`;

async function localServer(handler) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

async function runDownload(root, proxy, mirror, noProxy, checkCorruption, entry = 'preload') {
  // Do not let a developer's mirror, proxy or Electron download environment
  // redirect the fixture outside these loopback servers.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:electron_|npm_config_electron_|global_agent_|roarr_|https?_proxy$|all_proxy$|no_proxy$|node_options$|node_tls_reject_unauthorized$|node_extra_ca_certs$)/i.test(key)));
  const guardArguments = entry === 'preload' ? ['--require', redactionPreload] : [];
  return execFileAsync(process.execPath, [...guardArguments, '--input-type=module', '-e', downloadInChild,
    builderPackage, root, mirror, checksum, checkCorruption ? 'yes' : 'no', entry === 'tooling' ? desktopTooling : ''], {
    timeout: 10000,
    env: { ...env, ELECTRON_GET_USE_PROXY: '1', ELECTRON_GET_NO_PROGRESS: '1', ROARR_LOG: 'true',
      GLOBAL_AGENT_HTTP_PROXY: proxy, GLOBAL_AGENT_HTTPS_PROXY: proxy, GLOBAL_AGENT_NO_PROXY: noProxy },
  });
}

async function verifyAuthenticatedDownload(entry) {
  const root = await mkdtemp(path.join(tmpdir(), 'emwaves-proxy-test-'));
  const requests = [];
  const { server, url } = await localServer((request, response) => {
    requests.push({ url: request.url, authorization: request.headers['proxy-authorization'] });
    if (request.headers['proxy-authorization'] !== proxyAuthorization) {
      response.writeHead(407);
      response.end('Proxy authentication required');
      return;
    }
    response.setHeader('x-audit-format', remoteLogValue);
    // Response context can contain sensitive headers too; keep ordinary headers.
    response.setHeader('Proxy-Authorization', proxyAuthorization);
    response.end(request.url.includes('/corrupted/') ? 'corrupted download' : payload);
  });
  try {
    const proxy = url.replace('http://', `http://${encodeURIComponent(proxyUsername)}:${encodeURIComponent(proxyPassword)}@`);
    const { stdout, stderr } = await runDownload(root, proxy, 'http://download.emwaves.invalid/', '', true, entry);
    assert.deepEqual(requests.map((request) => request.url), [
      'http://download.emwaves.invalid/good/electron-v44.7.1-linux-x64.zip',
      'http://download.emwaves.invalid/corrupted/electron-v44.7.1-linux-x64.zip',
    ]);
    assert.ok(requests.every((request) => request.authorization === proxyAuthorization),
      'Redaction must not change proxy authentication sent over the wire');
    assertCredentialsRedacted(stdout + stderr);
    const logs = stdout.trim().split('\n').map((line) => JSON.parse(line));
    assert.ok(logs.some((record) => record.message === 'global agent has been initialized'));
    assert.ok(logs.some((record) => record.message === 'proxying request'
      && record.context.destination === requests[0].url && record.context.proxy === url));
    assert.ok(logs.some((record) => record.message === 'proxying response' && record.context.statusCode === 200));
    assert.ok(logs.some((record) => record.message === 'created socket' && record.context.logLevel === 20));
    assert.ok(logs.some((record) => record.context?.headers?.['x-audit-format'] === remoteLogValue),
      'Remote response data must stay literal logger context, including precision-like text');
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
}

for (const entry of ['preload', 'tooling']) {
  test(`pinned builder downloads via ${entry} preserve authenticated proxy behavior, useful redacted logs and checksums`,
    { timeout: 15000 }, () => verifyAuthenticatedDownload(entry));
}

test('pinned builder Electron downloads honor NO_PROXY for direct connections', { timeout: 15000 }, async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'emwaves-no-proxy-test-'));
  const requests = [];
  const { server, url } = await localServer((request, response) => {
    requests.push(request.url);
    response.end(payload);
  });
  try {
    // No proxy listens on this port. Only a correctly honored bypass succeeds.
    const { stdout } = await runDownload(root, 'http://127.0.0.1:1', url + '/', '127.0.0.1', false);
    assert.deepEqual(requests, ['/good/electron-v44.7.1-linux-x64.zip']);
    assert.ok(stdout.trim().split('\n').map((line) => JSON.parse(line))
      .some((record) => record.message === 'not proxying request; url matches GLOBAL_AGENT.NO_PROXY'));
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
