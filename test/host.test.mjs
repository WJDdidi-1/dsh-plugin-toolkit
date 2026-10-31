/**
 * The host half's activation, without a harness.
 *
 * The failure this file exists for: cordis does not return `undefined` for a
 * service a plugin never declared — it throws `cannot get property "webServer"
 * without inject`. An unguarded `ctx.webServer` read therefore fails the whole
 * `apply`, and the plugin manager shows that as one red dot with no message.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { apply } from '../index.js';

function cordisLike(extra = {}) {
  const base = { inject: undefined, ...extra };
  return new Proxy(base, {
    get(target, key) {
      if (key in target) return target[key];
      if (typeof key === 'symbol') return undefined;
      throw new Error(`cannot get property "${String(key)}" without inject`);
    },
  });
}

function fakeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(text) {
      this.body = text;
    },
  };
}

test('apply survives a context that throws on undeclared services', () => {
  assert.doesNotThrow(() => apply(cordisLike()));
});

test('apply registers both routes when the web server is already mounted', () => {
  const routes = new Map();
  apply(cordisLike({ webServer: { register: ({ path, handler }) => routes.set(path, handler) } }));
  assert.deepEqual([...routes.keys()], ['/toolkit/check', '/toolkit/report']);
});

test('apply waits for a web server that mounts after it', () => {
  const routes = new Map();
  const server = { register: ({ path, handler }) => routes.set(path, handler) };
  const ctx = cordisLike({ inject: (deps, callback) => callback({ webServer: server }) });
  apply(ctx);
  assert.deepEqual([...routes.keys()], ['/toolkit/check', '/toolkit/report']);
});

test('the report route rejects the wrong method instead of writing a file', async () => {
  const routes = new Map();
  apply(cordisLike({ webServer: { register: ({ path, handler }) => routes.set(path, handler) } }));
  const res = fakeRes();
  await routes.get('/toolkit/report')({ method: 'GET' }, res);
  assert.equal(res.statusCode, 405);
  assert.match(res.body, /method-not-allowed/);
});
