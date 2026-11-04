/**
 * The README tells readers to run `npm run benchmark`, so that command has to
 * work in the copy a reader actually installs. `files` used to omit both the
 * script and the list it reads, which only showed up after `npm pack`.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { DEFAULT_JOBS } from '../lib/audit.mjs';
import { run } from '../lib/exec.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the installed tarball runs the benchmark the README cites', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-benchmark-tarball-'));
  try {
    const packed = JSON.parse(run('npm', ['pack', '--pack-destination', scratch, '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }));
    const [document] = packed;
    const shipped = new Set(document.files.map((entry) => entry.path));
    assert.ok(shipped.has('scripts/benchmark-audit.mjs'), 'the tarball does not ship the benchmark script');
    assert.ok(shipped.has('docs/ecosystem-audit-2026-11-03.txt'), 'the tarball does not ship the benchmark list');

    const prefix = path.join(scratch, 'install');
    run('npm', ['install', path.join(scratch, document.filename), '--prefix', prefix, '--no-save', '--ignore-scripts', '--no-audit', '--no-fund'], {
      cwd: scratch,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const installed = path.join(prefix, 'node_modules', 'dsh-plugin-toolkit');
    const output = run('npm', ['run', 'benchmark'], {
      cwd: installed,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    assert.match(output, /benchmark: 8 repositories from docs\/ecosystem-audit-2026-11-03\.txt/u);
    assert.match(output, new RegExp(`after\\s+--jobs ${DEFAULT_JOBS}\\b`, 'u'));
    assert.doesNotMatch(output, /MODULE_NOT_FOUND|ENOENT/u);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});
