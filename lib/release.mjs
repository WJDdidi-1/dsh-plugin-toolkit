/**
 * The release sequence, as a function instead of a checklist in my head.
 *
 * Order matters: verify the manifest first (cheap), then tag, then wait for the
 * registry, then touch the index — the index entry carries the publish time the
 * registry reported, so writing it earlier would mean guessing.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { doctor } from './doctor.mjs';
import { addVersion, buildEntry, readIndex, writeIndex } from './index-file.mjs';
import { publishedAt, waitForVersion } from './registry.mjs';

function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
}

export function tagName(version, prefix = 'plugin-v') {
  return `${prefix}${version}`;
}

export function tagExists(dir, tag) {
  try {
    git(dir, ['rev-parse', `refs/tags/${tag}`]);
    return true;
  } catch {
    return false;
  }
}

export function workingTreeIsClean(dir) {
  return git(dir, ['status', '--porcelain']) === '';
}

/**
 * Steps a human must do, and steps the tool can do. Returning this list before
 * anything runs is what makes `--dry-run` useful: it shows the whole sequence
 * and the exact commands.
 */
export function plan({ dir = process.cwd(), version, name, tagPrefix = 'plugin-v', indexFile = 'market/index.json' }) {
  const report = doctor(dir);
  const resolvedName = name ?? report.manifest.name ?? 'this-plugin';
  const resolvedVersion = version ?? report.manifest.version ?? '0.0.0';
  const tag = tagName(resolvedVersion, tagPrefix);
  const steps = [
    { title: 'Read the manifest and check it can be loaded', command: 'dsh-plugin doctor', runs: true },
    { title: `Create the tag ${tag}`, command: `git tag ${tag}`, runs: true },
    { title: 'Push the tag, which starts the release workflow', command: `git push origin ${tag}`, runs: true },
    { title: `Wait until the registry serves ${resolvedName}@${resolvedVersion}`, command: `GET /${resolvedName}`, runs: true },
    { title: 'Write the version into the market index, with the publish time the registry reported', command: `patch ${indexFile}`, runs: true },
    { title: 'Open the index pull request', command: 'gh pr create', runs: false },
    { title: 'Re-read the live index and confirm the version is listed', command: 'GET market/index.json', runs: false },
  ];
  return { tag, name: resolvedName, version: resolvedVersion, indexFile, steps };
}

export async function release(options) {
  const {
    dir = process.cwd(),
    registry,
    tagPrefix = 'plugin-v',
    indexFile = 'market/index.json',
    budgetMs,
    intervalMs,
    sleep,
    now,
    onChange,
  } = options;

  const report = doctor(dir);
  if (report.failures.length > 0) {
    return { ok: false, stage: 'preflight', failures: report.failures };
  }

  const name = report.manifest.name;
  const version = report.manifest.version;
  const tag = tagName(version, tagPrefix);

  if (tagExists(dir, tag) === true) {
    return { ok: false, stage: 'tag', failures: [{ check: 'tag', message: `${tag} already exists` }] };
  }
  if (workingTreeIsClean(dir) === false) {
    return {
      ok: false,
      stage: 'git',
      failures: [{ check: 'git', message: 'the working tree has uncommitted changes' }],
    };
  }

  git(dir, ['tag', tag]);
  git(dir, ['push', 'origin', tag]);

  const waited = await waitForVersion(name, version, {
    registry,
    budgetMs,
    intervalMs,
    sleep,
    now,
    onWait: options.onWait,
  });
  if (waited.timedOut === true) {
    return {
      ok: false,
      stage: 'registry',
      failures: [
        {
          check: 'registry',
          message: `${name}@${version} is not on the registry after ${Math.round(waited.waitedMs / 1000)}s (tag ${tag} is pushed; re-run when npm catches up)`,
        },
      ],
    };
  }

  const timestamp = publishedAt(waited.document, version);
  const entry = buildEntry({ version, publishTimestamp: timestamp, hostRange: report.notes.hostRange });
  const indexPath = path.join(dir, indexFile);
  let indexUpdate = null;
  if (fs.existsSync(indexPath) === true) {
    const before = readIndex(indexPath);
    const after = addVersion(before, name, entry);
    writeIndex(indexPath, after);
    indexUpdate = { file: indexFile, version, entry };
    if (typeof onChange === 'function') onChange(indexUpdate);
  }

  return {
    ok: true,
    stage: 'index',
    tag,
    version,
    attempts: waited.attempts,
    waitedMs: waited.waitedMs,
    indexUpdate,
  };
}
