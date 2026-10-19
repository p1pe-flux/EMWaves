const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { test } = require('node:test');
const { parse: parseLegacyUrl } = require('node:url');
const { redactLogRecord } = require('./proxy-log-redaction.cjs');

const preload = path.join(__dirname, 'proxy-log-redaction.cjs');
const username = 'fixture user@reserved';
const password = 'fixture:password/with%+!';
const authenticatedUrl = `http://${encodeURIComponent(username)}:${encodeURIComponent(password)}@proxy.example:3128/path`;
const basic = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

function assertAbsent(value, secrets) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  for (const secret of secrets) {
    assert.equal(serialized.includes(secret), false, 'A sensitive fixture value survived redaction');
  }
}

test('redacts URL userinfo recursively while retaining routing and literal diagnostic text', () => {
  const input = {
    message: `Request to ${authenticatedUrl} failed; precision %.1000000000f stays literal`,
    context: {
      proxyController: { HTTP_PROXY: authenticatedUrl, HTTPS_PROXY: authenticatedUrl, NO_PROXY: 'localhost' },
      retries: [{ proxy: authenticatedUrl, port: 3128, statusCode: 407 }],
      host: 'proxy.example', destination: 'https://download.example/archive.zip',
    },
    sequence: '3', time: 1234, version: '2.0.0',
  };
  const original = structuredClone(input);
  const redacted = redactLogRecord(input);
  assertAbsent(redacted, [username, password, encodeURIComponent(username), encodeURIComponent(password)]);
  assert.match(redacted.message, /proxy\.example:3128\/path/);
  assert.match(redacted.message, /precision %\.1000000000f stays literal/);
  assert.match(redacted.context.proxyController.HTTP_PROXY, /proxy\.example:3128\/path/);
  assert.equal(redacted.context.proxyController.NO_PROXY, 'localhost');
  assert.deepEqual(redacted.context.retries.map(({ port, statusCode }) => ({ port, statusCode })), [{ port: 3128, statusCode: 407 }]);
  assert.equal(redacted.context.host, input.context.host);
  assert.equal(redacted.context.destination, input.context.destination);
  assert.equal(redacted.sequence, input.sequence);
  assert.equal(redacted.time, input.time);
  assert.equal(redacted.version, input.version);
  assert.deepEqual(input, original, 'Log sanitizing must not mutate live proxy configuration');
});

test('redacts credential and authorization fields irrespective of case or separator', () => {
  const input = {
    context: {
      target: { proxy: { authorization: `${username}:${password}`, hostname: 'proxy.example', port: 3128 } },
      nested: [
        { Authorization: basic, 'Proxy-Authorization': basic, COOKIE: 'session=fixture-cookie-secret',
          'Set-Cookie': ['session=fixture-cookie-secret; Secure'], Password: 'fixture-password-secret' },
        { proxy_authorization: basic, pass_phrase: 'fixture-passphrase-secret', private_key: 'fixture-private-key-secret' },
      ],
      headers: { 'content-type': 'application/zip', 'x-status': 'retrying' },
    },
  };
  const redacted = redactLogRecord(input);
  assertAbsent(redacted, [username, password, basic, basic.slice('Basic '.length),
    'fixture-cookie-secret', 'fixture-password-secret', 'fixture-passphrase-secret', 'fixture-private-key-secret']);
  assert.equal(redacted.context.target.proxy.hostname, 'proxy.example');
  assert.equal(redacted.context.target.proxy.port, 3128);
  assert.deepEqual(redacted.context.headers, input.context.headers);
  assert.equal(input.context.target.proxy.authorization, `${username}:${password}`);
});

test('redacts TLS secrets before buffer serialization and keeps TLS verification diagnostics', () => {
  const key = Buffer.from('fixture-private-key-buffer');
  const pfx = Buffer.from('fixture-pfx-buffer');
  const input = {
    context: {
      target: {
        tls: { key, pfx: [{ buf: pfx, passphrase: 'fixture-array-passphrase' }],
          passphrase: 'fixture-tls-passphrase', ca: 'fixture-public-ca', cert: 'fixture-public-certificate',
          rejectUnauthorized: true, servername: 'download.example', ciphers: 'TLS_AES_256_GCM_SHA384' },
      },
    },
  };
  const output = redactLogRecord(input);
  assertAbsent(output, ['fixture-private-key-buffer', 'fixture-pfx-buffer', 'fixture-array-passphrase',
    'fixture-tls-passphrase', JSON.stringify(key.toJSON()), JSON.stringify(pfx.toJSON())]);
  assert.equal(output.context.target.tls.rejectUnauthorized, true);
  assert.equal(output.context.target.tls.servername, 'download.example');
  assert.equal(output.context.target.tls.ciphers, 'TLS_AES_256_GCM_SHA384');
  assert.equal(output.context.target.tls.ca, 'fixture-public-ca');
  assert.equal(output.context.target.tls.cert, 'fixture-public-certificate');
  assert.equal(input.context.target.tls.key, key);
  assert.equal(input.context.target.tls.pfx[0].buf, pfx);
});

