import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { createFetch, createHost, mountClient } from '../lib/testkit/index.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const host = () => createHost({ locale: { en: {}, zh: {} } });

test('the checker is docked under the conversation, not only in the sidebar', async () => {
  const panel = await mountClient({ file: path.join(ROOT, 'client.js'), slot: 'conversation.input.dock', host: host() });
  const definition = panel.host.slot('conversation.input.dock').definition;
  assert.equal(definition.id, 'dsh-plugin-toolkit');
  assert.equal(typeof definition.order, 'number');
  await panel.unmount();
});

test('the dock opens on a guide, so "what is this for" is answered where it is used', async () => {
  const panel = await mountClient({ file: path.join(ROOT, 'client.js'), slot: 'conversation.input.dock', host: host() });

  // Collapsed: one row, no wall of text.
  assert.match(panel.text(), /Plugin doctor/);
  assert.doesNotMatch(panel.text(), /Who this is for/);

  await panel.click('.tk-dock-toggle');

  const opened = panel.text();
  for (const heading of ['Who this is for', 'How to use it', 'What it checks', 'Before you trust it']) {
    assert.ok(opened.includes(heading), `the guide never says "${heading}"`);
  }
  // The caveats are the part a user needs before trusting a green check.
  assert.match(opened, /Read-only/);
  assert.match(opened, /cannot prove runtime behaviour/);
  assert.match(opened, /npm pack/);
  assert.equal(panel.must('.tk-dock-toggle').getAttribute('aria-expanded'), 'true');
  await panel.unmount();
});

test('the dock runs the same check as the tab', async () => {
  const fetch = createFetch({
    '/toolkit/check': {
      body: { ok: true, checks: [{ check: 'manifest', ok: true, message: 'my-panel@0.1.0' }] },
    },
  });
  const panel = await mountClient({
    file: path.join(ROOT, 'client.js'),
    slot: 'conversation.input.dock',
    host: createHost({ locale: { en: {}, zh: {} }, fetch }),
  });

  await panel.click('.tk-dock-toggle');
  await panel.type('.tk-input', '/tmp/my-panel');
  await panel.click('.tk-button');

  assert.match(panel.text(), /Everything the market checks passes/);
  assert.match(panel.text(), /my-panel@0\.1\.0/);
  const requested = fetch.requests.filter((request) => request.path === '/toolkit/check');
  assert.equal(requested.length, 1);
  assert.match(requested[0].search, /dir=%2Ftmp%2Fmy-panel/);
  await panel.unmount();
});
