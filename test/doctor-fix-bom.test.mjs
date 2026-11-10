/**
 * `doctor` already read a UTF-8-BOM manifest; its repair path has to use the
 * same reader. Otherwise the check passes, the plan names the edit, and the
 * write fails with a bare `Unexpected token` on the manifest it just read.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { DEFAULT_ENGINES } from '../lib/fix.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const CLI = path.join(ROOT, 'bin', 'dsh-plugin.mjs');
const scratch = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-plugin-doctor-fix-bom-'));

/** A temp plugin with no `engines.dsh`, optionally saved the way Notepad does. */
function plugin({ bom }) {
  const dir = path.join(scratch(), 'plugin');
  fs.cpSync(path.join(here, 'fixtures', 'good'), dir, { recursive: true });
  const manifestPath = path.join(dir, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  delete manifest.engines;
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  fs.writeFileSync(manifestPath, bom === true ? `\uFEFF${text}` : text);
  return { dir, manifestPath };
}

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
}

function assertRepaired({ dir, manifestPath }, result) {
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /wrote engines\.dsh/u);

  const raw = fs.readFileSync(manifestPath, 'utf8');
  assert.equal(raw.startsWith('\uFEFF'), false, 'the rewritten manifest must not keep the BOM');
  const manifest = JSON.parse(raw);
  assert.equal(manifest.engines.dsh, DEFAULT_ENGINES);
  assert.equal(manifest.name, 'demo-plugin', 'the repair leaves the rest of the manifest alone');
  assert.equal(manifest.engines.node, undefined, 'the repair adds only the missing field');
  assert.equal(dir, path.dirname(manifestPath));
}

test('doctor --fix --write repairs a BOM manifest it can read', () => {
  const target = plugin({ bom: true });
  assertRepaired(target, runCli(['doctor', target.dir, '--fix', '--write']));
});

test('the no-BOM control takes the same doctor --fix --write path', () => {
  const target = plugin({ bom: false });
  assertRepaired(target, runCli(['doctor', target.dir, '--fix', '--write']));
});

test('fix --engines --write shares the BOM-aware read', () => {
  const target = plugin({ bom: true });
  assertRepaired(target, runCli(['fix', target.dir, '--engines', '--write']));
});
