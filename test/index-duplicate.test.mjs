/**
 * `index` must reject duplicate plugin names before it audits anything.
 *
 * The audit resolves a plugin by name, so a second entry named `dup-plugin`
 * used to re-read the first entry and report the duplicate clean. That is
 * exactly the false clean this pins: the command has to exit `1` with one
 * finding naming both positions, and it must not print an `ok` line for
 * either entry. The unique-name and missing-engines paths keep their old
 * answers.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { validateIndex } from '../lib/index-file.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const BIN = path.join(ROOT, 'bin', 'dsh-plugin.mjs');

function plugin(name, range = '>=0.2.0') {
  return {
    name,
    versions: [
      {
        version: '1.0.0',
        publishTimestamp: 1,
        source: { type: 'npm' },
        engines: { dsh: range },
      },
    ],
  };
}

function runIndex(indexFile) {
  return spawnSync(process.execPath, [BIN, 'index', indexFile], { encoding: 'utf8' });
}

function writeIndex(t, document) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-plugin-index-duplicate-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const indexFile = path.join(dir, 'index.json');
  fs.writeFileSync(indexFile, `${JSON.stringify(document, null, 2)}\n`);
  return indexFile;
}

test('validateIndex reports one finding naming both duplicate positions', () => {
  const findings = validateIndex({
    formatVersion: 1,
    plugins: [plugin('dup-plugin'), plugin('dup-plugin')],
  });

  assert.equal(findings.length, 1);
  assert.match(findings[0].entry, /plugins\[0\]/u);
  assert.match(findings[0].entry, /plugins\[1\]/u);
  assert.match(findings[0].problem, /dup-plugin/u);
  assert.match(findings[0].problem, /unique/u);
});

test('validateIndex still accepts distinct names', () => {
  assert.deepEqual(
    validateIndex({
      formatVersion: 1,
      plugins: [plugin('first-plugin'), plugin('second-plugin')],
    }),
    [],
  );
});

test('the CLI exits 1 for duplicate names without printing ok for either entry', (t) => {
  // The first entry is clean and the second has no engines.dsh. Before the
  // duplicate check the audit read the first entry twice and printed two ok
  // lines, hiding the broken second entry entirely.
  const first = plugin('dup-plugin');
  const second = plugin('dup-plugin');
  delete second.versions[0].engines;
  const indexFile = writeIndex(t, { formatVersion: 1, plugins: [first, second] });

  const result = runIndex(indexFile);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1, output);
  assert.ok(result.stderr.includes(indexFile), output);
  assert.match(result.stderr, /plugins\[0\]/u);
  assert.match(result.stderr, /plugins\[1\]/u);
  assert.match(result.stderr, /dup-plugin/u);
  assert.doesNotMatch(result.stdout, /^ok\b/mu);
  assert.equal((result.stderr.match(/✗/gu) ?? []).length, 1, output);
});

test('the unique-name and missing-engines paths keep their old answers', (t) => {
  const unique = writeIndex(t, {
    formatVersion: 1,
    plugins: [plugin('first-plugin'), plugin('second-plugin')],
  });
  let result = runIndex(unique);
  let output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, output);
  assert.match(result.stdout, /^ok\s+first-plugin: 1 version\(s\) all carry engines\.dsh$/mu);
  assert.match(result.stdout, /^ok\s+second-plugin: 1 version\(s\) all carry engines\.dsh$/mu);

  const missing = plugin('solo-plugin');
  delete missing.versions[0].engines;
  const broken = writeIndex(t, { formatVersion: 1, plugins: [missing] });
  result = runIndex(broken);
  output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1, output);
  assert.match(result.stderr, /no engines\.dsh/u);
  assert.doesNotMatch(result.stdout, /^ok\b/mu);
});
