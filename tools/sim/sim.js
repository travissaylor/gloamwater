#!/usr/bin/env node
// Gloamwater economy simulator. Loads the game into headless Chromium and plays full 30-night
// runs with the game's own code (real sailTo voyages, encounters, events, interest).
// Usage: node sim.js [--game ../../game/index.html] [--policies a,b] [--runs 400] [--seed 1]
//                    [--workers N] [--out results.json] [--opt key=value ...] [--quiet]
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const HERE = __dirname;
const POLICY_DIR = path.join(HERE, 'policies');

// ------------------------------------------------------------------ args
function parseArgs(argv) {
  const a = { game: path.join(HERE, '..', '..', 'game', 'index.html'), runs: 400, seed: 1, workers: Math.max(1, Math.min(8, os.cpus().length - 2)), out: null, policies: null, opts: {}, set: {}, quiet: false, label: '' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = () => argv[++i];
    if (k === '--game') a.game = path.resolve(v());
    else if (k === '--runs' || k === '-n') a.runs = +v();
    else if (k === '--seed') a.seed = +v();
    else if (k === '--seeds') a.seedList = v().split(',').map(Number);
    else if (k === '--workers' || k === '-j') a.workers = +v();
    else if (k === '--out') a.out = path.resolve(v());
    else if (k === '--policies' || k === '-p') a.policies = v().split(',').map(s => s.trim()).filter(Boolean);
    else if (k === '--opt') { const [kk, vv] = v().split('='); a.opts[kk] = isNaN(+vv) ? vv : +vv; }
    else if (k === '--set') { // game data mutations for sweeps: depthScale=0.6, conf.sure=.8/.15/.05, spike=2/3.5, holdScale=.5
      const [kk, vv] = v().split('=');
      const val = vv.includes('/') ? vv.split('/').map(Number) : (isNaN(+vv) ? vv : +vv);
      const ks = kk.split('.'); let o = a.set;
      for (let j = 0; j < ks.length - 1; j++) o = o[ks[j]] = o[ks[j]] || {};
      o[ks[ks.length - 1]] = val;
    }
    else if (k === '--label') a.label = v();
    else if (k === '--quiet' || k === '-q') a.quiet = true;
    else if (k === '--help' || k === '-h') { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 6).join('\n')); process.exit(0); }
    else { console.error('unknown argument ' + k); process.exit(2); }
  }
  return a;
}

// ------------------------------------------------------------------ in-page RNG (installed before the game script)
const RNG_INIT = `(() => {
  function xmur3(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19;}return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return(h^=h>>>16)>>>0;};}
  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  const names=['world','market','visual','policy'];
  const streams={};let cur='world';
  let base='0';
  function seed(s){base=String(s);for(const n of names)streams[n]=mulberry32(xmur3(base+':'+n)());cur='world';}
  function reseed(n,key){streams[n]=mulberry32(xmur3(base+':'+n+':'+key)());}
  seed(0);
  Math.random=function(){return streams[cur]();};
  window.__rng={seed,reseed,using(n,fn){const p=cur;cur=n;try{return fn();}finally{cur=p;}},stream:n=>streams[n]};
})();`;

// ------------------------------------------------------------------ helpers
const wrap = (src, name) => `(function(){\n${src}\n})();\n//# sourceURL=${name}`;
function policyFiles() {
  return fs.readdirSync(POLICY_DIR).filter(f => f.endsWith('.js') && !f.startsWith('_')).map(f => f.replace(/\.js$/, ''));
}
const q = (arr, p) => arr.length ? arr[Math.floor(p * (arr.length - 1))] : NaN;
const mean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN;
const median = arr => { const s = [...arr].sort((a, b) => a - b); return q(s, 0.5); };
function fmtN(n) {
  if (n == null || isNaN(n)) return '-';
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e6) return s + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e4) return s + (a / 1e3).toFixed(1) + 'k';
  return s + Math.round(a).toLocaleString('en-US');
}
const pct = x => (x == null || isNaN(x) ? '-' : (100 * x).toFixed(1) + '%');
function table(head, rows) {
  const w = head.map((h, i) => Math.max(String(h).length, ...rows.map(r => String(r[i]).length)));
  const line = r => r.map((c, i) => (i === 0 ? String(c).padEnd(w[i]) : String(c).padStart(w[i]))).join('  ');
  return [line(head), w.map(x => '-'.repeat(x)).join('  '), ...rows.map(line)].join('\n');
}

