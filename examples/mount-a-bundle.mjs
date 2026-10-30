/**
 * The shortest useful thing testkit does: mount a real client bundle and read
 * what a user would see.
 *
 * Run: node examples/mount-a-bundle.mjs
 */
import { mountClient } from 'dsh-plugin-toolkit/testkit';

const panel = await mountClient({ file: 'fixtures/client-bundle/client.js', copy: { demo: { title: 'Demo' } } });

console.log(panel.text());

await panel.click('[data-testid="inc"]');
console.log(panel.text());

await panel.unmount();
