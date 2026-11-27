/**
 * The testkit's contract is that `await mountClient(...)` returns a handle the
 * caller can read. Production React builds have no `act`, so the mount has to
 * flush the panel's own effects and fetches without it; this pins that path.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('a production build has the fetched value on screen when mountClient resolves', () => {
  const output = execFileSync(process.execPath, [path.join('test', 'fixtures', 'production-mount.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'production' },
  });
  assert.match(output, /mounts=3 mismatches=0/u);
});
