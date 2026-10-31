import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { copyEntry, dev, resolveDest, resolveEntry, verifyReload } from '../lib/dev.mjs';

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function sseResponse(frames) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
      controller.close();
    },
  });
  return { ok: true, status: 200, body };
}

test('the entry is the declared one, then the usual two locations', () => {
  const dir = tempDir('entry-');
  assert.equal(resolveEntry(dir, { dsh: { client: { entry: 'dist/main.js' } } }), null);
  fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'lib', 'client.js'), '// bundle');
  assert.equal(resolveEntry(dir, {}), path.join(dir, 'lib', 'client.js'));
  fs.writeFileSync(path.join(dir, 'client.js'), '// bundle');
  assert.equal(resolveEntry(dir, {}), path.join(dir, 'client.js'));
  fs.writeFileSync(path.join(dir, 'dist-main.js'), '// bundle');
  assert.equal(resolveEntry(dir, { dsh: { client: { entry: 'dist-main.js' } } }), path.join(dir, 'dist-main.js'));
});

test('the installed copy is found in a profile, or taken from --dest', () => {
  const home = tempDir('home-');
  const installed = path.join(home, 'profiles', 'desktop', 'node_modules', 'demo-plugin');
  fs.mkdirSync(installed, { recursive: true });
  assert.equal(resolveDest('demo-plugin', { home }), installed);
  assert.equal(resolveDest('other-plugin', { home }), null);
  assert.equal(resolveDest('demo-plugin', { home, dest: path.join(home, 'elsewhere') }), path.resolve(path.join(home, 'elsewhere')));
});

test('copying updates the file the host watches', () => {
  const dir = tempDir('copy-');
  const from = path.join(dir, 'client.js');
  const to = path.join(dir, 'installed', 'client.js');
  fs.writeFileSync(from, 'window.__ModuleLoader__ = {};');
  const before = Date.now();
  const copied = copyEntry({ from, to });
  assert.equal(copied.bytes, fs.statSync(to).size);
  assert.ok(fs.statSync(to).mtimeMs >= before - 1000);
  assert.equal(fs.readFileSync(to, 'utf8'), 'window.__ModuleLoader__ = {};');
});

test('a rebuilt frame for the plugin ends the wait, and the write happens after the stream opens', async () => {
  const order = [];
  const fetchImpl = async () => sseResponse([
    { type: 'graph', graph: { entries: [] } },
    { type: 'rebuilt', id: 'demo-plugin', rev: 'abc123' },
  ]);
  const result = await verifyReload({
    host: 'http://127.0.0.1:1234',
    id: 'demo-plugin',
    fetchImpl,
    action: () => order.push('write'),
  });
  assert.equal(result.ok, true);
  assert.equal(result.rev, 'abc123');
  assert.deepEqual(order, ['write']);
});

test('frames about other plugins are ignored', async () => {
  const fetchImpl = async () => sseResponse([
    { type: 'rebuilt', id: 'someone-else', rev: 'zzz' },
    { type: 'rebuilt', id: 'demo-plugin', rev: 'second' },
  ]);
  const result = await verifyReload({ host: 'http://127.0.0.1:1234', id: 'demo-plugin', fetchImpl });
  assert.equal(result.rev, 'second');
});

test('a stream that closes without the frame says so instead of hanging', async () => {
  const fetchImpl = async () => sseResponse([{ type: 'graph', graph: {} }]);
  const result = await verifyReload({ host: 'http://127.0.0.1:1234', id: 'demo-plugin', fetchImpl });
  assert.equal(result.ok, false);
  assert.match(result.reason, /ended before a rebuilt frame/);
});

