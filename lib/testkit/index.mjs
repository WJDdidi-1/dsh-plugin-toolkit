/**
 * `dsh-plugin-toolkit/testkit` — the public surface.
 *
 * A plugin's own test file should be able to say: mount my bundle, click the
 * button, expect this text — without inventing a DOM, a host, or a renderer.
 */
export { createDom, installGlobals } from './env.mjs';
export { createHost } from './host.mjs';
export { createFetch } from './fetch.mjs';
export { createModuleLoader, loadBundle } from './load.mjs';
export { mountClient } from './mount.mjs';
export { compare, normalize, snapshotPath, write } from './snapshot.mjs';
