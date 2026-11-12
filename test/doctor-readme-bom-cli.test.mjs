/**
 * The BOM acceptance cases, checked at the process boundary a user sees:
 * `doctor` exits `0` for three READMEs saved with a UTF-8 BOM and for three
 * plain controls, and exits `1` when either really has no `Requirements`
 * heading.
 *
 * The BOM set covers the exact reported shape (a `## Requirements` heading is
 * the first line after the marker), a different heading level, and a Windows
 * file where the BOM and CRLF arrive together. Each one would fail on 0.20.12,
 * because the marker sits between the start of the file and the heading. The
 * plain controls repeat those shapes without the marker, so a failure can only
 * be about the BOM and not about line endings or heading level. The unit tests
 * call `doctor()` directly; this one runs the real bin so a regression in
 * argument handling or output cannot hide behind them.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const CLI = path.join(ROOT, 'bin', 'dsh-plugin.mjs');
const fixture = (name) => path.join(here, 'fixtures', name);

const BOM_FIXTURES = ['readme-bom', 'readme-bom-h1', 'readme-bom-crlf'];
const PLAIN_FIXTURES = ['readme-plain', 'readme-plain-h1', 'readme-plain-crlf'];
const NO_HEADING_FIXTURES = ['readme-bom-no-heading', 'readme-no-heading'];

function runDoctor(name) {
  return spawnSync(process.execPath, [CLI, 'doctor', fixture(name)], { encoding: 'utf8' });
}

function readmeText(name) {
  return fs.readFileSync(path.join(fixture(name), 'README.md'), 'utf8');
}

function packageName(name) {
  return JSON.parse(fs.readFileSync(path.join(fixture(name), 'package.json'), 'utf8')).name;
}

/** Strip the marker without using the code under test. */
function withoutBom(text) {
  return text.startsWith('\uFEFF') ? text.slice(1) : text;
}

test('the fixtures are honest about their BOM, heading and line endings', () => {
  for (const name of [...BOM_FIXTURES, 'readme-bom-no-heading']) {
    const text = readmeText(name);
    assert.equal(text.codePointAt(0), 0xfeff, `${name}/README.md has no UTF-8 BOM`);
  }
  for (const name of [...PLAIN_FIXTURES, 'readme-no-heading']) {
    const text = readmeText(name);
    assert.notEqual(text.codePointAt(0), 0xfeff, `${name}/README.md must not start with a BOM`);
  }
  for (const name of [...BOM_FIXTURES, ...PLAIN_FIXTURES]) {
    assert.match(
      withoutBom(readmeText(name)),
      /^#{1,3}\s*Requirements/mu,
      `${name}/README.md must carry a Requirements heading`,
    );
  }
  for (const name of NO_HEADING_FIXTURES) {
    assert.doesNotMatch(
      withoutBom(readmeText(name)),
      /^#{1,3}\s*Requirements/mu,
      `${name}/README.md must not carry a Requirements heading`,
    );
  }
  for (const name of ['readme-bom-crlf', 'readme-plain-crlf']) {
    assert.match(readmeText(name), /\r\n/u, `${name}/README.md must keep CRLF line endings`);
  }
  for (const name of ['readme-bom', 'readme-bom-h1', 'readme-plain', 'readme-plain-h1']) {
    assert.doesNotMatch(readmeText(name), /\r/u, `${name}/README.md must use LF line endings`);
  }
});

/** Run one set of fixtures and require every one to print the same `ok` line. */
function acceptedTrials(fixtures) {
  let accepted = 0;
  for (const name of fixtures) {
    const result = runDoctor(name);
    assert.equal(result.status, 0, `${name}: expected exit 0\n${result.stdout}${result.stderr}`);
    const expected = `ok  ${packageName(name)}@1.2.3 (host >=0.2.0)`;
    assert.ok(
      result.stdout.split('\n').includes(expected),
      `${name}: expected the line ${JSON.stringify(expected)}\n${result.stdout}`,
    );
    assert.equal(result.stderr, '', `${name}: expected no stderr\n${result.stderr}`);
    accepted += 1;
  }
  return accepted;
}

test('doctor accepts 3/3 BOM READMEs through the shipped CLI', () => {
  const accepted = acceptedTrials(BOM_FIXTURES);
  assert.equal(accepted, 3, `accepted=${accepted}/3 BOM READMEs`);
});

test('doctor accepts 3/3 plain controls through the shipped CLI', () => {
  const accepted = acceptedTrials(PLAIN_FIXTURES);
  assert.equal(accepted, 3, `accepted=${accepted}/3 plain READMEs`);
});

/** A missing heading fails before the range check, with or without a BOM. */
function assertMissingHeading(name) {
  const result = runDoctor(name);
  assert.equal(result.status, 1, `${name}: expected exit 1\n${result.stdout}${result.stderr}`);
  assert.equal(result.stdout, '', `${name}: expected no stdout\n${result.stdout}`);
  assert.match(
    result.stderr,
    new RegExp(`dsh-plugin doctor: 1 problem\\(s\\) in .*${name}`, 'u'),
    `${name}: ${result.stderr}`,
  );
  assert.match(
    result.stderr,
    /✗ readme: README\.md has no Requirements section, so users cannot tell which host it needs/u,
    `${name}: ${result.stderr}`,
  );
}

test('doctor rejects the BOM README that really has no Requirements heading', () => {
  assertMissingHeading('readme-bom-no-heading');
});

test('doctor rejects a plain README with no Requirements heading too', () => {
  assertMissingHeading('readme-no-heading');
});
