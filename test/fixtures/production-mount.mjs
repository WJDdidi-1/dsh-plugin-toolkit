/**
 * Mount the fetching fixture with the production React build and a scheduler
 * that is deliberately slower than a timer tick.
 *
 * A production React has no `act`; a concurrent root commits through React's
 * scheduler, which uses `setImmediate` in Node. Development builds hide that
 * hop because `act` flushes
 * synchronously, and a fast scheduler usually hides it in tests too. Holding
 * the scheduler back makes the old "wait three zero-delay timers" mount return
 * before the commit, which is the failure this fixture exists to catch.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Zero-delay timers are usually a macrotask yield. Collapsing them to
// microtasks makes the old mount's three "ticks" yield nothing at all, so it
// returns before React's scheduler has committed; the fixed mount yields with
// setImmediate, which does not depend on this shim.
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (callback, _delay, ...args) => {
  queueMicrotask(() => callback(...args));
  return 0;
};

const { createFetch, mountClient } = await import('../../lib/testkit/index.mjs');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BUNDLE = path.join(ROOT, 'fixtures', 'fetching-bundle', 'client.js');
const CLICK_BUNDLE = path.join(ROOT, 'fixtures', 'click-fetch-bundle', 'client.js');
const RUNS = Number(process.env.RUNS ?? 3);
const STUB = { '/demo/report': { body: { score: 71 } }, '/demo/answer': { body: { answer: 42 } } };

let mismatches = 0;
for (let index = 0; index < RUNS; index += 1) {
  const panel = await mountClient({ file: BUNDLE, resolveFrom: ROOT, fetch: createFetch(STUB) });
  const text = panel.text();
  if (text !== 'Score 71') {
    mismatches += 1;
    if (mismatches === 1) console.error(`mount ${index + 1}: ${JSON.stringify(text)}`);
  }
  await panel.unmount();
}

// The same blind wait lived in the interaction helpers: click starts a fetch,
// whose setState has to be committed before panel.text() reads again.
try {
  const clicked = await mountClient({ file: CLICK_BUNDLE, resolveFrom: ROOT, fetch: createFetch(STUB) });
  await clicked.click('[data-testid="ask"]');
  const afterClick = clicked.text();
  if (afterClick !== 'ask Answer 42') {
    mismatches += 1;
    console.error(`click: ${JSON.stringify(afterClick)}`);
  }
  await clicked.unmount();
} catch (error) {
  mismatches += 1;
  console.error(`click failed: ${error.message.split('\n')[0]}`);
}

console.log(`mounts=${RUNS} mismatches=${mismatches}`);
process.exitCode = mismatches === 0 ? 0 : 1;
