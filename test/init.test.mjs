/**
 * The scaffold has one job: produce a plugin that already passes the checks
 * people hit after their first publish. So the test runs those checks on the
 * output instead of trusting the template.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { doctor } from '../lib/doctor.mjs';
import { init } from '../lib/init.mjs';
import { mountClient } from '../lib/testkit/index.mjs';

function scratch() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-plugin-init-'));
}

test('the scaffold passes doctor, which is the point of it', () => {
  const dir = path.join(scratch(), 'plugin');
  const result = init({ dir, name: 'my-panel', title: 'My panel' });
  assert.equal(result.ok, true);
  const report = doctor(dir);
  assert.deepEqual(report.failures, []);
  assert.equal(report.notes.hostRange, '>=0.2.0');
});

test('the scaffolded client bundle renders without a browser', async () => {
  const dir = path.join(scratch(), 'plugin');
  init({ dir, name: 'my-panel', title: 'My panel' });
  const panel = await mountClient({
    file: path.join(dir, 'client.js'),
    copy: { 'my-panel': { tabTitle: 'My panel', title: 'My panel', body: 'This panel came from dsh-plugin init.', clicks: 'Clicks' } },
  });
  assert.match(panel.text(), /My panel/);
  await panel.click('button');
  assert.match(panel.text(), /Clicks: 1/);
  await panel.unmount();
});

test('the scaffold ships the test and the workflow it tells you to run', () => {
  const dir = path.join(scratch(), 'plugin');
  init({ dir, name: 'my-panel' });
  const spec = fs.readFileSync(path.join(dir, 'test/panel.test.mjs'), 'utf8');
  assert.match(spec, /dsh-plugin-toolkit\/testkit/);
  assert.match(spec, /mountClient/);
  const workflow = fs.readFileSync(path.join(dir, '.github/workflows/ci.yml'), 'utf8');
  assert.match(workflow, /npm test/);
  assert.match(workflow, /doctor \./);
});

test('an occupied directory is refused unless --force, so nothing is overwritten', () => {
  const dir = scratch();
  fs.writeFileSync(path.join(dir, 'notes.md'), 'mine\n');
  const refused = init({ dir, name: 'my-panel' });
  assert.equal(refused.ok, false);
  assert.match(refused.failures[0].message, /is not empty/);
  assert.equal(fs.readFileSync(path.join(dir, 'notes.md'), 'utf8'), 'mine\n');

  const forced = init({ dir, name: 'my-panel', force: true });
  assert.equal(forced.ok, true);
  assert.equal(fs.readFileSync(path.join(dir, 'notes.md'), 'utf8'), 'mine\n');
});

test('a name that npm would reject is rejected here, not at publish time', () => {
  for (const name of ['My Panel', '', '../evil', 'UPPER', '@scope']) {
    const result = init({ dir: path.join(scratch(), 'x'), name });
    assert.equal(result.ok, false, `${name} should be refused`);
    assert.equal(result.failures[0].check, 'name');
  }
  assert.equal(init({ dir: path.join(scratch(), 'ok'), name: '@me/my-panel' }).ok, true);
});
