/**
 * The checks a plugin has to pass before a release is worth starting.
 *
 * Every check answers a question that has actually gone wrong somewhere:
 * a tag that did not match package.json, a market entry missing `engines`, a
 * README that promised a host version the manifest did not require. Each one
 * returns either null (fine) or a line a human can act on.
 */
import fs from 'node:fs';
import path from 'node:path';

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const RANGE = /^\s*[><=^~*]|\s*\|\||\s*-\s/;

export function readManifest(dir) {
  const manifestPath = path.join(dir, 'package.json');
  if (fs.existsSync(manifestPath) === false) {
    throw new Error(`no package.json in ${dir}`);
  }
  return { manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8')), manifestPath };
}

export function version(manifest) {
  return typeof manifest.version === 'string' ? manifest.version : null;
}

/** The host range a version declares is the one the market index must repeat. */
export function hostRange(manifest) {
  const engines = manifest.engines;
  if (engines === undefined || engines === null) return null;
  const dsh = engines.dsh;
  return typeof dsh === 'string' && dsh.trim() !== '' ? dsh.trim() : null;
}

export function checkVersion(manifest) {
  const value = version(manifest);
  if (value === null) return 'package.json has no version';
  if (SEMVER.test(value) === false) return `version "${value}" is not semver`;
  return null;
}

export function checkDshField(manifest) {
  if (manifest.dsh === undefined || manifest.dsh === null) {
    return 'package.json has no "dsh" field, so the host will not load it as a plugin';
  }
  const bundle = manifest.dsh.bundle;
  if (bundle === undefined || bundle === null) {
    return 'dsh.bundle is missing; the host needs the patch file it points at';
  }
  if (typeof bundle.patch === 'string' && bundle.patch !== '') {
    return { patch: bundle.patch };
  }
  return 'dsh.bundle.patch is missing';
}

export function checkHostRange(manifest) {
  const range = hostRange(manifest);
  if (range === null) return 'engines.dsh is missing, so the market index cannot state the host requirement';
  if (RANGE.test(range) === false) return `engines.dsh "${range}" is not a semver range`;
  return null;
}

export function checkReadme(dir) {
  const readmePath = path.join(dir, 'README.md');
  if (fs.existsSync(readmePath) === false) return 'README.md is missing';
  const text = fs.readFileSync(readmePath, 'utf8');
  if (/^#{1,3}\s*Requirements/im.test(text) === false) {
    return 'README.md has no Requirements section, so users cannot tell which host it needs';
  }
  const range = hostRange(JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')));
  // ">= 0.2.0" and ">=0.2.0" are the same range; authors write both.
  const squeeze = (value) => value.replace(/\s+/g, '');
  if (range !== null && squeeze(text).includes(squeeze(range)) === false) {
    return `README.md does not mention the host range "${range}" it declares`;
  }
  return null;
}

export function checkPatchFile(dir, manifest) {
  const bundle = manifest.dsh?.bundle;
  if (bundle === undefined || typeof bundle.patch !== 'string') return null;
  const patchPath = path.join(dir, bundle.patch);
  if (fs.existsSync(patchPath) === true) return null;
  return `dsh.bundle.patch points at ${bundle.patch}, which does not exist`;
}

export function checkClientEntry(dir, manifest) {
  const client = manifest.dsh?.client;
  if (client === undefined || client === null) return null;
  const entries = ['client.js', 'lib/client.js', 'dist/client.js'];
  const found = entries.some((entry) => fs.existsSync(path.join(dir, entry)));
  return found ? null : `dsh.client is declared but none of ${entries.join(', ')} exists`;
}

/** Every path the manifest points at: exports, the bundle patch, the client entry. */
export function declaredPaths(manifest) {
  const paths = new Set();
  const add = (value) => {
    if (typeof value !== 'string') return;
    if (value.startsWith('./')) paths.add(value.slice(2));
    else if (value.startsWith('.')) paths.add(value.slice(1));
  };
  const walk = (value) => {
    if (typeof value === 'string') add(value);
    else if (value !== null && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(manifest.exports);
  walk(manifest.dsh?.bundle?.patch);
  walk(manifest.dsh?.client?.entry);
  walk(manifest.main);
  walk(manifest.types);
  return [...paths];
}

/** A `files` entry covers a path when it is equal, a parent folder, or a glob prefix. */
export function isShipped(target, files) {
  return files.some((entry) => {
    const clean = entry.replace(/^\//, '');
    if (clean.includes('*') === true) {
      const [head] = clean.split('*');
      return head === '' || target.startsWith(head);
    }
    if (clean.endsWith('/') === true) return target.startsWith(clean);
    return target === clean;
  });
}

export function checkFilesList(manifest) {
  const files = manifest.files;
  if (Array.isArray(files) === false) {
    return 'package.json has no "files" list, so the tarball ships whatever happens to be in the folder';
  }
  const declared = declaredPaths(manifest);
  const missing = declared.filter((entry) => isShipped(entry, files) === false);
  if (missing.length > 0) {
    return `files does not ship ${missing.join(', ')}, which package.json points at, so the installed plugin would be missing its own code`;
  }
  return null;
}

/** Runs every check and returns `{ failures, notes }`. */
export function doctor(dir) {
  const { manifest } = readManifest(dir);
  const checks = [
    ['version', checkVersion(manifest)],
    ['engines.dsh', checkHostRange(manifest)],
    ['readme', checkReadme(dir)],
    ['dsh field', checkDshField(manifest)],
    ['patch file', checkPatchFile(dir, manifest)],
    ['client entry', checkClientEntry(dir, manifest)],
    ['files list', checkFilesList(manifest)],
  ];
  const failures = checks.filter(([, result]) => result !== null && typeof result === 'string');
  return {
    manifest,
    failures: failures.map(([name, message]) => ({ check: name, message })),
    notes: { hostRange: hostRange(manifest), version: version(manifest) },
  };
}
