/**
 * What assistive tech sees, asserted the same way the rest of the panel is.
 *
 * Run: node examples/aria.mjs
 */
import { mountClient } from 'dsh-plugin-toolkit/testkit';

const panel = await mountClient({ file: 'fixtures/client-bundle/client.js', copy: { demo: { title: 'Demo' } } });

// expectAria names the attribute that differs, so a failure reads like a bug
// report instead of "expected true to equal false".
const live = panel.expectAria('[aria-live="polite"]', { live: 'polite', text: '0' });
console.log(`live region: ${live.live} -> "${live.text}"`);

const button = panel.expectAria('[aria-label]', { label: 'increment' });
console.log(`labelled control: ${button.label}`);

await panel.unmount();
