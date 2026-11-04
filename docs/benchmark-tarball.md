# The published tarball cannot run the benchmark

[`README.md`](../README.md#measured-throughput) tells readers to run
`npm run benchmark`, whose script is `node scripts/benchmark-audit.mjs`. The
published `0.19.0` tarball does not ship `scripts/`, so the documented command
fails inside a fresh install. The checkout still works because it has the
script; only the installed copy is missing it.

## Reproduction

Measured on 2026-11-04 with Node.js `v24.15.0` and npm `11.12.1`:

```sh
$ tmp=$(mktemp -d)
$ cd "$tmp"
$ npm init -y
$ npm install dsh-plugin-toolkit@0.19.0
added 1 package in 6s
$ cd node_modules/dsh-plugin-toolkit
$ npm run benchmark

> dsh-plugin-toolkit@0.19.0 benchmark
> node scripts/benchmark-audit.mjs

node:internal/modules/cjs/loader:1479
  throw err;
  ^

Error: Cannot find module '/tmp/.../node_modules/dsh-plugin-toolkit/scripts/benchmark-audit.mjs'
    at Module._resolveFilename (node:internal/modules/cjs/loader:1476:15)
    ...
  code: 'MODULE_NOT_FOUND',
  requireStack: []
}

Node.js v24.15.0
$ echo $?
1
```

The missing path is `scripts/benchmark-audit.mjs` in the installed copy
(`node_modules/dsh-plugin-toolkit/scripts/benchmark-audit.mjs`).

## Why it is missing

`package.json` ships `bin/`, `lib/`, `index.js`, `client.js`,
`cordis.patch.yml`, `README.md`, `README.zh.md`, `LICENSE`, `CHANGELOG.md`,
`docs/badge.svg` and `docs/card.png`. That list has no `scripts/` entry.
`npm pack dsh-plugin-toolkit@0.19.0` confirms it: the tarball contains 34 files
and none of them is under `scripts/`. `lib/benchmark.mjs` does ship, but the
file `package.json` names in `scripts.benchmark` does not.

## Verdict

The defect reproduces: a fresh install of the published `0.19.0` tarball exits
`1` with `MODULE_NOT_FOUND` when it runs the command the README cites. A
packaging change has to ship the command (or the README has to cite one that
ships), and a test has to pack, install and run it so the gap cannot return.