test('--once copies the bundle and reports the reload it saw', async () => {
  const root = tempDir('dev-');
  const plugin = path.join(root, 'plugin');
  const dest = path.join(root, 'installed');
  fs.mkdirSync(plugin, { recursive: true });
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(path.join(plugin, 'package.json'), JSON.stringify({ name: 'demo-plugin', version: '1.0.0' }));
  fs.writeFileSync(path.join(plugin, 'client.js'), '// v1');
  fs.writeFileSync(path.join(dest, 'client.js'), '// v0');

  const lines = [];
  const io = { log: (line) => lines.push(line), error: (line) => lines.push(`ERROR ${line}`) };
  const fetchImpl = async () => sseResponse([{ type: 'graph', graph: {} }, { type: 'rebuilt', id: 'demo-plugin', rev: 'r2' }]);
  const code = await dev({ dir: plugin, dest, host: 'http://127.0.0.1:1234', once: true, io, fetchImpl });
  assert.equal(code, 0);
  assert.equal(fs.readFileSync(path.join(dest, 'client.js'), 'utf8'), '// v1');
  assert.ok(lines.some((line) => /reloaded demo-plugin \(rev r2\)/.test(line)), lines.join('\n'));
});

test('a plugin that is not installed is refused with the flag that fixes it', async () => {
  const root = tempDir('dev-missing-');
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'nowhere-plugin', version: '1.0.0' }));
  fs.writeFileSync(path.join(root, 'client.js'), '// v1');
  const lines = [];
  const io = { log: (line) => lines.push(line), error: (line) => lines.push(line) };
  const code = await dev({ dir: root, home: path.join(root, 'empty-home'), once: true, io, fetchImpl: async () => sseResponse([]) });
  assert.equal(code, 1);
  assert.ok(lines.some((line) => /not installed in any profile; pass --dest/.test(line)), lines.join('\n'));
});

test('without --host it still copies, and says the reload is unconfirmed', async () => {
  const root = tempDir('dev-nohost-');
  const plugin = path.join(root, 'plugin');
  const dest = path.join(root, 'installed');
  fs.mkdirSync(plugin, { recursive: true });
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(path.join(plugin, 'package.json'), JSON.stringify({ name: 'demo-plugin', version: '1.0.0' }));
  fs.writeFileSync(path.join(plugin, 'client.js'), '// v1');
  fs.writeFileSync(path.join(dest, 'client.js'), '// v0');
  const lines = [];
  const io = { log: (line) => lines.push(line), error: (line) => lines.push(line) };
  const code = await dev({ dir: plugin, dest, once: true, io });
  assert.equal(code, 0);
  assert.equal(fs.readFileSync(path.join(dest, 'client.js'), 'utf8'), '// v1');
  assert.ok(lines.some((line) => /pass --host/.test(line)), lines.join('\n'));
});

test('a plugin the running app never loaded is reported as that, not as a timeout', async () => {
  const fetchImpl = async () => sseResponse([
    { type: 'graph', graph: { entries: [{ id: 'someone-else' }] } },
  ]);
  const result = await verifyReload({ host: 'http://127.0.0.1:9', id: 'demo-plugin', timeoutMs: 50, fetchImpl });
  assert.equal(result.ok, false);
  assert.match(result.reason, /the running app has not loaded demo-plugin/);
  assert.match(result.reason, /restart the app once/);
});

test('a plugin that is loaded but silent still reads as a timeout', async () => {
  const encoder = new TextEncoder();
  // A stream that never closes: the wait ends by timeout, not by the app.
  const fetchImpl = async (url, { signal } = {}) => ({
    ok: true,
    status: 200,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'graph', graph: { entries: [{ id: 'demo-plugin' }] } })}\n\n`));
        // The real stream dies when the controller aborts; a fake one has to say so.
        signal?.addEventListener('abort', () => controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      },
    }),
  });
  const result = await verifyReload({ host: 'http://127.0.0.1:9', id: 'demo-plugin', timeoutMs: 50, fetchImpl });
  assert.equal(result.ok, false);
  assert.match(result.reason, /no rebuilt frame for demo-plugin/);
});
