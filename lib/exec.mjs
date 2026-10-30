/**
 * Running `npm`, `git` or `gh` is not the same on Windows:
 *
 * - they are `.cmd` shims, so the bare name is `ENOENT`;
 * - and since Node 18.20/20.12 a `.cmd` cannot be spawned without a shell
 *   (`EINVAL`, the fix for CVE-2024-27980).
 *
 * So on Windows the command runs through the shell, with every argument quoted
 * for it. Nothing else differs, which is why this lives in one file.
 */
import { execFileSync } from 'node:child_process';

export function command(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

function quote(argument) {
  const text = String(argument);
  return /[\s"]/u.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

export function run(name, args, options = {}) {
  if (process.platform === 'win32') {
    return execFileSync(command(name), args.map(quote), { ...options, shell: true });
  }
  return execFileSync(name, args, options);
}
