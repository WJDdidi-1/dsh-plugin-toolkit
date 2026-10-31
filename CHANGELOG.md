## 0.7.2

`verify` runs from npx's cache, so it has to find jsdom and React where the
plugin is, not where the tool is.

- `testkit` resolves `jsdom`, `react` and `react-dom` from the plugin folder
  first, then the working directory, then the tool's own dependencies.
- `verify` passes the plugin folder through, so
  `uses: WJDdidi-1/dsh-plugin-toolkit@v1` works in a workflow that ran `npm ci`
  in the plugin: before this, the action failed with
  `testkit needs a DOM: npm install --save-dev jsdom react react-dom` even
  though the plugin declared them.

## 0.7.1

The action now checks the tarball, which is the only thing a user installs.

- `uses: WJDdidi-1/dsh-plugin-toolkit@v1` defaults to `command: verify` instead
  of `doctor`. `doctor` reads the working copy, so a `files` list that omits
  `client.js` passes it and the plugin installs without a panel.
- The action fetches the published package with `npx` rather than shipping
  `node_modules` in the repository — `verify` mounts the panel, which needs
  jsdom and React, and those belong to the caller's dev dependencies.
- New `version` input (default `latest`) so a workflow can pin the tool.
- `test/action.test.mjs` guards the three things that break silently: the
  default command, the commands it offers existing in the CLI, and the README
  showing the action the way a consumer writes it.

# Changelog

## 0.7.0

Documentation, restructured around what you are trying to do rather than what the tool contains.

- README opens with **Three paths** — write a plugin, develop a panel, ship a version — and each path shows the commands it needs.
- `--help` gives every command one example line that can be pasted as-is, instead of syntax with placeholders.
- The stale `Roadmap` (which still described `dev` as unbuilt, two releases after it shipped) is replaced by **What is not here yet**: no `npm publish`, no check against a running app, `dev --host` not covered by CI, no Windows test of the watcher.
- `test/help.test.mjs` keeps all three honest: every command needs an example without placeholders, the three paths must show each command, and the README may not call a shipped feature unbuilt.

## 0.6.3

- `git` and `gh` are `.exe` on Windows, not `.cmd`; 0.6.2 renamed them too and `git.cmd` does not exist. Only the npm family is a shim now.

## 0.6.2

- 0.6.1 named the Windows shim but spawned `npm.cmd` directly, which Node 18.20/20.12 reject with `EINVAL` (the fix for CVE-2024-27980). `lib/exec.mjs` now runs through the shell on Windows and quotes each argument; elsewhere nothing changes.

## 0.6.1

- `npm`, `git` and `gh` are `.cmd` shims on Windows; `execFileSync('npm', …)` fails there with `spawnSync npm ENOENT`. One helper (`lib/exec.mjs`) now maps the name, instead of a `shell: true` at every call site. Caught by the Windows CI job that 0.6.0 added tests to.

## 0.6.0

`dsh-plugin verify` — the check that reads the tarball instead of the working copy.

- Packs, installs that tarball into a throwaway directory, and mounts the bundle **from the installed copy**, so "works in the repo, broken after `npm i`" is caught before publishing.
- Fails when the tarball omits the client bundle (found by convention, so it is not in the `files` check doctor runs) or anything else `package.json` points at.
- `--no-mount` stops after packing, for plugins whose panel needs a host to be meaningful.

## 0.5.0

`dsh-plugin init` — scaffolding that already passes the checks people hit after their first publish.

- Writes eight files: `package.json` (with `engines.dsh`, the patch file and a `files` list that actually ships the code), `cordis.patch.yml`, `index.js`, `client.js` (a sidebar tab), a testkit test for that tab, a CI workflow that runs both, `README.md` and `.gitignore`.
- Refuses a directory that is not empty unless `--force`, and refuses a name npm would refuse — the two mistakes that cost the most time later.
- The template is embedded, so `init` works offline.

## 0.4.1

- `examples/`: four runnable files (`mount-a-bundle`, `route-stubs`, `baseline`, `aria`), each showing one thing testkit does.
- `test/examples.test.mjs` runs every example and asserts it prints exactly what the README shows, and that the README names each one. An example that does not run teaches a shape that no longer exists.
- `fixtures/fetching-bundle/`: a bundle that calls its host on mount, so the route-stub example asserts something real instead of printing zeros.

## 0.4.0

`release` can now finish the job instead of printing the next command.

