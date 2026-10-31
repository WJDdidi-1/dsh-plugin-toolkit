/**
 * Turning what someone typed into a folder to check.
 *
 * The panel's input used to take one thing — a path. It now takes three:
 * `owner/repo`, a GitHub URL, or a bare name to search for. This file pins the
 * parsing (a Windows path must not look like `owner/repo`) and the two network
 * steps, without touching the network.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { fetchRepo, parseTarget, resolveTarget, searchRepos } from '../lib/github.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('a folder path stays a folder path', () => {
  // Paths that exist wherever the suite runs: the repo root is not /tmp/kit in CI.
  for (const input of [ROOT, '.', path.join('fixtures', 'good'), '..']) {
    const parsed = parseTarget(input);
    assert.equal(parsed.kind, 'local', input);
    assert.equal(path.isAbsolute(parsed.dir), true, input);
  }
  // `~` is the home folder, not a repository name.
  assert.equal(parseTarget('~').kind, 'local');
});

test('owner/repo and GitHub URLs become a repository', () => {
  assert.deepEqual(parseTarget('WJDdidi-1/dsh-plugin-example'), { kind: 'repo', owner: 'WJDdidi-1', repo: 'dsh-plugin-example' });
  assert.deepEqual(parseTarget('https://github.com/WJDdidi-1/dsh-plugin-toolkit'), { kind: 'repo', owner: 'WJDdidi-1', repo: 'dsh-plugin-toolkit' });
  assert.deepEqual(parseTarget('https://github.com/WJDdidi-1/dsh-plugin-toolkit.git'), { kind: 'repo', owner: 'WJDdidi-1', repo: 'dsh-plugin-toolkit' });
  assert.deepEqual(parseTarget('github.com/WJDdidi-1/dsh-plugin-toolkit/tree/main'), { kind: 'repo', owner: 'WJDdidi-1', repo: 'dsh-plugin-toolkit' });
});

test('a bare name is a search, not a repository', () => {
  assert.deepEqual(parseTarget('dsh-plugin-toolkit'), { kind: 'search', query: 'dsh-plugin-toolkit' });
  assert.deepEqual(parseTarget('  dsh  '), { kind: 'search', query: 'dsh' });
  assert.deepEqual(parseTarget(''), { kind: 'empty' });
});

test('search returns what a person needs to pick one', async () => {
  const fetchImpl = async (url) => {
    assert.match(String(url), /api\.github\.com\/search\/repositories\?q=dsh-plugin/);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { full_name: 'WJDdidi-1/dsh-plugin-toolkit', description: 'Plugin tooling', stargazers_count: 3, html_url: 'https://github.com/WJDdidi-1/dsh-plugin-toolkit' },
          { full_name: 'a/b', description: null, stargazers_count: 0, html_url: 'https://github.com/a/b' },
        ],
      }),
    };
  };
  const found = await searchRepos('dsh-plugin', { fetchImpl });
  assert.equal(found.length, 2);
  assert.deepEqual(found[0], {
    fullName: 'WJDdidi-1/dsh-plugin-toolkit',
    description: 'Plugin tooling',
    stars: 3,
    url: 'https://github.com/WJDdidi-1/dsh-plugin-toolkit',
  });
  // A missing description is an empty string, never the word "null" in the UI.
  assert.equal(found[1].description, '');
});

test('a repository that does not exist says so in words', async () => {
  const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({}) });
  await assert.rejects(() => fetchRepo({ owner: 'nobody', repo: 'nothing' }, { fetchImpl }), /nobody\/nothing.*404/);
});

test('resolving a repository downloads it and returns the folder plus its name', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode('tarball').buffer });
  const extract = (file, into) => {
    // Stand in for tar: the point under test is what the caller does with it.
    fs.mkdirSync(into, { recursive: true });
    fs.writeFileSync(path.join(into, 'package.json'), '{"name":"x","version":"1.0.0"}');
    return into;
  };
  const target = await resolveTarget('WJDdidi-1/dsh-plugin-example', { fetchImpl, extract });
  assert.equal(target.kind, 'github');
  assert.equal(target.repo.fullName, 'WJDdidi-1/dsh-plugin-example');
  assert.equal(target.repo.url, 'https://github.com/WJDdidi-1/dsh-plugin-example');
  assert.equal(path.basename(target.dir), 'repo');
  assert.equal(fs.existsSync(path.join(target.dir, 'package.json')), true);
});

test('resolving a bare name answers with candidates instead of guessing', async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ items: [{ full_name: 'a/b', description: '', stargazers_count: 0, html_url: 'https://github.com/a/b' }] }),
  });
  const target = await resolveTarget('a', { fetchImpl });
  assert.equal(target.kind, 'candidates');
  assert.equal(target.query, 'a');
  assert.equal(target.candidates.length, 1);
});

test('an empty input is not a request', async () => {
  assert.deepEqual(await resolveTarget('   '), { kind: 'empty' });
});
