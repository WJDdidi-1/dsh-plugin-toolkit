/**
 * A root `.npmignore` is disabled when `package.json` has a `files` list, but a
 * `.npmignore` (or the `.gitignore` fallback) inside a subdirectory still
 * subtracts from it. `doctor` used to read only the manifest, so it called the
 * package clean while `npm pack` dropped the `lib/client.js` that
 * `exports["./client"]` names.
 *
 * Every fixture is handed to `npm pack --dry-run --json` and to `doctor`, so the
 * prediction is pinned to the packer rather than to a hand-written list. The
 * controls keep the fix from becoming "any subdirectory ignore file fails":
 * a rule for an unrelated file, an explicit file in `files`, and a negation
 * that puts the client back all have to stay clean.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { run as runCli } from '../lib/cli.mjs';
import { doctor } from '../lib/doctor.mjs';
import { run } from '../lib/exec.mjs';

// `npm pack` writes a cache; keep it under the temp directory so the test does
// not depend on the user's npm home being writable.
const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-doctor-npmignore-'));
process.env.npm_config_cache = cache;
process.env.npm_config_logs_dir = path.join(cache, '_logs');
fs.mkdirSync(process.env.npm_config_logs_dir, { recursive: true });
process.on('exit', () => {
  try {
    fs.rmSync(cache, { recursive: true, force: true });
  } catch {
    // A leftover temp cache is not a test failure.
  }
});

const DEFAULT_FILES = ['index.js', 'lib', 'cordis.patch.yml', 'README.md'];

/**
 * Build a plugin that passes every check except the files-list question under
 * test. `ignore.name` is written inside `lib/` and defaults to `.npmignore`;
 * `client` lets a fixture move the exported bundle into a nested folder.
 */
function writeFixture(root, name, { files = DEFAULT_FILES, ignore, ignoreDirectory = 'lib', client = 'lib/client.js' } = {}) {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });

  const manifest = {
    name,
    version: '1.0.0',
    description: `subdirectory npmignore fixture ${name}`,
    license: 'MIT',
    type: 'module',
    engines: { node: '>=18', dsh: '>=0.2.0' },
    main: 'index.js',
    files,
    exports: { '.': './index.js', './client': `./${client}` },
    dsh: {
      bundle: { patch: 'cordis.patch.yml' },
      client: { platform: 'web' },
    },
  };
  fs.writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'index.js'), 'export function apply() {}\n');
  fs.writeFileSync(path.join(dir, 'cordis.patch.yml'), '- insert: []\n');
  fs.writeFileSync(
    path.join(dir, 'README.md'),
    `# ${name}\n\n## Requirements\n\n- DeepSeek Harness \`>=0.2.0\`\n`,
  );

  fs.mkdirSync(path.join(dir, path.dirname(client)), { recursive: true });
  fs.writeFileSync(path.join(dir, client), 'export default 1;\n');
  // A second file proves the folder is still traversed and packed: a fixture
  // where the whole folder is empty would test something else.
  fs.writeFileSync(path.join(dir, path.dirname(client), 'other.js'), 'export default 2;\n');

  if (ignore !== undefined) {
    const ignoreRoot = path.join(dir, ignoreDirectory);
    fs.mkdirSync(ignoreRoot, { recursive: true });
    fs.writeFileSync(path.join(ignoreRoot, ignore.name), ignore.text);
  }
  return dir;
}

