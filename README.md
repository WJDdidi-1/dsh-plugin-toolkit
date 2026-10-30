# dsh-plugin-toolkit

A preflight and release tool for [DeepSeek Harness](https://github.com/deepseek-ai/dsh) plugins, plus the pieces of the publishing ritual that kept going wrong by hand.

```
npx dsh-plugin doctor .          # can this plugin be loaded and installed?
npx dsh-plugin index             # does every market-index version state a host range?
npx dsh-plugin release --dry-run # what would shipping this version do?
```

## Requirements

- Node.js 18 or newer (`node --fetch` is used to read the registry; no dependencies)
- Git and `gh` on `PATH` for the steps that touch GitHub
- DeepSeek Harness `>=0.2.0` — the version whose market index carries `engines.dsh`, which is what makes the range check meaningful

## Why this exists

Releasing one plugin fifteen times taught me three things the ecosystem's tooling does not cover:

1. **A version is not shipped when npm accepts it.** Registry propagation took two to eight minutes every time. `npm view` answered from a stale local cache, so I repeatedly believed a release had failed when it had not — and once believed it had succeeded when the market still could not see it.
2. **The market index is a second release, done by hand.** Each version needs an entry carrying `publishTimestamp` from the registry and `engines.dsh` from the manifest. Forget the range and the index validator rejects the PR with `Engines mismatch` — after the tag is already public.
3. **Reading a manifest is not the same as checking it.** A plugin can have a valid `package.json` and still be uninstallable: `files` that omit the entry the manifest points at, a bundle patch that does not exist, a README that never states the host range it declares.

## What `doctor` checks

| Check | Why it matters |
| --- | --- |
| `version` | The tag is built from it; a malformed version produces a tag nobody can install |
| `engines.dsh` | The market index copies this into every version entry. Missing it fails the index PR |
| `readme` | A `Requirements` section that states the declared range, so an install failure is predictable |
| `dsh field` | `dsh.bundle.patch` must exist for the host to load the plugin |
| `patch file` | The path declared above must be a real file |
| `client entry` | If `dsh.client` is declared, the bundle has to be there |
| `files list` | Every path `package.json` points at (`exports`, patch, client) must be covered by `files` |

Exit code is `0` when the plugin can be installed and `1` when it cannot, so it drops into CI unchanged.

## What `release` does

`release` runs the sequence in the order that fails cheapest first:

1. Preflight (`doctor`) — stop before tagging anything.
2. Refuse to run on a dirty tree, or if the tag already exists.
3. Create and push the tag, which starts the plugin's release workflow.
4. Poll the registry until it actually serves that version, reporting each wait.
5. Write the index entry with the publish time **the registry reports**, not the local clock.
6. Print the exact `git add` / `gh pr create` commands for the index change.

Steps that touch your repository are printed, never guessed at. `--dry-run` prints the whole sequence with the commands it would run.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Done, or nothing to complain about |
| 1 | A check failed, or the release stopped (the failing stage is named) |
| 2 | Unknown command |

## Looking at it without a Harness

The fixtures under `test/fixtures/` are three tiny plugins — one good, one missing its host range, one whose README contradicts its manifest — and the tests run every check against them:

```
npm test
```

## Roadmap

- `testkit`: load a single-file client bundle in a DOM with a fake host ctx, so panel behaviour can be asserted in CI instead of by hand.
- `dev`: watch a client bundle and push it to a running app, instead of restarting the app for every change.

## License

Apache-2.0. See [LICENSE](LICENSE).