test('userinfo is hidden for malformed URLs and encoded delimiters without hiding ordinary URLs', () => {
  const inputs = [
    `http://${encodeURIComponent(username)}:${encodeURIComponent(password)}@bad host:3128/`,
    'http://fixture%ZZ-user:fixture%ZZ-password@proxy.example:badport/',
    'http://fixture-raw-user:fixture-raw-password@proxy.example:3128/',
    'socks5://fixture-socks-user:fixture-socks-password@[::1]:1080',
    'http://fixture-user-only@proxy.example/',
    'http://:fixture-empty-user-password@proxy.example/',
  ];
  const ordinary = 'https://download.example/archive.zip?platform=linux#checksum';
  const output = redactLogRecord({ message: inputs.join(' -> '), context: { urls: inputs, ordinary } });
  assertAbsent(output, [username, password, encodeURIComponent(username), encodeURIComponent(password),
    'fixture%ZZ-user', 'fixture%ZZ-password', 'fixture-raw-user', 'fixture-raw-password',
    'fixture-socks-user', 'fixture-socks-password', 'fixture-user-only', 'fixture-empty-user-password']);
  assert.equal(output.context.ordinary, ordinary);
  assert.match(output.message, /proxy\.example/);
});

test('redacts legacy-parser accepted control characters and backslash proxy authorities', () => {
  const accepted = [
    'http://fixture-control-user:fixture-control-pass\nword@proxy.example:3128/',
    'http://fixture-control-user:fixture-control-pass\rword@proxy.example:3128/',
    'http://fixture-control-user:fixture-control-pass\tword@proxy.example:3128/',
    String.raw`http:\\fixture-slash-user:fixture-slash-password@proxy.example:3128/`,
    String.raw`http:/\fixture-slash-user:fixture-slash-password@proxy.example:3128/`,
    String.raw`http:\/fixture-slash-user:fixture-slash-password@proxy.example:3128/`,
  ];
  for (const url of accepted) {
    const parsed = parseLegacyUrl(url);
    assert.equal(parsed.protocol, 'http:');
    assert.equal(parsed.hostname, 'proxy.example');
    assert.equal(parsed.port, '3128');
    assert.equal(parsed.auth, url.includes('control')
      ? 'fixture-control-user:fixture-control-password'
      : 'fixture-slash-user:fixture-slash-password',
    'Regression inputs must be accepted as complete proxy credentials');
    const output = redactLogRecord({ message: `Proxy ${url} selected`, context: { HTTP_PROXY: url } });
    assertAbsent(output, ['fixture-control-user', 'fixture-control-pass', 'fixture-slash-user', 'fixture-slash-password']);
    assert.match(output.message, /proxy\.example:3128/);
    assert.match(output.context.HTTP_PROXY, /proxy\.example:3128/);
  }
});

test('redacts invalid proxy configuration before validation while preserving the endpoint and diagnostics', () => {
  const invalidProxy = 'fixture-invalid-user:fixture-invalid-password@proxy.example:3128';
  const input = {
    message: 'configuration changed',
    context: {
      change: { name: 'HTTP_PROXY', value: invalidProxy },
      newConfiguration: { HTTP_PROXY: invalidProxy, HTTPS_PROXY: invalidProxy, NO_PROXY: 'localhost' },
      state: { HTTP_PROXY: invalidProxy, HTTPS_PROXY: invalidProxy, NO_PROXY: 'localhost' },
      ordinaryChange: { name: 'NO_PROXY', value: 'localhost' },
      diagnostic: { hostname: 'download.example', port: 443, code: 'ERR_PROXY_URL', contact: 'support@example.invalid' },
      ALL_PROXY: 'http://proxy.example:3128',
    },
  };
  const original = structuredClone(input);
  const output = redactLogRecord(input);
  assertAbsent(output, ['fixture-invalid-user', 'fixture-invalid-password']);
  for (const proxy of [output.context.change.value, output.context.newConfiguration.HTTP_PROXY,
    output.context.newConfiguration.HTTPS_PROXY, output.context.state.HTTP_PROXY, output.context.state.HTTPS_PROXY]) {
    assert.match(proxy, /@proxy\.example:3128$/);
  }
  assert.equal(output.message, input.message);
  assert.equal(output.context.change.name, 'HTTP_PROXY');
  assert.equal(output.context.newConfiguration.NO_PROXY, 'localhost');
  assert.equal(output.context.state.NO_PROXY, 'localhost');
  assert.equal(output.context.ALL_PROXY, input.context.ALL_PROXY);
  assert.deepEqual(output.context.ordinaryChange, input.context.ordinaryChange);
  assert.deepEqual(output.context.diagnostic, input.context.diagnostic);
  assert.deepEqual(input, original, 'Rejected proxy settings must remain untouched outside the log copy');
});

