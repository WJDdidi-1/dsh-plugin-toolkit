/**
 * Every example in `examples/` runs in CI, and prints exactly what the README
 * shows. An example that does not run is worse than no example: it teaches a
 * shape that no longer exists.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const examples = fs.readdirSync(path.join(root, 'examples')).filter((name) => name.endsWith('.mjs')).sort();

const expected = {
  'aria.mjs': 'live region: polite -> "0"\nlabelled control: increment\n',
  'baseline.mjs': 'baseline: same\n',
  'mount-a-bundle.mjs': 'Demo panel Count 0 0\nDemo panel Count 1 1\n',
  'route-stubs.mjs': 'Score 71\nasked for: 1 route(s), undeclared route answers 404\n',
};

test('every example runs and prints what the README claims', () => {
  assert.deepEqual(examples, Object.keys(expected).sort(), 'the example list and the expected output list disagree');
  for (const name of examples) {
    const output = execFileSync(process.execPath, [path.join('examples', name)], { cwd: root, encoding: 'utf8' });
    assert.equal(output, expected[name], `${name} printed something else`);
  }
});

test('the README shows each example by name, so the two cannot drift apart', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  for (const name of examples) {
    assert.match(readme, new RegExp(`examples/${name.replace('.', '\\.')}`), `README never mentions examples/${name}`);
  }
});
