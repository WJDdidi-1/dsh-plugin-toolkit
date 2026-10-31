/**
 * Every plugin installed in a profile, checked in one pass.
 *
 * `doctor` answers "is this plugin correct?" for one folder you name. The
 * question that actually gets asked is "why is my plugin not in the sidebar?",
 * and the answer depends on three things a single folder cannot tell you: what
 * is installed, whether each installed copy is valid, and which of them the
 * running app actually loaded.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { doctor } from './doctor.mjs';
import { readGraph } from './dev.mjs';

/** Every package folder inside every profile, scoped names included. */
export function listInstalled({ home = path.join(os.homedir(), '.dsh') } = {}) {
  const profiles = path.join(home, 'profiles');
  if (fs.existsSync(profiles) === false) return [];
  const found = [];
  for (const profile of fs.readdirSync(profiles).sort()) {
    const modules = path.join(profiles, profile, 'node_modules');
    if (fs.existsSync(modules) === false) continue;
    for (const entry of fs.readdirSync(modules).sort()) {
      if (entry.startsWith('.') === true) continue;
      const candidates = entry.startsWith('@')
        ? fs.readdirSync(path.join(modules, entry)).sort().map((name) => path.join(modules, entry, name))
        : [path.join(modules, entry)];
      for (const dir of candidates) {
        const manifestPath = path.join(dir, 'package.json');
        if (fs.existsSync(manifestPath) === false) continue;
        let manifest;
        try {
          manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        } catch {
          // A package.json that does not parse is still an installed plugin, and
          // "it does not parse" is exactly what the author needs to hear.
          manifest = { name: path.basename(dir) };
        }
        // Only packages that declare themselves as plugins. node_modules is full
        // of ordinary dependencies, and auditing those is noise.
        if (manifest.dsh === undefined) continue;
        found.push({ dir, manifest, profile });
      }
    }
  }
  return found;
}

function describe({ failures }) {
  if (failures.length === 0) return 'ok';
  return `${failures.length} problem${failures.length === 1 ? '' : 's'}: ${failures[0].check}`;
}

export async function audit({ home, host, io = console, fetchImpl, timeoutMs = 3000 } = {}) {
  const installed = listInstalled({ home });
  if (installed.length === 0) {
    io.log('no plugins installed in any profile (a plugin declares a "dsh" field)');
    return { ok: true, plugins: [], graph: null };
  }

  let graph = null;
  if (typeof host === 'string' && host.length > 0) {
    graph = await readGraph({ host, timeoutMs, fetchImpl });
    if (graph.ok !== true) io.log(`could not read the plugin graph: ${graph.reason}`);
  }

  const rows = installed.map(({ dir, manifest, profile }) => {
    let failures;
    try {
      ({ failures } = doctor(dir, { installed: true }));
    } catch (error) {
      failures = [{ check: 'manifest', message: error.message }];
    }
    const loaded = graph?.ok === true ? graph.ids.has(manifest.name) : null;
    return { name: manifest.name, version: manifest.version ?? '?', profile, dir, failures, loaded };
  });

  const width = Math.max(...rows.map((row) => row.name.length), 6);
  for (const row of rows) {
    const state = row.loaded === null ? '?' : row.loaded === true ? 'loaded' : 'not loaded';
    io.log(`${row.name.padEnd(width)}  ${String(row.version).padEnd(8)}  ${state.padEnd(10)}  ${describe(row)}`);
    for (const failure of row.failures) io.log(`${' '.repeat(width + 22)}${failure.check}: ${failure.message}`);
  }

  const failed = rows.filter((row) => row.failures.length > 0);
  const notLoaded = rows.filter((row) => row.loaded === false);
  if (notLoaded.length > 0) {
    io.log('');
    io.log(`${notLoaded.length} installed plugin(s) are not in the running app; restart the app once after installing.`);
  }
  if (failed.length > 0) {
    io.log('');
    io.log(`${failed.length} of ${rows.length} installed plugin(s) have problems.`);
  }
  return { ok: failed.length === 0, plugins: rows, graph };
}
