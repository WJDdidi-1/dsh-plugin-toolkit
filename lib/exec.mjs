/**
 * `npm`, `git` and `gh` are `.cmd` shims on Windows: `execFileSync('npm', …)`
 * fails there with `spawnSync npm ENOENT`. Nothing else about them differs, so
 * the fix is one place rather than a `shell: true` on every call.
 */
export function command(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}
