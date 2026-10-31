window.__ModuleLoader__.load({
  id: 'dsh-plugin-toolkit',
  factory: (require) => {
    const module = { exports: {} };
    const React = require('react');
    const { useState, useCallback, useEffect, useRef } = React;

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
        counts: (failed, total) => `${failed} of ${total} checks failed`,
        passedLabel: (n) => `${n} passed`,
        empty: 'A folder path, owner/repo, or a GitHub link. A bare name searches GitHub.',
        guideTitle: 'How to use this',
        checkingNow: 'Checking…',
        candidates: (n) => `${n} repositories match`,
        chipFail: (n) => `${n} failed`,
        chipPass: 'passes',
        checked: 'Checked',
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
        counts: (failed, total) => `${total} 项里 ${failed} 项没过`,
        passedLabel: (n) => `${n} 项通过`,
        empty: '填文件夹路径、owner/repo 或 GitHub 链接；只写名字会去 GitHub 搜。',
        guideTitle: '使用说明',
        checkingNow: '正在检查…',
        candidates: (n) => `找到 ${n} 个仓库`,
        chipFail: (n) => `${n} 项没过`,
        chipPass: '通过',
        checked: '检查的是',
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
            'Paste a folder, or type owner/repo or a GitHub link. A bare name searches GitHub and lists what it found.',
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
            'It never installs or edits your project. A local folder is read only; a GitHub repository is downloaded once as a tarball and checked in a temp folder.',
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
            '填本地文件夹，或 owner/repo、GitHub 链接；只写名字会去 GitHub 搜，列出候选让你挑。',
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
            '不安装、不改你的项目。查本地文件夹时只读；查 GitHub 仓库时会下载一次 tarball，在临时目录里检查。',
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
    const translate = (key, lang = readLang()) => {
      return (COPY[lang] ?? COPY.en)[key] ?? key;
    };

    /**
     * The panel's language is the user's choice, not the host's: the app may be
     * in English while the person reading it is not. Chinese is the default,
     * because that is the audience this plugin is written for, and the choice is
     * remembered per browser.
     */
    const LANG_KEY = 'dsh-plugin-toolkit:lang';
    const LANGUAGES = ['zh', 'en'];
    const langListeners = new Set();
    let langCache = null;

    function readLang() {
      if (langCache !== null) return langCache;
      try {
        const stored = window.localStorage.getItem(LANG_KEY);
        if (LANGUAGES.includes(stored)) {
          langCache = stored;
          return langCache;
        }
      } catch {
        // No storage (private mode, a sandboxed frame): fall through to the default.
      }
      langCache = 'zh';
      return langCache;
    }

    function setLang(next) {
      if (!LANGUAGES.includes(next)) return;
      langCache = next;
      try {
        window.localStorage.setItem(LANG_KEY, next);
      } catch {
        // Remembering the choice is a convenience, never a requirement.
      }
      for (const listener of langListeners) listener();
    }

    function useLang() {
      const [lang, set] = useState(readLang);
      useEffect(() => {
        const listener = () => set(readLang());
        langListeners.add(listener);
        return () => langListeners.delete(listener);
      }, []);
      return lang;
    }

    function LangSwitch({ lang }) {
      return h('span', { className: 'tk-lang', role: 'group', 'aria-label': 'Language' },
        LANGUAGES.map((code) => h('button', {
          key: code,
          type: 'button',
          className: 'tk-lang-button',
          'data-on': code === lang ? 'true' : 'false',
          'aria-pressed': code === lang ? 'true' : 'false',
          onClick: (event) => {
            // The dock sits inside the composer: a click here must not reach
            // the conversation's own handlers.
            event.stopPropagation();
            setLang(code);
          },
        }, code === 'zh' ? '中文' : 'EN')));
    }

    const h = React.createElement;

    const CSS = [
      '.tk-panel{padding:16px;display:flex;flex-direction:column;gap:10px;font-size:13px}',
      '.tk-title{margin:0;flex:1;min-width:0;font-size:14px;font-weight:600}',
      '.tk-hint{margin:0;font-size:12px;color:var(--dsw-alias-label-tertiary,#888)}',
      '.tk-form{display:flex;gap:8px}',
      '.tk-input{flex:1;min-width:0;height:28px;padding:0 9px;font:inherit;font-size:12px;',
      'border:0.5px solid var(--dsw-alias-border-l2,#ccc);border-radius:6px;',
      'background:var(--dsw-alias-bg-layer-1,#fff);color:inherit}',
      '.tk-input:hover{border-color:var(--dsw-alias-border-l3,#c9ccd1)}',
      '.tk-input:focus-visible{outline:1px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:-1px}',
      '.tk-button{height:28px;padding:0 12px;border-radius:6px;border:0;cursor:pointer;font:inherit;',
      'background:var(--dsw-alias-state-business-primary,#4176e6);color:#fff}',
      '.tk-button:hover{filter:brightness(1.06)}',
      '.tk-button:disabled{opacity:.6;cursor:default;filter:none}',
      '.tk-button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:2px}',
      '.tk-chip{flex:none;font-size:11px;font-weight:600;padding:1px 7px;border-radius:999px;',
      'font-variant-numeric:tabular-nums}',
      '.tk-chip[data-ok="true"]{color:var(--dsw-alias-state-success-primary,#2f855a);',
      'background:var(--dsw-alias-state-success-bg,#eef8ee)}',
      '.tk-chip[data-ok="false"]{color:var(--dsw-alias-state-error-primary,#c0392b);',
      'background:var(--dsw-alias-state-error-bg,#fdf3f2)}',
      '.tk-failed{margin:0;font-size:12px;color:var(--dsw-alias-state-error-primary,#c0392b)}',
      '.tk-empty{margin:0;font-size:12px;color:var(--dsw-alias-label-tertiary,#888)}',
      '.tk-passes{margin:0}',
      '.tk-passes summary{cursor:pointer;font-size:11px;color:var(--dsw-alias-label-tertiary,#888);',
      'padding:2px 0;list-style:none}',
      '.tk-passes summary::-webkit-details-marker{display:none}',
      '.tk-passes summary::before{content:"▸ ";font-size:10px}',
      '.tk-passes[open] summary::before{content:"▾ "}',
      '.tk-passes .tk-rows{margin-top:4px}',
      '.tk-summary{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}',
      '.tk-count{font-size:11px;color:var(--dsw-alias-label-tertiary,#888);font-variant-numeric:tabular-nums}',
      '.tk-candidates{display:flex;flex-direction:column;gap:6px}',
      '.tk-candidate-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}',
      '.tk-candidate{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px;width:100%;text-align:left;',
      'padding:7px 9px;border:0.5px solid var(--dsw-alias-border-l1,#e5e6eb);border-radius:6px;',
      'background:var(--dsw-alias-bg-body,#fff);font:inherit;cursor:pointer;transition:border-color .12s ease,background .12s ease}',
      '.tk-candidate:hover{border-color:var(--dsw-alias-state-business-primary,#4176e6);',
      'background:var(--dsw-alias-bg-layer-1,#fafbfc)}',
      '.tk-candidate:focus-visible{outline:1px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:1px}',
      '.tk-candidate:hover{border-color:var(--dsw-alias-state-business-primary,#4176e6)}',
      '.tk-candidate-name{font-size:12px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis}',
      '.tk-candidate-owner{font-weight:400;color:var(--dsw-alias-label-tertiary,#888)}',
      '.tk-candidate-go{margin-left:auto;font-size:12px;color:var(--dsw-alias-label-tertiary,#888)}',
      '.tk-candidate:hover .tk-candidate-go{color:var(--dsw-alias-state-business-primary,#4176e6)}',
      '.tk-candidate-stars{font-size:11px;color:var(--dsw-alias-label-tertiary,#888)}',
      '.tk-candidate-desc{flex-basis:100%;font-size:11px;color:var(--dsw-alias-label-secondary,#555);',
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.tk-repo{margin:0;font-size:12px}',
      '.tk-repo a{color:var(--dsw-alias-state-business-primary,#4176e6);text-decoration:none}',
      '.tk-repo a:hover{text-decoration:underline}',
      '.tk-checked{margin:0;font-size:11px;color:var(--dsw-alias-label-tertiary,#888);overflow-wrap:anywhere}',
      '.tk-checked code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}',
      '.tk-verdict{margin:0;font-size:12px;font-weight:600}',
      '.tk-verdict[data-ok="true"]{color:var(--dsw-alias-state-success-primary,#2f855a)}',
      '.tk-verdict[data-ok="false"]{color:var(--dsw-alias-state-warn-primary,#b7791f)}',
      '.tk-rows{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}',
      '.tk-row{display:flex;gap:8px;align-items:baseline;padding:6px 8px;border-radius:6px;}',
      '.tk-rows .tk-row + .tk-row{margin-top:3px}',
      '.tk-row[data-ok="false"]{background:var(--dsw-alias-state-error-bg,#fdf3f2);',
      'box-shadow:inset 2px 0 0 var(--dsw-alias-state-error-primary,#c0392b)}',
      '.tk-row[data-ok="true"] .tk-message{color:var(--dsw-alias-label-secondary,#555)}',
      '.tk-mark{width:12px;flex:none;font-weight:600}',
      '.tk-row[data-ok="true"] .tk-mark{color:var(--dsw-alias-state-success-primary,#2f855a)}',
      '.tk-row[data-ok="false"] .tk-mark{color:var(--dsw-alias-state-error-primary,#c0392b)}',
      '.tk-body{display:flex;flex-direction:column;gap:1px;min-width:0}',
      '.tk-check{font-size:11px;text-transform:uppercase;letter-spacing:.04em;',
      'color:var(--dsw-alias-label-tertiary,#888)}',
      '.tk-message{font-size:12px;overflow-wrap:anywhere}',
      '.tk-panel-head{display:flex;align-items:center;gap:8px}',
      '.tk-lang{display:inline-flex;flex:none;gap:2px;padding:2px;border-radius:7px;',
      'background:var(--dsw-alias-bg-layer-1,#f2f3f5)}',
      '.tk-lang-button{height:20px;min-width:34px;padding:0 8px;border:0;border-radius:5px;background:none;',
      'font:inherit;font-size:11px;line-height:20px;color:var(--dsw-alias-label-secondary,#555);cursor:pointer;',
      'transition:background .12s ease,color .12s ease}',
      '.tk-lang-button[data-on="true"]{background:var(--dsw-alias-state-business-primary,#4176e6);color:#fff;',
      'box-shadow:0 0 0 0.5px var(--dsw-alias-state-business-primary,#4176e6)}',
      '.tk-lang-button[data-on="false"]:hover{color:var(--dsw-alias-label-primary,#1f2329)}',
      '.tk-lang-button:focus-visible{outline:1px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:-1px}',
      '.tk-dock{border-top:0.5px solid var(--dsw-alias-border-l2,#e5e5e5);margin:0 12px}',
      '.tk-dock-head{display:flex}',
      '.tk-dock-toggle{display:flex;align-items:center;gap:8px;flex:1;min-width:0;padding:7px 2px;',
      'border:0;background:none;font:inherit;font-size:12px;color:inherit;cursor:pointer;text-align:left}',
      '.tk-dock-toggle:focus-visible{outline:1px solid var(--dsw-alias-state-business-primary,#4176e6);',
      'outline-offset:-1px;border-radius:4px}',
      '.tk-dock-title{font-weight:600}',
      '.tk-dock-sub{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
      'color:var(--dsw-alias-label-tertiary,#888)}',
      '.tk-dock-chevron{flex:none;width:6px;height:6px;margin:0 2px 0 0;border-right:1.5px solid currentColor;',
      'border-bottom:1.5px solid currentColor;transform:rotate(-45deg);color:var(--dsw-alias-label-tertiary,#888);',
      'transition:transform .15s ease}',
      '.tk-dock-chevron[data-open="true"]{transform:rotate(45deg);margin-bottom:3px}',
      '.tk-summary:focus-visible{outline:1px solid var(--dsw-alias-state-business-primary,#4176e6);',
      'outline-offset:2px;border-radius:4px}',
      '.tk-dock-body{display:flex;flex-direction:column;gap:10px;max-width:76ch;padding:2px 2px 14px;',
      'max-height:60vh;overflow:auto;font-size:12px}',
      '.tk-guide-all{margin-top:2px;padding-top:12px;border-top:0.5px solid var(--dsw-alias-border-l1,#ececec)}',
      '.tk-guide-all[open]{display:flex;flex-direction:column;gap:14px}',
      '.tk-guide-summary{cursor:pointer;font-size:11px;font-weight:600;list-style:none;',
      'color:var(--dsw-alias-label-secondary,#555);padding:2px 0}',
      '.tk-guide-summary::-webkit-details-marker{display:none}',
      '.tk-guide-summary::before{content:"▸ ";font-size:11px;color:var(--dsw-alias-label-tertiary,#888)}',
      '.tk-guide-all[open] .tk-guide-summary::before{content:"▾ ";}',
      '.tk-guide{margin:0;display:flex;flex-direction:column;gap:4px}',
      '.tk-guide h3{margin:0;font-size:12px;font-weight:600;',
      'color:var(--dsw-alias-label-primary,#1f2329)}',
      '.tk-guide p{margin:0;color:var(--dsw-alias-label-secondary,#555)}',
      '.tk-guide ol,.tk-guide ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:3px;',
      'color:var(--dsw-alias-label-secondary,#555)}',
      '.tk-guide-rows{display:grid;grid-template-columns:132px 1fr;gap:4px 12px;margin:0}',
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

      const check = useCallback((explicit) => {
        // A candidate button checks a name that is not in the input yet, so the
        // target can be passed in instead of read from state.
        const target = typeof explicit === 'string' ? explicit : dir;
        if (target.trim().length === 0) {
          setFailed(translate('noDir'));
          return;
        }
        setBusy(true);
        setFailed(null);
        fetch(`/toolkit/check?dir=${encodeURIComponent(target.trim())}`)
          .then((response) => (response.ok === true ? response.json() : Promise.reject(new Error(String(response.status)))))
          .then((payload) => setResult(payload))
          .catch((error) => setFailed(`${translate('failed')} · ${error.message}`))
          .finally(() => setBusy(false));
      }, [dir]);

      return { dir, setDir, result, busy, failed, check };
    }

    function Form({ checker }) {
      const lang = useLang();
      const tr = (key) => translate(key, lang);
      return h('div', { className: 'tk-form' },
        h('input', {
          className: 'tk-input',
          type: 'text',
          value: checker.dir,
          placeholder: tr('placeholder'),
          'aria-label': tr('placeholder'),
          onChange: (event) => checker.setDir(event.target.value),
          onKeyDown: (event) => { if (event.key === 'Enter') checker.check(); },
        }),
        h('button', {
          className: 'tk-button',
          type: 'button',
          disabled: checker.busy === true,
          onClick: checker.check,
        }, checker.busy === true ? tr('checking') : tr('check')));
    }

    function Result({ checker }) {
      const lang = useLang();
      const tr = (key) => translate(key, lang);
      return h('div', { className: 'tk-result', 'aria-busy': checker.busy === true ? 'true' : 'false' },
        checker.failed !== null ? h('p', { className: 'tk-failed', role: 'status' }, checker.failed) : null,
        checker.failed === null && checker.result === null && checker.busy !== true
          ? h('p', { className: 'tk-empty' }, tr('empty'))
          : null,
        checker.result !== null
          ? h(ResultBody, { result: checker.result, tr, lang, checker })
          : null);
    }

    function Candidates({ result, tr, lang, checker }) {
      return h('div', { className: 'tk-candidates' },
        h('p', { className: 'tk-empty' }, COPY[lang].candidates(result.candidates.length)),
        h('ul', { className: 'tk-candidate-list' }, result.candidates.map((item) => h('li', { key: item.fullName },
          h('button', {
            className: 'tk-candidate',
            type: 'button',
            onClick: () => {
              // Picking a candidate is the same request, with a name the host
              // can resolve without searching again.
              checker.setDir(item.fullName);
              checker.check(item.fullName);
            },
          },
            h('span', { className: 'tk-candidate-name' },
              h('span', { className: 'tk-candidate-owner' }, `${item.fullName.split('/')[0]}/`),
              item.fullName.split('/')[1]),
            item.stars > 0 ? h('span', { className: 'tk-candidate-stars' }, `★ ${item.stars}`) : null,
            h('span', { className: 'tk-candidate-go', 'aria-hidden': 'true' }, '→'),
            item.description !== '' ? h('span', { className: 'tk-candidate-desc' }, item.description) : null)))));
    }

    function ResultBody({ result, tr, lang, checker }) {
      const summary = useRef(null);
      // After a check the answer is the thing to read; leaving focus in the
      // input means a screen reader announces nothing.
      useEffect(() => {
        summary.current?.focus();
      }, [result]);
      const checks = result.checks ?? [];
      const failed = checks.filter((entry) => entry.ok !== true);
      const passed = checks.filter((entry) => entry.ok === true);
      // Failures first: a list that opens with six green lines buries the two
      // that matter below the fold of a docked panel.
      const ordered = [...failed, ...passed];
      if (result.kind === 'candidates') {
        return h(Candidates, { result, tr, lang, checker });
      }
      return h('div', { className: 'tk-result-body' },
        h('div', { className: 'tk-summary', ref: summary, tabIndex: -1,
          'data-ok': result.ok === true ? 'true' : 'false', role: 'status' },
          h('span', { className: 'tk-verdict' },
            result.ok === true ? tr('pass') : tr('fail')),
          failed.length > 0
            ? h('span', { className: 'tk-count' }, COPY[lang].counts(failed.length, checks.length))
            : null),
        result.repo !== undefined
          ? h('p', { className: 'tk-repo' },
            h('a', { href: result.repo.url, target: '_blank', rel: 'noreferrer noopener' }, result.repo.fullName))
          : null,
        // A repository's temp folder is an implementation detail; a local path is
        // the thing the person typed, so that one stays.
        result.repo === undefined && typeof result.dir === 'string' && result.dir !== ''
          ? h('p', { className: 'tk-checked' },
            h('span', {}, `${tr('checked')} `),
            h('code', {}, result.dir))
          : null,
        h('ul', { className: 'tk-rows' }, failed.map((entry) => h(Row, { key: entry.check, entry }))),
        passed.length > 0
          ? h('details', { className: 'tk-passes', open: failed.length === 0 ? true : undefined },
            h('summary', {}, COPY[lang].passedLabel(passed.length)),
            h('ul', { className: 'tk-rows' }, passed.map((entry) => h(Row, { key: entry.check, entry }))))
          : null);
    }

    function Panel() {
      const checker = useChecker();
      const lang = useLang();
      const tr = (key) => translate(key, lang);
      return h('div', { className: 'tk-panel' },
        h('div', { className: 'tk-panel-head' },
          h('h2', { className: 'tk-title' }, tr('title')),
          h(LangSwitch, { lang })),
        h('p', { className: 'tk-hint' }, tr('hint')),
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
      const lang = useLang();
      const guide = GUIDE[lang] ?? GUIDE.zh;

      return h('section', {
        className: 'tk-dock',
        'data-open': open === true ? 'true' : 'false',
        // Escape closes it wherever the focus is inside: a docked panel that
        // traps the keyboard is worse than one that is hard to find.
        onKeyDown: (event) => {
          if (event.key === 'Escape' && open === true) setOpen(false);
        },
      },
        h('div', { className: 'tk-dock-head' },
          // The language switch is a sibling of the toggle, never inside it: a
          // button inside a button is invalid and React drops the inner one.
          h('button', {
            className: 'tk-dock-toggle',
            type: 'button',
            'aria-expanded': open === true ? 'true' : 'false',
            'aria-controls': 'dsh-toolkit-dock-body',
            onClick: () => setOpen(open !== true),
          },
            h('span', { className: 'tk-dock-title' }, translate('dockTitle', lang)),
            h('span', { className: 'tk-dock-sub' }, translate('dockSub', lang)),
            h('span', { className: 'tk-dock-chevron', 'data-open': open === true ? 'true' : 'false', 'aria-hidden': 'true' })),
          open !== true && checker.result !== null
            ? h('span', {
              className: 'tk-chip',
              'data-ok': checker.result.ok === true ? 'true' : 'false',
            }, checker.result.ok === true
              ? COPY[lang].chipPass
              : COPY[lang].chipFail((checker.result.checks ?? []).filter((entry) => entry.ok !== true).length))
            : null,
          h(LangSwitch, { lang })),
        open === true
          ? h('div', { className: 'tk-dock-body', id: 'dsh-toolkit-dock-body' },
            // The input comes first: the guide is reference material, and making
            // people scroll past a wall of prose to reach the one control they
            // came for is how a docked panel stops being used.
            h(Form, { checker }),
            h(Result, { checker }),
            h('details', { className: 'tk-guide-all', open: true },
              h('summary', { className: 'tk-guide-summary' }, translate('guideTitle', lang)),
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
                h('p', {}, h('code', {}, guide.cli.body)))))
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
