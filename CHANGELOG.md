## 0.9.7

- **The tab type is now reachable.** Registering a tab *type* is not enough: the
  right sidebar's guide list is built from `tabs.guide()`, so a type with no
  `guide` entry is registered, has a body slot, and is still impossible to open —
  no tab appears anywhere. The type now contributes one guide entry
  (`id: 'doctor'`, `order: 60`, localized title and description), which is what
  puts "Plugin doctor" in the sidebar's guide.
- The title and description come from the panel's own dictionary through a
  module-level `translate()`, because the sidebar calls them from its guide list,
  outside this component.
- Regression test: mounting the bundle with a recording `sidebarRightTabs` now
  asserts the registered definition carries a guide entry with a title and an
  order.

## 0.9.6

- **The host half now survives a context it does not own.** `apply()` ended with
  an unguarded `installRoutes(ctx)`, and cordis does not return `undefined` for
  an undeclared service — it throws `cannot get property "webServer" without
  inject`. So the whole `apply` failed, no route was registered, and the plugin
  manager showed one red dot with no text: the exact symptom the 0.9.5 report
  channel was built to explain, caused by the code next to it.
- `verify` now calls the host face's `apply` with a context that throws on every
  undeclared property, the way cordis does. A plain `{}` hid this: reading
  `ctx.webServer` off it is just `undefined`. Message:
  `apply() throws when a service it never declared is read, which fails the row: …`
- The scaffold was never affected — its host half registers nothing.
- Regression tests: `test/host.test.mjs` (activation, deferred web server,
  method guard) and a `verify` case that builds a plugin whose `apply` reads
  `ctx.webServer` unguarded.

## 0.9.5

- The panel reports its own failures. When a row fails to activate the app shows
  one red dot and no text, so the bundle now posts what happened to
  `POST /toolkit/report`; the host appends it to `~/.dsh/toolkit-client-report.ndjson`.
  Every stage is reported — `apply`, `no-inject`, `no-sidebar`, `tab-registered`,
  `tab-failed` — so "did it run at all" is answerable without a debugger.
- The failure that motivated it: `ctx.inject` callbacks run *after* `apply()`
  returns, so the guards added in 0.9.4 could not see a throwing registration and
  the row still ended up failed. The callback body is now guarded and reported.
- The client module no longer sets `name` on its face; it is the package's name
  either way, and the face now matches the shape that works.
- `mountClient` accepts a `host`, so a test can hand the panel a service that
  throws on purpose. Without it "the service threw" — the failure mode that costs
  the most to debug in the app — was untestable.
- `README.zh.md`: the whole tour in Chinese, linked from the top of the README.
  The install examples now say `@latest` instead of a version that goes stale.

## 0.9.4

- The client module now declares `inject: ['slots', 'locale']` and guards every
  service it reads. Without the list the loader calls `apply()` before those
  services exist; the throw fails the **whole web boot**, and the app then reports
  that third-party plugins are unsupported and starts with them disabled. That is
  what one unguarded `ctx.locale.register` did to a real profile.
- `verify` now calls the client module's `apply()` with a bare context and refuses
  a face without an `inject` list, so this class of failure is caught before
  install instead of at boot.
- `init` scaffolds the same guards, for the same reason.

## 0.9.3

- The panel needed one more thing than `dsh.client`: the host resolves the bundle
  through `exports["./client"]` (`clientExportOf`), and drops the row when that
  subpath is missing. 0.9.2 declared `dsh.client` but its `exports` map had no
  `./client`, so the tab was still absent — this release exports `./client` and
  `doctor` now checks the same thing the host does.
- `init` scaffolds `exports: { '.': './index.js', './client': './client.js' }`.
  Every plugin generated before this release was missing it, so every generated
  panel was invisible for the same reason.
- `doctor` reports a `dsh.client` whose `exports["./client"]` file does not exist,
  and a `dsh.client` with no `./client` export at all. The `files`-list gap is now
  caught at the manifest stage instead of at pack time.

## 0.9.2

- `doctor` reports a shipped client bundle that no `dsh.client` declares. The host
  serves `client.js` only for packages declaring `dsh.client`, so a plugin could
  ship the bundle, mount it in `verify`, and still have no panel in the app — the
  same silent failure as a tarball without it.
- The toolkit's own manifest now declares `dsh.client` (`platform: web`,
  `inject: ['@deepseek-ai/dsh-client-ui-sidebar-right']`), which is what makes the
  Plugin doctor tab reachable at all.
- The `not-shipped` fixture declares its client entry, so it keeps demonstrating
  the `files` gap instead of tripping the new declaration check.

## 0.9.1

- `audit` separates problems from advisories. Running 0.9.0 on a real profile
  said "17 of 19 installed plugin(s) have problems" — 13 of those load fine and
  only lack `engines.dsh` or a README Requirements section, which the market index
  needs and the loader does not. Those are now counted separately, so the plugins
  that are actually broken stay visible.