function packedFiles(dir) {
  const output = run('npm', ['pack', '--dry-run', '--json'], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const [document] = JSON.parse(output);
  return new Set((document.files ?? []).map((entry) => entry.path));
}

function recorder() {
  const lines = [];
  return {
    lines,
    log: (line) => lines.push(String(line)),
    error: (line) => lines.push(String(line)),
  };
}

function filesListFailures(dir) {
  return doctor(dir).failures.filter((failure) => failure.check === 'files list');
}

test('a lib/.npmignore that drops the exported client is reported by doctor', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-doctor-npmignore-case-'));
  try {
    const dir = writeFixture(root, 'nested-npmignore', {
      ignore: { name: '.npmignore', text: 'client.js\n' },
    });

    const shipped = packedFiles(dir);
    const files = [...shipped].sort().join('\n');
    assert.equal(shipped.has('lib/client.js'), false, `npm pack unexpectedly ships the client:\n${files}`);
    assert.ok(shipped.has('lib/other.js'), `npm pack no longer traverses lib/:\n${files}`);

    const failures = filesListFailures(dir);
    assert.equal(failures.length, 1, `doctor failures: ${JSON.stringify(doctor(dir).failures)}`);
    assert.match(failures[0].message, /files does not ship lib\/client\.js/u);

    const io = recorder();
    const code = await runCli(['doctor', dir], io);
    const output = io.lines.join('\n');
    assert.equal(code, 1, output);
    assert.match(output, /✗ files list: files does not ship lib\/client\.js/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a lib/.npmignore naming an unrelated file still exits 0 with no files-list failure', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-doctor-npmignore-control-'));
  try {
    const dir = writeFixture(root, 'unrelated-ignore', {
      ignore: { name: '.npmignore', text: 'other.js\n' },
    });

    const shipped = packedFiles(dir);
    assert.ok(shipped.has('lib/client.js'), `npm pack unexpectedly drops the client:\n${[...shipped].sort().join('\n')}`);

    assert.deepEqual(filesListFailures(dir), []);

    const io = recorder();
    const code = await runCli(['doctor', dir], io);
    assert.equal(code, 0, io.lines.join('\n'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a lib/.gitignore is the fallback when lib has no .npmignore', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-doctor-gitignore-'));
  try {
    const dir = writeFixture(root, 'nested-gitignore', {
      ignore: { name: '.gitignore', text: 'client.js\n' },
    });

    const shipped = packedFiles(dir);
    assert.equal(shipped.has('lib/client.js'), false, `npm pack unexpectedly ships the client:\n${[...shipped].sort().join('\n')}`);

    const failures = filesListFailures(dir);
    assert.equal(failures.length, 1, `doctor failures: ${JSON.stringify(doctor(dir).failures)}`);
    assert.match(failures[0].message, /files does not ship lib\/client\.js/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('an explicit files entry keeps the client over a lib/.npmignore, so doctor stays quiet', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-doctor-explicit-'));
  try {
    const dir = writeFixture(root, 'explicit-file-entry', {
      files: ['index.js', 'lib/client.js', 'cordis.patch.yml', 'README.md'],
      ignore: { name: '.npmignore', text: 'client.js\n' },
    });

    const shipped = packedFiles(dir);
    assert.ok(
      shipped.has('lib/client.js'),
      `npm pack now drops an explicitly listed file:\n${[...shipped].sort().join('\n')}`,
    );
    assert.deepEqual(filesListFailures(dir), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a negation in lib/.npmignore puts the client back, so doctor stays quiet', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-doctor-negation-'));
  try {
    const dir = writeFixture(root, 'nested-negation', {
      ignore: { name: '.npmignore', text: '*.js\n!client.js\n' },
    });

    const shipped = packedFiles(dir);
    assert.ok(
      shipped.has('lib/client.js'),
      `npm pack no longer honors a negation in a subdirectory ignore file:\n${[...shipped].sort().join('\n')}`,
    );
    assert.deepEqual(filesListFailures(dir), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a nested lib/nested/.npmignore is honored too', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-doctor-nested-'));
  try {
    const dir = writeFixture(root, 'deep-npmignore', {
      client: 'lib/nested/client.js',
      ignore: { name: '.npmignore', text: 'client.js\n' },
      ignoreDirectory: 'lib/nested',
    });

    const shipped = packedFiles(dir);
    assert.equal(shipped.has('lib/nested/client.js'), false, `npm pack unexpectedly ships the client:\n${[...shipped].sort().join('\n')}`);

    const failures = filesListFailures(dir);
    assert.equal(failures.length, 1, `doctor failures: ${JSON.stringify(doctor(dir).failures)}`);
    assert.match(failures[0].message, /files does not ship lib\/nested\/client\.js/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('an anchored lib/.npmignore rule applies to that folder, not to nested basenames', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-doctor-anchored-'));
  try {
    // `/client.js` is a direct child of lib, so it drops lib/client.js.
    const direct = writeFixture(root, 'anchored-direct', {
      ignore: { name: '.npmignore', text: '/client.js\n' },
    });
    assert.equal(packedFiles(direct).has('lib/client.js'), false);
    assert.match(filesListFailures(direct)[0]?.message ?? '', /files does not ship lib\/client\.js/u);

    // The same rule must not reach lib/nested/client.js, which npm still packs.
    const nested = writeFixture(root, 'anchored-nested', {
      client: 'lib/nested/client.js',
      ignore: { name: '.npmignore', text: '/client.js\n' },
    });
    assert.ok(
      packedFiles(nested).has('lib/nested/client.js'),
      'npm pack unexpectedly applies an anchored rule at a deeper level',
    );
    assert.deepEqual(filesListFailures(nested), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
