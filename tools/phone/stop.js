#!/usr/bin/env node
// Stop the phone harness on a port:  node tools/phone/stop.js --port 9411
'use strict';
const fs = require('fs');
const { parseArgs, tmp, request } = require('./common');

async function main() {
  const port = +parseArgs(process.argv.slice(2)).port;
  if (!port) { console.error('Usage: stop.js --port <n>'); process.exit(2); }
  try {
    await request(port, 'POST', '/stop', {}, 5000);
    console.log(`Stopped phone harness on port ${port}.`);
  } catch (e) {
    // Fall back to the pid file if the server is wedged.
    try {
      const pid = +fs.readFileSync(tmp(port, 'pid'), 'utf8');
      process.kill(pid);
      console.log(`Killed phone harness pid ${pid} on port ${port}.`);
    } catch (e2) { console.log(`Nothing running on port ${port}.`); }
  }
  try { fs.unlinkSync(tmp(port, 'pid')); } catch (e) {}
}
main();
