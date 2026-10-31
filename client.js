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
      },
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

    function Panel() {
      const [dir, setDir] = useState('');
      const [result, setResult] = useState(null);
      const [busy, setBusy] = useState(false);
      const [failed, setFailed] = useState(null);
      const tr = (key) => {
        const language = COPY[document.documentElement.lang === 'zh' ? 'zh' : 'en'];
        return language[key] ?? key;
      };

      const check = useCallback(() => {
        if (dir.trim().length === 0) {
          setFailed(tr('noDir'));
          return;
        }
        setBusy(true);
        setFailed(null);
        fetch(`/toolkit/check?dir=${encodeURIComponent(dir.trim())}`)
          .then((response) => (response.ok === true ? response.json() : Promise.reject(new Error(String(response.status)))))
          .then((payload) => setResult(payload))
          .catch((error) => setFailed(`${tr('failed')} · ${error.message}`))
          .finally(() => setBusy(false));
      }, [dir]);

      return h('div', { className: 'tk-panel' },
        h('h2', { className: 'tk-title' }, tr('title')),
        h('p', { className: 'tk-hint' }, tr('hint')),
        h('div', { className: 'tk-form' },
          h('input', {
            className: 'tk-input',
            type: 'text',
            value: dir,
            placeholder: tr('placeholder'),
            'aria-label': tr('placeholder'),
            onChange: (event) => setDir(event.target.value),
            onKeyDown: (event) => { if (event.key === 'Enter') check(); },
          }),
          h('button', {
            className: 'tk-button',
            type: 'button',
            disabled: busy === true,
            onClick: check,
          }, busy === true ? tr('checking') : tr('check'))),
        failed !== null ? h('p', { className: 'tk-failed', role: 'status' }, failed) : null,
        result !== null
          ? h('div', { className: 'tk-result' },
            h('p', { className: 'tk-verdict', 'data-ok': result.ok === true ? 'true' : 'false', role: 'status' },
              result.ok === true ? tr('pass') : tr('fail')),
            h('ul', { className: 'tk-rows' }, result.checks.map((entry) => h(Row, { key: entry.check, entry }))))
          : null);
    }

    function apply(ctx) {
      injectStyles(document);
      ctx.locale.register(NS, COPY);
      ctx.inject(['sidebarRightTabs', 'sidebarRight'], (tabCtx) => {
        if (tabCtx.slots === undefined || tabCtx.sidebarRightTabs === undefined) return;
        tabCtx.effect(() => tabCtx.slots.inject('sidebar.right.pane.tab', () => tabCtx.slots.register({
          name: 'sidebar.right.pane.tab',
          key: NS,
          locale: NS,
        }, Panel)));
        tabCtx.effect(() => tabCtx.sidebarRightTabs.register({
          id: NS,
          kind: KIND,
          priority: 'extension',
          title: () => 'Plugin doctor',
        }));
      });
    }

    module.exports = { apply, name: 'dsh-plugin-toolkit' };
    return module.exports;
  },
});
