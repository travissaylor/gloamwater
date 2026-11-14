// Shared helpers for the phone harness: argument parsing, paths, and the HTTP client.
'use strict';
const http = require('http');
const os = require('os');
const path = require('path');

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[k] = true;
      else { out[k] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

const tmp = (port, ext) => path.join(os.tmpdir(), `phone-harness-${port}.${ext}`);

function request(port, method, route, body, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = http.request({
      host: '127.0.0.1', port, method, path: route, timeout: timeoutMs,
      headers: data ? { 'content-type': 'application/json', 'content-length': data.length } : {},
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const txt = Buffer.concat(chunks).toString('utf8');
        try { resolve({ status: res.statusCode, json: JSON.parse(txt) }); } catch (e) { resolve({ status: res.statusCode, text: txt }); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('request timed out')));
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

module.exports = { parseArgs, tmp, request };
