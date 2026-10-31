/**
 * Loading a client bundle without a bundler.
 *
 * DSH ships plugin client code as a single file that registers itself with
 * `window.__ModuleLoader__.load({id, factory})`. There is no ESM boundary to
 * import, so the loader is replaced with one that hands the factory a `require`
 * for the modules the host provides.
 */
import fs from 'node:fs';

/**
 * Read the bundle, or say what is wrong with the path in the caller's words.
 *
 * A raw ENOENT is technically true and practically useless: the usual mistake is
 * passing the plugin folder, or a path relative to the wrong directory.
 */
function readBundleSource(file) {
  const resolved = String(file);
  if (fs.existsSync(resolved) === false) {
    throw new Error(`no such file: ${resolved} (mount takes the client bundle, e.g. ./client.js)`);
  }
  if (fs.statSync(resolved).isDirectory() === true) {
    throw new Error(`${resolved} is a directory (mount takes the client bundle inside it, e.g. ${resolved}/client.js)`);
  }
  return fs.readFileSync(resolved, 'utf8');
}

export function createModuleLoader({ require: provide, onLoad } = {}) {
  const loaded = [];
  const loader = {
    load({ id, factory }) {
      const module = { exports: {} };
      const result = factory(provide ?? (() => ({})));
      const exported = result ?? module.exports;
      loaded.push({ id, exports: exported });
      if (typeof onLoad === 'function') onLoad({ id, exports: exported });
      return exported;
    },
    get loaded() {
      return loaded;
    },
  };
  return loader;
}

export function loadBundle(file, options = {}) {
  const source = readBundleSource(file);
  const loader = createModuleLoader(options);
  // The bundle's `window` must be the real one: a plugin reads
  // `window.localStorage`, `window.matchMedia`, `window.navigator`, and a
  // stand-in that only carries the loader turns every one of those into a
  // silent `undefined`.
  const hostWindow = options.window ?? {};
  hostWindow.__ModuleLoader__ = loader;
  const context = { window: hostWindow, __ModuleLoader__: loader, ...(options.globals ?? {}) };
  // The bundle is an IIFE or a top-level statement list; the browser would run it
  // as a classic script, so a function body is the closest equivalent.
  const run = new Function('window', '__ModuleLoader__', 'require', 'module', 'exports', source);
  const module = { exports: {} };
  run(context.window, loader, options.require ?? (() => ({})), module, module.exports);
  if (loader.loaded.length === 0) {
    throw new Error(`${file} never called window.__ModuleLoader__.load(), so it is not a client bundle`);
  }
  return loader.loaded[loader.loaded.length - 1].exports;
}
