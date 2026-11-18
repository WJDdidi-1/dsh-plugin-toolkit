/**
 * `doctor` reads the working copy. `npm pack` runs `prepack` first and reads
 * what the hook wrote. A plugin whose `client.js` is generated in `prepack` is
 * therefore complete in the tarball and incomplete in the folder `doctor` sees
 * before the pack.
 *
 * `verify --no-mount` used to run `doctor` first, so it rejected that plugin at
 * the source-only `client entry` checks and never reached the pack that would
 * have produced the file. These tests spawn the shipped CLI because that is
 * where a user or CI job sees the verdict: the generated-client fixture must
 * exit 0 with `ok packed`, npm's own file list must contain `client.js`, and a
 * control whose prepack does not generate the file must still exit 1 at
 * `pack`, naming `client.js`.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { run } from '../lib/exec.mjs';
import { init } from '../lib/init.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const BIN = path.join(ROOT, 'bin', 'dsh-plugin.mjs');
const fixture = (name) => path.join(here, 'fixtures', name);

/** Copy a committed fixture: packing it writes client.js into the copy. */
function copyFixture(name) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-verify-prepack-'));
  const dir = path.join(parent, 'plugin');
  fs.cpSync(fixture(name), dir, { recursive: true });
  return dir;
}

function verifyNoMount(dir) {
  return spawnSync(process.execPath, [BIN, 'verify', dir, '--no-mount'], { encoding: 'utf8' });
}

function packedFiles(dir) {
  const output = run('npm', ['pack', '--dry-run', '--json'], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const [document] = JSON.parse(output);
  return new Set((document.files ?? []).map((entry) => entry.path));
}

test('verify --no-mount packs a plugin whose prepack generates client.js', () => {
  const dir = copyFixture('verify-prepack-generated');
  try {
    assert.equal(fs.existsSync(path.join(dir, 'client.js')), false, 'the fixture must not commit the generated panel');

    const result = verifyNoMount(dir);
    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.status, 0, output);
    assert.match(result.stdout, /^ok {2}packed \d+ file\(s\)/m, output);
    assert.doesNotMatch(output, /stopped at doctor/u, output);
    // The pack ran the hook in the source tree, which is what let doctor see
    // the panel on its second pass.
    assert.ok(fs.existsSync(path.join(dir, 'client.js')), 'prepack did not run in the plugin folder');

    const files = packedFiles(dir);
    assert.ok(
      files.has('client.js'),
      `npm pack --dry-run --json does not list client.js:\n${[...files].sort().join('\n')}`,
    );
  } finally {
    fs.rmSync(path.dirname(dir), { recursive: true, force: true });
  }
});

test('a prepack that does not generate client.js still fails at pack and names it', () => {
  const dir = copyFixture('verify-prepack-missing');
  try {
    const result = verifyNoMount(dir);
    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.status, 1, output);
    assert.match(output, /dsh-plugin verify: stopped at pack/u, output);
    const line = output.split('\n').find((entry) => entry.includes('pack:'));
    assert.ok(line, output);
    assert.match(line, /client\.js/u, line);
    assert.doesNotMatch(output, /stopped at doctor/u, output);
    assert.equal(fs.existsSync(path.join(dir, 'client.js')), false, 'the control prepack wrote a panel');
    assert.ok(packedFiles(dir).has('client.js') === false, 'the control tarball unexpectedly contains client.js');
  } finally {
    fs.rmSync(path.dirname(dir), { recursive: true, force: true });
  }
});

test('the unmodified scaffold still exits 0 with --no-mount', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-verify-prepack-scaffold-'));
  const dir = path.join(parent, 'plugin');
  try {
    const scaffold = init({ dir, name: 'prepack-scaffold', title: 'Prepack scaffold' });
    assert.equal(scaffold.ok, true, JSON.stringify(scaffold.failures));

    const result = verifyNoMount(dir);
    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.status, 0, output);
    assert.match(result.stdout, /^ok {2}packed \d+ file\(s\)/m, output);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
