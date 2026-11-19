/**
 * `audit --home` must not turn a declared bundle with a valid but dsh-less
 * package.json into a false clean.
 *
 * The profile's `dsh.profile.bundles` list is the record that the loader will
 * mount the package. When the folder exists and its package.json parses but has
 * no `dsh` field, the old scan skipped it as if it were an ordinary dependency:
 * the profile then printed "no plugins installed" and exited 0 even though the
 * app could not mount the bundle. The CLI-level trials below pin both sides of
 * the boundary: the broken declared bundle fails with a `dsh field` row, while
 * a profile with only undeclared ordinary dependencies still exits 0.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const BIN = path.join(ROOT, 'bin', 'dsh-plugin.mjs');

function runAudit(args) {
  return spawnSync(process.execPath, [BIN, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

function writeProfile(home, bundles) {
  const profile = path.join(home, 'profiles', 'desktop');
  fs.mkdirSync(path.join(profile, 'node_modules'), { recursive: true });
  fs.writeFileSync(
    path.join(profile, 'package.json'),
    JSON.stringify({ name: 'desktop', private: true, dsh: { profile: { bundles } } }, null, 2),
  );
  return profile;
}

function writePackage(profile, name, manifest) {
  const dir = path.join(profile, 'node_modules', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(manifest, null, 2));
}

test('a declared bundle with no dsh field prints its row and exits 1', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-home-no-dsh-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const profile = writeProfile(home, ['broken-bundle']);
  // Parses cleanly, so it is not an unreadable-install row; it simply has no
  // plugin declaration. The profile still says the loader mounts it.
  writePackage(profile, 'broken-bundle', { name: 'broken-bundle', version: '1.0.0' });

  const result = runAudit(['audit', '--home', home, '--timeout', '50']);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 1, output);
  assert.match(output, /^broken-bundle\s+1\.0\.0\s+no dsh field\b/mu);
  assert.match(output, /dsh field: package\.json has no "dsh" field/u);
  assert.match(output, /1 of 1 installed plugin\(s\) have problems/u);
  assert.doesNotMatch(output, /no plugins installed/u);
});

test('a profile with only undeclared ordinary dependencies still exits 0', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-home-no-dsh-clean-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const profile = writeProfile(home, []);
  writePackage(profile, 'left-pad', { name: 'left-pad', version: '1.3.0' });
  writePackage(profile, 'another-dependency', { name: 'another-dependency', version: '2.0.0' });

  const result = runAudit(['audit', '--home', home, '--timeout', '50']);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 0, output);
  assert.match(output, /no plugins installed/u);
  assert.doesNotMatch(output, /left-pad|another-dependency/u);
  assert.doesNotMatch(output, /dsh field/u);
});
