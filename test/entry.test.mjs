/**
 * The loader starts a plugin by importing the bare package name, so the root
 * export has to be the plugin. It used to be the CLI, which would have made
 * `dsh plugin add dsh-plugin-toolkit` install a row that applies nothing.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

test('the root export is the plugin, and the CLI is reachable beside it', () => {
  assert.equal(manifest.exports['.'], './index.js');
  assert.equal(manifest.main, 'index.js');
  assert.equal(manifest.exports['./cli'], './lib/cli.mjs');
  assert.equal(manifest.bin['dsh-plugin'], 'bin/dsh-plugin.mjs');
});

test('the plugin the root export names is a real plugin, not a wrapper', async () => {
  // A bare absolute path is not an ESM URL on Windows: "D:\a\..." parses as
  // the scheme "d:".
  const plugin = await import(pathToFileURL(path.join(ROOT, manifest.exports['.'])).href);
  assert.equal(typeof plugin.apply, 'function');
  assert.equal(plugin.name, 'dsh-plugin-toolkit');
});

test('the patch file names the package once, in the shape the loader expects', () => {
  const patch = fs.readFileSync(path.join(ROOT, manifest.dsh.bundle.patch), 'utf8');
  assert.match(patch, /^- insert:/m);
  assert.equal((patch.match(/name: dsh-plugin-toolkit/g) ?? []).length, 1);
  assert.match(patch, /id: dsh-plugin-toolkit/);
});

test('every path package.json points at is shipped', () => {
  const shipped = manifest.files;
  const wanted = [manifest.main, manifest.exports['.'], manifest.exports['./cli'], manifest.exports['./testkit'], manifest.dsh.bundle.patch];
  for (const entry of wanted) {
    const clean = entry.replace(/^\.\//, '');
    const covered = shipped.some((rule) => rule === clean || (rule.endsWith('/') && clean.startsWith(rule)) || rule === clean);
    assert.equal(covered, true, `${entry} is not in files: ${shipped.join(', ')}`);
  }
});
