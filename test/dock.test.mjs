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
  assert.match(panel.text(), /插件体检/);
  assert.doesNotMatch(panel.text(), /这是给谁用的/);

  await panel.click('.tk-dock-toggle');

  const opened = panel.text();
  for (const heading of ['这是给谁用的', '怎么用', '检查什么', '用之前要知道的']) {
    assert.ok(opened.includes(heading), `the guide never says "${heading}"`);
  }
  // The caveats are the part a user needs before trusting a green check.
  assert.match(opened, /只读/);
  assert.match(opened, /证明不了运行期行为/);
  assert.match(opened, /npm pack/);

  // The English guide is the same guide, not a shorter one.
  await panel.click('.tk-lang-button[data-on="false"]');
  for (const heading of ['Who this is for', 'How to use it', 'What it checks', 'Before you trust it']) {
    assert.ok(panel.text().includes(heading), `the English guide never says "${heading}"`);
  }
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

  assert.match(panel.text(), /市场会检查的项都通过了/);
  assert.match(panel.text(), /my-panel@0\.1\.0/);
  const requested = fetch.requests.filter((request) => request.path === '/toolkit/check');
  assert.equal(requested.length, 1);
  assert.match(requested[0].search, /dir=%2Ftmp%2Fmy-panel/);
  await panel.unmount();
});

test('the panel speaks Chinese by default, and switches to English in place', async () => {
  const panel = await mountClient({ file: path.join(ROOT, 'client.js'), slot: 'conversation.input.dock', host: host() });

  // Chinese first: the audience this plugin is written for.
  assert.match(panel.text(), /插件体检/);
  assert.doesNotMatch(panel.text(), /Plugin doctor/);

  await panel.click('.tk-lang-button[data-on="false"]');

  const english = panel.text();
  assert.match(english, /Plugin doctor/);
  assert.doesNotMatch(english, /插件体检/);
  assert.equal(panel.window.localStorage.getItem('dsh-plugin-toolkit:lang'), 'en');

  await panel.click('.tk-dock-toggle');
  assert.match(panel.text(), /Who this is for/);

  // And back, so the switch is not one-way.
  await panel.click('.tk-lang-button[data-on="false"]');
  assert.match(panel.text(), /这是给谁用的/);
  await panel.unmount();
});

test('the sidebar tab carries the same switch', async () => {
  const panel = await mountClient({ file: path.join(ROOT, 'client.js'), host: host() });
  assert.match(panel.text(), /这个插件装上去还能用吗/);
  await panel.click('.tk-lang-button[data-on="false"]');
  assert.match(panel.text(), /Does this plugin survive an install/);
  await panel.unmount();
});
