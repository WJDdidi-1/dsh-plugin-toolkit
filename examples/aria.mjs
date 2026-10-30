/**
 * What assistive tech sees, asserted the same way the rest of the panel is.
 *
 * Run: node examples/aria.mjs
 */
import { mountClient } from 'dsh-plugin-toolkit/testkit';

const panel = await mountClient({ file: 'fixtures/client-bundle/client.js', copy: { demo: { title: 'Demo' } } });

const live = panel.must('[aria-live="polite"]');
console.log(`live region: ${live.getAttribute('aria-live')} -> "${live.textContent}"`);

const button = panel.must('[aria-label]');
console.log(`labelled control: ${button.getAttribute('aria-label')}`);

await panel.unmount();
