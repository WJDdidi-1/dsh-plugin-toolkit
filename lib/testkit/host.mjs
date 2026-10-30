/**
 * The smallest host that a panel can be honest against.
 *
 * A plugin registers slots, a locale table and a sidebar tab; this records what
 * it registered and calls the callbacks the way the host would. Nothing here
 * pretends to be more than the surface the panel actually uses — if a panel
 * needs something else, the missing service throws with its own name.
 */
export function createHost({ locale = {}, fetch: fetchImpl, surface = 'sidebar' } = {}) {
  const registrations = { slots: [], tabs: [], locales: [], effects: [] };
  const opened = [];
  const injected = [];

  const slots = {
    register(definition, component) {
      registrations.slots.push({ definition, component });
      return () => {};
    },
    inject(name, run) {
      const result = run();
      if (typeof result === 'function') return result;
      return () => {};
    },
  };

  const localeService = {
    register(namespace, dictionary) {
      // Two shapes reach this: a flat key → text table, and a language map
      // ({en: {...}, zh: {...}}). Both are legal, so both are kept.
      const entry = { namespace, dictionary: {}, languages: null };
      const values = Object.values(dictionary ?? {});
      const isLanguageMap = values.length > 0 && values.every((value) => value !== null && typeof value === 'object' && Array.isArray(value) === false);
      if (isLanguageMap === true) entry.languages = { ...dictionary };
      else Object.assign(entry.dictionary, dictionary);
      const existing = registrations.locales.findIndex((item) => item.namespace === namespace);
      if (existing === -1) registrations.locales.push(entry);
      else {
        const previous = registrations.locales[existing];
        Object.assign(previous.dictionary, entry.dictionary);
        if (entry.languages !== null) previous.languages = { ...(previous.languages ?? {}), ...entry.languages };
      }
      return () => {};
    },
    bind(namespace, language = 'en') {
      const entry = registrations.locales.find((item) => item.namespace === namespace);
      const table = entry?.languages?.[language] ?? entry?.languages?.[Object.keys(entry.languages ?? {})[0]] ?? entry?.dictionary;
      return (key, values) => {
        const template = table?.[key];
        if (typeof template !== 'string') return key;
        if (values === undefined) return template;
        return template.replace(/\{(\w+)\}/g, (match, name) => (Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match));
      };
    },
  };

  const sidebarRightTabs = {
    register(definition) {
      registrations.tabs.push(definition);
      return () => {};
    },
  };

  const sidebarRight = {
    openTab(kind) {
      opened.push(kind);
      return undefined;
    },
    active: () => null,
    isExpanded: () => true,
    toggleExpanded() {},
  };

  const services = {
    slots,
    locale: localeService,
    sidebarRightTabs,
    sidebarRight,
    // A relative URL is normal in the renderer and impossible for Node's fetch,
    // so the default answers "nothing here" instead of throwing a parse error.
    fetch:
      fetchImpl ??
      (async () => ({
        ok: false,
        status: 404,
        headers: { get: () => null },
        json: async () => ({}),
        text: async () => '',
      })),
    // `ctx.inject(names, cb)` is how a plugin asks for services lazily.
    inject(names, callback) {
      injected.push(names);
      // The real host hands back a ctx that can still resolve other services;
      // a plugin that checks `tabCtx.slots` before registering must see it.
      const subset = Object.assign({}, services);
      for (const name of names) subset[name] = services[name];
      return callback(subset);
    },
    effect(run) {
      registrations.effects.push(run);
      const dispose = run();
      return () => {
        if (typeof dispose === 'function') dispose();
      };
    },
    on() {
      return () => {};
    },
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    console,
  };

  if (surface === 'overlay') {
    delete services.sidebarRightTabs;
    delete services.sidebarRight;
  }

  services.registrations = registrations;
  services.opened = opened;
  services.injected = injected;
  services.registeredLocale = (namespace) => registrations.locales.find((item) => item.namespace === namespace)?.dictionary ?? {};
  services.slot = (name) =>
    registrations.slots.find(({ definition }) => definition.name === name) ??
    null;
  services.tabDefinition = (id) => registrations.tabs.find((definition) => definition.id === id) ?? null;
  return services;
}
