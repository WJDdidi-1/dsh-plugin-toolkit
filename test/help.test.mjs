/**
 * `--help` is the first thing a new user reads, so it has to answer "which
 * command do I run" and not only "what commands exist": every command gets one
 * example, and the README's three paths have to name the same commands.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { HELP } from '../lib/cli.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMMANDS = ['init', 'doctor', 'verify', 'mount', 'dev', 'release', 'index'];

test('every command is listed with an example that starts with the command name', () => {
  for (const command of COMMANDS) {
    assert.match(HELP, new RegExp(`dsh-plugin ${command}\\b`), `--help never mentions ${command}`);
    const example = new RegExp(`^      dsh-plugin ${command}\\b.*$`, 'm').exec(HELP);
    assert.ok(example !== null, `${command} has no example line`);
    assert.doesNotMatch(example[0], /<dir>|<client\.js>|<pkg>/, `${command}'s example still contains a placeholder`);
  }
});

test('the README three paths name every command they promise', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const paths = readme.slice(readme.indexOf('## Three paths'), readme.indexOf('## Why this exists'));
  for (const command of COMMANDS) {
    if (command === 'index') continue; // the index audit is a release-time detail
    assert.match(paths, new RegExp(`dsh-plugin-toolkit@[\\d.]+ ${command}\\b`), `the three paths never show ${command}`);
  }
});

test('the README does not describe a feature as unbuilt when it is shipped', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  assert.doesNotMatch(readme, /Roadmap/, 'a roadmap that has been delivered reads as if it has not');
  assert.match(readme, /## What is not here yet/, 'the honest list is the replacement');
});

test('the README has a section for the panel that does not appear', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  assert.match(readme, /## When the panel does not appear/);
  // Every step of that section is a failure that actually happened.
  for (const hint of ['restart', 'typeof m.apply', 'verify .', 'cordis.patch.yml', 'throw']) {
    assert.ok(readme.includes(hint), `the troubleshooting section does not mention ${hint}`);
  }
});
