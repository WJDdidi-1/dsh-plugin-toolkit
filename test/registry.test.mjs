import assert from 'node:assert/strict';
import test from 'node:test';

import { publishedAt, waitForVersion } from '../lib/registry.mjs';

const document = { time: { '1.2.3': '2026-10-30T09:33:12.000Z' } };

test('the publish time comes from the registry document, not from us', () => {
  assert.equal(publishedAt(document, '1.2.3'), Math.floor(Date.parse('2026-10-30T09:33:12.000Z') / 1000));
  assert.equal(publishedAt(document, '9.9.9'), null);
});

test('waiting polls the registry until the version appears', async () => {
  let calls = 0;
  const waits = [];
  const result = await waitForVersion('demo-plugin', '1.2.3', {
    fetch: async () => {
      calls += 1;
      return { ok: true, status: 200, json: async () => (calls < 3 ? { time: {} } : document) };
    },
    sleep: async (ms) => waits.push(ms),
    now: (() => {
      let clock = 0;
      return () => (clock += 1000);
    })(),
  });
  assert.equal(result.timedOut, undefined);
  assert.equal(result.attempts, 3);
  assert.deepEqual(waits, [10000, 10000]);
});

test('a slow registry ends as a timeout with what was seen, not as a crash', async () => {
  const result = await waitForVersion('demo-plugin', '1.2.3', {
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ time: {} }) }),
    sleep: async () => {},
    budgetMs: 3000,
    now: (() => {
      let clock = 0;
      return () => (clock += 1000);
    })(),
  });
  assert.equal(result.timedOut, true);
});
