import assert from 'node:assert/strict';
import test from 'node:test';

import { addVersion, auditVersions, buildEntry, findPlugin } from '../lib/index-file.mjs';

const index = () => ({
  formatVersion: 1,
  plugins: [
    {
      name: 'demo-plugin',
      title: 'Demo',
      metadata: { labels: ['no-network'] },
      versions: [
        { version: '1.2.0', publishTimestamp: 1790000000, source: { type: 'npm' }, engines: { dsh: '>=0.2.0' } },
      ],
    },
  ],
});

test('a new version goes to the front, with the host range attached', () => {
  const next = addVersion(index(), 'demo-plugin', buildEntry({ version: '1.2.3', publishTimestamp: 1793400000, hostRange: '>=0.2.0' }));
  const versions = findPlugin(next, 'demo-plugin').versions;
  assert.equal(versions[0].version, '1.2.3');
  assert.equal(versions[0].engines.dsh, '>=0.2.0');
  assert.equal(versions[0].publishTimestamp, 1793400000);
  assert.deepEqual(versions[0].source, { type: 'npm' });
});

test('publishing the same version twice is refused', () => {
  assert.throws(() => addVersion(index(), 'demo-plugin', buildEntry({ version: '1.2.0', publishTimestamp: 1, hostRange: '>=0.2.0' })), /already/);
});

test('the audit finds versions that cannot state a host requirement', () => {
  const stale = index();
  stale.plugins[0].versions.push({ version: '1.2.1', publishTimestamp: 2, source: { type: 'npm' } });
  assert.deepEqual(auditVersions(stale, 'demo-plugin').map((version) => version.version), ['1.2.1']);
  assert.deepEqual(auditVersions(index(), 'demo-plugin'), []);
});

test('an unknown plugin name is an error, not a silent no-op', () => {
  assert.throws(() => addVersion(index(), 'other-plugin', buildEntry({ version: '1.0.0', publishTimestamp: 1, hostRange: '>=0.2.0' })), /other-plugin/);
});
