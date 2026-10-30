/**
 * A DOM baseline: normalised markup in a file, compared on every run.
 *
 * Run: node examples/baseline.mjs
 * First run writes nothing; re-run with UPDATE_SNAPSHOTS=1 to create the file.
 */
import { expectSnapshot, mountClient } from 'dsh-plugin-toolkit/testkit';

const panel = await mountClient({ file: 'fixtures/client-bundle/client.js', copy: { demo: { title: 'Demo' } } });

const result = expectSnapshot(panel.html(), 'fixtures/client-bundle/__snapshots__', 'panel');
console.log(`baseline: ${result.status}`);

await panel.unmount();
