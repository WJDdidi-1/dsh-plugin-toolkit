/**
 * A DOM for a plugin bundle that was written for a DOM.
 *
 * The bundle is one file that runs in the renderer: it calls
 * `window.__ModuleLoader__.load({factory})` and expects React to already exist.
 * jsdom plus the real React gives us the same arrangement in Node, which is what
 * makes panel behaviour assertable in CI instead of by hand.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolve a dependency the way the *plugin under test* would.
 *
 * `npx dsh-plugin-toolkit verify` installs the tool in npx's own cache, so a
 * bare `import('jsdom')` looks there and not in the project that declared it.
 * The plugin folder is the authority on what is installed.
 */
export function requireFrom(name, resolveFrom) {
  const anchors = [resolveFrom, process.cwd(), path.dirname(fileURLToPath(import.meta.url))]
    .filter((anchor) => typeof anchor === 'string' && anchor !== '');
  for (const anchor of anchors) {
    try {
      return createRequire(path.join(anchor, 'noop.js'))(name);
    } catch {
      // Try the next place a dependency could legitimately live.
    }
  }
  throw new Error(
    `testkit needs ${name} where the plugin is installed: cd ${anchors[0]} && npm install --save-dev jsdom react react-dom`,
  );
}

export function createDom({ html = '<!doctype html><html><body><div id="root"></div></body></html>', resolveFrom } = {}) {
  const { JSDOM, VirtualConsole } = requireFrom('jsdom', resolveFrom);
  // jsdom's CSS parser predates nesting and `:has()`, so it complains about
  // stylesheets it cannot parse. That is a jsdom limit, not a panel bug.
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => {
    if (/Could not parse CSS stylesheet/.test(error.message) === true) return;
    console.error(error.message);
  });
  const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true, virtualConsole });
  return { dom, window: dom.window, document: dom.window.document };
}

/**
 * Installs the globals a renderer-side bundle reaches for. `previous` is
 * returned so a test file can put the process back the way it found it.
 */
export function installGlobals(window, document) {
  const names = ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const previous = new Map();
  const define = (name, value) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    previous.set(name, descriptor);
    // Node 24 ships `navigator` as a getter; assigning to it throws, so the
    // global is replaced with defineProperty and put back the same way.
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true, enumerable: descriptor?.enumerable ?? true });
  };
  for (const name of names) {
    const value = name === 'window' ? window : window[name];
    if (value === undefined) continue;
    define(name, value);
  }
  define('self', window);
  // React 19 only runs effects through act() when it is told it is in a test.
  const previousAct = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  previous.set('IS_REACT_ACT_ENVIRONMENT', previousAct);
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true, writable: true });
  return () => {
    for (const [name, descriptor] of previous) {
      if (descriptor === undefined) delete globalThis[name];
      else Object.defineProperty(globalThis, name, descriptor);
    }
  };
}
