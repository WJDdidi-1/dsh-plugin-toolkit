/**
 * Scaffolding, so the first ten minutes are not spent discovering that the
 * market index rejects a plugin without `engines.dsh`.
 *
 * The template is embedded, not fetched: `init` has to work on a plane.
 */
import fs from 'node:fs';
import path from 'node:path';

const NPM_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;

export function checkName(name) {
  if (typeof name !== 'string' || NPM_NAME.test(name) === false) {
    return 'name must be a valid npm package name, e.g. my-plugin or @me/my-plugin';
  }
  return null;
}

function manifest({ name, title, version }) {
  return `${JSON.stringify(
    {
      name,
      version,
      description: `${title} — a panel for DeepSeek Harness`,
      license: 'MIT',
      type: 'module',
      engines: { node: '>=18', dsh: '>=0.2.0' },
      main: 'index.js',
      files: ['index.js', 'client.js', 'cordis.patch.yml', 'README.md'],
      scripts: { test: 'node --test', doctor: 'dsh-plugin doctor .' },
      devDependencies: {
        'dsh-plugin-toolkit': '^0.5.0',
        jsdom: '^26.1.0',
        react: '^18.3.1',
        'react-dom': '^18.3.1',
      },
      dsh: {
        bundle: { patch: './cordis.patch.yml' },
        client: {
          platform: 'web',
          immediately: true,
          inject: ['@deepseek-ai/dsh-client-ui-conversation'],
        },
      },
    },
    null,
    2,
  )}\n`;
}

function client({ name, title }) {
  return `window.__ModuleLoader__.load({
  id: '${name}',
  factory: (require) => {
    const React = require('react');
    const { useState } = React;
    const h = React.createElement;
    const NS = '${name}';
    const KIND = '${name}';

    const COPY = {
      en: { tabTitle: '${title}', title: '${title}', body: 'This panel came from dsh-plugin init.', clicks: 'Clicks' },
    };

    function Panel() {
      const [clicks, setClicks] = useState(0);
      return h(
        'div',
        { className: 'panel' },
        h('h1', { className: 'panel-title' }, COPY.en.title),
        h('p', { className: 'panel-body' }, COPY.en.body),
        h(
          'button',
          { type: 'button', className: 'panel-button', onClick: () => setClicks((value) => value + 1) },
          \`\${COPY.en.clicks}: \${clicks}\`,
        ),
      );
    }

    return {
      apply(ctx) {
        ctx.locale.register(NS, COPY);
        const dispose = ctx.inject(['sidebarRightTabs', 'sidebarRight'], (tabCtx) => {
          if (tabCtx.slots === undefined) return;
          const tr = tabCtx.locale.bind(NS);
          const offType = tabCtx.sidebarRightTabs.register({
            id: NS,
            kind: KIND,
            title: () => tr('tabTitle'),
            guide: [{ id: 'panel', order: 40, title: () => tr('title'), description: () => tr('body') }],
          });
          const offBody = tabCtx.slots.register({ name: 'sidebar.right.pane.tab', key: NS, locale: NS }, Panel);
          return () => {
            offBody?.();
            offType?.();
          };
        });
        return () => dispose?.();
      },
    };
  },
});
`;
}

function test({ name, title }) {
  return `import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { mountClient } from 'dsh-plugin-toolkit/testkit';

const here = path.dirname(fileURLToPath(import.meta.url));

test('the panel renders and its button counts', async () => {
  const panel = await mountClient({
    file: path.join(here, '..', 'client.js'),
    copy: { '${name}': { tabTitle: '${title}', title: '${title}', body: 'This panel came from dsh-plugin init.', clicks: 'Clicks' } },
  });
  assert.match(panel.text(), /${title}/);
  await panel.click('button');
  assert.match(panel.text(), /Clicks: 1/);
  await panel.unmount();
});
`;
}

export function files({ name, title = 'My panel', version = '0.1.0' }) {
  const slug = name.includes('/') ? name.split('/')[1] : name;
  return {
    'package.json': manifest({ name, title, version }),
    'cordis.patch.yml': `- insert:\n    - id: ${name}\n      name: '${name}'\n      config: {}\n`,
    'index.js': `export const name = '${name}';\n\n// The host half runs in Node. Most panels need nothing here.\nexport function apply() {}\n`,
    'client.js': client({ name, title }),
    'test/panel.test.mjs': test({ name, title }),
    'README.md': `# ${slug}\n\n${title} — a panel for DeepSeek Harness.\n\n## Requirements\n\n| What | Version | Why |\n| --- | --- | --- |\n| DeepSeek Harness | >= 0.2.0 | provides \`sidebarRightTabs\` |\n| Node | >= 18 | the host half |\n\n## Develop\n\n\`\`\`sh\nnpm install\nnpm test            # mounts client.js in Node\nnpm run doctor      # checks the manifest before you publish\n\`\`\`\n\n## Install\n\n\`\`\`sh\ndsh plugin add ${name}\n\`\`\`\n`,
    '.gitignore': 'node_modules/\n',
    '.github/workflows/ci.yml': `name: ci\n\non:\n  push:\n    branches: [main]\n  pull_request:\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    strategy:\n      matrix:\n        node: [18, 20, 22]\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: \${{ matrix.node }}\n      - run: npm install\n      - run: npm test\n      - run: npx --yes dsh-plugin-toolkit@0.5.0 doctor .\n`,
  };
}

export function init({ dir, name, title, force = false }) {
  const problem = checkName(name);
  if (problem !== null) return { ok: false, failures: [{ check: 'name', message: problem }] };

  const target = path.resolve(dir);
  if (fs.existsSync(target) === true) {
    const entries = fs.readdirSync(target).filter((entry) => entry !== '.git');
    if (entries.length > 0 && force !== true) {
      return {
        ok: false,
        failures: [
          {
            check: 'dir',
            message: `${target} is not empty (${entries.slice(0, 3).join(', ')}); pass --force to write into it anyway`,
          },
        ],
      };
    }
  }

  const written = [];
  for (const [relative, content] of Object.entries(files({ name, title }))) {
    const file = path.join(target, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    written.push(relative);
  }
  return { ok: true, dir: target, files: written.sort() };
}
