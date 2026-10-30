#!/usr/bin/env node
import { run } from '../lib/cli.mjs';

run(process.argv.slice(2)).then((code) => {
  process.exitCode = typeof code === 'number' ? code : 0;
}).catch((error) => {
  console.error(`dsh-plugin: ${error.message}`);
  if (process.env.DSH_PLUGIN_DEBUG === '1') console.error(error.stack);
  process.exitCode = 1;
});
