/**
 * Loading a client bundle without a bundler.
 *
 * DSH ships plugin client code as a single file that registers itself with
 * `window.__ModuleLoader__.load({id, factory})`. There is no ESM boundary to
 * import, so the loader is replaced with one that hands the factory a `require`
 * for the modules the host provides.
 */
import fs from 'node:fs';

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
  const source = fs.readFileSync(file, 'utf8');
  const loader = createModuleLoader(options);
  const context = { window: { __ModuleLoader__: loader }, __ModuleLoader__: loader, ...(options.globals ?? {}) };
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
