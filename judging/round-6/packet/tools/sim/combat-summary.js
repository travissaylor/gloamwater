'use strict';
const fs = require('fs');
const path = require('path');
const file = process.argv[2] || path.join(__dirname, 'results/combat-audit.json');
const out = process.argv[3] || file.replace(/\.json$/, '-summary.md');
const d = JSON.parse(fs.readFileSync(file, 'utf8'));
const sum = a => a.reduce((x, y) => x + y, 0);
const mean = a => sum(a) / (a.length || 1);
const cash = x => (x < 0 ? '−' : '') + '¤' + Math.round(Math.abs(x)).toLocaleString('en-US');
const pct = x => (100 * x).toFixed(1) + '%';
const stats = {};
for (const [name, all] of Object.entries(d.runs)) {
  const rows = all.filter(r => !r.error), enc = rows.flatMap(r => r.enc || []), buys = rows.flatMap(r => r.purchases || []);
  const repair = buys.filter(b => b.kind === 'repair' || b.kind === 'patch');
  const weapons = buys.filter(b => b.kind === 'arms');
  const choices = {}, first = {}, ends = {};
  for (const e of enc) {
    for (const c of String(e.seq).split(',').filter(Boolean)) choices[c] = (choices[c] || 0) + 1;
    first[e.first] = (first[e.first] || 0) + 1;
    ends[e.end] = (ends[e.end] || 0) + 1;
  }
  stats[name] = {
    runs: rows.length, sunk: rows.filter(r => r.sunk).length,
    medianNet: d.summary[name].median, meanNet: d.summary[name].mean,
    firstChoices: first, allRoundChoices: choices, outcomes: ends, encounters: enc.length,
    repairSpentPerRun: sum(repair.map(b => b.cost)) / rows.length,
    repairedHullPerRun: sum(repair.map(b => b.hullRestored)) / rows.length,
    combatHullLostPerRun: sum(enc.map(e => Math.max(0, -e.hull))) / rows.length,
    combatHullRepairProxyPerRun: sum(enc.map(e => Math.max(0, -e.hull) * 35)) / rows.length,
    weaponSpentPerRun: sum(weapons.map(b => b.cost)) / rows.length,
    weaponBuyerShare: rows.filter(r => (r.purchases || []).some(b => b.kind === 'arms')).length / rows.length,
    finalWeaponTierMean: mean(rows.map(r => r.stats.arms)), finalHullMean: mean(rows.map(r => r.hull)),
    encounterCostPerRun: sum(enc.map(e => e.cost)) / rows.length,
    paired: d.summary[name].vsInformed || null,
  };
}
const lines = ['# Combat policy comparison', '', `Loaded game SHA-256: \`${d.meta.gameSha}\`. ${d.meta.runs} paired seeds per policy, ${d.meta.workers} workers.`,
  'One diagnostic comparison; no balance settings or prototype flags.', '',
  '| Policy | Median fortune | Mean fortune | Sunk | First choice fight | Mean repair spend | Mean weapon spend | Weapon buyers |',
  '|---|---:|---:|---:|---:|---:|---:|---:|'];
for (const [name, s] of Object.entries(stats)) lines.push(`| ${name} | ${cash(s.medianNet)} | ${cash(s.meanNet)} | ${s.sunk}/${s.runs} | ${pct((s.firstChoices.fight || 0) / s.encounters)} | ${cash(s.repairSpentPerRun)} | ${cash(s.weaponSpentPerRun)} | ${pct(s.weaponBuyerShare)} |`);
lines.push('', '| Policy | Mean combat hull lost | Repair proxy at ¤35/point | Mean hull actually repaired | Mean final hull | Encounter cost per run |', '|---|---:|---:|---:|---:|---:|');
for (const [name, s] of Object.entries(stats)) lines.push(`| ${name} | ${s.combatHullLostPerRun.toFixed(1)} | ${cash(s.combatHullRepairProxyPerRun)} | ${s.repairedHullPerRun.toFixed(1)} | ${s.finalHullMean.toFixed(1)} | ${cash(s.encounterCostPerRun)} |`);
lines.push('', 'Repair proxy prices observed combat damage at the full yard rate. Actual repairs also cover storms and other damage; cheaper patches and unhealed damage make those amounts differ. Early sinkings shorten exposure. Encounter costs value direct resources and damage; they do not price the remaining voyages lost after sinking.', '', 'First choices, by encounter. Volley counts are separate.', '', '| Policy | Fight | Run | Pay | Bribe | Yield | Won | Escaped | Sunk in encounter |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const [name, s] of Object.entries(stats)) lines.push(`| ${name} | ${['fight','run','pay','bribe','yield'].map(k => s.firstChoices[k] || 0).join(' | ')} | ${s.outcomes.won || 0} | ${s.outcomes.Escaped || 0} | ${s.outcomes.sunk || 0} |`);
lines.push('', 'Encounter outcome keys reflect the existing simulator card classifier; detailed records remain in the JSON.', '',
  `Reported page errors: ${d.meta.pageErrors.length}. Runs with errors: ${Object.values(d.runs).flat().filter(r => r.error || r.errors && r.errors.length).length}.`,
  `Worker response-body SHA matches: ${d.meta.workerResponseShas.filter(x => x === d.meta.gameSha).length}/${d.meta.workerResponseShas.length}.`,
  `Numerical invariant checks: ${sum(Object.values(d.runs).flat().map(r => r.stats && r.stats.numericChecks || 0))}.`,
  `RNG seed mismatches: ${d.meta.repro.rng0Mismatch}; night-30 market mismatches: ${d.meta.repro.mktMismatch}.`, '');
fs.writeFileSync(out, lines.join('\n'));
fs.writeFileSync(out.replace(/\.md$/, '.json'), JSON.stringify({ meta: d.meta, stats }, null, 2) + '\n');
console.log(lines.join('\n'));
