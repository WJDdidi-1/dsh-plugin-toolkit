/**
 * `audit --remote` may skip the tree checks only when npm itself will produce
 * the missing files. An arbitrary `build` script is not a lifecycle hook: npm
 * pack never runs it, so a repository whose only script is `scripts.build`
 * ships exactly what is committed.
 *
 * This test crosses both process boundaries. It asks npm what each fixture's
 * tarball contains, then runs the shipped CLI against a fake GitHub tree with
 * the same committed files. The three build-only fixtures must exit 1 and name
 * the missing `client.js`; the `prepack` control must still exit 0 with the
 * built-not-committed note because its hook really does create the file.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { run } from '../lib/exec.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'bin', 'dsh-plugin.mjs');
const REPO = 'demo/plugin';
const README = '# demo\n\n## Requirements\n\nRequires dsh >=0.2.0.\n';
const PATCH = '- insert: []\n';
const INDEX = 'export function apply() {}\n';
const CREATE_CLIENT = `node -e "require('node:fs').writeFileSync('client.js','built by prepack')"`;

function manifest({ scripts, clientPath }) {
  return {
    name: 'demo-plugin',
    version: '1.2.3',
    main: 'index.js',
    engines: { dsh: '>=0.2.0' },
    scripts,
    dsh: { bundle: { patch: 'cordis.patch.yml' }, client: { platform: 'web' } },
    exports: { '.': './index.js', './client': clientPath },
    files: ['index.js', clientPath.replace(/^\.\//u, ''), 'cordis.patch.yml', 'README.md'],
  };
}

/** A committed tree with no client file: the fixture npm pack and the fake GitHub both see. */
function createFixture(t, options) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-remote-build-hook-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const raw = `${JSON.stringify(manifest(options), null, 2)}\n`;
  const files = {
    'package.json': raw,
    'README.md': README,
    'cordis.patch.yml': PATCH,
    'index.js': INDEX,
  };
  for (const [name, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), contents);
  }
  return { dir, files };
}

/** What npm will actually put in the tarball, not what the manifest promises. */
function packedFiles(t, dir) {
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-remote-build-hook-npm-'));
  t.after(() => fs.rmSync(cache, { recursive: true, force: true }));
  const logs = path.join(cache, '_logs');
  fs.mkdirSync(logs, { recursive: true });
  const output = run('npm', ['pack', '--dry-run', '--json'], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, npm_config_cache: cache, npm_config_logs_dir: logs },
  });
  const [document] = JSON.parse(output);
  return document.files.map((entry) => entry.path).sort();
}

/** A `--require` shim that serves the fixture's committed files as GitHub would. */
function preload(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-remote-build-hook-fetch-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'github-fetch.cjs');
  fs.writeFileSync(
    file,
    `const files = JSON.parse(Buffer.from(process.env.DSH_AUDIT_REMOTE_FILES ?? '', 'base64').toString('utf8'));
const prefix = '/repos/${REPO}/contents/';
globalThis.fetch = async (url) => {
  const pathname = new URL(String(url)).pathname;
  if (pathname.startsWith(prefix) === false) {
    return { ok: false, status: 404, json: async () => ({ message: 'Not Found' }) };
  }
  const name = decodeURIComponent(pathname.slice(prefix.length));
  if (Object.prototype.hasOwnProperty.call(files, name) === false) {
    return { ok: false, status: 404, json: async () => ({ message: 'Not Found' }) };
  }
  return {
    ok: true,
    status: 200,
    json: async () => ({ encoding: 'base64', content: Buffer.from(files[name], 'utf8').toString('base64') }),
  };
};
`,
  );
  return file;
}

function audit(t, files) {
  return spawnSync(process.execPath, ['--require', preload(t), CLI, 'audit', '--remote', REPO], {
    encoding: 'utf8',
    env: {
      ...process.env,
      DSH_AUDIT_REMOTE_FILES: Buffer.from(JSON.stringify(files), 'utf8').toString('base64'),
    },
  });
}

test('three build-only fixtures exit 1 and the report names the missing client.js', (t) => {
  for (const clientPath of ['./client.js', './lib/client.js', './dist/client.js']) {
    const fixture = createFixture(t, { scripts: { build: 'node build.mjs' }, clientPath });

    // npm pack runs no `build` script, so the tarball is the committed tree:
    // there is no client bundle to serve and the audit must not call it clean.
    assert.deepEqual(
      packedFiles(t, fixture.dir),
      ['README.md', 'cordis.patch.yml', 'index.js', 'package.json'],
      `npm pack shipped a client for ${clientPath} without a lifecycle hook`,
    );

    const result = audit(t, fixture.files);
    assert.equal(result.status, 1, `${clientPath}: ${result.stderr}`);
    assert.ok(
      result.stdout.includes(
        `client declaration: exports["./client"] points at ${clientPath}, which is not in the repository`,
      ),
      `${clientPath}: the report did not name the missing client:\n${result.stdout}${result.stderr}`,
    );
    assert.doesNotMatch(result.stdout, /built rather than committed/u);
  }
});

test('a prepack fixture that creates client.js exits 0 with the built-not-committed note', (t) => {
  const fixture = createFixture(t, { scripts: { prepack: CREATE_CLIENT }, clientPath: './client.js' });

  // The hook really creates the file before the tarball is listed; the file is
  // not in the committed tree the fake GitHub serves, so only the lifecycle
  // evidence can keep the audit from reporting it missing.
  assert.ok(
    packedFiles(t, fixture.dir).includes('client.js'),
    'the prepack fixture did not put client.js in the tarball',
  );
  assert.equal(fs.existsSync(path.join(fixture.dir, 'client.js')), true, 'prepack did not create client.js');

  const result = audit(t, fixture.files);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /note: package\.json runs "prepack" before it publishes/u);
  assert.match(result.stdout, /built rather than committed/u);
  assert.doesNotMatch(result.stdout, /client declaration/u);
});

test('a blank lifecycle hook is not build evidence either', (t) => {
  const fixture = createFixture(t, { scripts: { prepack: '   ' }, clientPath: './client.js' });

  const result = audit(t, fixture.files);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /client declaration: exports\["\.\/client"\] points at \.\/client\.js/u);
  assert.doesNotMatch(result.stdout, /built rather than committed/u);
});
