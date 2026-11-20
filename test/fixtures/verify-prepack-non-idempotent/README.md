# verify-prepack-non-idempotent

A fixture whose `prepack` hook is not idempotent: the first invocation writes
`client.js`, every later invocation removes it. A `verify` that packs exactly
once must report on the tarball that invocation built, so the first run ships a
panel and the second run fails at `pack` naming `client.js`. An earlier verify
ran a dry run before the real pack and silently judged the dry run's file list,
which described a different tarball.

## Requirements

- DeepSeek Harness `>=0.2.0`
