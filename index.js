/**
 * The host half: a panel is a promise that something checked your plugin, so
 * something has to do the checking on the side that can read files.
 *
 * Read-only by design. The panel passes a directory, this runs the same
 * `doctor` and pack-list checks the CLI runs, and answers with what failed and
 * the command that fixes it. Nothing here writes to the workspace.
 */
import fs from 'node:fs';
import path from 'node:path';

import { doctor } from './lib/doctor.mjs';
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

export function apply(ctx) {
  const checkHandler = async (req, res) => {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method-not-allowed' });
    if (sameOrigin(req) === false) return sendJson(res, 403, { error: 'cross-origin' });
    const url = new URL(req.url, 'http://localhost');
    try {
      return sendJson(res, 200, await checkPlugin(url.searchParams.get('dir')));
    } catch (error) {
      return sendJson(res, 500, { error: 'check-failed', message: String(error && error.message) });
    }
  };

  let installed = false;
  const installRoutes = (serviceCtx) => {
    if (installed) return;
    const server = serviceCtx !== null && serviceCtx !== undefined ? serviceCtx.webServer : undefined;
    if (server === null || server === undefined || typeof server.register !== 'function') return;
    server.register({ kind: 'exact', path: '/toolkit/check', handler: checkHandler });
    installed = true;
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
