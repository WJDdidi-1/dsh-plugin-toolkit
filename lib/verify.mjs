/**
 * `doctor` reads the repository. Users install the tarball.
 *
 * `verify` closes that gap: pack it, install the tarball into a throwaway
 * directory, then mount the bundle *from the installed copy*. The failures this
 * catches — a `files` list that omits the entry, a patch file that is not
 * shipped, a bundle that only works next to its source — all pass `doctor`.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { doctor, declaredPaths } from './doctor.mjs';
import { resolveEntry } from './dev.mjs';
import { run } from './exec.mjs';

function packJson(dir) {
  const output = run('npm', ['pack', '--json', '--dry-run'], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const [document] = JSON.parse(output);
  return { files: (document.files ?? []).map((entry) => entry.path), filename: document.filename, size: document.size };
}

function packTarball(dir, destination) {
  const output = run('npm', ['pack', '--pack-destination', destination, '--json'], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const [document] = JSON.parse(output);
  return path.join(destination, document.filename);
}

export async function verify({ dir, mount = true }) {
  const failures = [];
  const report = doctor(dir);
  for (const failure of report.failures) failures.push(failure);
  if (failures.length > 0) return { ok: false, stage: 'doctor', failures, files: [] };

  let packed;
  try {
    packed = packJson(dir);
  } catch (error) {
    return {
      ok: false,
      stage: 'pack',
      failures: [{ check: 'pack', message: `npm pack failed: ${String(error.stderr ?? error.message).trim().split('\n').slice(-1)[0]}` }],
      files: [],
    };
  }

  // Everything package.json points at has to be inside the tarball, or the
  // installed plugin is missing its own code.
  const shipped = new Set(packed.files);
  for (const target of declaredPaths(report.manifest)) {
    if (shipped.has(target) === false) {
      failures.push({
        check: 'pack',
        message: `the tarball does not contain ${target}, so the installed plugin would be missing it`,
      });
    }
  }
  // The client bundle is usually found by convention (`client.js`), so it is
  // not in `declaredPaths` — but it still has to be in the tarball.
  const repoEntry = resolveEntry(dir, report.manifest);
  if (repoEntry !== null) {
    const relative = path.relative(dir, repoEntry).split(path.sep).join('/');
    if (shipped.has(relative) === false) {
      failures.push({
        check: 'pack',
        message: `the tarball does not contain ${relative}, so the installed plugin has no panel`,
      });
    }
  }

  if (failures.length > 0) return { ok: false, stage: 'pack', failures, files: packed.files };

  if (mount === false) return { ok: true, stage: 'pack', failures: [], files: packed.files, size: packed.size };

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-plugin-verify-'));
  let installed;
  try {
    const tarball = packTarball(dir, scratch);
    run('npm', ['install', tarball, '--prefix', path.join(scratch, 'install'), '--no-save', '--ignore-scripts', '--no-audit', '--no-fund'], {
      cwd: scratch,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    installed = path.join(scratch, 'install', 'node_modules', report.manifest.name);
  } catch (error) {
    return {
      ok: false,
      stage: 'install',
      failures: [{ check: 'install', message: `installing the tarball failed: ${String(error.stderr ?? error.message).trim().split('\n').slice(-1)[0]}` }],
      files: packed.files,
    };
  }

  if (fs.existsSync(installed) === false) {
    return {
      ok: false,
      stage: 'install',
      failures: [{ check: 'install', message: `the tarball installed no package at ${report.manifest.name}` }],
      files: packed.files,
    };
  }

  // Same convention the host uses: dsh.client.entry, then client.js.
  const entryFile = resolveEntry(installed, report.manifest);
  if (entryFile !== null) {
    if (fs.existsSync(entryFile) === false) {
      return {
        ok: false,
        stage: 'install',
        failures: [{ check: 'install', message: `the installed copy has no ${path.basename(entryFile)}` }],
        files: packed.files,
      };
    }
    try {
      const { mountClient } = await import('./testkit/index.mjs');
      // Resolve jsdom/React from the plugin's own folder: `verify` may be
      // running out of npx's cache, whose dependencies are not the panel's.
      const panel = await mountClient({ file: entryFile, resolveFrom: dir });
      const text = panel.text();
      await panel.unmount();
      return { ok: true, stage: 'mount', failures: [], files: packed.files, size: packed.size, installed, text };
    } catch (error) {
      return {
        ok: false,
        stage: 'mount',
        failures: [{ check: 'mount', message: `the installed bundle does not mount: ${error.message}` }],
        files: packed.files,
        installed,
      };
    }
  }

  return { ok: true, stage: 'install', failures: [], files: packed.files, size: packed.size, installed };
}
