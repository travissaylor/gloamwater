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
// default suggestion: Canal Runner ~p3, Lantern Broker ~p20, Tide Baron ~p40 (so the informed
// median lands in Tide Baron), Harbor Magnate ~p80, Sovereign ~p95 (top rank about 5%)
else sugg = [-Infinity, 0, niceRound(q(inf, 0.03)), niceRound(q(inf, 0.20)), niceRound(q(inf, 0.40)), niceRound(q(inf, 0.80)), niceRound(q(inf, 0.95))];
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
  const HOW = { one: 'acted by a one-night hop', two: 'acted by a two-night trip', stay: 'acted by staying the night' };
  W.byHow = {};
  for (const h of Object.keys(HOW)) { const a = acted.filter(w => w.how === h); W.byHow[h] = st(a); if (a.length) row(HOW[h], W.byHow[h]); }
  W.table = rows.join('\n');
  out.whispers[p] = W;
}

// ---- named pairs
out.pairs = {};
if (runs['scum'] && runs['scum-control']) out.pairs['scum vs scum-control'] = paired('scum', 'scum-control');
if (runs['whisper-spam'] && runs['informed']) out.pairs['whisper-spam vs informed'] = paired('whisper-spam', 'informed');
if (runs['whisper-smart'] && runs['informed']) out.pairs['whisper-smart vs informed'] = paired('whisper-smart', 'informed');
for (const p of P) if (p !== 'informed' && runs.informed && !out.pairs[p + ' vs informed']) out.pairs[p + ' vs informed'] = paired(p, 'informed');
const namedPair = (a, b) => { if (runs[a] && runs[b]) out.pairs[a + ' vs ' + b] = paired(a, b); };
namedPair('charter-rush', 'informed-nocharter');
namedPair('borrow-smart', 'borrow-max');
namedPair('fight-farm', 'fight');
namedPair('stay-whisper', 'whisper-smart');
{
  const rows = ['| pair | seeds | first higher | ties | median diff | mean diff | p25 diff | p75 diff |', '|---|---:|---:|---:|---:|---:|---:|---:|'];
  for (const [k, v] of Object.entries(out.pairs)) rows.push(`| ${k} | ${v.n} | ${pct(v.higher)} | ${pct(v.ties)} | ${fmtN(v.median)} | ${fmtN(v.mean)} | ${fmtN(v.p25)} | ${fmtN(v.p75)} |`);
  out.pairTable = rows.join('\n');
}

// ---- encounters, by option (adapter.js records one line per encounter)
out.encounters = {};
const encRow = (label, a, runsN) => {
  const ex = a.filter(e => e.expectCost != null);
  return `| ${label} | ${a.length} | ${(a.length / runsN).toFixed(2)} | ${fmtN(mean(a.map(e => e.cost)))} | ${fmtN(median(a.map(e => e.cost)))} | ${fmtN(mean(a.map(e => -e.cash)))} | ${mean(a.map(e => -e.hull)).toFixed(1)} | ${fmtN(mean(a.map(e => e.cargoLost)))} | ${fmtN(mean(a.map(e => e.debt)))} | ${pct(a.filter(e => e.end === 'sunk').length / (a.length || 1))} | ${ex.length ? fmtN(mean(ex.map(e => e.expectCost))) : ''} |`;
};
for (const p of P) {
  const rs = ok(p), E = rs.flatMap(r => r.enc || []);
  if (!E.length) continue;
  const rows = [`| ${p}: encounters | n | per run | mean cost | median cost | purse lost | hull lost | cargo lost | off debt | sunk | solver's expected cost |`, '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|'];
  for (const kind of ['patrol', 'gulls', 'collectors']) {
    const K = E.filter(e => e.kind === kind); if (!K.length) continue;
    rows.push(encRow(`**${kind}**`, K, rs.length));
    for (const f of [...new Set(K.map(e => e.first))].sort()) rows.push(encRow(`${kind}, first choice ${f}`, K.filter(e => e.first === f), rs.length));
    for (const f of [...new Set(K.map(e => e.end))].sort()) rows.push(encRow(`${kind}, ended: ${f}`, K.filter(e => e.end === f), rs.length));
  }
  rows.push(encRow('**all**', E, rs.length));
  out.encounters[p] = { table: rows.join('\n'), perRun: E.length / rs.length, meanCost: mean(E.map(e => e.cost)), costPerRun: E.reduce((a, e) => a + e.cost, 0) / rs.length, purseBefore: { p50: q(E.map(e => e.cashBefore), .5), p90: q(E.map(e => e.cashBefore), .9) }, sunkShare: E.filter(e => e.end === 'sunk').length / E.length };
}
{
  const rows = ['| policy | encounters/run | cost per encounter | encounter cost per run | purse at sea p50 / p90 | encounters that sank | runs sunk | won/run | weapon tier at end |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|'];
  for (const p of P) {
    const e = out.encounters[p]; if (!e) continue; const rs = ok(p);
    rows.push(`| ${p} | ${e.perRun.toFixed(2)} | ${fmtN(e.meanCost)} | ${fmtN(e.costPerRun)} | ${fmtN(e.purseBefore.p50)} / ${fmtN(e.purseBefore.p90)} | ${pct(e.sunkShare)} | ${pct(rs.filter(r => r.sunk).length / rs.length)} | ${mean(rs.map(r => r.stats.won)).toFixed(2)} | ${mean(rs.map(r => r.stats.arms)).toFixed(2)} |`);
  }
  out.encounterSummary = rows.join('\n');
}

