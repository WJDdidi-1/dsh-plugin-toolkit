/**
 * The route the panel talks to, tested without a web server: the handler is a
 * plain function, so it can be called with a fake request and response.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { checkPlugin } from '../index.js';
import { init } from '../lib/init.mjs';

function scaffold() {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'toolkit-check-')), 'plugin');
  const result = init({ dir, name: 'checked-plugin', title: 'Checked panel' });
  assert.equal(result.ok, true, JSON.stringify(result.failures));
  return dir;
}

test('a scaffolded plugin passes, and the answer names what was checked', async () => {
  const report = await checkPlugin(scaffold());
  assert.equal(report.ok, true, JSON.stringify(report.checks));
  assert.deepEqual(report.checks.map((entry) => entry.check), ['manifest', 'tarball']);
  assert.match(report.checks[1].message, /^\d+ file\(s\)$/);
});

test('a files list that forgets the bundle is caught here, not after install', async () => {
  const dir = scaffold();
  const manifestPath = path.join(dir, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.files = manifest.files.filter((entry) => entry !== 'client.js');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const report = await checkPlugin(dir);
  assert.equal(report.ok, false);
  const failed = report.checks.filter((entry) => entry.ok === false);
  assert.equal(failed.length, 1);
  assert.match(failed[0].message, /the tarball does not contain client\.js/);
});

test('something that is not a directory is refused without throwing', async () => {
  assert.deepEqual((await checkPlugin('/definitely/not/here')).checks, [
    { check: 'dir', ok: false, message: 'that is not a directory' },
  ]);
  assert.deepEqual((await checkPlugin('')).checks[0].check, 'dir');
});

test('the panel and the route agree on the shape of the answer', async () => {
  const report = await checkPlugin(scaffold());
  assert.deepEqual(Object.keys(report).sort(), ['checks', 'dir', 'ok']);
  for (const entry of report.checks) {
    assert.deepEqual(Object.keys(entry).sort(), ['check', 'message', 'ok']);
  }
});
