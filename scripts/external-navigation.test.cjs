const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { externalCitationUrl, installExternalNavigation } = require('../electron/external-navigation.cjs');

test('external navigation accepts only the guide citation HTTPS hosts', () => {
  for (const url of ['https://ethw.org/Smith_Chart', 'https://maths.dur.ac.uk/users/sabine.boegli/CA2.html#definition', 'https://arxiv.org/pdf/1201.4068#page=2', 'https://ximera.osu.edu/em/electromagnetics/waves/digInReflectionCoeff', 'https://www.mathworks.com/help/rf/ug/designing-matching-networks-part-2-single-stub-transmission-lines.html', 'https://web.ece.ucsb.edu/~long/ece145a/Notes5_Matching_networks.pdf', 'https://courses.ece.vt.edu/ece3105/chp2_lssn6.html', 'https://www.waves.utoronto.ca/prof/mojahedi/ECE320/Lab%202%20Description%20and%20Procedure.pdf']) {
    assert.equal(externalCitationUrl(url), url);
  }
  assert.equal(externalCitationUrl('https://ETHW.ORG:443/Smith_Chart'), 'https://ethw.org/Smith_Chart');
});

test('every external citation in all English and Spanish guides is covered by the desktop policy', () => {
  let citations = 0;
  const sources = [
    ...readdirSync(path.join(__dirname, '../src/content')).filter((name) => name.endsWith('.md')).map((name) => `content/${name}`),
    ...readdirSync(path.join(__dirname, '../src/components')).filter((name) => /(?:Guides?|Deduction)\.tsx$/.test(name)).map((name) => `components/${name}`),
  ];
  for (const source of sources) {
    const text = readFileSync(path.join(__dirname, '../src', source), 'utf8');
    const urls = [...text.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g), ...text.matchAll(/href=["'](https?:\/\/[^"']+)["']/g)];
    for (const [, url] of urls) {
      assert.ok(externalCitationUrl(url), `Uncovered citation in ${source}: ${url}`);
      citations += 1;
    }
  }
  assert.ok(citations > 0);
});

test('external navigation rejects protocols, credentials, ports, lookalike hosts and malformed URLs', () => {
  for (const url of [null, '', '#/labs/single-stub-matching', 'file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,test', 'mailto:test@example.com', 'http://ethw.org/Smith_Chart', 'https://example.com/', 'https://ethw.org.evil.example/', 'https://ethw.org@evil.example/', 'https://user:password@ethw.org/', 'https://ethw.org:444/', 'https://ethw.org/\nSmith_Chart', ' https://ethw.org/Smith_Chart', 'https://127.0.0.1/']) {
    assert.equal(externalCitationUrl(url), null, String(url));
  }
});

test('navigation stays blocked while main-frame citations open externally; subframes never launch a browser', async () => {
  const contents = new EventEmitter();
  contents.setWindowOpenHandler = (handler) => { contents.windowOpen = handler; };
  const opened = [];
  installExternalNavigation(contents, async (url) => opened.push(url));
  for (const [url, isMainFrame] of [['https://ethw.org/Smith_Chart', true], ['https://arxiv.org/pdf/1201.4068', false], ['https://example.com/', true], ['file:///tmp/test.html', true]]) {
    let prevented = false;
    contents.emit('will-frame-navigate', { url, isMainFrame, preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
  }
  assert.deepEqual(contents.windowOpen({ url: 'https://arxiv.org/pdf/1201.4068' }), { action: 'deny' });
  assert.deepEqual(contents.windowOpen({ url: 'https://example.com/' }), { action: 'deny' });
  await new Promise(setImmediate);
  assert.deepEqual(opened, ['https://ethw.org/Smith_Chart', 'https://arxiv.org/pdf/1201.4068']);
});

test('a failed external browser launch is reported without an unhandled rejection', async () => {
  const contents = new EventEmitter();
  contents.setWindowOpenHandler = (handler) => { contents.windowOpen = handler; };
  const failures = [];
  installExternalNavigation(contents, () => { throw new Error('No browser available'); }, (...args) => failures.push(args));
  contents.windowOpen({ url: 'https://ethw.org/Smith_Chart' });
  await new Promise(setImmediate);
  assert.equal(failures.length, 1);
  assert.match(failures[0][1].message, /No browser available/);
});