// ------------------------------------------------------------------ summarise
function summarise(name, runs, ranks, checkpoints, baseline) {
  const ok = runs.filter(r => !r.error);
  const nets = ok.map(r => r.net).sort((a, b) => a - b);
  const s = {
    policy: name, runs: runs.length, failed: runs.length - ok.length,
    errors: [...new Set(runs.flatMap(r => r.error ? [r.error.split('\n')[0]] : (r.errors || [])))].slice(0, 10),
    p10: q(nets, 0.1), p25: q(nets, 0.25), median: q(nets, 0.5), p75: q(nets, 0.75), p90: q(nets, 0.9), max: nets[nets.length - 1], min: nets[0], mean: mean(nets),
    sinkRate: ok.filter(r => r.sunk).length / (ok.length || 1),
    rankDist: Object.fromEntries(ranks.map(k => [k, ok.filter(r => r.rank === k).length / (ok.length || 1)])),
    worthByNight: Object.fromEntries(checkpoints.map((d, i) => [d, { mean: mean(ok.map(r => r.worth[i])), median: median(ok.map(r => r.worth[i])) }])),
    stats: {
      fights: mean(ok.map(r => r.stats.fights)), won: mean(ok.map(r => r.stats.won)), interest: mean(ok.map(r => r.stats.interest)),
      vaultEarned: mean(ok.map(r => r.stats.vaultEarned)), bestFlip: mean(ok.map(r => r.stats.bestFlip)), maxBestFlip: Math.max(...ok.map(r => r.stats.bestFlip)),
      holdTier: mean(ok.map(r => r.stats.holdTier)), wireless: mean(ok.map(r => (r.stats.wireless ? 1 : 0))), reloads: mean(ok.map(r => r.reloads || 0)),
    },
    events: {},
  };
  for (const r of ok) for (const [k, v] of Object.entries(r.events || {})) s.events[k] = (s.events[k] || 0) + v / ok.length;
  // economy shape
  const ratios = ok.map(r => r.worth[checkpoints.indexOf(30)] / Math.max(1, r.worth[checkpoints.indexOf(18)])).filter(isFinite);
  s.shape = {
    ratio30over18OfMedians: s.worthByNight[30] && s.worthByNight[18] ? s.worthByNight[30].median / s.worthByNight[18].median : NaN,
    medianRunRatio30over18: median(ratios),
    maxSale: Math.max(...ok.map(r => r.stats.maxSale || 0)), meanMaxSale: mean(ok.map(r => r.stats.maxSale || 0)), medianMaxSale: median(ok.map(r => r.stats.maxSale || 0)),
    tallyCargoMean: mean(ok.map(r => r.tallyCargo || 0)),
  };
  // whisper accounting
  const ws = ok.filter(r => r.out && r.out.whispers);
  if (ws.length) {
    const all = ws.flatMap(r => r.out.whispers);
    const acted = all.filter(w => w.acted);
    const stat = a => ({
      n: a.length, lostShare: a.filter(w => w.pnl < 0).length / (a.length || 1), lostShareNight: a.filter(w => w.pnlNight < 0).length / (a.length || 1),
      meanPnl: mean(a.map(w => w.pnl)), medianPnl: median(a.map(w => w.pnl)), meanPnlNight: mean(a.map(w => w.pnlNight)), medianPnlNight: median(a.map(w => w.pnlNight)),
      withCargo: a.filter(w => w.actedLot).length,
    });
    s.whispers = Object.assign(stat(acted), {
      boughtPerRun: all.length / ws.length, actedPerRun: acted.length / ws.length,
      bought: all.length, acted: acted.length, actionable: all.filter(w => w.actionable).length,
      actedShare: acted.length / (all.length || 1),
      feesPerRun: mean(ws.map(r => r.out.whispers.reduce((a, w) => a + w.fee, 0))),
      pnlPerRun: mean(ws.map(r => r.out.whispers.reduce((a, w) => a + (w.acted ? w.pnl || 0 : -w.fee), 0))),
      pnlNightPerRun: mean(ws.map(r => r.out.whispers.reduce((a, w) => a + (w.acted ? w.pnlNight || 0 : -w.fee - (w.route || 0)), 0))),
      byType: Object.fromEntries(['spike', 'crash'].map(t => [t, stat(acted.filter(w => w.type === t))])),
      byConf: Object.fromEntries(['sure', 'likely', 'guess'].map(c => [c, stat(acted.filter(w => w.conf === c))])),
      byConfType: Object.fromEntries(['sure', 'likely', 'guess'].flatMap(c => ['spike', 'crash'].map(t => [c + ':' + t, stat(acted.filter(w => w.conf === c && w.type === t))]))),
      landedByConf: Object.fromEntries(['sure', 'likely', 'guess'].map(c => { const a = all.filter(w => w.conf === c && w.landed); return [c, Object.fromEntries(['full', 'weak', 'turn', 'unseen'].map(k => [k, a.filter(w => w.landed === k).length / (a.length || 1)]))]; })),
      boughtByConf: Object.fromEntries(['sure', 'likely', 'guess'].map(c => [c, all.filter(w => w.conf === c).length])),
    });
  }
  const rt = ok.filter(r => r.out && r.out.rt);
  if (rt.length) {
    s.roundtrip = { tests: rt.reduce((a, r) => a + r.out.rt.tests, 0), positive: rt.reduce((a, r) => a + r.out.rt.positive, 0), maxGain: Math.max(...rt.map(r => r.out.rt.max)), minGain: Math.min(...rt.map(r => r.out.rt.min)), sum: rt.reduce((a, r) => a + r.out.rt.sum, 0), by: {} };
    const b = rt.map(r => r.out.rt).sort((a, b2) => b2.max - a.max)[0]; s.roundtrip.best = b.best;
    for (const r of rt) for (const [k, v] of Object.entries(r.out.rt.by || {})) { const o = (s.roundtrip.by[k] = s.roundtrip.by[k] || { tests: 0, positive: 0, sum: 0, max: -Infinity }); o.tests += v.tests; o.positive += v.positive; o.sum += v.sum; o.max = Math.max(o.max, v.max); }
  }
  const dmp = ok.filter(r => r.out && r.out.dump);
  if (dmp.length) { s.dump = {}; for (const k of Object.keys(dmp[0].out.dump)) s.dump[k] = mean(dmp.map(r => r.out.dump[k])); }
  const cor = ok.filter(r => r.out && r.out.corner);
  if (cor.length) s.corner = { probes: cor.reduce((a, r) => a + r.out.corner.probes, 0), tallyDeltaMean: mean(cor.filter(r => r.out.corner.probes).map(r => r.out.corner.tallyDelta)), tallyDeltaMax: Math.max(...cor.map(r => r.out.corner.probes ? r.out.corner.tallyDelta : -Infinity)), sellDeltaMean: mean(cor.filter(r => r.out.corner.probes).map(r => r.out.corner.sellDelta)), sellDeltaMax: Math.max(...cor.map(r => r.out.corner.probes ? r.out.corner.sellDelta : -Infinity)) };
  const rl = ok.filter(r => r.reloadLog && (r.reloadLog.found || r.reloadLog.noSave));
  s.reloadLog = { runsWithReloads: rl.length, found: ok.reduce((a, r) => a + ((r.reloadLog && r.reloadLog.found) || 0), 0), noSave: ok.reduce((a, r) => a + ((r.reloadLog && r.reloadLog.noSave) || 0), 0), cashBack: ok.reduce((a, r) => a + ((r.reloadLog && r.reloadLog.cashBack) || 0), 0), hullBack: ok.reduce((a, r) => a + ((r.reloadLog && r.reloadLog.hullBack) || 0), 0) };
  if (baseline && baseline !== runs) {
    const by = new Map(baseline.filter(r => !r.error).map(r => [r.seed, r.net]));
    const diffs = ok.filter(r => by.has(r.seed)).map(r => r.net - by.get(r.seed));
    s.vsInformed = { pairs: diffs.length, higherShare: diffs.filter(d => d > 0).length / (diffs.length || 1), medianDiff: median(diffs), meanDiff: mean(diffs) };
  }
  return s;
}

