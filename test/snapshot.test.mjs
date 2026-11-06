import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { expectSnapshot, normalize, write } from '../lib/testkit/snapshot.mjs';

test('a missing baseline names the flag that creates it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-'));
  assert.throws(() => expectSnapshot('<div class="a">x</div>', dir, 'panel'), /UPDATE_SNAPSHOTS=1/);
});

test('a matching baseline passes, and a changed one says which element moved', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-'));
  write(dir, 'panel', '<div class="b a">hello</div>');
  assert.equal(expectSnapshot('<div class="a b">hello</div>', dir, 'panel').status, 'same');
  assert.throws(
    () => expectSnapshot('<div class="a b">goodbye</div>', dir, 'panel'),
    /panel changed at element \d+[\s\S]*expected:[\s\S]*actual:/,
  );
});

test('UPDATE_SNAPSHOTS=1 writes the normalised HTML and reports written', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-'));
  const previous = process.env.UPDATE_SNAPSHOTS;
  process.env.UPDATE_SNAPSHOTS = '1';
  try {
    const created = expectSnapshot('<div  class="b  a">  hello  </div>', dir, 'panel');
    assert.equal(created.status, 'written');
    assert.equal(fs.readFileSync(path.join(dir, 'panel.html'), 'utf8'), '<div class="a b"> hello </div>\n');
    assert.equal(expectSnapshot('<div class="a b"> hello </div>', dir, 'panel').status, 'same');

    const updated = expectSnapshot('<div class="a b">goodbye</div>', dir, 'panel');
    assert.equal(updated.status, 'written');
    assert.equal(fs.readFileSync(path.join(dir, 'panel.html'), 'utf8'), '<div class="a b">goodbye</div>\n');
  } finally {
    if (previous === undefined) delete process.env.UPDATE_SNAPSHOTS;
    else process.env.UPDATE_SNAPSHOTS = previous;
  }
});

test('class order and outer whitespace do not count as a change', () => {
  assert.equal(normalize('<div  class="b  a">  hi  </div>'), '<div class="a b"> hi </div>');
});
