import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { run } from '../lib/cli.mjs';
import { doctor, exportsApply } from '../lib/doctor.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => path.join(here, 'fixtures', name);

function recorder() {
  const lines = [];
  return {
    lines,
    log: (line) => lines.push(String(line)),
    error: (line) => lines.push(String(line)),
  };
}

test('an apply mention in a comment, string, template or regex is not an export', () => {
  const sources = [
    "export const name = 'only-comment';\n// export function apply() {}\n",
    "export const name = 'only-comment';\n/* export function apply() {} */\n",
    "export const name = 'only-comment';\n/**\n * TODO: export const apply = () => {}\n */\n",
    "export const docs = 'export function apply() {}';\n",
    'export const docs = `export const apply = () => {};`;\n',
    'export const pattern = /export function apply/;\n',
    'const local = { apply: function () {} };\nexport { local };\n',
    'function apply() {}\nexport { apply as notApply };\n',
  ];
  for (const source of sources) {
    assert.equal(exportsApply(source), false, source);
  }
});

test('the export forms the loader can call are recognized after comments are removed', () => {
  const sources = [
    'export function apply(ctx) {}\n',
    'export async function apply(ctx) {}\n',
    'export const apply = () => {};\n',
    'export let apply = function () {};\n',
    'export { apply };\n',
    "export { helper as apply } from './helper.js';\n",
    '/* before */ export /* middle */ function apply() {}\n',
    'module.exports = { apply: function () {} };\n',
    'module.exports = { apply() {} };\n',
    'exports.apply = () => {};\n',
  ];
  for (const source of sources) {
    assert.equal(exportsApply(source), true, source);
  }
});

const commentFixtures = ['comment-apply-1', 'comment-apply-2', 'comment-apply-3'];

for (const name of commentFixtures) {
  test(`doctor rejects ${name}, whose root module only mentions apply in a comment`, async () => {
    const report = doctor(fixture(name));
    const failure = report.failures.find((entry) => entry.check === 'root export');
    assert.ok(failure, JSON.stringify(report.failures));
    assert.match(failure.message, /does not export apply/u);

    const io = recorder();
    assert.equal(await run(['doctor', fixture(name)], io), 1, io.lines.join('\n'));
    assert.match(io.lines.join('\n'), /root export: the root export index\.js does not export apply/u);
  });
}

test('a real apply export still passes after the comment-only fixtures fail', async () => {
  const report = doctor(fixture('root-export-string-apply'));
  assert.deepEqual(report.failures, []);

  const io = recorder();
  assert.equal(await run(['doctor', fixture('root-export-string-apply')], io), 0, io.lines.join('\n'));
});
