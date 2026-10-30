/**
 * The market index is a list of versions with a host range per version.
 * Adding an entry is small; getting it right is what broke a release before —
 * a version object without `engines` makes the entry uninstallable, and the
 * validator only tells you after you have already opened the PR.
 */
import fs from 'node:fs';

export function readIndex(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function findPlugin(index, name) {
  const plugins = Array.isArray(index.plugins) ? index.plugins : [];
  return plugins.find((entry) => entry.name === name) ?? null;
}

/** The version objects the validator understands, newest first. */
export function buildEntry({ version, publishTimestamp, hostRange }) {
  const entry = {
    version,
    publishTimestamp,
    source: { type: 'npm' },
  };
  if (hostRange !== null && hostRange !== undefined) {
    entry.engines = { dsh: hostRange };
  }
  return entry;
}

export function addVersion(index, name, entry) {
  const plugin = findPlugin(index, name);
  if (plugin === null) {
    throw new Error(`the index has no plugin called "${name}"`);
  }
  const versions = Array.isArray(plugin.versions) ? plugin.versions : [];
  if (versions.some((existing) => existing.version === entry.version)) {
    throw new Error(`${name}@${entry.version} is already in the index`);
  }
  return {
    ...index,
    plugins: index.plugins.map((candidate) => {
      if (candidate.name !== name) return candidate;
      return { ...candidate, versions: [entry, ...versions] };
    }),
  };
}

/** Every version must carry the host range, not just the newest one. */
export function auditVersions(index, name) {
  const plugin = findPlugin(index, name);
  if (plugin === null) return [{ problem: `no plugin called "${name}"` }];
  const versions = Array.isArray(plugin.versions) ? plugin.versions : [];
  return versions
    .filter((entry) => typeof entry.engines?.dsh !== 'string' || entry.engines.dsh.trim() === '')
    .map((entry) => ({ version: entry.version, problem: 'no engines.dsh' }));
}

export function writeIndex(file, index) {
  fs.writeFileSync(file, `${JSON.stringify(index, null, 2)}\n`);
}
