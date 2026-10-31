/**
 * Render the panel to a static page so its layout can be looked at.
 *
 * The bundle is mounted in jsdom with the same testkit a test would use, and
 * the resulting markup plus the plugin's own stylesheet becomes one HTML file.
 * No browser automation, no screenshot of the real app: this is the panel's
 * markup and its CSS, in the states that matter.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHost, createFetch, mountClient } from '../lib/testkit/index.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const out = process.argv[2] ?? '/tmp/kit-preview.html';

const result = {
  ok: false,
  dir: '/Users/you/work/my-plugin',
  checks: [
    { check: 'manifest', ok: true, message: 'my-plugin@0.2.0' },
    { check: 'engines.dsh', ok: true, message: '>=0.2.0' },
    { check: 'root export', ok: false, message: 'exports["."] points at the CLI (./bin/cli.mjs), so the loader\'s row has no plugin to apply' },
    { check: 'client declaration', ok: true, message: 'dsh.client platform=web, exports["./client"]=./client.js' },
    { check: 'files list', ok: false, message: 'files does not ship client.js, which package.json points at, so the installed plugin would be missing its own code' },
    { check: 'readme', ok: true, message: 'Requirements section found' },
  ],
};

const CANDIDATES = {
  ok: false,
  kind: 'candidates',
  query: 'dsh-plugin',
  candidates: [
    { fullName: 'tanzhangjia/dsh-plugins-examples', description: 'Example plugins for the DeepSeek Harness', stars: 1, url: 'https://github.com/tanzhangjia/dsh-plugins-examples' },
    { fullName: 'WJDdidi-1/dsh-plugin-example', description: 'A minimal panel plugin', stars: 0, url: 'https://github.com/WJDdidi-1/dsh-plugin-example' },
    { fullName: 'hopefullstack-collab/dsh-plugin-company-example', description: '', stars: 0, url: 'https://github.com/hopefullstack-collab/dsh-plugin-company-example' },
  ],
};

const REPO_RESULT = {
  ...result,
  kind: 'github',
  dir: '/tmp/dsh-toolkit-gh-1a2b/repo',
  repo: { fullName: 'WJDdidi-1/dsh-plugin-example', url: 'https://github.com/WJDdidi-1/dsh-plugin-example' },
};

const states = [
  { name: 'dock collapsed', slot: 'conversation.input.dock', before: async () => {} },
  { name: 'dock open', slot: 'conversation.input.dock', before: async (panel) => { await panel.click('.tk-dock-toggle'); } },
  { name: 'dock result', slot: 'conversation.input.dock', before: async (panel) => { await panel.click('.tk-dock-toggle'); await panel.type('.tk-input', '/Users/you/work/my-plugin'); await panel.click('.tk-button'); } },
  { name: 'dock candidates', slot: 'conversation.input.dock', route: 'search', before: async (panel) => { await panel.click('.tk-dock-toggle'); await panel.type('.tk-input', 'dsh-plugin'); await panel.click('.tk-button'); } },
  { name: 'dock repository', slot: 'conversation.input.dock', route: 'repo', before: async (panel) => { await panel.click('.tk-dock-toggle'); await panel.type('.tk-input', 'WJDdidi-1/dsh-plugin-example'); await panel.click('.tk-button'); } },
  { name: 'tab', slot: undefined, before: async () => {} },
  { name: 'tab result', slot: undefined, before: async (panel) => { await panel.type('.tk-input', '/Users/you/work/my-plugin'); await panel.click('.tk-button'); } },
];

const sections = [];
let firstPanel = null; // the injected stylesheet, read while the first panel is alive
for (const state of states) {
  const panel = await mountClient({
    file: path.join(ROOT, 'client.js'),
    slot: state.slot,
    host: createHost({ locale: { en: {}, zh: {} } }),
    fetch: createFetch({ '/toolkit/check': { body: state.route === 'search' ? CANDIDATES : state.route === 'repo' ? REPO_RESULT : result } }),
  });
  if (firstPanel === null) {
    firstPanel = panel.window.document.getElementById('dsh-plugin-toolkit:styles')?.textContent ?? '';
  }
  await state.before(panel);
  sections.push(`<section class="frame"><h2>${state.name}</h2><div class="stage">${panel.html()}</div></section>`);
  await panel.unmount();
}

// The stylesheet the plugin injects, read from the DOM it injected into: parsing
// the source with a regex silently truncates at the first `;` in a string.
const css = firstPanel;

const page = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>dsh-plugin-toolkit preview</title>
<style>
  :root { --dsw-alias-label-primary:#1f2329; --dsw-alias-label-secondary:#646a73; --dsw-alias-label-tertiary:#8f959e;
    --dsw-alias-border-l1:#e5e6eb; --dsw-alias-border-l2:#d9dbe1; --dsw-alias-bg-body:#fff; --dsw-alias-bg-l1:#f7f8fa;
    --dsw-alias-state-business-primary:#4176e6; --dsw-alias-state-success-primary:#2ea121; --dsw-alias-state-error-primary:#d54941; }
  body { margin:0; padding:32px; background:#eef0f4; font:13px/1.5 -apple-system, "PingFang SC", system-ui, sans-serif; color:#1f2329; }
  .frame { background:#fff; border-radius:12px; padding:20px; margin:0 0 24px; max-width:720px; }
  .frame h2 { font-size:12px; text-transform:uppercase; letter-spacing:.06em; color:#8f959e; margin:0 0 14px; }
  .stage { border:1px dashed #d9dbe1; border-radius:8px; padding:12px; }
  ${css}
</style></head><body>${sections.join('\n')}</body></html>`;

fs.writeFileSync(out, page);
console.log(`wrote ${out} (${page.length} bytes)`);
