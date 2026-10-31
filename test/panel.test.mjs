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
  return mountClient({
    file: path.join(ROOT, 'client.js'),
    copy: { en: {}, zh: {} },
    fetch: createFetch(routes),
  });
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
  assert.equal(panel.host.fetch.requests.length, 0);
  await panel.unmount();
});
