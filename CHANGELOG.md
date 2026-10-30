# Changelog

## 0.1.0

First cut: `doctor`, `index`, `release`.

- `doctor` checks the manifest, the README's stated host range, the bundle patch, the client entry, and whether `files` ships everything `package.json` points at.
- `index` audits `market/index.json` and names every version that cannot state a host range.
- `release` runs preflight → tag → registry wait → index entry, prints every GitHub step, and refuses to run on a dirty tree or an existing tag.
- Registry checks read the registry's own document (and `time`), because `npm view` answers from a cache.
