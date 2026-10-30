import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { plan, tagExists, tagName, workingTreeIsClean } from '../lib/release.mjs';

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-release-'));
  const run = (args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' }).toString();
  run(['init', '-q']);
  run(['config', 'user.email', 'test@example.com']);
  run(['config', 'user.name', 'Test']);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'demo-plugin', version: '1.2.3', engines: { dsh: '>=0.2.0' } }, null, 2));
  run(['add', '.']);
  run(['commit', '-q', '-m', 'one']);
  return { dir, run };
}

test('the tag carries the package version and the prefix the project uses', () => {
  assert.equal(tagName('1.2.3'), 'plugin-v1.2.3');
  assert.equal(tagName('1.2.3', 'v'), 'v1.2.3');
});

test('a clean repository is reported clean, and a tag that exists is seen', () => {
  const { dir, run } = tempRepo();
  assert.equal(workingTreeIsClean(dir), true);
  fs.writeFileSync(path.join(dir, 'a.txt'), 'x');
  assert.equal(workingTreeIsClean(dir), false);
  fs.writeFileSync(path.join(dir, 'package.json'), fs.readFileSync(path.join(dir, 'package.json')));
  run(['checkout', '--', '.']);
  run(['clean', '-qfd']);
  assert.equal(tagExists(dir, 'plugin-v1.2.3'), false);
  run(['tag', 'plugin-v1.2.3']);
  assert.equal(tagExists(dir, 'plugin-v1.2.3'), true);
});

test('the plan lists every step that a release has to finish, in order', () => {
  const { dir } = tempRepo();
  const planned = plan({ dir, indexFile: path.join(dir, 'market/index.json') });
  assert.equal(planned.tag, 'plugin-v1.2.3');
  const titles = planned.steps.map((step) => step.title);
  assert.ok(titles.length >= 7, titles.join(' | '));
  assert.match(titles[0], /read the manifest/i);
  const at = (pattern) => titles.findIndex((title) => pattern.test(title));
  assert.ok(at(/create the tag/i) > 0);
  assert.ok(at(/push the tag/i) > at(/create the tag/i));
  assert.ok(at(/registry serves/i) > at(/push the tag/i));
  assert.ok(at(/market index/i) > at(/registry serves/i));
});