test('nonsecret structured logs retain their values and shape', () => {
  const input = { context: { logLevel: 10, host: 'localhost', port: 3128, headers: { etag: 'checksum' },
    attempts: [0, 1, null, false], empty: {}, description: 'not proxying request; NO_PROXY matches' },
  message: 'connected', sequence: '1', time: 10, version: '2.0.0' };
  assert.deepEqual(redactLogRecord(input), input);
});

test('cycles and repeated references serialize safely without dropping ordinary diagnostics', () => {
  const shared = { hostname: 'proxy.example', statusCode: 200, authorization: basic };
  const input = { context: { first: shared, second: shared } };
  input.context.self = input;
  const output = redactLogRecord(input);
  assert.doesNotThrow(() => JSON.stringify(output));
  assertAbsent(output, [basic, basic.slice('Basic '.length)]);
  assert.equal(output.context.first.hostname, 'proxy.example');
  assert.equal(output.context.first.statusCode, 200);
  assert.deepEqual(output.context.first, output.context.second,
    'A shared value is not a cycle and should keep its ordinary fields');
  assert.equal(input.context.self, input);
  assert.equal(shared.authorization, basic);
});

test('literal JSON prototype keys stay data while their nested credentials are redacted', () => {
  const input = JSON.parse('{"context":{"__proto__":{"authorization":"Bearer fixture-proto-token","hostname":"proxy.example"},"constructor":{"prototype":{"password":"fixture-constructor-password","statusCode":200}}}}');
  const output = redactLogRecord(input);
  assertAbsent(output, ['fixture-proto-token', 'fixture-constructor-password']);
  assert.equal(Object.hasOwn(output.context, '__proto__'), true);
  assert.equal(output.context.__proto__.hostname, 'proxy.example');
  assert.equal(output.context.constructor.prototype.statusCode, 200);
  assert.equal(Object.getPrototypeOf(output.context), Object.prototype);
  assert.equal(Object.hasOwn(Object.prototype, 'authorization'), false);
  assert.equal(Object.hasOwn(Object.prototype, 'password'), false);
  assert.equal(input.context.__proto__.authorization, 'Bearer fixture-proto-token');
});

test('preload redacts the actual pinned logger sink, respects STDERR and installs idempotently', () => {
  const builderPackage = require.resolve('app-builder-lib/package.json');
  const child = String.raw`
    const assert = require('node:assert/strict');
    const { createRequire } = require('node:module');
    const [preload, builderPackage] = process.argv.slice(1);
    const { installProxyLogRedaction } = require(preload);
    const firstWriter = globalThis.ROARR.write;
    installProxyLogRedaction();
    assert.equal(globalThis.ROARR.write, firstWriter);
    const fromBuilder = createRequire(builderPackage);
    const fromGet = createRequire(fromBuilder.resolve('@electron/get'));
    const fromAgent = createRequire(fromGet.resolve('global-agent'));
    const log = fromAgent('roarr').default;
    log.debug({ statusCode: 200, hostname: 'proxy.example', authorization: 'Basic fixture-sensitive-auth' }, 'created socket');
  `;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:node_options|roarr_.+)$/i.test(key)));
  const result = spawnSync(process.execPath, ['--require', preload, '-e', child, preload, builderPackage], {
    encoding: 'utf8', env: { ...env, ROARR_LOG: 'true', ROARR_STREAM: 'STDERR' }, timeout: 10000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '', 'The selected logger output stream must be preserved');
  assertAbsent(result.stderr, ['fixture-sensitive-auth']);
  const records = result.stderr.trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(records.length, 1);
  assert.equal(records[0].message, 'created socket');
  assert.equal(records[0].context.logLevel, 20);
  assert.equal(records[0].context.statusCode, 200);
  assert.equal(records[0].context.hostname, 'proxy.example');
});

