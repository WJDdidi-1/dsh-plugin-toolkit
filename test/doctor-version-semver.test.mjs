import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkVersion, doctor } from '../lib/doctor.mjs';
import { init } from '../lib/init.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(here, '..', 'bin', 'dsh-plugin.mjs');
const scratch = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-plugin-version-'));

/** A clean `init` scaffold with its manifest version replaced. */
function scaffold(version) {
  const dir = path.join(scratch(), 'plugin');
  init({ dir, name: 'version-check-plugin', title: 'Version check' });
  const manifestPath = path.join(dir, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.version = version;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return dir;
}

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
}

const valid = ['1.0.0+build.5', '2.3.4+sha.abc', '0.1.0+20261103'];
const invalid = ['1.0.0-..', '1.0.0-.', '1.0.0+build..1', '1.0.0-01'];

test('checkVersion accepts SemVer 2.0 build metadata', () => {
  for (const version of valid) {
    assert.equal(checkVersion({ version }), null, version);
  }
});

test('doctor exits 0 on a clean scaffold with build metadata', () => {
  for (const version of valid) {
    const dir = scaffold(version);
    const report = doctor(dir);
    assert.deepEqual(report.failures, [], `${version}: ${JSON.stringify(report.failures)}`);

    const result = runCli(['doctor', dir]);
    assert.equal(result.status, 0, `${version}: ${result.stdout}${result.stderr}`);
    assert.match(result.stdout, new RegExp(`ok  version-check-plugin@${version.replace(/[.+]/gu, '\\$&')}`, 'u'));
  }
});

test('release --dry-run reaches the plan with build metadata', () => {
  for (const version of valid) {
    const result = runCli(['release', scaffold(version), '--dry-run']);
    assert.equal(result.status, 0, `${version}: ${result.stdout}${result.stderr}`);
    assert.match(result.stdout, new RegExp(`Create the tag plugin-v${version.replace(/[.+]/gu, '\\$&')}`, 'u'));
  }
});

test('doctor still rejects malformed pre-release and build identifiers', () => {
  for (const version of invalid) {
    assert.match(checkVersion({ version }), /is not semver/u, version);

    const dir = scaffold(version);
    assert.equal(doctor(dir).failures.some(({ check }) => check === 'version'), true, version);

    const result = runCli(['doctor', dir]);
    assert.equal(result.status, 1, `${version}: ${result.stdout}${result.stderr}`);
    assert.match(result.stderr, /✗ version:/u, `${version}: ${result.stderr}`);
  }
});