// ---- routes, stays, charters, vault, debt
{
  const rows = ['| policy | one-night hops | two-night trips | carried on | nights on two-night trips | stays | charters/run | runs with a charter | first charter night | charter spend | vault interest | interest paid | debt at end |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|'];
  out.routes = {};
  const f1 = x => (isNaN(x) ? '-' : x.toFixed(1)), f2 = x => (isNaN(x) ? '-' : x.toFixed(2));
  for (const p of P) {
    const rs = ok(p), rt = rs.map(r => (r.out && r.out.route) || null).filter(Boolean), ch = rs.map(r => r.charters || []);
    const R = k => (rt.length ? mean(rt.map(x => x[k] || 0)) : NaN);
    const o = { one: R('one'), twoFirst: R('twoFirst'), twoOn: R('twoOn'), stays: mean(rs.map(r => r.stays || 0)), charters: mean(ch.map(c => c.length)), anyCharter: ch.filter(c => c.length).length / rs.length, firstCharter: mean(ch.filter(c => c.length).map(c => c[0].day)), charterSpend: mean(ch.map(c => c.reduce((a, x) => a + x.cost, 0))), byDistrict: {} };
    o.twoNights = o.twoOn * 2 + (o.twoFirst - o.twoOn); // a trip carried on spans two nights; one abandoned at the waypoint, one
    for (const c of ch.flat()) o.byDistrict[c.d] = (o.byDistrict[c.d] || 0) + 1;
    out.routes[p] = o;
    rows.push(`| ${p} | ${f1(o.one)} | ${f2(o.twoFirst)} | ${f2(o.twoOn)} | ${f2(o.twoNights)} | ${o.stays.toFixed(2)} | ${o.charters.toFixed(2)} | ${pct(o.anyCharter)} | ${f1(o.firstCharter)} | ${fmtN(o.charterSpend)} | ${fmtN(mean(rs.map(r => r.stats.vaultEarned)))} | ${fmtN(mean(rs.map(r => r.stats.interest)))} | ${fmtN(mean(rs.map(r => r.debtEnd || 0)))} |`);
  }
  out.routeTable = rows.join('\n');
}

const o = opt('--out');
if (o) fs.writeFileSync(o, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ policies: out.policies, shape: out.shape, ranks: { suggested: sugg }, pairs: out.pairs, informedQuantiles: out.informedQuantiles }, null, 1));
console.log('\n' + out.fortuneTable + '\n\n' + out.shapeTable + '\n\n' + out.rankTableCurrent + '\n\n' + out.rankTableSuggested);
console.log('\n' + out.pairTable + '\n\n' + out.encounterSummary + '\n\n' + out.routeTable);
for (const p of (opt('--enc') || 'informed').split(',')) if (out.encounters[p]) console.log('\n' + out.encounters[p].table);
for (const [p, W] of Object.entries(out.whispers)) console.log(`\n${p}: bought ${W.bought} (${W.perRun.toFixed(2)}/run), actionable ${W.actionable}, fees ${fmtN(W.feesPerRun)}/run\n${W.table}`);