test('preload preserves the default disabled opt-in logging behavior', () => {
  const child = String.raw`
    const { createRequire } = require('node:module');
    const fromBuilder = createRequire(process.argv[1]);
    const fromGet = createRequire(fromBuilder.resolve('@electron/get'));
    const fromAgent = createRequire(fromGet.resolve('global-agent'));
    fromAgent('roarr').default.debug({ hostname: 'proxy.example' }, 'created socket');
  `;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:node_options|roarr_.+)$/i.test(key)));
  const result = spawnSync(process.execPath, ['--require', preload, '-e', child, require.resolve('app-builder-lib/package.json')], {
    encoding: 'utf8', env, timeout: 10000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout + result.stderr, '');
});

test('installation preserves a custom writer, redacts before callbacks and propagates sink failures', () => {
  const child = String.raw`
    const assert = require('node:assert/strict');
    const { createRequire } = require('node:module');
    const [preload, builderPackage] = process.argv.slice(1);
    const fromBuilder = createRequire(builderPackage);
    const fromGet = createRequire(fromBuilder.resolve('@electron/get'));
    const fromAgent = createRequire(fromGet.resolve('global-agent'));
    const { default: log, ROARR } = fromAgent('roarr');
    const written = [];
    let receiver;
    let rejectWrites = false;
    const sinkError = new Error('fixture custom writer failure');
    ROARR.write = function (body) {
      if (rejectWrites) throw sinkError;
      written.push(JSON.parse(body)); receiver = this; return 'custom-result';
    };
    const { installProxyLogRedaction } = require(preload);
    const guarded = ROARR.write;
    installProxyLogRedaction();
    assert.equal(ROARR.write, guarded);
    const owner = { write: ROARR.write };
    assert.equal(owner.write(JSON.stringify({ message: 'retrying', context: {
      authorization: 'Basic fixture-custom-secret', statusCode: 407,
    } })), 'custom-result');
    assert.equal(receiver, owner, 'The existing sink callback receiver must survive wrapping');
    log.debug({ hostname: 'proxy.example', password: 'fixture-custom-password' }, 'created socket');
    assert.equal(written.length, 2);
    assert.equal(JSON.stringify(written).includes('fixture-custom-secret'), false);
    assert.equal(JSON.stringify(written).includes('fixture-custom-password'), false);
    assert.equal(written[0].context.statusCode, 407);
    assert.equal(written[1].message, 'created socket');
    assert.equal(written[1].context.hostname, 'proxy.example');
    assert.equal(written[1].context.logLevel, 20);
    rejectWrites = true;
    assert.throws(() => ROARR.write(JSON.stringify({ message: 'sink failure probe',
      context: { authorization: 'Basic fixture-custom-secret' } })), (error) => error === sinkError,
      'Writer failures must propagate instead of being caught as a redaction failure');
  `;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:node_options|roarr_.+)$/i.test(key)));
  const result = spawnSync(process.execPath, ['-e', child, preload, require.resolve('app-builder-lib/package.json')], {
    encoding: 'utf8', env: { ...env, ROARR_LOG: 'true' }, timeout: 10000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout + result.stderr, '');
});

test('malformed sink records produce a visible safe diagnostic and do not stop later logs', () => {
  const child = String.raw`
    const assert = require('node:assert/strict');
    const { createRequire } = require('node:module');
    const [preload, builderPackage] = process.argv.slice(1);
    const fromBuilder = createRequire(builderPackage);
    const fromGet = createRequire(fromBuilder.resolve('@electron/get'));
    const fromAgent = createRequire(fromGet.resolve('global-agent'));
    const { ROARR } = fromAgent('roarr');
    const records = [];
    ROARR.write = (body) => records.push(JSON.parse(body));
    require(preload);
    const malformedRecords = [
      '{"authorization":"fixture-invalid-secret"',
      '["fixture-invalid-secret"]',
      'null', '"fixture-invalid-secret"', '42',
    ];
    for (const body of malformedRecords) ROARR.write(body);
    assert.equal(records.length, malformedRecords.length);
    assert.equal(JSON.stringify(records).includes('fixture-invalid-secret'), false);
    assert.ok(records.every((record) => typeof record.message === 'string'
      && /log record|sensitive|omit/i.test(record.message) && record.context.logLevel >= 40));
    ROARR.write(JSON.stringify({ message: 'connected', context: { hostname: 'proxy.example', statusCode: 200 } }));
    assert.equal(records.at(-1).message, 'connected');
    assert.equal(records.at(-1).context.statusCode, 200);
  `;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:node_options|roarr_.+)$/i.test(key)));
  const result = spawnSync(process.execPath, ['-e', child, preload, require.resolve('app-builder-lib/package.json')], {
    encoding: 'utf8', env: { ...env, ROARR_LOG: 'true' }, timeout: 10000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout + result.stderr, '');
});
