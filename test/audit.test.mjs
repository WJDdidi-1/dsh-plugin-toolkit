import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { audit, listInstalled } from '../lib/audit.mjs';
import { checkClientEntry, doctor } from '../lib/doctor.mjs';

function writePlugin(root, name, manifest, files = {}) {
  const dir = path.join(root, 'profiles', 'desktop', 'node_modules', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(manifest, null, 2));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), content);
  }
  return dir;
}

function goodManifest(name) {
  return {
    name, version: '1.0.0', files: ['index.js', 'client.js', 'cordis.patch.yml'],
    engines: { dsh: '>=0.2.0' },
    dsh: { bundle: { patch: './cordis.patch.yml' }, client: { entry: 'client.js' } },
  };
}

const goodFiles = {
  'README.md': '# demo\n\n## Requirements\n\n| Harness |\n| --- |\n| `>=0.2.0` |\n',
  'cordis.patch.yml': '- insert: []\n',
  'index.js': 'export function apply() {}\n',
  'client.js': 'window.__ModuleLoader__.load({ id: "x", factory: () => ({}) });\n',
};

test('only packages that declare a dsh field count as plugins', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-home-'));
  writePlugin(home, 'demo-plugin', goodManifest('demo-plugin'), goodFiles);
  writePlugin(home, '@scope/demo', { ...goodManifest('@scope/demo') }, goodFiles);
  writePlugin(home, 'left-pad', { name: 'left-pad', version: '1.3.0' });
  const found = listInstalled({ home }).map((entry) => entry.manifest.name).sort();
  assert.deepEqual(found, ['@scope/demo', 'demo-plugin']);
});

test('audit names the plugin with problems and keeps the healthy one quiet', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-home-'));
  writePlugin(home, 'demo-plugin', goodManifest('demo-plugin'), goodFiles);
  writePlugin(home, 'broken-plugin', { ...goodManifest('broken-plugin'), engines: undefined, main: 'index.js' }, {
    ...goodFiles,
    'index.js': 'export const notApply = 1;\n',
  });
  const lines = [];
  const result = await audit({ home, io: { log: (line) => lines.push(line) } });
  assert.equal(result.ok, false);
  assert.equal(result.plugins.length, 2);
  const broken = result.plugins.find((row) => row.name === 'broken-plugin');
  assert.deepEqual(broken.failures.map((failure) => failure.check), ['engines.dsh', 'root export']);
  assert.match(lines.join('\n'), /1 of 2 installed plugin\(s\) have problems/u);
});

test('audit says which plugins the running app loaded, and which it did not', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-home-'));
  writePlugin(home, 'demo-plugin', goodManifest('demo-plugin'), goodFiles);
  writePlugin(home, 'quiet-plugin', goodManifest('quiet-plugin'), goodFiles);
  const encoder = new TextEncoder();
  const graph = { type: 'graph', graph: { entries: [{ id: 'demo-plugin' }] } };
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(graph)}\n\n`));
        controller.close();
      },
    }),
  });
  const lines = [];
  const result = await audit({ home, host: 'http://127.0.0.1:9', fetchImpl, io: { log: (line) => lines.push(line) } });
  assert.equal(result.plugins.find((row) => row.name === 'demo-plugin').loaded, true);
  assert.equal(result.plugins.find((row) => row.name === 'quiet-plugin').loaded, false);
  assert.match(lines.join('\n'), /1 installed plugin\(s\) are not in the running app/u);
});

test('without a host, loaded is unknown rather than false', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-home-'));
  writePlugin(home, 'demo-plugin', goodManifest('demo-plugin'), goodFiles);
  const result = await audit({ home, io: { log: () => {} } });
  assert.equal(result.plugins[0].loaded, null);
});

test('an installed copy is not judged by a files list it already survived', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'installed-'));
  const manifest = { ...goodManifest('demo-plugin'), files: ['nothing-here'] };
  for (const [file, content] of Object.entries(goodFiles)) fs.writeFileSync(path.join(dir, file), content);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(manifest));
  assert.match(doctor(dir).failures.map((failure) => failure.check).join(','), /files list/u);
  assert.equal(doctor(dir, { installed: true }).failures.length, 0);
});

test('a client bundle declared through the ./client export is found', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'client-export-'));
  fs.mkdirSync(path.join(dir, 'dsh'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'dsh', 'client.js'), '// bundle');
  const manifest = { name: 'demo', version: '1.0.0', dsh: { client: { platform: 'web' } }, exports: { './client': './dsh/client.js' } };
  assert.equal(checkClientEntry(dir, manifest), null);
});

test('a ./client export written as a conditions object is found too', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'client-conditions-'));
  fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'lib', 'client.cjs'), '// bundle');
  const manifest = { name: 'demo', version: '1.0.0', dsh: { client: { platform: 'web' } }, exports: { './client': { default: './lib/client.cjs' } } };
  assert.equal(checkClientEntry(dir, manifest), null);
});

test('advisories do not fail an audit', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-home-'));
  writePlugin(home, 'demo-plugin', { ...goodManifest('demo-plugin'), engines: undefined }, goodFiles);
  const lines = [];
  const result = await audit({ home, io: { log: (line) => lines.push(line) } });
  assert.equal(result.ok, true);
  assert.equal(result.plugins[0].hard.length, 0);
  assert.deepEqual(result.plugins[0].advisory.map((failure) => failure.check), ['engines.dsh']);
  assert.match(lines.join('\n'), /not ready for the market index/u);
});
