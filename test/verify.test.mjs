/**
 * `doctor` reads the repository; users install the tarball. These tests are
 * about that difference: the scaffold passes both, a `files` list that drops the
 * panel passes `doctor` and must fail `verify`.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

import { init } from '../lib/init.mjs';
import { verify } from '../lib/verify.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the scaffold survives being packed, installed and mounted', async () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-verify-')), 'plugin');
  init({ dir, name: 'verify-me', title: 'Verify me' });
  const result = await verify({ dir });
  assert.deepEqual(result.failures, []);
  assert.equal(result.stage, 'mount');
  assert.match(result.text, /Verify me/);
  assert.ok(result.files.includes('client.js'), 'the tarball has to contain the panel');
});

test('a files list that drops the panel passes doctor and fails verify', async () => {
  const result = await verify({ dir: path.join(root, 'fixtures', 'not-shipped') });
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'pack');
  assert.match(result.failures[0].message, /does not contain client\.js/);
});

test('verify can stop after packing when mounting is not wanted', async () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-verify-')), 'plugin');
  init({ dir, name: 'pack-only' });
  const result = await verify({ dir, mount: false });
  assert.equal(result.ok, true);
  assert.equal(result.stage, 'pack');
  assert.equal(result.text, undefined);
});

test('a manifest that doctor rejects stops before npm is asked anything', async () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-verify-')), 'plugin');
  init({ dir, name: 'broken' });
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  delete manifest.engines.dsh;
  fs.writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const result = await verify({ dir });
  assert.equal(result.stage, 'doctor');
  assert.match(result.failures[0].message, /engines\.dsh/);
});

test('only the npm family gets a Windows suffix, because git and gh are .exe', async () => {
  const { command } = await import('../lib/exec.mjs');
  const win = process.platform === 'win32';
  assert.equal(command('npm'), win ? 'npm.cmd' : 'npm');
  assert.equal(command('git'), 'git');
  assert.equal(command('gh'), 'gh');
});

test('verify mounts with dependencies resolved from the plugin, not from the tool', () => {
  // `npx dsh-plugin-toolkit verify` runs out of npx's cache; a bare import of
  // jsdom would look there and fail even though the plugin declared it.
  const source = fs.readFileSync(path.join(ROOT, 'lib', 'verify.mjs'), 'utf8');
  assert.match(source, /mountClient\(\{ file: entryFile, resolveFrom: dir \}\)/);
});
