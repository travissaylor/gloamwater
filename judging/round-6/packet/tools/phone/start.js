#!/usr/bin/env node
// Start a long-lived phone browser (Playwright WebKit by default) that listens on 127.0.0.1:<port>.
// It detaches itself and returns once the browser is ready, so it works from any shell.
//
//   node tools/phone/start.js --port 9411 --device "iPhone 13" --url file:///C:/.../index.html
//   node tools/phone/start.js --port 9412 --size 360x640 --url ...
//   node tools/phone/start.js --port 9413 --device "Pixel 7" --browser chromium --url ...
//   --foreground   serve in this process instead of detaching (Ctrl+C to stop)
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { parseArgs, tmp, request } = require('./common');

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const port = +args.port;
  if (!port) { console.error('Usage: start.js --port <n> [--device "iPhone 13" | --size WxH] [--browser webkit|chromium] [--url <url>]'); process.exit(2); }

  // Stop anything already on this port.
  try { await request(port, 'POST', '/stop', {}, 3000); await new Promise(r => setTimeout(r, 600)); } catch (e) { /* nothing running */ }

  const serverArgs = [path.join(__dirname, 'server.js'), ...process.argv.slice(2).filter(a => a !== '--foreground')];
  if (args.foreground) {
    require('./server.js');
    return;
  }
  const logFile = tmp(port, 'log');
  const fd = fs.openSync(logFile, 'w');
  const child = spawn(process.execPath, serverArgs, { detached: true, stdio: ['ignore', fd, fd], windowsHide: true });
  child.unref();

  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    await new Promise(r => setTimeout(r, 250));
    try {
      const r = await request(port, 'GET', '/ping', undefined, 2000);
      if (r.json && r.json.ready) {
        console.log(`Phone harness up on port ${port}: ${r.json.summary}`);
        if (r.json.navResult) console.log(r.json.navResult);
        return;
      }
    } catch (e) { /* not up yet */ }
    if (child.exitCode !== null) break;
  }
  console.error(`Harness did not come up on port ${port}. Log: ${logFile}`);
  try { console.error(fs.readFileSync(logFile, 'utf8').slice(-3000)); } catch (e) {}
  process.exit(1);
}
main().catch(e => { console.error(e.stack || String(e)); process.exit(1); });
