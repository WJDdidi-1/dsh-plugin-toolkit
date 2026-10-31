window.__ModuleLoader__.load({
  id: 'dsh-plugin-toolkit',
  factory: (require) => {
    const module = { exports: {} };
    const React = require('react');
    const { useState, useCallback } = React;

    const NS = 'dsh-plugin-toolkit';
    const KIND = 'toolkit';

    const COPY = {
      en: {
        tabTitle: 'Plugin doctor',
        title: 'Does this plugin survive an install?',
        hint: 'The checks the market runs, on the folder you name.',
        placeholder: '/path/to/your-plugin',
        check: 'Check',
        checking: 'Checking…',
        pass: 'Everything the market checks passes.',
        fail: 'This would not install cleanly.',
        noDir: 'Name the folder that holds the plugin\'s package.json.',
        failed: 'Could not run the checks',
        guideDescription: 'Run the install checks on a plugin folder',
        dockTitle: 'Plugin doctor',
        dockSub: 'Will this plugin survive an install? Check a folder before you publish it.',
      },
      zh: {
        tabTitle: '插件体检',
        title: '这个插件装上去还能用吗？',
        hint: '市场会跑的检查，对着你填的文件夹跑一遍。',
        placeholder: '/path/to/your-plugin',
        check: '检查',
        checking: '检查中…',
        pass: '市场会检查的项都通过了。',
        fail: '这样装上去会出问题。',
        noDir: '请填写放着 package.json 的插件文件夹。',
        failed: '检查没能跑起来',
        guideDescription: '对任意插件文件夹跑一遍安装前的检查',
        dockTitle: '插件体检',
        dockSub: '这个插件装上去还能用吗？发布前先对着文件夹查一遍。',
      },
    };

    /**
     * The full guide, rendered in the dock. It is deliberately long: the panel
     * used to be a bare input with no explanation of what it was for, which is
     * the first question anyone asks.
     */
    const GUIDE = {
      en: {
        who: {
          title: 'Who this is for',
          body: 'People who write DSH plugins. It is not a daily tool — if you never publish a plugin, it has nothing for you.',
        },
        steps: {
          title: 'How to use it',
          items: [
            'Paste the folder that holds the plugin\'s package.json (a folder, not a file).',
            'Press Check. Nothing is installed and none of your files are touched.',
            'Read the list: ✓ passes, ✗ would break the install, with one line saying why.',
          ],
        },
        checks: {
          title: 'What it checks',
          rows: [
            ['manifest', 'name, version, engines.dsh'],
            ['root export', 'the package exports apply — the loader mounts nothing without it'],
            ['client declaration', 'dsh.client agrees with exports["./client"], which is what makes the host serve the panel'],
            ['files list', 'npm pack would actually ship every path package.json points at'],
            ['patch', 'cordis.patch.yml is exactly one - insert: row'],
            ['readme', 'the README has a Requirements section (the market index asks for it)'],
            ['tarball', 'the packed tarball installs and its root export imports'],
          ],
        },
        notes: {
          title: 'Before you trust it',
          items: [
            'Read-only: it does not install anything, write files, or make network calls beyond this one request.',
            'It looks at a folder, not at what you have installed — use dsh-plugin audit --host … for that.',
            'engines.dsh and README are market-index requirements; a plugin missing them still runs.',
            'It cannot prove runtime behaviour. A panel can still fail inside the real app when a service arrives late or a registration throws; those failures are appended to ~/.dsh/toolkit-client-report.ndjson.',
          ],
        },
        cli: {
          title: 'The same checks in a terminal',
          body: 'dsh-plugin verify .  ·  dsh-plugin doctor .  ·  dsh-plugin audit --host http://127.0.0.1:PORT',
        },
      },
      zh: {
        who: {
          title: '这是给谁用的',
          body: '写 DSH 插件的人。它不是日常工具——如果你不发布插件，它对你没有用处。',
        },
        steps: {
          title: '怎么用',
          items: [
            '粘贴放着 package.json 的那个文件夹（是文件夹，不是文件）。',
            '按「检查」。不会安装任何东西，也不会改你的文件。',
            '看列表：✓ 通过，✗ 是装上去会坏的地方，右边一行说明原因。',
          ],
        },
        checks: {
          title: '检查什么',
          rows: [
            ['manifest', 'name、version、engines.dsh'],
            ['root export', '包导出的东西里有没有 apply——没有它加载器什么都挂不上'],
            ['client declaration', 'dsh.client 与 exports["./client"] 是否一致，这决定宿主会不会加载面板'],
            ['files list', 'npm pack 是否真的会带上 package.json 指到的每个文件'],
            ['patch', 'cordis.patch.yml 是不是恰好一条 - insert:'],
            ['readme', 'README 有没有 Requirements 段（市场索引会看）'],
            ['tarball', '打包后的 tarball 能不能装上、根导出能不能 import'],
          ],
        },
        notes: {
          title: '用之前要知道的',
          items: [
            '只读：不安装、不写文件、除这一次请求外不联网。',
            '它看的是文件夹，不是你已装的插件——查已装的用 dsh-plugin audit --host …。',
            'engines.dsh 与 README 是市场索引的要求，缺了插件照样能跑。',
            '它证明不了运行期行为。面板在真实应用里仍可能因为服务来晚了、注册抛错而失败；那些失败会写进 ~/.dsh/toolkit-client-report.ndjson。',
          ],
        },
        cli: {
          title: '同样的检查，命令行里',
          body: 'dsh-plugin verify .  ·  dsh-plugin doctor .  ·  dsh-plugin audit --host http://127.0.0.1:PORT',
        },
      },
    };

    /**
     * The panel's copy, by the document language. Module scope because the tab
     * type's `title`/`description` are called by the sidebar's guide list, not
     * by this component, and they need the same strings.
     */
    const translate = (key) => {
      const lang = typeof document === 'undefined' ? 'en' : (document.documentElement.lang === 'zh' ? 'zh' : 'en');
      return COPY[lang][key] ?? key;
    };

    const h = React.createElement;

    const CSS = [
      '.tk-panel{padding:16px;display:flex;flex-direction:column;gap:10px;font-size:13px}',
      '.tk-title{margin:0;font-size:14px;font-weight:600}',
      '.tk-hint{margin:0;font-size:12px;color:var(--dsw-alias-label-tertiary,#888)}',
      '.tk-form{display:flex;gap:8px}',
      '.tk-input{flex:1;min-width:0;height:28px;padding:0 9px;font:inherit;font-size:12px;',
      'border:0.5px solid var(--dsw-alias-border-l2,#ccc);border-radius:6px;',
      'background:var(--dsw-alias-bg-layer-1,#fff);color:inherit}',
      '.tk-input:focus-visible{outline:1px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:-1px}',
      '.tk-button{height:28px;padding:0 12px;border-radius:6px;border:0;cursor:pointer;font:inherit;',
      'background:var(--dsw-alias-state-business-primary,#4176e6);color:#fff}',
      '.tk-button:disabled{opacity:.6;cursor:default}',
      '.tk-failed{margin:0;font-size:12px;color:var(--dsw-alias-state-error-primary,#c0392b)}',
      '.tk-verdict{margin:0;font-size:12px;font-weight:600}',
      '.tk-verdict[data-ok="true"]{color:var(--dsw-alias-state-success-primary,#2f855a)}',
      '.tk-verdict[data-ok="false"]{color:var(--dsw-alias-state-warn-primary,#b7791f)}',
      '.tk-rows{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}',
      '.tk-row{display:flex;gap:8px;align-items:baseline;padding:5px 8px;border-radius:6px;',
      'background:var(--dsw-alias-bg-layer-1,#fafafa)}',
      '.tk-mark{width:12px;flex:none;font-weight:600}',
      '.tk-row[data-ok="true"] .tk-mark{color:var(--dsw-alias-state-success-primary,#2f855a)}',
      '.tk-row[data-ok="false"] .tk-mark{color:var(--dsw-alias-state-error-primary,#c0392b)}',
      '.tk-body{display:flex;flex-direction:column;gap:1px;min-width:0}',
      '.tk-check{font-size:11px;text-transform:uppercase;letter-spacing:.04em;',
      'color:var(--dsw-alias-label-tertiary,#888)}',
      '.tk-message{font-size:12px;overflow-wrap:anywhere}',
      '.tk-dock{border-top:0.5px solid var(--dsw-alias-border-l2,#e5e5e5);margin:0 12px}',
      '.tk-dock-head{display:flex}',
      '.tk-dock-toggle{display:flex;align-items:center;gap:8px;width:100%;padding:7px 2px;',
      'border:0;background:none;font:inherit;font-size:12px;color:inherit;cursor:pointer;text-align:left}',
      '.tk-dock-toggle:focus-visible{outline:1px solid var(--dsw-alias-state-business-primary,#4176e6);',
      'outline-offset:-1px;border-radius:4px}',
      '.tk-dock-title{font-weight:600}',
      '.tk-dock-sub{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
      'color:var(--dsw-alias-label-tertiary,#888)}',
      '.tk-dock-chevron{flex:none;color:var(--dsw-alias-label-tertiary,#888)}',
      '.tk-dock-body{display:flex;flex-direction:column;gap:12px;padding:2px 2px 14px;',
      'max-height:46vh;overflow:auto;font-size:12px}',
      '.tk-guide{margin:0;display:flex;flex-direction:column;gap:5px}',
      '.tk-guide h3{margin:0;font-size:12px;font-weight:600}',
      '.tk-guide p{margin:0;color:var(--dsw-alias-label-secondary,#555)}',
      '.tk-guide ol,.tk-guide ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:3px;',
      'color:var(--dsw-alias-label-secondary,#555)}',
      '.tk-guide-rows{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;margin:0}',
      '.tk-guide-rows dt{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;',
      'color:var(--dsw-alias-label-primary,#222)}',
      '.tk-guide-rows dd{margin:0;color:var(--dsw-alias-label-secondary,#555)}',
      '.tk-guide code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}',
    ].join('');

    function injectStyles(document) {
      if (document.getElementById('dsh-plugin-toolkit:styles') !== null) return;
      const style = document.createElement('style');
      style.id = 'dsh-plugin-toolkit:styles';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    function Row({ entry }) {
      return h(
        'li',
        { className: 'tk-row', 'data-ok': entry.ok === true ? 'true' : 'false' },
        h('span', { className: 'tk-mark', 'aria-hidden': 'true' }, entry.ok === true ? '✓' : '✗'),
        h('span', { className: 'tk-body' },
          h('span', { className: 'tk-check' }, entry.check),
          h('span', { className: 'tk-message' }, entry.message)),
      );
    }

    /**
     * The check itself, shared by the dock and the sidebar tab so the two can
     * never drift apart.
     */
    function useChecker() {
      const [dir, setDir] = useState('');
      const [result, setResult] = useState(null);
      const [busy, setBusy] = useState(false);
      const [failed, setFailed] = useState(null);

      const check = useCallback(() => {
        if (dir.trim().length === 0) {
          setFailed(translate('noDir'));
          return;
        }
        setBusy(true);
        setFailed(null);
        fetch(`/toolkit/check?dir=${encodeURIComponent(dir.trim())}`)
          .then((response) => (response.ok === true ? response.json() : Promise.reject(new Error(String(response.status)))))
          .then((payload) => setResult(payload))
          .catch((error) => setFailed(`${translate('failed')} · ${error.message}`))
          .finally(() => setBusy(false));
      }, [dir]);

      return { dir, setDir, result, busy, failed, check };
    }

    function Form({ checker }) {
      return h('div', { className: 'tk-form' },
        h('input', {
          className: 'tk-input',
          type: 'text',
          value: checker.dir,
          placeholder: translate('placeholder'),
          'aria-label': translate('placeholder'),
          onChange: (event) => checker.setDir(event.target.value),
          onKeyDown: (event) => { if (event.key === 'Enter') checker.check(); },
        }),
        h('button', {
          className: 'tk-button',
          type: 'button',
          disabled: checker.busy === true,
          onClick: checker.check,
        }, checker.busy === true ? translate('checking') : translate('check')));
    }

    function Result({ checker }) {
      return h('div', { className: 'tk-result' },
        checker.failed !== null ? h('p', { className: 'tk-failed', role: 'status' }, checker.failed) : null,
        checker.result !== null
          ? h('div', { className: 'tk-result-body' },
            h('p', { className: 'tk-verdict', 'data-ok': checker.result.ok === true ? 'true' : 'false', role: 'status' },
              checker.result.ok === true ? translate('pass') : translate('fail')),
            h('ul', { className: 'tk-rows' }, checker.result.checks.map((entry) => h(Row, { key: entry.check, entry }))))
          : null);
    }

    function Panel() {
      const checker = useChecker();
      return h('div', { className: 'tk-panel' },
        h('h2', { className: 'tk-title' }, translate('title')),
        h('p', { className: 'tk-hint' }, translate('hint')),
        h(Form, { checker }),
        h(Result, { checker }));
    }

    /**
     * The same checker, docked under the conversation where people actually
     * look. Collapsed it is one row; opened it carries the whole guide, because
     * "what is this for" is the question the sidebar tab never answered.
     */
    function Dock() {
      const [open, setOpen] = useState(false);
      const checker = useChecker();
      const guide = GUIDE[typeof document === 'undefined' || document.documentElement.lang !== 'zh' ? 'en' : 'zh'];

      return h('section', { className: 'tk-dock', 'data-open': open === true ? 'true' : 'false' },
        h('div', { className: 'tk-dock-head' },
          h('button', {
            className: 'tk-dock-toggle',
            type: 'button',
            'aria-expanded': open === true ? 'true' : 'false',
            onClick: () => setOpen(open !== true),
          },
            h('span', { className: 'tk-dock-title' }, translate('dockTitle')),
            h('span', { className: 'tk-dock-sub' }, translate('dockSub')),
            h('span', { className: 'tk-dock-chevron', 'aria-hidden': 'true' }, open === true ? '▾' : '▸'))),
        open === true
          ? h('div', { className: 'tk-dock-body' },
            h('div', { className: 'tk-guide' },
              h('h3', {}, guide.who.title),
              h('p', {}, guide.who.body)),
            h('div', { className: 'tk-guide' },
              h('h3', {}, guide.steps.title),
              h('ol', {}, guide.steps.items.map((item) => h('li', { key: item }, item)))),
            h('div', { className: 'tk-guide' },
              h('h3', {}, guide.checks.title),
              h('dl', { className: 'tk-guide-rows' },
                guide.checks.rows.map(([name, what]) => [
                  h('dt', { key: `${name}-k` }, name),
                  h('dd', { key: `${name}-v` }, what),
                ]))),
            h('div', { className: 'tk-guide' },
              h('h3', {}, guide.notes.title),
              h('ul', {}, guide.notes.items.map((item) => h('li', { key: item }, item)))),
            h('div', { className: 'tk-guide' },
              h('h3', {}, guide.cli.title),
              h('p', {}, h('code', {}, guide.cli.body))),
            h(Form, { checker }),
            h(Result, { checker }))
          : null);
    }

    function describe(error) {
      if (error === undefined || error === null) return 'unknown';
      const text = error.stack !== undefined ? String(error.stack) : String(error.message !== undefined ? error.message : error);
      return text.split('\n').slice(0, 3).join(' | ');
    }

    /**
     * The panel's own crash reporter. When the row fails to activate the app
     * shows one red dot and no text, and the bundle has no console anyone can
     * read, so it posts what happened and the host appends it to
     * `~/.dsh/toolkit-client-report.ndjson`.
     */
    function report(stage, detail) {
      try {
        if (typeof fetch !== 'function') return;
        const body = JSON.stringify({
          stage,
          message: describe(detail),
          services: ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight'],
        });
        fetch('/toolkit/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }).catch(() => {});
      } catch {
        // Reporting is best effort; it never changes the outcome.
      }
    }

    function apply(ctx) {
      // A panel that cannot find its services must degrade, not fail the boot:
      // an exception here fails the whole web boot and takes every other plugin
      // down with it. Every service below is optional for that reason.
      const has = (name) => {
        try {
          return ctx[name] !== undefined && ctx[name] !== null;
        } catch {
          return false;
        }
      };
      report('apply', `services slots=${String(has('slots'))} locale=${String(has('locale'))} inject=${typeof ctx.inject}`);
      try {
        injectStyles(typeof document === 'undefined' ? undefined : document);
      } catch (error) {
        // No document: the styles are cosmetic.
        report('styles', error);
      }
      try {
        if (ctx.locale !== undefined && typeof ctx.locale.register === 'function') ctx.locale.register(NS, COPY);
      } catch (error) {
        // The panel keeps its English strings.
        report('locale', error);
      }
      try {
        if (typeof ctx.inject !== 'function') {
          report('no-inject', 'ctx.inject is not a function');
          return;
        }
        ctx.inject(['slots', 'sidebarRightTabs', 'sidebarRight'], (tabCtx) => {
          // Failures inside this callback happen after apply() returned, so the
          // guards above do not cover them — this try/catch is the one that
          // decides whether the row lands in "failed".
          try {
            // The dock lives under the conversation and needs nothing but
            // `slots`, so it is registered before the sidebar is required.
            if (tabCtx !== undefined && tabCtx.slots !== undefined) {
              tabCtx.effect(() => tabCtx.slots.inject('conversation.input.dock', () => tabCtx.slots.register({
                name: 'conversation.input.dock',
                id: NS,
                order: 30,
                locale: NS,
              }, Dock)));
            }
            if (tabCtx === undefined || tabCtx.slots === undefined || tabCtx.sidebarRightTabs === undefined) {
              report('no-sidebar', `tabCtx slots=${String(tabCtx !== undefined && tabCtx.slots !== undefined)} sidebarRightTabs=${String(tabCtx !== undefined && tabCtx.sidebarRightTabs !== undefined)}`);
              return;
            }
            tabCtx.effect(() => tabCtx.slots.inject('sidebar.right.pane.tab', () => tabCtx.slots.register({
              name: 'sidebar.right.pane.tab',
              key: NS,
              locale: NS,
            }, Panel)));
            // A tab *type* with no guide entry is registered but unreachable:
            // the sidebar's guide list is built from `tabs.guide()`, so the
            // type would never be offered and nothing would open it.
            tabCtx.effect(() => tabCtx.sidebarRightTabs.register({
              id: NS,
              kind: KIND,
              priority: 'extension',
              title: () => translate('tabTitle'),
              guide: [{
                id: 'doctor',
                order: 60,
                title: () => translate('tabTitle'),
                description: () => translate('guideDescription'),
              }],
            }));
            report('tab-registered', `kind=${KIND}`);
          } catch (error) {
            report('tab-failed', error);
          }
        });
      } catch (error) {
        // No sidebar: the plugin still loads, it just has no place to show.
        report('inject', error);
      }
    }

    // The services the tab body reads. Declaring them lets the loader wait for
    // them instead of calling apply() before they exist.
    module.exports = { inject: ['slots', 'locale'], apply };
    return module.exports;
  },
});
