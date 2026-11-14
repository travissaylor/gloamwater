// Focused economy diagnosis. Input files remain the source of every reported number.
'use strict';
const fs = require('fs');
const path = require('path');
const file = process.argv[2] || path.join(__dirname, 'results/round3-changed.json');
const out = process.argv[3] || file.replace(/\.json$/, '-summary.md');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const pct = x => (100 * x).toFixed(1) + '%';
const cash = x => (x < 0 ? '−' : '') + '¤' + Math.round(Math.abs(x)).toLocaleString('en-US');
const valid = rows => rows.filter(r => !r.error);
const mean = xs => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const sum = xs => xs.reduce((a, b) => a + b, 0);
const lines = [
  '# Focused economy simulation', '',
  `Game SHA-256: \`${data.meta.gameSha}\`. ${data.meta.runs} seeds per policy.`,
  'This diagnostic sample is not proof across all seeds.', '',
  '| Policy | Median fortune | Mean fortune | Mean hold tier | Sunk |',
  '|---|---:|---:|---:|---:|',
];
for (const s of Object.values(data.summary)) lines.push(`| ${s.policy} | ${cash(s.median)} | ${cash(s.mean)} | ${s.stats.holdTier.toFixed(2)} | ${pct(s.sinkRate)} |`);
const inf = valid(data.runs.informed || []);
const bySeed = new Map(inf.map(r => [r.seed, r]));
if (data.meta.set && data.meta.set.freightLicense) {
  lines.push('', 'Experimental freight license only: shipped game source was not changed.', '',
    '| Policy | Tier 3 | Tier 4 | Tier 5 | Mean charters | Median run N30/N18 |', '|---|---:|---:|---:|---:|---:|');
  for (const [name, rows] of Object.entries(data.runs)) {
    const rs = valid(rows), s = data.summary[name];
    const shares = [3, 4, 5].map(t => pct(rs.filter(r => r.stats.holdTier === t).length / rs.length));
    lines.push(`| ${name} | ${shares.join(' | ')} | ${s.charters.perRun.toFixed(2)} | ${s.shape.medianRunRatio30over18.toFixed(2)}× |`);
  }
  for (const [name, rows] of Object.entries(data.runs)) {
    const rs = valid(rows), ts = rs.flatMap(r => r.trades || []).filter(t => t.kind === 'sell' && t.day >= 18);
    const total = sum(ts.map(t => t.total)), mix = {};
    for (const t of ts) mix[t.g] = (mix[t.g] || 0) + t.total;
    lines.push('', `${name} late revenue shares: ${Object.entries(mix).sort((a, b) => b[1] - a[1]).map(([g, n]) => g + ' ' + pct(n / total)).join(', ')}.`);
  }
}
const ws = data.summary['whisper-spam'];
if (ws) {
  const paired = valid(data.runs['whisper-spam']).filter(r => bySeed.has(r.seed));
  const higher = paired.filter(r => r.net > bySeed.get(r.seed).net).length;
  lines.push('', `Whisper spam beats informed on ${higher}/${paired.length} paired seeds (${pct(higher / paired.length)}). ${pct(ws.whispers.lostShare)} of ${ws.whispers.acted} acted whispers lose money, including the fee.`);
}
const smart = data.summary['whisper-smart'];
if (smart) {
  lines.push('', `Careful whisper use: ${smart.whispers.bought} bought, ${smart.whispers.acted} acted on; mean attributed whisper profit per run ${cash(smart.whispers.pnlPerRun)} including fees. Whole-run paired mean difference versus informed ${cash(smart.vsInformed.meanDiff)}, median difference ${cash(smart.vsInformed.medianDiff)}; higher on ${pct(smart.vsInformed.higherShare)} of seeds. Attributed whisper profit does not allocate every shared patch or bribe cost. Whole-run comparisons include actual costs and also reflect changed routes and decisions.`);
}
const rt = data.summary.roundtrip && data.summary.roundtrip.roundtrip;
if (rt) lines.push('', `Round trips: ${rt.tests.toLocaleString('en-US')} probes; ${rt.positive} profitable; best cash change ${cash(rt.maxGain)}.`);
const sales = inf.flatMap(r => r.trades || []).filter(t => t.kind === 'sell' && t.day >= 18);
const gross = sum(sales.map(t => t.total));
if (sales.length) {
  const mix = {};
  for (const t of sales) mix[t.g] = (mix[t.g] || 0) + t.total;
  lines.push('', 'Late-game gross sale proceeds, nights 18–30. These are revenue shares, not profit shares.', '', '| Good | Share |', '|---|---:|');
  for (const [g, total] of Object.entries(mix).sort((a, b) => b[1] - a[1])) lines.push(`| ${g} | ${pct(total / gross)} |`);
}
const hops = inf.flatMap(r => r.routeLog || []).filter(t => t.day >= 18);
if (hops.length) {
  const routes = {};
  for (const t of hops) {
    const key = t.from === t.to ? t.from + ' stay' : [t.from, t.to].sort().join(' ↔ ');
    routes[key] = (routes[key] || 0) + 1;
  }
  lines.push('', 'Late-game route shares, nights 18–29.', '', '| Route | Share |', '|---|---:|');
  for (const [route, n] of Object.entries(routes).sort((a, b) => b[1] - a[1])) lines.push(`| ${route} | ${pct(n / hops.length)} |`);
}
lines.push('', `Informed charters: ${pct(data.summary.informed.charters.anyShare)} buy at least one, ${data.summary.informed.charters.perRun.toFixed(2)} per run.`,
  `Informed N30/N18: ratio of medians ${data.summary.informed.shape.ratio30over18OfMedians.toFixed(2)}×; median per-run ratio ${data.summary.informed.shape.medianRunRatio30over18.toFixed(2)}×.`,
  `Informed hold tiers 3–5: ${inf.filter(r => r.stats.holdTier >= 3).length}/${inf.length} runs.`,
  `Reported page errors: ${data.meta.pageErrors.length}. Runs with reported errors: ${Object.values(data.runs).flat().filter(r => r.error || (r.errors && r.errors.length)).length}.`,
  `Non-finite final net scores: ${Object.values(data.runs).flat().filter(r => !r.error && !Number.isFinite(r.net)).length}.`,
  `RNG seed mismatches: ${data.meta.repro.rng0Mismatch}; night-30 market mismatches: ${data.meta.repro.mktMismatch}.`, '');
if (data.meta.workerResponseShas) lines.push(`Worker response-body SHA matches: ${data.meta.workerResponseShas.filter(x => x === data.meta.gameSha).length}/${data.meta.workerResponseShas.length}.`,
  `Numerical invariant checks across all runs: ${sum(Object.values(data.runs).flat().map(r => r.stats && r.stats.numericChecks || 0))}.`, '');
if (inf.some(r => Object.keys(r.events || {}).some(k => /^(gull|leak):/.test(k)))) {
  lines.push('New event decisions, actual counts over all runs per policy.', '', '| Policy | Gull chase | Gull pay | Leak patch | Leak jettison |', '|---|---:|---:|---:|---:|');
  for (const [name, rows] of Object.entries(data.runs)) lines.push(`| ${name} | ${['gull:run','gull:pay','leak:pay','leak:yield'].map(k => sum(rows.map(r => r.events && r.events[k] || 0))).join(' | ')} |`);
  lines.push('');
}
fs.writeFileSync(out, lines.join('\n'));
console.log(lines.join('\n'));
