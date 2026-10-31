# Five plugins that installed and did nothing

Every one of these shipped in a real version of `dsh-plugin-toolkit`, to a real
Harness profile, and every one of them passed a manifest check. They are the
reason this tool exists, and they are the reason its checks look the way they
do: each was found by using the plugin, not by reading `package.json`.

If you are writing a Harness plugin, these are the five ways it can look
installed and still be useless.

---

## 1. The tab is a red dot, and the panel never opens

**What I saw.** The plugin manager listed `dsh-plugin-toolkit`, one component,
one red dot, no text. The app was fine; the panel was simply not there.

**What the host said.** Nothing. That is the problem: a host row that fails to
activate shows up as a colour.

**The cause.** `package.json` had:

```json
{
  "bin": { "dsh-plugin": "./lib/cli.mjs" },
  "exports": { ".": "./lib/cli.mjs" }
}
```

The loader imports the package by its bare name and calls `apply`. The root
export pointed at the CLI, so the loader's row received a module whose `apply`
was `undefined` — or, worse, a CLI that ran and exited. The plugin was installed,
the manifest was valid, and there was nothing to apply.

**What catches it now.** `root export`: the root export must not be a `bin`
target, and the module it points at must export `apply`.

```sh
npx dsh-plugin-toolkit@latest doctor .
# ✗ root export  exports["."] points at the CLI (./lib/cli.mjs), so the
#                loader's row has no plugin to apply
```

**Reproduce it.** Point `exports["."]` at your CLI and run `doctor`; it fails
before anything is published.

---

## 2. The plugin is installed, and the host never serves it

**What I saw.** Same red dot, a different cause. The host half worked — its HTTP
route answered `200` — but `/plugins/<id>/client.js` returned `404`, and the
plugin was absent from the live module graph the app streams over
`/plugins/events`.

**The cause.** The bundle was declared the way the README described:

```json
{ "dsh": { "client": { "platform": "web" } } }
```

and the file existed at `client.js`. But the host resolves the bundle through
the package's export map, not by convention:

```js
const clientRel = clientExportOf(packageName, pkg.exports);
if (clientRel === void 0) {
  throw new Error(`client-modules: ${packageName} declares dsh.client but exports no "./client" bundle`);
}
```

No `exports["./client"]`, no bundle. The row is dropped and the panel can never
appear.

**What catches it now.** `client declaration`: if `dsh.client` is declared, then
`exports["./client"]` must exist, must resolve, and the file it points at must
be on disk — and `platform` must be `web`.

```sh
npx dsh-plugin-toolkit@latest doctor .
# ✗ client declaration  dsh.client is declared but exports has no "./client"
#                       bundle, so the host drops the row and the panel cannot appear
```

**Reproduce it.** Delete `exports["./client"]` from a working plugin and run
`doctor`.

---

## 3. One unguarded line disables every plugin in the app

This is the worst one, because the damage is not local.

**What I saw.** After a restart the app announced that a third-party plugin was
not supported and **turned off all plugins**, including the ones that had worked
for weeks.

**What the log said.**

```
Error: web boot: 1 entry did not activate
dsh-plugin-toolkit: failed
```

and, from the module itself:

```
Error: cannot get property "webServer" without inject
    at installRoutes (…/dsh-plugin-toolkit/index.js:146:81)
    at apply (…/index.js:161:3)
```

**The cause.** `apply()` ended with a last-resort call to a helper that reads
`ctx.webServer`:

```js
export function apply(ctx) {
  registerSomething(ctx);
  installRoutes(ctx);   // reads ctx.webServer
}
```

`webServer` was never in the module's `inject` list. Cordis does not answer
`undefined` for an undeclared service — it **throws**. The exception escaped
`apply`, the entry failed to activate, and a failed entry fails the whole web
boot. The harness then disabled third-party plugins to get the app back.

The fix is two lines and one habit:

```js
export function apply(ctx) {
  try { installRoutes(ctx); } catch { /* no web server here; the panel still works */ }
}
```

**What catches it now.** `verify` calls `apply` on a context that has the cordis
API but no services, and reports anything it throws. The probe is deliberately
strict: reading an *undeclared* property throws the way cordis throws, so the
guard cannot be forgotten.

```sh
npx dsh-plugin-toolkit@latest verify .
# ✗ host apply  apply() throws when a service it never declared is read,
#               which fails the row: cannot get property "webServer" without inject
```

---

## 4. The tab registers, and nothing in the UI opens it

**What I saw.** Everything reported success. The plugin's own crash reporter
said `stage: "tab-registered"`. And there was still no way to open the panel.

**The cause.** `sidebarRightTabs.register()` registers a tab **type**. What the
sidebar lists is a different call — it collects each type's `guide` entries:

```js
this.guideEntries = this.cached.flatMap((definition) =>
  (definition.guide ?? []).map((entry) => ({ ...entry, kind: definition.kind })),
);
```

With no `guide`, a type is registered and unreachable. "Registered" is not
"visible", and a log line cannot tell you which one you have.

**What catches it now.** Not `doctor` — this is a UI contract, not a manifest
fact. It is a testkit test: mount the bundle with a host that records the
registration and assert the definition carries a guide entry.

```js
const panel = await mountClient({ file: './client.js', host });
const [definition] = panel.host.registrations.tabs;
assert.equal(definition.guide.length, 1);
```

**Reproduce it.** Delete the `guide` array from a working tab definition; the
test above fails while the app still reports a successful registration.

---

## 5. The checker was wrong, and the example plugin said so

The four above are plugin bugs. This one is a tool bug, and it belongs here
because it is the same lesson from the other side.

**What I saw.** The example plugin's CI went red on a release that changed
nothing in the example:

```
✗ boot: apply() throws when the services are absent, which fails the web boot:
        ctx.inject is not a function
```

The example's `apply` is empty, and its client half guards every service. It was
correct. The **probe** was wrong: it called the client module's `apply` with
`{}`, so `ctx.inject(...)` — the cordis API every plugin uses — was
`undefined`.

**The fix.** The probe now models a real context: `inject`, `on`, `effect`,
`logger`, `get`, `set`, `provide` exist; only the services are absent. A second,
stricter probe keeps the rule from #3: reading an undeclared property throws.

**Why it is in this document.** A checker that fails correct plugins is worse
than no checker — people turn it off and never come back. The example exists to
be checked by the same command everyone else runs, which is how this was found
within a minute of the release going out.

---

## The short version

| Symptom | Root cause | Checked by |
| --- | --- | --- |
| Red dot, no panel | root export is the CLI | `doctor` |
| Installed, never served | `dsh.client` without `exports["./client"]` | `doctor` |
| App disables every plugin | unguarded read of an undeclared service | `verify` |
| Tab registered, no entry | `register()` without `guide` | a testkit test |
| Correct plugin rejected | the probe, not the plugin | this document |

```sh
npx dsh-plugin-toolkit@latest verify .
```

If it exits 0, all five have been ruled out.
