/**
 * `audit --home` must stop at usage validation when the flag has no path.
 *
 * The failure this pins is a false clean: the old parser let `--home` swallow
 * the next token, so `audit --home --timeout 50` scanned a folder literally
 * named `--timeout`, and `audit --home --json` scanned `--json`, then printed
 * "no plugins installed in any profile" and exited `0`. A bare `--home` also
 * fell back to `$HOME/.dsh`. Each spelling is a missing value, not a scan.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const BIN = path.join(ROOT, 'bin', 'dsh-plugin.mjs');
const FIXTURE_HOME = path.join(here, 'fixtures', 'missing-declared-bundle');

function runAudit(args) {
  return spawnSync(process.execPath, [BIN, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

test('a missing --home value exits 2 and names --home before scanning', () => {
  const forms = [
    ['audit', '--home'],
    ['audit', '--home', '--timeout', '50'],
    ['audit', '--home', '--json'],
  ];

  for (const args of forms) {
    const result = runAudit(args);
    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.status, 2, `${args.join(' ')}\n${output}`);
    assert.match(result.stderr, /--home needs a directory path/u, args.join(' '));
    assert.doesNotMatch(output, /no plugins installed/u, `${args.join(' ')} scanned a folder and reported it empty`);
    assert.equal(result.stdout, '', `${args.join(' ')} must not print a report`);
  }
});

test('a later --home does not overwrite an earlier bare --home', () => {
  const result = runAudit(['audit', '--home', '--home', FIXTURE_HOME, '--timeout', '50']);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 2, output);
  assert.match(result.stderr, /--home needs a directory path/u);
  assert.doesNotMatch(output, /ghost-plugin/u, 'the scan ran despite the missing value');
});

test('a valid --home still prints the declared plugin row', () => {
  const result = runAudit(['audit', '--home', FIXTURE_HOME, '--timeout', '50']);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 1, output);
  assert.match(output, /^ghost-plugin\s+\?\s+missing\b/mu);
  assert.match(output, /node_modules\/ghost-plugin/u);
  assert.doesNotMatch(output, /no plugins installed/u);
});