function report(sum, meta) {
  const P = Object.values(sum);
  const out = [];
  out.push(`Game: ${meta.game} (sha256 ${meta.gameSha.slice(0, 12)})`);
  out.push(`Runs per policy: ${meta.runs}, seeds ${meta.seeds[0]}..${meta.seeds[meta.seeds.length - 1]}, workers ${meta.workers}, ${meta.runsPerSec.toFixed(1)} runs/s, mode ${meta.mode}`);
  out.push(`Adapter features: ${JSON.stringify(meta.features)}`);
  if (meta.label) out.push(`Label: ${meta.label}`);
  if (Object.keys(meta.set || {}).length) out.push(`Data set: ${JSON.stringify(meta.set)}`);
  if (Object.keys(meta.opts || {}).length) out.push(`Policy opts: ${JSON.stringify(meta.opts)}`);
  out.push('');
  out.push('Final fortune (tally net, crowns)');
  out.push(table(['policy', 'p10', 'p25', 'median', 'p75', 'p90', 'max', 'mean', 'sunk', 'vs informed: higher', 'median diff'],
    P.map(s => [s.policy, fmtN(s.p10), fmtN(s.p25), fmtN(s.median), fmtN(s.p75), fmtN(s.p90), fmtN(s.max), fmtN(s.mean), pct(s.sinkRate), s.vsInformed ? pct(s.vsInformed.higherShare) : '', s.vsInformed ? fmtN(s.vsInformed.medianDiff) : ''])));
  out.push('');
  out.push('Rank distribution');
  const ranks = meta.ranks;
  out.push(table(['policy', ...ranks], P.map(s => [s.policy, ...ranks.map(r => pct(s.rankDist[r]))])));
  out.push('');
  out.push('Mean net worth by night (median in brackets)');
  out.push(table(['policy', ...meta.checkpoints.map(d => 'n' + d)], P.map(s => [s.policy, ...meta.checkpoints.map(d => `${fmtN(s.worthByNight[d].mean)} (${fmtN(s.worthByNight[d].median)})`)])));
  out.push('');
  out.push('Per-run means');
  out.push(table(['policy', 'fights', 'won', 'interest', 'vault earned', 'best sale', 'max best sale', 'hold tier', 'wireless', 'reloads'],
    P.map(s => [s.policy, s.stats.fights.toFixed(2), s.stats.won.toFixed(2), fmtN(s.stats.interest), fmtN(s.stats.vaultEarned), fmtN(s.stats.bestFlip), fmtN(s.stats.maxBestFlip), s.stats.holdTier.toFixed(2), pct(s.stats.wireless), s.stats.reloads.toFixed(2)])));
  out.push('');
  out.push('Economy shape');
  out.push(table(['policy', 'n30/n18 (medians)', 'median run n30/n18', 'largest sale', 'median run largest sale', 'tally cargo mean'],
    P.map(s => [s.policy, s.shape.ratio30over18OfMedians.toFixed(2) + 'x', s.shape.medianRunRatio30over18.toFixed(2) + 'x', fmtN(s.shape.maxSale), fmtN(s.shape.medianMaxSale), fmtN(s.shape.tallyCargoMean)])));
  for (const s of P) {
    if (s.whispers) {
      const w = s.whispers;
      out.push('');
      out.push(`Whispers (${s.policy})`);
      out.push(`  bought ${w.bought} (${w.boughtPerRun.toFixed(1)}/run, fees ${fmtN(w.feesPerRun)}/run; sure ${w.boughtByConf.sure}, likely ${w.boughtByConf.likely}, guess ${w.boughtByConf.guess}); actionable ${w.actionable}; acted on ${w.acted} (${w.actedPerRun.toFixed(1)}/run, ${pct(w.actedShare)} of bought, ${w.withCargo} with cargo)`);
      out.push(`  acted whispers that lost money: ${pct(w.lostShare)} (fee included), ${pct(w.lostShareNight)} (also charging the night)`);
      out.push(`  P&L per acted whisper: mean ${fmtN(w.meanPnl)}, median ${fmtN(w.medianPnl)} (fee included); with night cost: mean ${fmtN(w.meanPnlNight)}, median ${fmtN(w.medianPnlNight)}`);
      out.push(`  whisper P&L per run (unacted whispers count their fee): ${fmtN(w.pnlPerRun)}; with night cost ${fmtN(w.pnlNightPerRun)}`);
      const rows = [];
      for (const k of ['sure', 'likely', 'guess']) { const c = w.byConf[k]; rows.push([k, c.n, pct(c.lostShare), fmtN(c.meanPnl), fmtN(c.medianPnl), pct(c.lostShareNight), fmtN(c.medianPnlNight), pct(w.landedByConf[k].full) + '/' + pct(w.landedByConf[k].weak) + '/' + pct(w.landedByConf[k].turn)]); }
      for (const k of ['spike', 'crash']) { const c = w.byType[k]; rows.push([k, c.n, pct(c.lostShare), fmtN(c.meanPnl), fmtN(c.medianPnl), pct(c.lostShareNight), fmtN(c.medianPnlNight), '']); }
      out.push(table(['  acted', 'n', 'lost', 'mean P&L', 'median P&L', 'lost (night)', 'median (night)', 'landed full/weak/turn'], rows).split('\n').map(l => '  ' + l).join('\n'));
      if (s.vsInformed) out.push(`  vs informed on the same seeds: higher on ${pct(s.vsInformed.higherShare)} of ${s.vsInformed.pairs} seeds, median difference ${fmtN(s.vsInformed.medianDiff)}, mean ${fmtN(s.vsInformed.meanDiff)}`);
    }
    if (s.roundtrip) {
      const r = s.roundtrip;
      out.push('');
      out.push(`Round trips (${s.policy}): ${r.tests} trade-and-undo tests, ${r.positive} made money, best ${fmtN(r.maxGain)}, worst ${fmtN(r.minGain)}, total ${fmtN(r.sum)}`);
      for (const [k, v] of Object.entries(r.by)) out.push(`  ${k}: ${v.tests} tests, ${v.positive} positive, best ${fmtN(v.max)}, mean ${(v.sum / v.tests).toFixed(2)}`);
    }
    if (s.dump) out.push('', `Dump and buy back (${s.policy}), per run: ${Object.entries(s.dump).map(([k, v]) => k + ' ' + fmtN(v)).join(', ')}`);
    if (s.corner) out.push('', `Corner (${s.policy}): ${s.corner.probes} final-night probes; tally change from buying up the main good: mean ${fmtN(s.corner.tallyDeltaMean)}, best ${fmtN(s.corner.tallyDeltaMax)}; cash from cornering then selling vs plain selling: mean ${fmtN(s.corner.sellDeltaMean)}, best ${fmtN(s.corner.sellDeltaMax)}`);
    if (s.reloadLog && (s.reloadLog.found || s.reloadLog.noSave)) out.push('', `Reloads (${s.policy}): ${s.reloadLog.found} found a save, ${s.reloadLog.noSave} found none (runs with reloads: ${s.reloadLog.runsWithReloads}); cash a reload gave back: ${fmtN(s.reloadLog.cashBack)}, hull: ${s.reloadLog.hullBack}`);
  }
  const ev = P.filter(s => Object.keys(s.events).length);
  if (ev.length) {
    out.push('');
    out.push('Choices per run (selected)');
    const keys = ['patrol:bribe', 'patrol:run', 'patrol:fight', 'patrol:yield', 'gulls:pay', 'gulls:run', 'gulls:fight', 'squall:push', 'squall:shelter', 'eel:big', 'eelwin:ok', 'eellose:ok', 'sunk:ok', 'victory:ok'];
    out.push(table(['policy', ...keys], ev.map(s => [s.policy, ...keys.map(k => (s.events[k] || 0).toFixed(2))])));
  }
  const errs = P.filter(s => s.failed || s.errors.length);
  if (errs.length) { out.push(''); out.push('Errors'); errs.forEach(s => out.push(`  ${s.policy}: ${s.failed} failed runs; ${s.errors.join(' | ')}`)); }
  return out.join('\n');
}

