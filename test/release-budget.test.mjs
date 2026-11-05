import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { run } from '../lib/cli.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, 'fixtures', 'good');

function recorder() {
  const lines = [];
  return {
    lines,
    log: (line) => lines.push(String(line)),
    error: (line) => lines.push(String(line)),
  };
}

function releaseRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-release-budget-'));
  const origin = path.join(root, 'origin.git');
  const repo = path.join(root, 'plugin');
  execFileSync('git', ['init', '-q', '--bare', origin], { cwd: root, stdio: 'pipe' });
  fs.cpSync(fixture, repo, { recursive: true });
  const git = (args) => execFileSync('git', args, { cwd: repo, stdio: 'pipe' }).toString();
  git(['init', '-q']);
  git(['config', 'user.email', 'test@example.com']);
  git(['config', 'user.name', 'Test']);
  git(['remote', 'add', 'origin', origin]);
  git(['add', '.']);
  git(['commit', '-q', '-m', 'one']);
  return { origin, repo, git };
}

function tags(dir) {
  const output = execFileSync('git', ['tag', '--list'], { cwd: dir, encoding: 'utf8' }).trim();
  return output === '' ? [] : output.split('\n');
}

for (const budget of ['8m', '0', '-1']) {
  test(`release rejects --budget ${budget} before it tags`, async () => {
    const { origin, repo } = releaseRepo();
    const io = recorder();
    const code = await run(['release', repo, '--budget', budget], io);
    assert.equal(code, 2, io.lines.join('\n'));
    assert.match(io.lines.join('\n'), /--budget needs a positive number of seconds/u);
    assert.deepEqual(tags(origin), []);
    assert.deepEqual(tags(repo), []);
  });
}

test('a missing --budget value is rejected too, instead of becoming NaN', async () => {
  const { origin, repo } = releaseRepo();
  const io = recorder();
  const code = await run(['release', repo, '--budget'], io);
  assert.equal(code, 2, io.lines.join('\n'));
  assert.match(io.lines.join('\n'), /--budget needs a positive number of seconds/u);
  assert.deepEqual(tags(origin), []);
});

test('a positive --budget still reaches the registry wait', async () => {
  const { origin, repo } = releaseRepo();
  const io = recorder();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ status: 404, ok: false, json: async () => ({}) });
  try {
    const code = await run(['release', repo, '--budget', '480'], io);
    assert.equal(code, 1, io.lines.join('\n'));
    const output = io.lines.join('\n');
    assert.match(output, /stopped at registry/u);
    assert.match(output, /has no package named demo-plugin/u);
    // The positive path did finish the tag and push, which is exactly what the
    // invalid values above must never reach.
    assert.deepEqual(tags(origin), ['plugin-v1.2.3']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
