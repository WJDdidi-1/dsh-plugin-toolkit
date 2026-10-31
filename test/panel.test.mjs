/**
 * The panel is the reason this package can be listed in the market at all, so
 * it is mounted the way a user would meet it: the real client bundle, a fake
 * host, and a stub that answers the route the host half registers.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createFetch, mountClient } from '../lib/testkit/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function mount(routes) {
  const panel = await mountClient({
    file: path.join(ROOT, 'client.js'),
    copy: { en: {}, zh: {} },
    fetch: createFetch(routes),
  });
  // These tests assert copy, and the panel opens in Chinese: switch once here
  // rather than scattering the language through every assertion.
  await panel.click('.tk-lang-button[data-on="false"]');
  return panel;
}

test('the panel asks for a folder and reports what the checks said', async () => {
  const panel = await mount({
    '/toolkit/check': {
      body: {
        ok: false,
        dir: '/tmp/example',
        checks: [
          { check: 'manifest', ok: true, message: 'example@0.1.0' },
          { check: 'tarball', ok: false, message: 'the tarball does not contain client.js' },
        ],
      },
    },
  });

  assert.match(panel.text(), /Does this plugin survive an install\?/);
  await panel.type('.tk-input', '/tmp/example');
  await panel.click('.tk-button');

  assert.match(panel.text(), /This would not install cleanly\./);
  assert.match(panel.text(), /the tarball does not contain client\.js/);
  assert.equal(panel.queryAll('.tk-row').length, 2);
  assert.equal(panel.must('.tk-row[data-ok="false"] .tk-mark').textContent, '✗');
  await panel.unmount();
});

test('a folder that passes says so, and nothing is claimed before a check runs', async () => {
  const panel = await mount({ '/toolkit/check': { body: { ok: true, dir: '/tmp/ok', checks: [{ check: 'manifest', ok: true, message: 'ok@1.0.0' }] } } });

  assert.equal(panel.queryAll('.tk-row').length, 0);
  await panel.type('.tk-input', '/tmp/ok');
  await panel.click('.tk-button');

  assert.match(panel.text(), /Everything the market checks passes\./);
  await panel.unmount();
});

test('an empty folder is refused in the panel instead of asking the host', async () => {
  const panel = await mount({ '/toolkit/check': { body: { ok: true, dir: null, checks: [] } } });
  await panel.click('.tk-button');
  assert.match(panel.text(), /Name the folder that holds the plugin's package\.json\./);
  assert.deepEqual(panel.host.fetch.requests.filter((request) => request.path === '/toolkit/check'), []);
  await panel.unmount();
});

test('the module face declares the services it reads, and apply survives a bare context', async () => {
  const { loadBundle } = await import('../lib/testkit/load.mjs');
  const face = loadBundle(path.join(ROOT, 'client.js'));
  // Without this list the loader calls apply() before `slots` and `locale`
  // exist, apply throws, and the web boot fails for every plugin in the profile.
  assert.deepEqual(face.inject, ['slots', 'locale']);
  assert.equal(typeof face.apply, 'function');
  assert.doesNotThrow(() => face.apply({}));
  assert.doesNotThrow(() => face.apply({ locale: { register() { throw new Error('no locale'); } } }));
  assert.doesNotThrow(() => face.apply({ inject: (deps, callback) => callback({}) }));
});

test('a service that throws is reported instead of turning into an unexplained red dot', async () => {
  const { createFetch: makeFetch, createHost, mountClient: mountWith } = await import('../lib/testkit/index.mjs');
  const fetch = makeFetch({});
  const host = createHost({ fetch, locale: { en: {}, zh: {} } });
  // The failure this incident produced: the tab registration throws *after*
  // apply() returned, where the outer guards cannot see it. The row ends up
  // "failed" and the app shows one red dot with no text anywhere.
  host.sidebarRightTabs.register = () => {
    throw new Error('the sidebar is full');
  };

  const panel = await mountWith({ file: path.join(ROOT, 'client.js'), host, fetch });
  await panel.click('.tk-lang-button[data-on="false"]');

  const reports = fetch.requests.filter((request) => request.path === '/toolkit/report');
  const failed = reports.filter((request) => String(request.body).includes('tab-failed'));
  assert.equal(failed.length, 1);
  assert.match(String(failed[0].body), /the sidebar is full/);
  // The panel still mounted: the report is the only visible difference.
  assert.match(panel.text(), /Does this plugin survive an install\?/);
  await panel.unmount();
});

test('the tab type is reachable from the sidebar guide, not only by kind', async () => {
  const { createHost, mountClient: mountWith } = await import('../lib/testkit/index.mjs');
  const registered = [];
  const host = createHost({ locale: { en: {}, zh: {} } });
  host.sidebarRightTabs.register = (definition) => {
    registered.push(definition);
    return () => {};
  };

  const panel = await mountWith({ file: path.join(ROOT, 'client.js'), host });

  // A tab *type* with no guide entry is registered but never offered: the
  // sidebar builds its guide list from `tabs.guide()`, so nothing opens it and
  // the user sees no tab at all.
  const definition = registered.find((entry) => entry.id === 'dsh-plugin-toolkit');
  assert.ok(definition !== undefined, 'the tab type is registered');
  assert.equal(definition.guide.length, 1);
  // The title follows the panel's own language choice, Chinese first.
  assert.equal(definition.guide[0].title(), '插件体检');
  assert.equal(typeof definition.guide[0].order, 'number');
  await panel.click('.tk-lang-button[data-on="false"]');
  assert.equal(definition.guide[0].title(), 'Plugin doctor');
  await panel.unmount();
});
