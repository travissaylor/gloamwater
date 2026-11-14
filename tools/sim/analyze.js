#!/usr/bin/env node
// Post-processing for sim.js output: acceptance test, economy shape, rank thresholds, paired
// comparisons. Usage: node analyze.js results.json [--ranks 0,20000,...] [--out summary.json]
'use strict';
const fs = require('fs');

const args = process.argv.slice(2);
const file = args[0];
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const J = JSON.parse(fs.readFileSync(file, 'utf8'));
const runs = J.runs, meta = J.meta;

const sorted = a => [...a].sort((x, y) => x - y);
const q = (a, p) => { const s = sorted(a); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
const median = a => q(a, 0.5);
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
function fmtN(n) {
  if (n == null || isNaN(n)) return '-';
  const a = Math.abs(n), s = n < 0 ? '−' : '';
  if (a >= 1e6) return s + '¤' + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e4) return s + '¤' + (a / 1e3).toFixed(1) + 'k';
  return s + '¤' + Math.round(a).toLocaleString('en-US');
}
const pct = x => (100 * x).toFixed(1) + '%';
const ok = p => (runs[p] || []).filter(r => !r.error);
const nets = p => ok(p).map(r => r.net);

function paired(a, b) {
  const by = new Map(ok(b).map(r => [r.seed, r.net]));
  const d = ok(a).filter(r => by.has(r.seed)).map(r => r.net - by.get(r.seed));
  return { n: d.length, higher: d.filter(x => x > 0).length / (d.length || 1), ties: d.filter(x => x === 0).length / (d.length || 1), median: median(d), mean: mean(d), p25: q(d, 0.25), p75: q(d, 0.75) };
}

const out = { file, game: meta.game, sha: meta.gameSha, set: meta.set, opts: meta.opts };
const lines = [];
const P = Object.keys(runs);

// ---- final fortune and vs informed
lines.push('| policy | p10 | p25 | median | p75 | p90 | sunk | beats informed | median paired diff | mean paired diff |');
lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
out.policies = {};
for (const p of P) {
  const n = nets(p);
  const pr = p !== 'informed' && runs.informed ? paired(p, 'informed') : null;
  out.policies[p] = { p10: q(n, .1), p25: q(n, .25), median: q(n, .5), p75: q(n, .75), p90: q(n, .9), sunk: ok(p).filter(r => r.sunk).length / ok(p).length, vsInformed: pr };
  lines.push(`| ${p} | ${fmtN(q(n, .1))} | ${fmtN(q(n, .25))} | ${fmtN(q(n, .5))} | ${fmtN(q(n, .75))} | ${fmtN(q(n, .9))} | ${pct(out.policies[p].sunk)} | ${pr ? pct(pr.higher) : ''} | ${pr ? fmtN(pr.median) : ''} | ${pr ? fmtN(pr.mean) : ''} |`);
}
out.fortuneTable = lines.join('\n');

// ---- shape (informed and others)
const CK = meta.checkpoints;
const shapeRows = ['| policy | ' + CK.map(d => 'n' + d).join(' | ') + ' | n30/n18 | largest sale (max / median run) |', '|---|' + CK.map(() => '---:').join('|') + '|---:|---:|'];
out.shape = {};
for (const p of P) {
  const rs = ok(p);
  const med = CK.map((d, i) => median(rs.map(r => r.worth[i])));
  const ratio = med[CK.indexOf(30)] / med[CK.indexOf(18)];
  const sales = rs.map(r => r.stats.maxSale || 0);
  out.shape[p] = { medianWorth: Object.fromEntries(CK.map((d, i) => [d, med[i]])), ratio30over18: ratio, maxSale: Math.max(...sales), medianMaxSale: median(sales), p90MaxSale: q(sales, 0.9) };
  shapeRows.push(`| ${p} | ${med.map(fmtN).join(' | ')} | ${ratio.toFixed(2)}× | ${fmtN(Math.max(...sales))} / ${fmtN(median(sales))} |`);
}
out.shapeTable = shapeRows.join('\n');

