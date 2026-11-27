window.__ModuleLoader__.load({
  id: 'click-fetch-bundle',
  factory: (require) => {
    const React = require('react');
    const { useState } = React;
    const h = React.createElement;
    const NS = 'click-fetch';

    function Panel() {
      const [answer, setAnswer] = useState('idle');
      const ask = () => {
        fetch('/demo/answer')
          .then((response) => response.json())
          .then((body) => setAnswer(String(body.answer)))
          .catch(() => setAnswer('failed'));
      };
      return h(
        'div',
        null,
        h('button', { 'data-testid': 'ask', onClick: ask }, 'ask'),
        h('p', { 'data-testid': 'answer' }, `Answer ${answer}`),
      );
    }

    return {
      apply(ctx) {
        ctx.locale.register(NS, { title: 'Click fetch' });
        ctx.slots.register({ name: 'sidebar.right.pane.tab', key: NS, locale: NS }, Panel);
      },
    };
  },
});
