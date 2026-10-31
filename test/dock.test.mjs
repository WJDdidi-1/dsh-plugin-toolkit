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

const MIXED = {
  ok: false,
  dir: '/tmp/example',
  checks: [
    { check: 'manifest', ok: true, message: 'example@0.1.0' },
    { check: 'root export', ok: false, message: 'no apply' },
    { check: 'readme', ok: true, message: 'Requirements found' },
  ],
};

async function dock(routes = {}) {
  return mountClient({
    file: path.join(ROOT, 'client.js'),
    slot: 'conversation.input.dock',
    host: createHost({ locale: { en: {}, zh: {} } }),
    fetch: createFetch({ '/toolkit/check': { body: MIXED }, ...routes }),
  });
}

test('the input sits above the guide: the tool is not behind a wall of prose', async () => {
  const panel = await dock();
  await panel.click('.tk-dock-toggle');
  const html = panel.html();
  assert.ok(html.indexOf('tk-input') < html.indexOf('tk-guide-summary'),
    'the form comes before the guide');
  await panel.unmount();
});

test('the answer is the first thing in the list, and passes fold away', async () => {
  const panel = await dock();
  await panel.click('.tk-dock-toggle');
  await panel.type('.tk-input', '/tmp/example');
  await panel.click('.tk-button');

  const first = panel.must('.tk-rows .tk-row');
  assert.equal(first.getAttribute('data-ok'), 'false');
  assert.match(panel.text(), /2 项通过/);
  assert.match(panel.text(), /3 项里 1 项没过/);
  // The passing checks are behind the fold, not gone.
  assert.equal(panel.must('.tk-passes').open, false);
  await panel.unmount();
});

test('before the first check the panel says what to do instead of showing nothing', async () => {
  const panel = await dock();
  await panel.click('.tk-dock-toggle');
  assert.match(panel.text(), /填文件夹路径、owner\/repo 或 GitHub 链接/);
  await panel.unmount();
});

test('Escape closes the dock, and the toggle points at the body it opens', async () => {
  const panel = await dock();
  await panel.click('.tk-dock-toggle');
  assert.equal(panel.must('.tk-dock-toggle').getAttribute('aria-controls'), 'dsh-toolkit-dock-body');
  assert.equal(panel.must('.tk-dock').getAttribute('data-open'), 'true');

  await panel.press('.tk-input', 'Escape');
  assert.equal(panel.must('.tk-dock').getAttribute('data-open'), 'false');
  await panel.unmount();
});

test('the collapsed row carries the outcome, so a check is not hidden behind a click', async () => {
  const panel = await dock();
  await panel.click('.tk-dock-toggle');
  await panel.type('.tk-input', '/tmp/example');
  await panel.click('.tk-button');
  assert.equal(panel.query('.tk-chip'), null, 'no chip while the panel is open');

  await panel.click('.tk-dock-toggle');
  const chip = panel.must('.tk-chip');
  assert.equal(chip.getAttribute('data-ok'), 'false');
  assert.match(chip.textContent, /1 项没过/);
  await panel.unmount();
});

test('a bare name comes back as repositories to pick from, not as a guess', async () => {
  const candidates = {
    ok: false,
    kind: 'candidates',
    query: 'dsh-plugin',
    candidates: [
      { fullName: 'tanzhangjia/dsh-plugins-examples', description: 'Example plugins', stars: 1, url: 'https://github.com/tanzhangjia/dsh-plugins-examples' },
      { fullName: 'WJDdidi-1/dsh-plugin-example', description: 'A minimal panel plugin', stars: 0, url: 'https://github.com/WJDdidi-1/dsh-plugin-example' },
    ],
  };
  const panel = await mountClient({
    file: path.join(ROOT, 'client.js'),
    slot: 'conversation.input.dock',
    host: host(),
    fetch: createFetch({ '/toolkit/check': { body: candidates } }),
  });
  await panel.click('.tk-dock-toggle');
  await panel.type('.tk-input', 'dsh-plugin');
  await panel.click('.tk-button');

  const shown = panel.text();
  assert.match(shown, /找到 2 个仓库/);
  assert.match(shown, /tanzhangjia\/ ?dsh-plugins-examples/);
  assert.match(shown, /WJDdidi-1\/ ?dsh-plugin-example/);
  assert.match(shown, /Example plugins/);

  // Picking one asks about that repository by name — no second search.
  await panel.click('.tk-candidate');
  const asked = panel.host.fetch.requests.filter((entry) => entry.path === '/toolkit/check');
  assert.equal(asked.length, 2);
  assert.match(asked[1].search, /dir=tanzhangjia%2Fdsh-plugins-examples/);
  await panel.unmount();
});

test('a repository result names the repository, not just a temp folder', async () => {
  const body = {
    ok: false,
    kind: 'github',
    dir: '/tmp/dsh-toolkit-gh-1a2b/repo',
    repo: { fullName: 'WJDdidi-1/dsh-plugin-example', url: 'https://github.com/WJDdidi-1/dsh-plugin-example' },
    checks: [{ check: 'root export', ok: false, message: 'exports["."] points at the CLI' }],
  };
  const panel = await mountClient({
    file: path.join(ROOT, 'client.js'),
    slot: 'conversation.input.dock',
    host: host(),
    fetch: createFetch({ '/toolkit/check': { body } }),
  });
  await panel.click('.tk-dock-toggle');
  await panel.type('.tk-input', 'WJDdidi-1/dsh-plugin-example');
  await panel.click('.tk-button');

  const link = panel.attributes('.tk-repo a');
  assert.equal(link.href, 'https://github.com/WJDdidi-1/dsh-plugin-example');
  assert.match(panel.text(), /WJDdidi-1\/dsh-plugin-example/);
  await panel.unmount();
});
