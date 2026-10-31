// The composite action is the only part of this package that runs in someone
// else's workflow, so it is the part that breaks without any test noticing:
// a renamed input, a command that no longer exists, or `doctor` where `verify`
// belongs all look fine from here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { HELP } from '../lib/cli.mjs';

// `import.meta.dirname` is Node 20.11+, and this package supports 18.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ACTION = fs.readFileSync(path.join(ROOT, 'action.yml'), 'utf8');
const README = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

test('the action defaults to verify, not to a check that misses the tarball', () => {
  const [, afterCommand] = ACTION.split('command:');
  assert.match(afterCommand, /default: verify/);
});

test('every command the action offers is a command the CLI has', () => {
  const offered = ACTION.match(/description: verify \(pack, install, mount\) or (\w+)[^\n]*or (\w+)/);
  assert.ok(offered, 'the command input lists what it accepts');
  for (const name of ['verify', ...offered.slice(1)]) {
    assert.match(HELP, new RegExp(`dsh-plugin ${name}\\b`), `${name} is a real command`);
  }
});

test('the action fetches a published package rather than shipping node_modules', () => {
  assert.match(ACTION, /npx --yes dsh-plugin-toolkit@\$\{\{ inputs\.version \}\}/);
  assert.match(ACTION, /default: latest/);
  // Shipping node_modules would also mean shipping jsdom and React.
  assert.equal(fs.existsSync(path.join(ROOT, 'action-node_modules')), false);
});

test('the README shows the action the way a consumer writes it', () => {
  assert.match(README, /uses: WJDdidi-1\/dsh-plugin-toolkit@v1/);
  assert.match(README, /command: verify/);
});
