import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { doctor, hostRange } from '../lib/doctor.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => path.join(here, '..', 'fixtures', name);

test('a manifest the host can load passes every check', () => {
  const report = doctor(fixture('good'));
  assert.deepEqual(report.failures, []);
  assert.equal(report.notes.version, '1.2.3');
  assert.equal(report.notes.hostRange, '>=0.2.0');
});

test('a missing engines.dsh is reported, because the index cannot state a host range without it', () => {
  const report = doctor(fixture('no-engines'));
  assert.equal(report.failures.length, 1);
  assert.equal(report.failures[0].check, 'engines.dsh');
  assert.match(report.failures[0].message, /market index/);
});

test('engines.dsh must be a range, not a pin or a sentence', () => {
  assert.equal(hostRange({ engines: { dsh: '>=0.2.0' } }), '>=0.2.0');
  assert.equal(hostRange({ engines: {} }), null);
  assert.equal(hostRange({}), null);
});

test('a README that never mentions the declared range is reported', () => {
  const dir = fixture('readme-mismatch');
  const report = doctor(dir);
  const checks = report.failures.map((failure) => failure.check);
  assert.ok(checks.includes('readme'), checks.join(','));
});
