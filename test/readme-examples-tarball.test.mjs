/**
 * The README tells a reader to run four `node examples/*.mjs` commands. Those
 * files existed in the checkout but `files` only shipped the compatibility
 * sample, so a fresh install contained none of them.
 *
 * The tarball is the unit here: the commands are read from the READMEs npm
 * actually ships, then the packed tarball is installed into a temp prefix. The
 * installed copies must be byte-identical to the repository files, so a future
 * `files` edit that drops one fails here and names the path before publication.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { run } from '../lib/exec.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Both READMEs are in the published file list. A command documented only in the
// Chinese README is still a command an installed reader can try to run.
const SHIPPED_READMES = ['README.md', 'README.zh.md'];
const EXAMPLE_COMMAND = /\bnode\s+(examples\/[A-Za-z0-9._/-]+\.mjs)\b/gu;
const REQUIRED = [
  'examples/aria.mjs',
  'examples/baseline.mjs',
  'examples/mount-a-bundle.mjs',
  'examples/route-stubs.mjs',
];

/** Every distinct `examples/<name>.mjs` the READMEs tell a reader to pass to node. */
function documentedExamples() {
  const found = new Map();
  for (const readme of SHIPPED_READMES) {
    const file = path.join(ROOT, readme);
    if (fs.existsSync(file) === false) continue;
    // A Windows checkout writes README.md with CRLF; the command is text, so
    // normalize before matching the line a reader copies.
    const text = fs.readFileSync(file, 'utf8').replace(/\r\n/gu, '\n');
    for (const match of text.matchAll(EXAMPLE_COMMAND)) {
      if (found.has(match[1]) === false) found.set(match[1], readme);
    }
  }
  return found;
}

test('a fresh install contains the four examples the shipped README cites', () => {
  const documented = documentedExamples();
  const cited = [...documented.keys()].sort();
  assert.deepEqual(
    cited,
    REQUIRED,
    `the READMEs cite ${cited.join(', ') || 'no examples'}; the acceptance case is exactly the four examples`,
  );

  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  for (const example of REQUIRED) {
    assert.ok(
      manifest.files.includes(example),
      `package.json files omits ${example} (named in ${documented.get(example)}), so npm pack will leave it out`,
    );
  }

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-examples-tarball-'));
  try {
    const [document] = JSON.parse(run('npm', ['pack', '--pack-destination', scratch, '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }));
    const shipped = new Set(document.files.map((entry) => entry.path));
    const missing = REQUIRED.filter((example) => shipped.has(example) === false);
    assert.deepEqual(
      missing,
      [],
      `the tarball omits README-cited example(s):\n${missing
        .map((example) => `  ${example} (named in ${documented.get(example)})`)
        .join('\n')}\nAdd each path to package.json's "files" list, or stop documenting it as an installed command.`,
    );

    const prefix = path.join(scratch, 'install');
    // The examples need optional peers (react, jsdom) to run, but the acceptance
    // case is the installed file list. `--omit=peer` keeps the guard offline.
    run('npm', ['install', path.join(scratch, document.filename), '--prefix', prefix, '--no-save', '--ignore-scripts', '--no-audit', '--no-fund', '--omit=peer'], {
      cwd: scratch,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const installedRoot = path.join(prefix, 'node_modules', 'dsh-plugin-toolkit');
    for (const example of REQUIRED) {
      const installed = path.join(installedRoot, example);
      assert.ok(fs.existsSync(installed), `the installed package has no ${example}`);
      const repository = fs.readFileSync(path.join(ROOT, example));
      const copy = fs.readFileSync(installed);
      assert.ok(
        repository.equals(copy),
        `the installed ${example} differs from the repository copy (${copy.length} vs ${repository.length} bytes)`,
      );
    }
    assert.deepEqual(
      fs.readdirSync(path.join(installedRoot, 'examples')).filter((name) => name.endsWith('.mjs')).sort(),
      REQUIRED.map((example) => path.basename(example)).sort(),
      'the installed examples directory has a different set of .mjs files than the README cites',
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});
