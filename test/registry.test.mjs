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

test('a version listed without its publish time is not ready yet', async () => {
  const { waitForVersion } = await import('../lib/registry.mjs');
  const documents = [
    { versions: { '1.0.0': {} } },
    { versions: { '1.0.0': {} }, time: { '1.0.0': '2026-10-31T02:43:00.000Z' } },
  ];
  let calls = 0;
  const result = await waitForVersion('demo', '1.0.0', {
    requireTime: true,
    fetch: async () => ({ status: 200, ok: true, json: async () => documents[Math.min(calls++, documents.length - 1)] }),
    sleep: async () => {},
    budgetMs: 60_000,
    intervalMs: 1,
  });
  assert.equal(result.timedOut, undefined);
  assert.equal(result.attempts, 2);
  assert.equal(result.document.time['1.0.0'], '2026-10-31T02:43:00.000Z');
});

test('a release refuses to write an index entry with a null publish time', async () => {
  const { release } = await import('../lib/release.mjs');
  const result = await release({
    dir: '/tmp/definitely-not-a-repo',
    fetch: async () => ({ status: 200, ok: true, json: async () => ({ versions: { '1.0.0': {} } }) }),
    sleep: async () => {},
    budgetMs: 1000,
    intervalMs: 1,
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'preflight');
});

test('the registry document is asked for in full, because the index needs `time`', async () => {
  const { packument } = await import('../lib/registry.mjs');
  let seen;
  await packument('demo', {
    fetch: async (url, init) => {
      seen = init.headers.accept;
      return { status: 200, ok: true, json: async () => ({}) };
    },
  });
  assert.equal(seen, 'application/json');
});