// ---- ranks
const names = meta.ranks, curMins = meta.rankMins.map(x => (x === null ? -Infinity : x));
const rankDist = (n, mins) => { const c = new Array(mins.length).fill(0); for (const v of n) { let k = 0; for (let i = 0; i < mins.length; i++) if (v >= mins[i]) k = i; c[k]++; } return c.map(x => x / (n.length || 1)); };
function niceRound(x) {
  if (x <= 0) return 0;
  const e = Math.pow(10, Math.floor(Math.log10(x)));
  const steps = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 10];
  let best = e; for (const s of steps) if (Math.abs(s * e - x) < Math.abs(best - x)) best = s * e;
  return best;
}
const inf = nets('informed');
let sugg;
if (opt('--ranks')) sugg = [-Infinity, ...opt('--ranks').split(',').map(Number)];
else sugg = [-Infinity, 0, niceRound(q(inf, 0.03)), niceRound(q(inf, 0.25)), niceRound(q(inf, 0.70)), niceRound(q(inf, 0.88)), niceRound(q(inf, 0.95))];
out.ranks = { names, current: curMins, suggested: sugg, dist: {} };
const rk = (title, mins) => {
  const rows = [`| policy | ${names.map((n, i) => `${n} (${i === 0 ? '<' + fmtN(mins[1]) : fmtN(mins[i]) + '+'})`).join(' | ')} |`, '|---|' + names.map(() => '---:').join('|') + '|'];
  for (const p of P) { const d = rankDist(nets(p), mins); rows.push(`| ${p} | ${d.map(pct).join(' | ')} |`); (out.ranks.dist[title] = out.ranks.dist[title] || {})[p] = d; }
  return rows.join('\n');
};
out.rankTableCurrent = rk('current', curMins);
out.rankTableSuggested = rk('suggested', sugg);
out.informedQuantiles = Object.fromEntries([.03, .05, .1, .25, .3, .5, .7, .75, .88, .9, .95, .99].map(p => [p, q(inf, p)]));

// ---- whispers
out.whispers = {};
for (const p of P) {
  const rs = ok(p).filter(r => r.out && r.out.whispers);
  if (!rs.length) continue;
  const all = rs.flatMap(r => r.out.whispers), acted = all.filter(w => w.acted);
  const st = a => ({ n: a.length, lost: a.filter(w => w.pnl < 0).length / (a.length || 1), lostNight: a.filter(w => w.pnlNight < 0).length / (a.length || 1), mean: mean(a.map(w => w.pnl)), median: median(a.map(w => w.pnl)), meanNight: mean(a.map(w => w.pnlNight)), medianNight: median(a.map(w => w.pnlNight)) });
  const W = { bought: all.length, perRun: all.length / rs.length, actionable: all.filter(w => w.actionable).length, all: st(acted), byConf: {}, byType: {}, byConfType: {}, byLanded: {}, feesPerRun: mean(rs.map(r => r.out.whispers.reduce((a, w) => a + w.fee, 0))) };
  for (const c of ['sure', 'likely', 'guess']) W.byConf[c] = Object.assign(st(acted.filter(w => w.conf === c)), { bought: all.filter(w => w.conf === c).length });
  for (const t of ['spike', 'crash']) W.byType[t] = st(acted.filter(w => w.type === t));
  for (const c of ['sure', 'likely', 'guess']) for (const t of ['spike', 'crash']) W.byConfType[c + ' ' + t] = st(acted.filter(w => w.conf === c && w.type === t));
  for (const k of ['full', 'weak', 'turn']) W.byLanded[k] = st(acted.filter(w => w.landed === k));
  const rows = ['| acted whispers | n | lost money (fee in) | mean P&L | median P&L | lost, night charged | median, night charged |', '|---|---:|---:|---:|---:|---:|---:|'];
  const row = (k, s) => rows.push(`| ${k} | ${s.n} | ${pct(s.lost)} | ${fmtN(s.mean)} | ${fmtN(s.median)} | ${pct(s.lostNight)} | ${fmtN(s.medianNight)} |`);
  row('**all**', W.all);
  for (const c of ['sure', 'likely', 'guess']) row(c, W.byConf[c]);
  for (const t of ['spike', 'crash']) row(t, W.byType[t]);
  for (const k of ['full', 'weak', 'turn']) row('landed ' + k, W.byLanded[k]);
  W.table = rows.join('\n');
  out.whispers[p] = W;
}

// ---- named pairs
out.pairs = {};
if (runs['scum'] && runs['scum-control']) out.pairs['scum vs scum-control'] = paired('scum', 'scum-control');
if (runs['whisper-spam'] && runs['informed']) out.pairs['whisper-spam vs informed'] = paired('whisper-spam', 'informed');
if (runs['whisper-smart'] && runs['informed']) out.pairs['whisper-smart vs informed'] = paired('whisper-smart', 'informed');

const o = opt('--out');
if (o) fs.writeFileSync(o, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ policies: out.policies, shape: out.shape, ranks: { suggested: sugg }, pairs: out.pairs, informedQuantiles: out.informedQuantiles }, null, 1));
console.log('\n' + out.fortuneTable + '\n\n' + out.shapeTable + '\n\n' + out.rankTableCurrent + '\n\n' + out.rankTableSuggested);
for (const [p, W] of Object.entries(out.whispers)) console.log(`\n${p}: bought ${W.bought} (${W.perRun.toFixed(2)}/run), actionable ${W.actionable}, fees ${fmtN(W.feesPerRun)}/run\n${W.table}`);