- `client entry` and `dev` resolve a `./client` export written as a conditions
  object (`{ default: './lib/client.cjs' }`), not only as a string.

## 0.9.0

- `audit`: every plugin installed in a profile, in one pass — version, whether the
  installed copy passes the same checks `doctor` runs, and whether the running app
  loaded it (read from the graph frame on `/plugins/events`). Answers "why is my
  plugin not in the sidebar?" with the plugin named.
- `doctor --installed` (used by `audit`): skip the `files` check. After install the
  tarball is already unpacked, so `files` cannot decide what shipped — npm always
  ships `package.json` and the README, and the check reported false problems for
  every published plugin.
- `client entry` accepts the bundle named by the `./client` export, which is how a
  package with a `dsh/` folder names its bundle (`@liustack/modlens` was reported
  as missing its own client bundle).

## 0.8.8

- `dev` reads the plugin graph the app sends first, so a plugin the app never
  loaded is reported as that ("restart the app once after installing it") instead
  of as a timeout. Found by running `dev` against a real app, not a fake stream.

## 0.8.7

- `panel.aria(selector)` and `panel.expectAria(selector, expected)`: assert what a
  screen reader reads, and get the attribute that differs named in the failure.
  A missing attribute reports `nothing` rather than `""`.

## 0.8.6

- `release --publish`: run `npm publish` locally instead of waiting for a
  publish workflow. Plenty of small plugins have no release pipeline; before
  this, `release` tagged, pushed and then waited for a registry that would never
  receive the version.
- The publish failure reports the last line of npm's stderr, so a 403 reads like
  a 403.

## 0.8.5

- `release --market <dir>`: write the index entry into a checkout of the
  repository that owns the index, and open the pull request there. Before this,
  `release` only touched a `market/index.json` inside the plugin's own repo, so
  anyone listed in a central market had to patch the entry by hand — which is
  where the timestamp goes wrong.
- `--index` still names the file inside that repository.

## 0.8.4

- README: `## When the panel does not appear` — the five checks that explain a
  successful install with nothing on screen (restart, root export, tarball,
  patch row, a bundle that throws). Each one is a failure this tool has already
  hit. A test keeps the section from losing a step.
- `doctor` table lists the new `root export` check; the verify example no longer
  pins an old version in its own docs.

## 0.8.3

`verify` now imports the host half it just installed.

- After installing the tarball, `verify` imports the module the loader will
  import (`exports["."]`, else `main`) and requires an `apply` function. A root
  module that throws on import — which `doctor`'s static read cannot see — is
  now a failure: `the installed index.js does not import: boom`.
- `--no-mount` skips the DOM, not the install, so the host half is checked in
  both modes. The success line says which half ran.

## 0.8.2

`doctor` now refuses the failure that shipped in 0.8.0.

- New check `root export`: when a package declares `dsh.bundle`, its root module
  has to be the plugin. A root that is also a `bin` target — a CLI wearing a
  plugin's clothes — is reported, and so is a root module with no `apply`.
  pnpm reports success either way; the row just mounts nothing.
- `test/doctor.test.mjs` covers both shapes, and a bundle with no root module
  (a subpath plugin) stays legal.

## 0.8.1

`0.8.0` installed and then did nothing: the loader starts a plugin by importing
the bare package name, and `exports["."]` still pointed at the CLI, so the row
had no `apply` to run.

- `exports["."]` is `./index.js`; the CLI keeps `./cli` and `bin`, the testkit
  keeps `./testkit`.
- `test/entry.test.mjs` guards the shape: the root export is the plugin, the
  patch file names the package once as `- insert:`, and every path
  `package.json` points at is in `files`.

## 0.8.0

The toolkit can now be installed as a plugin, because a tool that cannot be
installed the way its users install things is asking them to take its word.

- A "Plugin doctor" tab in the right sidebar: name the folder that holds a
  plugin's `package.json`, and it runs the same checks the market runs
  (`doctor` plus the pack list) and says which one would fail.
- `index.js` registers `GET /toolkit/check?dir=`, read-only, same-origin only,
  and answers with `{ok, dir, checks:[{check, ok, message}]}`.
- `cordis.patch.yml` and `dsh.bundle` in `package.json`, so `dsh plugin add
  dsh-plugin-toolkit` installs the panel; the CLI keeps working from the same
  package.
- The panel is tested the way a user meets it: `mountClient` on the real
  `client.js`, with a stub answering the route the host half registers.

## 0.7.3

The scaffold was two minor versions behind the tool that wrote it.

- `init` pins the toolkit it was generated by (`^<its own version>`) instead of
  a number typed once, so `npm install` in a fresh scaffold gets the version
  whose README you just read.
- The generated workflow uses the composite action with `verify` instead of
  `npx dsh-plugin-toolkit@0.5.0 doctor .` — `doctor` reads the working copy and
  cannot see that `files` left the client bundle out.
- `test/init.test.mjs` guards both: the pinned range must equal the running
  version, and the workflow must not fall back to `doctor`.

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
