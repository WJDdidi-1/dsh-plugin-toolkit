/**
 * Route stubs for the plugin's own endpoints.
 *
 * The panel talks to itself over HTTP (`/aiignore/report` and friends), so a
 * test states what each route answers and gets a log of what was asked. A route
 * that is not declared answers 404 on purpose: silence hides missing calls.
 */
export function createFetch(routes = {}) {
  const requests = [];
  const answer = (pathname, search) => {
    const key = Object.keys(routes).find((route) => route === pathname || route === `${pathname}${search}`);
    if (key === undefined) return null;
    const value = routes[key];
    const resolved = typeof value === 'function' ? value({ pathname, search, requests }) : value;
    const status = resolved?.status ?? 200;
    const body = resolved?.body ?? resolved ?? {};
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  };

  const fetchStub = async (input, init = {}) => {
    const raw = typeof input === 'string' ? input : input?.url ?? String(input);
    const url = new URL(raw, 'http://localhost/');
    const method = (init.method ?? 'GET').toUpperCase();
    const entry = { method, path: url.pathname, search: url.search, body: init.body ?? null };
    requests.push(entry);
    const found = answer(url.pathname, url.search);
    if (found !== null) return found;
    return { ok: false, status: 404, headers: { get: () => null }, json: async () => ({}), text: async () => '' };
  };

  fetchStub.requests = requests;
  fetchStub.calls = (pathname) => requests.filter((request) => request.path === pathname);
  return fetchStub;
}
