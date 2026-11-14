#!/usr/bin/env node
// Run steps against a running phone harness and print the results.
//
//   node tools/phone/step.js --port 9411 --step "tap #t-new ;; wait 300 ;; shot C:/x.png ;; ui"
//   node tools/phone/step.js --port 9411 --steps-file steps.txt     (one step per line, # comments)
'use strict';
const fs = require('fs');
const { parseArgs, request } = require('./common');

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const port = +args.port;
  let steps = [];
  if (typeof args.step === 'string') steps.push(...args.step.split(/\s+;;\s+/));
  if (typeof args['steps-file'] === 'string') {
    steps.push(...fs.readFileSync(args['steps-file'], 'utf8').split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#')));
  }
  steps = steps.map(s => s.trim()).filter(Boolean);
  if (!port || !steps.length) { console.error('Usage: step.js --port <n> --step "a ;; b" | --steps-file <path>'); process.exit(2); }
  let r;
  try { r = await request(port, 'POST', '/steps', { steps }); }
  catch (e) { console.error(`No harness on port ${port} (${e.message}). Start one with start.js.`); process.exit(1); }
  if (!r.json) { console.error(r.text); process.exit(1); }
  for (const s of r.json.results) {
    console.log(`> ${s.step}`);
    if (s.out) console.log(s.out);
    if (s.error) console.log(`!! ERROR: ${s.error}`);
  }
  process.exit(r.json.results.some(s => s.error) ? 1 : 0);
}
main();
