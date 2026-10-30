/**
 * Talking to npm without lying to yourself.
 *
 * `npm view` hits a local cache and can answer with a version that the registry
 * is still not serving; the only honest question is "does the registry's own
 * document list this version". That is what `versionsOf` asks, and the release
 * command waits on it instead of on a sleep.
 */
export const REGISTRY = 'https://registry.npmjs.org';

export async function packument(name, options = {}) {
  const base = options.registry ?? REGISTRY;
  const request = options.fetch ?? fetch;
  const response = await request(`${base}/${name.replace('/', '%2F')}`, {
    headers: { accept: 'application/vnd.npm.install-v1+json' },
  });
  if (response.status === 404) return null;
  if (response.ok === false) {
    throw new Error(`registry answered ${response.status} for ${name}`);
  }
  return response.json();
}

/** The publish time the index should carry, straight from the registry. */
export function publishedAt(document, version) {
  const time = document?.time?.[version];
  if (typeof time !== 'string') return null;
  const seconds = Math.floor(Date.parse(time) / 1000);
  return Number.isFinite(seconds) ? seconds : null;
}

export function hasVersion(document, version) {
  // `versions` is what an install sees; `time` is what a publish writes first.
  // Either one means the registry is serving this version.
  return Boolean(document?.versions?.[version]) || typeof document?.time?.[version] === 'string';
}

/**
 * Polls until the version is visible or the budget runs out.
 * `onWait` is called after each miss so the CLI can report progress.
 */
export async function waitForVersion(name, version, options = {}) {
  const budgetMs = options.budgetMs ?? 8 * 60 * 1000;
  const intervalMs = options.intervalMs ?? 10 * 1000;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const started = now();
  let attempts = 0;

  for (;;) {
    attempts += 1;
    const document = await packument(name, options);
    if (hasVersion(document, version) === true) {
      return { document, attempts, waitedMs: now() - started };
    }
    if (now() - started >= budgetMs) {
      return { document, attempts, waitedMs: now() - started, timedOut: true };
    }
    if (typeof options.onWait === 'function') {
      options.onWait({ attempts, waitedMs: now() - started, version });
    }
    await sleep(intervalMs);
  }
}
