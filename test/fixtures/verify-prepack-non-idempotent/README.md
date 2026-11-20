# verify-prepack-non-idempotent

A fixture whose `prepack` hook is not idempotent: the first invocation writes
`client.js`, every later invocation removes it. The dry run therefore lists a
panel that the second `npm pack` invocation leaves out of the tarball.

## Requirements

- DeepSeek Harness `>=0.2.0`
