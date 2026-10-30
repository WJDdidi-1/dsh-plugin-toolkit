/**
 * Only the npm family needs care on Windows:
 *
 * - `npm`, `npx`, `yarn` and `pnpm` are `.cmd` shims, so the bare name is
 *   `ENOENT`;
 * - and since Node 18.20/20.12 a `.cmd` cannot be spawned without a shell
 *   (`EINVAL`, the fix for CVE-2024-27980).
 *
 * `git` and `gh` are real executables (`git.exe`, `gh.exe`) and must *not* get
 * a `.cmd` suffix — `git.cmd` does not exist.
 */
import { execFileSync } from 'node:child_process';

const SHIMS = new Set(['npm', 'npx', 'yarn', 'pnpm']);

export function command(name) {
  return process.platform === 'win32' && SHIMS.has(name) ? `${name}.cmd` : name;
}

function quote(argument) {
  const text = String(argument);
  return /[\s"]/u.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

export function run(name, args, options = {}) {
  if (process.platform === 'win32' && SHIMS.has(name)) {
    return execFileSync(command(name), args.map(quote), { ...options, shell: true });
  }
  return execFileSync(name, args, options);
}
