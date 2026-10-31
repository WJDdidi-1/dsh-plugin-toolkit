/**
 * The host half: a panel is a promise that something checked your plugin, so
 * something has to do the checking on the side that can read files.
 *
 * Read-only by design. The panel passes a directory, this runs the same
 * `doctor` and pack-list checks the CLI runs, and answers with what failed and
 * the command that fixes it. Nothing here writes to the workspace.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { doctor } from './lib/doctor.mjs';
import { resolveTarget } from './lib/github.mjs';
import { verify } from './lib/verify.mjs';

export const name = 'dsh-plugin-toolkit';

const LIMIT = 400;

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(text));
  res.end(text);
}

function readDir(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const resolved = path.resolve(value.trim());
  if (resolved.length > LIMIT) return null;
  try {
    if (fs.statSync(resolved).isDirectory() === false) return null;
  } catch {
    return null;
  }
  return resolved;
}

/** Same-origin only: this route has no authentication of its own. */
function sameOrigin(req) {
  const origin = req.headers !== undefined ? req.headers.origin : undefined;
  if (typeof origin !== 'string' || origin.length === 0) return true;
  const host = req.headers.host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function checkPlugin(dir) {
  const target = readDir(dir);
  if (target === null) {
    return { ok: false, dir: null, checks: [{ check: 'dir', ok: false, message: 'that is not a directory' }] };
  }
  const checks = [];
  const report = doctor(target);
  if (report.failures.length === 0) {
    checks.push({ check: 'manifest', ok: true, message: `${report.manifest.name}@${report.manifest.version}` });
  }
  for (const failure of report.failures) {
    checks.push({ check: failure.check, ok: false, message: failure.message });
  }
  // The pack list is the check `doctor` cannot make: it reads the working copy,
  // so a `files` entry that forgets client.js passes it and ships a plugin with
  // no panel.
  const packed = await verify({ dir: target, mount: false });
  const known = new Set(checks.map((entry) => entry.check));
  if (packed.ok === true) {
    checks.push({ check: 'tarball', ok: true, message: `${packed.files.length} file(s)` });
  } else {
    for (const failure of packed.failures ?? []) {
      // `verify` re-runs doctor first; do not say the same thing twice.
      if (known.has(failure.check) === true) continue;
      checks.push({ check: failure.check ?? packed.stage, ok: false, message: failure.message });
    }
  }
  return { ok: checks.every((entry) => entry.ok === true), dir: target, checks };
}

/**
 * The client half cannot see the host console, and a panel that fails to
 * activate shows up as one red dot — no message, nowhere to look. This route is
 * the plugin's own crash reporter: the bundle posts what happened, the host
 * appends it to `~/.dsh/toolkit-client-report.ndjson`.
 */
function appendReport(entry) {
  try {
    const file = path.join(os.homedir(), '.dsh', 'toolkit-client-report.ndjson');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(entry)}\n`);
  } catch {
    // A report that fails to write must not become a second failure.
  }
}

function clip(value, limit) {
  if (typeof value !== 'string') return null;
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8192) return null;
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

export function apply(ctx, options = {}) {
  const reportHandler = async (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method-not-allowed' });
    const body = await readBody(req);
    if (body === null || typeof body !== 'object') return sendJson(res, 400, { error: 'bad-report' });
    appendReport({
      at: new Date().toISOString(),
      stage: clip(body.stage, 60),
      message: clip(body.message, 500),
      services: Array.isArray(body.services) ? body.services.slice(0, 20).map((name) => clip(String(name), 60)) : [],
    });
    return sendJson(res, 200, { ok: true });
  };

  const checkHandler = async (req, res) => {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method-not-allowed' });
    if (sameOrigin(req) === false) return sendJson(res, 403, { error: 'cross-origin' });
    const url = new URL(req.url, 'http://localhost');
    const input = url.searchParams.get('dir');
    try {
      // A folder path, `owner/repo`, a GitHub URL, or a bare name to search for.
      const target = await resolveTarget(input, options.github);
      if (target.kind === 'empty') {
        return sendJson(res, 200, { ok: false, kind: 'empty', checks: [{ check: 'dir', ok: false, message: 'nothing to check' }] });
      }
      if (target.kind === 'candidates') {
        return sendJson(res, 200, { ok: false, kind: 'candidates', query: target.query, candidates: target.candidates });
      }
      const report = await checkPlugin(target.dir);
      const answer = { ...report, kind: target.kind };
      if (target.repo !== undefined) answer.repo = target.repo;
      return sendJson(res, 200, answer);
    } catch (error) {
      const message = String(error && error.message);
      // A repository that cannot be fetched is a check result, not a server
      // fault: the panel has to be able to say which one and why.
      if (/github|answered \d{3}|rate limit/i.test(message) === true) {
        return sendJson(res, 200, {
          ok: false,
          kind: 'github',
          checks: [{ check: 'github', ok: false, message }],
        });
      }
      return sendJson(res, 500, { error: 'check-failed', message });
    }
  };

  let installed = false;
  const installRoutes = (serviceCtx) => {
    if (installed) return;
    // Reading `ctx.webServer` on a context that does not declare `inject` does
    // not yield undefined: cordis throws "cannot get property ... without
    // inject". An unguarded read here fails the whole apply, which is exactly
    // the red dot with no message this panel exists to explain.
    try {
      const server = serviceCtx !== null && serviceCtx !== undefined ? serviceCtx.webServer : undefined;
      if (server === null || server === undefined || typeof server.register !== 'function') return;
      server.register({ kind: 'exact', path: '/toolkit/check', handler: checkHandler });
      server.register({ kind: 'exact', path: '/toolkit/report', handler: reportHandler });
      installed = true;
    } catch {
      // No web server on this context: the guard still runs, the panel does not.
    }
  };

  const defer = (deps, callback) => {
    try {
      if (typeof ctx.inject === 'function') ctx.inject(deps, callback);
    } catch {
      // The service may already be mounted on this context.
    }
  };
  defer(['webServer'], (serviceCtx) => installRoutes(serviceCtx));
  installRoutes(ctx);
}