// ------------------------------------------------------------------ main
async function main() {
  const A = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(A.game)) { console.error('game not found: ' + A.game); process.exit(2); }
  const avail = policyFiles();
  const pols = A.policies || ['informed', ...avail.filter(p => p !== 'informed')];
  for (const p of pols) if (!avail.includes(p)) { console.error(`unknown policy ${p}; have ${avail.join(', ')}`); process.exit(2); }
  // informed runs first so others can be paired against it
  if (pols.includes('informed')) pols.splice(pols.indexOf('informed'), 1), pols.unshift('informed');

  const shared = fs.readdirSync(POLICY_DIR).filter(f => f.endsWith('.js') && f.startsWith('_')).sort();
  const scripts = [
    wrap(fs.readFileSync(path.join(HERE, 'adapter.js'), 'utf8'), 'adapter.js'),
    ...shared.map(f => wrap(fs.readFileSync(path.join(POLICY_DIR, f), 'utf8'), f)),
    ...avail.map(p => wrap(fs.readFileSync(path.join(POLICY_DIR, p + '.js'), 'utf8'), p + '.js')),
  ];
  const gameSrc = fs.readFileSync(A.game);
  const gameSha = crypto.createHash('sha256').update(gameSrc).digest('hex');
  const seeds = A.seedList || Array.from({ length: A.runs }, (_, i) => A.seed * 100000 + i);
  A.runs = seeds.length;

  const browser = await chromium.launch({ headless: true });
  const pageErrors = [];
  async function newWorker(i) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript(RNG_INIT);
    const page = await ctx.newPage();
    page.on('pageerror', e => pageErrors.push(`[w${i}] ${e.message}`));
    await page.goto(pathToFileURL(A.game).href, { waitUntil: 'load' });
    for (const s of scripts) await page.addScriptTag({ content: s });
    const ok = await page.evaluate(() => !!(window.SIM && SIM.runBatch));
    if (!ok) throw new Error('adapter failed to load: ' + pageErrors.join('; '));
    page.__mutated = await page.evaluate(cfg => SIM.mutate(cfg), A.set);
    return page;
  }
  const pages = await Promise.all(Array.from({ length: A.workers }, (_, i) => newWorker(i)));
  const meta0 = await pages[0].evaluate(() => ({ ranks: SIM.ranks, rankMins: SIM.rankMins, checkpoints: SIM.checkpoints, features: SIM.features }));
  meta0.set = A.set; meta0.mutated = pages[0].__mutated; meta0.label = A.label;

  const results = Object.fromEntries(pols.map(p => [p, []]));
  const CHUNK = 5;
  const tasks = [];
  for (const p of pols) for (let i = 0; i < seeds.length; i += CHUNK) tasks.push({ p, seeds: seeds.slice(i, i + CHUNK) });
  let done = 0; const total = pols.length * seeds.length; const t0 = Date.now();
  async function work(page) {
    while (tasks.length) {
      const t = tasks.shift();
      const r = await page.evaluate(({ p, s, o }) => SIM.runBatch(p, s, o), { p: t.p, s: t.seeds, o: A.opts });
      results[t.p].push(...r);
      done += r.length;
      if (!A.quiet) process.stderr.write(`\r${done}/${total} runs  ${(done / ((Date.now() - t0) / 1000)).toFixed(1)} runs/s   `);
    }
  }
  await Promise.all(pages.map(work));
  const elapsed = (Date.now() - t0) / 1000;
  if (!A.quiet) process.stderr.write('\n');
  await browser.close();

  for (const p of pols) results[p].sort((a, b) => a.seed - b.seed);
  const summary = {};
  for (const p of pols) summary[p] = summarise(p, results[p], meta0.ranks, meta0.checkpoints, results.informed);
  const meta = { game: A.game, gameSha, runs: A.runs, seeds, workers: A.workers, elapsedSec: elapsed, runsPerSec: total / elapsed, mode: 'full (real sailTo voyages, rendering on)', opts: A.opts, pageErrors: pageErrors.slice(0, 20), date: new Date().toISOString(), ...meta0 };
  const text = report(summary, meta);
  console.log(text);
  if (pageErrors.length) console.log(`\nPage errors (${pageErrors.length}): ${pageErrors.slice(0, 5).join(' | ')}`);
  if (A.out) {
    fs.mkdirSync(path.dirname(A.out), { recursive: true });
    fs.writeFileSync(A.out, JSON.stringify({ meta, summary, runs: results }, null, 1));
    fs.writeFileSync(A.out.replace(/\.json$/, '') + '.txt', text + '\n');
    console.log(`\nWrote ${A.out}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
