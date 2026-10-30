/**
 * Mounting a panel the way the host does, then poking at it the way a user does.
 *
 * The helpers are deliberately blunt — click, type, press — because that is the
 * vocabulary a bug report uses. Anything cleverer hides which selector was hit.
 */
import { createDom, installGlobals } from './env.mjs';
import { createHost } from './host.mjs';
import { loadBundle } from './load.mjs';
import { compare, write } from './snapshot.mjs';

function moduleShim(modules) {
  return (name) => {
    if (Object.prototype.hasOwnProperty.call(modules, name)) return modules[name];
    // An unknown host module should be obviously fake, not silently empty.
    return new Proxy(
      {},
      {
        get: (target, key) => {
          if (key === 'then') return undefined;
          if (key === Symbol.toPrimitive) return () => `[unknown module ${name}]`;
          return () => null;
        },
      },
    );
  };
}

export async function mountClient(options) {
  const {
    file,
    copy = {},
    surface = 'sidebar',
    slot = 'sidebar.right.pane.tab',
    props = {},
    fetch: fetchImpl,
    container = 'root',
  } = options;

  const { dom, window, document } = createDom();
  const restoreGlobals = installGlobals(window, document);

  const need = async (name) => {
    try {
      return await import(name);
    } catch {
      throw new Error(`testkit needs ${name}: npm install --save-dev jsdom react react-dom`);
    }
  };
  const React = await need('react');
  const reactDom = await need('react-dom/client');
  const jsxRuntime = await need('react/jsx-runtime');
  const jsxDevRuntime = await import('react/jsx-dev-runtime').catch(() => jsxRuntime);

  const modules = {
    react: React.default ?? React,
    'react-dom': await import('react-dom'),
    'react-dom/client': reactDom.default ?? reactDom,
    'react/jsx-runtime': jsxRuntime,
    'react/jsx-dev-runtime': jsxDevRuntime,
  };

  const host = createHost({ locale: copy, fetch: fetchImpl, surface });
  // The panel calls the browser's fetch, not a service, so the stub has to be
  // the global one for the duration of the mount.
  const previousFetch = globalThis.fetch;
  globalThis.fetch = host.fetch;
  try {
    const exported = loadBundle(file, { require: moduleShim(modules) });
    const apply = exported.apply ?? exported.default ?? exported.install ?? exported;
    if (typeof apply !== 'function') {
      throw new Error(`${file} exports no apply(ctx) function, so there is nothing to mount`);
    }
    await apply(host);
  } catch (error) {
    globalThis.fetch = previousFetch;
    restoreGlobals();
    throw error;
  }

  const registered = host.slot(slot);
  if (registered === null) {
    globalThis.fetch = previousFetch;
    restoreGlobals();
    throw new Error(`the bundle registered no "${slot}" slot; it registered: ${[...new Set(host.registrations.slots.map((entry) => entry.definition.name))].join(', ') || 'nothing'}`);
  }

  const root = document.getElementById(container);
  const clientRoot = (reactDom.default ?? reactDom).createRoot(root);
  const act = React.act ?? ((run) => run());

  await act(async () => {
    clientRoot.render(React.createElement(registered.component, props));
    // The first paint is followed by the panel's own fetches; letting them land
    // inside act keeps the "not wrapped in act" warnings from drowning the run.
    for (let tick = 0; tick < 3; tick += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });

  const settle = async (run) => {
    await act(async () => {
      if (run !== undefined) await run();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  const query = (selector) => root.querySelector(selector);
  const queryAll = (selector) => [...root.querySelectorAll(selector)];
  const must = (selector) => {
    const element = query(selector);
    if (element === null) throw new Error(`no element matched "${selector}" in:\n${root.innerHTML.slice(0, 600)}`);
    return element;
  };

  const helpers = {
    window,
    document,
    root,
    host,
    react: React,
    // textContent glues siblings together ("Demo panelCount 0"); a reader of the
    // screen does not, so leaves are joined with a space.
    text: () => {
      const leaves = [];
      const walk = (node) => {
        if (node.nodeType === 3) {
          const value = node.nodeValue.replace(/\s+/g, ' ').trim();
          if (value !== '') leaves.push(value);
          return;
        }
        if (node.nodeType !== 1) return;
        const tag = node.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style') return;
        for (const child of node.childNodes) walk(child);
      };
      walk(root);
      return leaves.join(' ');
    },
    html: () => root.innerHTML,
    query,
    queryAll,
    must,
    click: async (selector) => {
      const element = must(selector);
      await settle(() => {
        element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      return element;
    },
    press: async (selector, key, init = {}) => {
      const element = selector === null ? root : must(selector);
      await settle(() => {
        element.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
      });
      return element;
    },
    type: async (selector, value) => {
      const element = must(selector);
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        ?? Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      await settle(() => {
        setter?.call(element, value);
        element.dispatchEvent(new window.Event('input', { bubbles: true }));
      });
      return element;
    },
    focus: (selector) => {
      const element = must(selector);
      element.focus();
      return element;
    },
    attributes: (selector) => {
      const element = must(selector);
      return Object.fromEntries([...element.attributes].map((attribute) => [attribute.name, attribute.value]));
    },
    snapshot: (dir, name) => {
      const result = compare(dir, name, root.innerHTML);
      if (result.status === 'changed') {
        throw new Error(`${name} changed at <${result.actual.split(/(?=<)/)[result.firstDifference]}>`);
      }
      if (result.status === 'missing') {
        throw new Error(`${name} has no baseline at ${result.file}; run with --update to create it`);
      }
      return result;
    },
    writeSnapshot: (dir, name) => write(dir, name, root.innerHTML),
    unmount: async () => {
      await act(async () => {
        clientRoot.unmount();
        // React schedules follow-up work, and a polling panel schedules timers.
        // One macrotask lets that land while the DOM is still alive; closing the
        // window first turns it into "ReferenceError: window is not defined"
        // after the test has already passed.
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      globalThis.fetch = previousFetch;
      restoreGlobals();
      // A panel polls; jsdom's timers and rAF would keep the test process alive
      // for as long as the app runs. Closing the window cancels them.
      dom.window.close();
    },
  };

  return helpers;
}
