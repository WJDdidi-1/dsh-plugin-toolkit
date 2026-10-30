# Changelog

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
