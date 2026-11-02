import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { CAUSES, explain, verdict } from '../lib/explain.mjs';
import { run } from '../lib/cli.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => path.join(here, '..', 'fixtures', name);

function recorder() {
  const lines = [];
  return {
    lines,
    log: (line) => lines.push(String(line)),
    error: (line) => lines.push(String(line)),
  };
}

// The four sentences a plugin hub files into a plugin's own repository. Each
// string below is the opening line of real reports collected on 2026-11-02,
// e.g. V1ki/dsh-plugin-subscriptions#181 and rebron1900/dsh-mnemosyne#1.
const HUB_TEXTS = {
  install: 'dsh: plugin install failed for dsh-plugin-subscriptions@0.9.11',
  packaging: 'dsh: plugin distribution incomplete: prepare/build script failed for dsh-humanizer@0.4.0-alpha.2',
  version: 'dsh: installation rejected: Plugin dsh-plugin-subscriptions@0.9.11 is incompatible with dsh 0.2.1-rc.5',
  conflict: 'dsh: failed to apply loader entry for dsh-browser-scope@1.0.0-rc7: id already registered',
};

test('every hub sentence maps to exactly one known cause', () => {
  for (const [id, text] of Object.entries(HUB_TEXTS)) {
    const result = explain(text);
    assert.deepEqual(
      result.matched.map((cause) => cause.id),
      [id],
      `${id} should be the only match for ${JSON.stringify(text)}`,
    );
  }
});

test('a cause carries a check name doctor can actually run', () => {
  const checks = new Set(CAUSES.map((cause) => cause.check).join(', ').split(', '));
  assert.ok(checks.has('engines.dsh'));
  assert.ok(checks.has('files list'));
  assert.ok(checks.has('patch file'));
});

test('text that matches nothing is reported as unknown, not guessed', () => {
  assert.deepEqual(explain('npm ERR! code EACCES').matched, []);
  assert.deepEqual(explain('').matched, []);
});

test('verdict keeps only the failures the predicted cause points at', () => {
  const result = explain(HUB_TEXTS.version);
  const failures = [
    { check: 'readme', message: 'README.md has no Requirements section' },
    { check: 'engines.dsh', message: 'engines.dsh is missing' },
  ];
  const { hits } = verdict(result, failures);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].check, 'engines.dsh');
});

test('explain prints the cause and exits 0', async () => {
  const io = recorder();
  const code = await run(['explain', HUB_TEXTS.version], io);
  assert.equal(code, 0);
  const text = io.lines.join('\n');
  assert.match(text, /1 known cause/);
  assert.match(text, /engines\.dsh is missing/);
  assert.match(text, /fix: declare the range you actually support/);
});

test('explain names the failing check when given a checkout', async () => {
  const io = recorder();
  const code = await run(['explain', HUB_TEXTS.version, fixture('no-engines')], io);
  assert.equal(code, 0);
  assert.match(io.lines.join('\n'), /in .*no-engines: ✗ engines\.dsh:/);
});

test('explain exits 2 for unknown text and for no text', async () => {
  const unknown = recorder();
  assert.equal(await run(['explain', 'npm ERR! code EACCES'], unknown), 2);
  assert.match(unknown.lines.join('\n'), /no known cause for that text/);

  const empty = recorder();
  assert.equal(await run(['explain'], empty), 2);
  assert.match(empty.lines.join('\n'), /usage: dsh-plugin explain/);
});