- `--pr` commits the index on `market/<version>`, pushes it, and opens the pull request with `gh`.
- `--merge` (with `--pr`) waits for `gh pr checks` to settle and squash-merges.
- A repository with no CI is treated as settled rather than waited on; `gh` prints "no checks reported" on **stderr** and exits 1, which is why stderr is now piped instead of dropped.
- Re-running a release after a failure no longer throws: the same version with the same publish time is a no-op, and a different timestamp stops with both values in the message.
- A package the registry has never heard of fails immediately (`the registry has no package named …`) instead of polling for eight minutes.
- `release` forwards `fetch`, so a caller can answer instead of npm.

Verified end to end against a throwaway package: tag → publish → registry wait → index write → PR #3 → checks → merged.

## 0.3.5

Four bugs found by running `release` for real against a throwaway package, instead of only `--dry-run`:

- The index entry came out with `publishTimestamp: null`. The registry was asked for the abbreviated packument (`application/vnd.npm.install-v1+json`), which has no `time` field at all — so the tool could see the version and still have no publish date. It now asks for the full document, and waits for `time[version]` before writing the entry.
- `git rev-parse` on a tag that does not exist yet printed `fatal: ambiguous argument …` in the middle of a successful release; stderr is now dropped for that call.
- "the working tree has uncommitted changes" now names up to three paths.
- A folder without `package.json` raised a stack trace instead of returning a preflight failure.

## 0.3.4

- CI now runs on Windows as well as Linux and macOS; two tests assumed a POSIX temp path (`/tmp/…`) and were rewritten with `path.join`.
- Verified `mount`, `doctor` and `release --dry-run` on Node 18.20.8 (not just the version CI installs), and the SSE wait against a stream shaped like the app's.

## 0.3.3

- `mount` on a path that is missing, or that is a directory, now says what to pass instead of raising `ENOENT: no such file or directory, open '…'`. Found by running the three commands in a clean HOME with a fresh clone.

## 0.3.2

- `expectSnapshot(html, dir, name)`: the assertion form of `compare`, so a baseline test reads like a test and fails with the element that moved.
- README: how to keep a DOM baseline, and how to assert what assistive tech sees.

## 0.3.1

- `unmount()` now waits one macrotask before the DOM goes away. React schedules work during its own unmount, and closing jsdom first turned that into `ReferenceError: window is not defined` after a passing test. Found by the example plugin's second test.
- The README links `dsh-plugin-example` and documents that `unmount()` is async.

## 0.3.0

- `dsh-plugin dev`: copy a rebuilt bundle into the installed plugin, then confirm the reload from the host's `/plugins/events` stream. Subscribing happens *before* the write, because a copy made first is reported to nobody.
- Without `--host` the copy still happens and the tool says the reload is unconfirmed — no guessed port, no false negative.
- A failed `--build` copies nothing.

## 0.2.2

- `unmount()` closes the jsdom window, so a panel that polls does not keep the test process alive.
- The first paint waits for the panel's own fetches inside `act`, which removes the flood of "not wrapped in act" warnings that buried real failures.

## 0.2.1

- A missing peer dependency now names the install command instead of failing with `ERR_MODULE_NOT_FOUND`.

## 0.2.0

- `dsh-plugin-toolkit/testkit`: mount a single-file client bundle in jsdom with the real React and a recording host context — `click`, `type`, `press`, `must`, `attributes`, and normalised DOM baselines.
- `createFetch(routes)`: route stubs for the panel's own endpoints, with a request log; an undeclared route answers 404 rather than hanging.
- `dsh-plugin mount <client.js>`: render a bundle in Node and print the text a user would see, or the markup with `--html`.
- The host merges locale registrations per namespace and understands both a flat table and a `{en, zh}` language map, which is what real plugins register.

## 0.1.1

- Ship a composite GitHub Action (`action.yml`), so a plugin repository can run the same checks with `uses: WJDdidi-1/dsh-plugin-toolkit@v1`.

## 0.1.0

First cut: `doctor`, `index`, `release`.

- `doctor` checks the manifest, the README's stated host range, the bundle patch, the client entry, and whether `files` ships everything `package.json` points at.
- `index` audits `market/index.json` and names every version that cannot state a host range.
- `release` runs preflight → tag → registry wait → index entry, prints every GitHub step, and refuses to run on a dirty tree or an existing tag.
- Registry checks read the registry's own document (and `time`), because `npm view` answers from a cache.
