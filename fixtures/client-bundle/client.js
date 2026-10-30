window.__ModuleLoader__.load({
  id: 'demo-bundle',
  factory: (require) => {
    const React = require('react');
    const { useState } = React;
    const h = React.createElement;
    const NS = 'demo';

    function Panel() {
      const [count, setCount] = useState(0);
      return h(
        'div',
        { className: 'demo-panel' },
        h('h1', { className: 'demo-title' }, 'Demo panel'),
        h(
          'button',
          { type: 'button', 'aria-label': 'increment', 'data-testid': 'inc', onClick: () => setCount((value) => value + 1) },
          `Count ${count}`,
        ),
        h('p', { className: 'demo-result', 'aria-live': 'polite' }, String(count)),
      );
    }

    return {
      apply(ctx) {
        ctx.locale.register(NS, { title: 'Demo' });
        ctx.slots.register({ name: 'sidebar.right.pane.tab', key: NS, locale: NS }, Panel);
      },
    };
  },
});
