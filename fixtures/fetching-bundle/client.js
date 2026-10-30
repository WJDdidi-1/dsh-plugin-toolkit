window.__ModuleLoader__.load({
  id: 'fetching-bundle',
  factory: (require) => {
    const React = require('react');
    const { useEffect, useState } = React;
    const h = React.createElement;
    const NS = 'fetching';

    function Panel() {
      const [score, setScore] = useState('…');
      useEffect(() => {
        let alive = true;
        fetch('/demo/report')
          .then((response) => response.json())
          .then((body) => {
            if (alive === true) setScore(String(body.score));
          })
          .catch(() => {
            if (alive === true) setScore('failed');
          });
        return () => {
          alive = false;
        };
      }, []);
      return h('div', { className: 'fetching-panel' }, h('p', { 'data-testid': 'score' }, `Score ${score}`));
    }

    return {
      apply(ctx) {
        ctx.locale.register(NS, { title: 'Fetching' });
        ctx.slots.register({ name: 'sidebar.right.pane.tab', key: NS, locale: NS }, Panel);
      },
    };
  },
});
