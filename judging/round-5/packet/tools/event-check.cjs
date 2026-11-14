#!/usr/bin/env node
'use strict';
// Explicit state-fixture regressions, not scored play. Choices are real touch
// taps. The fixture starts at the actual saved arrived-event stage, so reloads
// exercise Continue voyage -> runTrip -> runEvent, without a substitute handler.
// Run after the choice-based evGull/evLeak implementation is integrated:
// node tools/event-check.cjs --game game/index.html --out tools/event-evidence
// Optional: --browser webkit|chromium|all (default all).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const pw = require('playwright');
function parse(argv) {
  const a = { game: path.resolve(__dirname, '../game/index.html'), out: path.join(__dirname, 'event-evidence'), browser: 'all' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--game') a.game = path.resolve(argv[++i]);
    else if (argv[i] === '--out') a.out = path.resolve(argv[++i]);
    else if (argv[i] === '--browser') a.browser = argv[++i];
    else throw Error('Unknown option ' + argv[i]);
  }
  if (!['all', 'webkit', 'chromium'].includes(a.browser)) throw Error('--browser must be webkit, chromium or all');
  return a;
}
const insist = (ok, message) => { if (!ok) throw Error(message); };
const equal = (actual, expected, message) => insist(JSON.stringify(actual) === JSON.stringify(expected), message + '\nActual: ' + JSON.stringify(actual) + '\nExpected: ' + JSON.stringify(expected));
function firstRoll(seed) {
  let t = (seed + 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const successSeed = Array.from({ length: 100 }, (_, i) => i).find(i => firstRoll(i) < .7);
const failureSeed = Array.from({ length: 100 }, (_, i) => i).find(i => firstRoll(i) >= .7);
const audioInit = fs.readFileSync(path.join(__dirname, 'phone/server.js'), 'utf8').match(/const AUDIO_INIT = `([\s\S]*?)`;/)[1];
const cases = [
  { name: 'gull-pay', event: 'gull', choice: 'pay', cash: 10000, seed: failureSeed },
  { name: 'gull-pay-cap', event: 'gull', choice: 'pay', cash: 100000, seed: failureSeed },
  { name: 'gull-run-success-reload', event: 'gull', choice: 'run', cash: 10000, seed: successSeed, reloadOffer: true },
  { name: 'gull-run-failure-reload', event: 'gull', choice: 'run', cash: 10000, seed: failureSeed, reloadOffer: true },
  { name: 'gull-run-sinking', event: 'gull', choice: 'run', cash: 10000, seed: failureSeed, hull: 10, sinks: true },
  { name: 'leak-patch-reload', event: 'leak', choice: 'pay', cash: 40000, seed: successSeed, reloadOffer: true },
  { name: 'leak-jettison-reload', event: 'leak', choice: 'yield', cash: 40000, seed: successSeed, reloadOffer: true },
  { name: 'leak-unaffordable-empty-cost', event: 'leak', choice: 'yield', cash: 100, seed: failureSeed, ink: 1, kelp: 0, patchDisabled: true }
];
async function snapshot(page) {
  return page.evaluate(() => ({
    day: S.day, loc: S.loc, cash: S.cash, bank: S.bank, debt: S.debt, hull: S.hull,
    cargo: JSON.parse(JSON.stringify(S.cargo)), rngE: S.rngE, rngM: S.rngM,
    trip: S.trip ? JSON.parse(JSON.stringify(S.trip)) : null, over: S.over,
    saved: store.get(KEY_SAVE, null), scores: loadScores(), stats: { ...S.stats }
  }));
}
function economy(s) { return { day: s.day, loc: s.loc, cash: s.cash, bank: s.bank, debt: s.debt, hull: s.hull, cargo: s.cargo, rngE: s.rngE, rngM: s.rngM }; }
async function offer(page) {
  await page.locator('#modal h3').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(440);
  return page.evaluate(() => ({
    title: document.querySelector('#modal h3')?.innerText,
    text: document.querySelector('#modal')?.innerText,
    choices: [...document.querySelectorAll('#modal [data-choice]')].map(b => ({ key: b.dataset.choice, disabled: b.disabled, text: b.innerText })),
    hasArt: !!document.querySelector('#modal .art svg')
  }));
}
async function tap(page, selector) {
  const button = page.locator(selector).first();
  await button.waitFor({ state: 'visible', timeout: 8000 });
  await button.scrollIntoViewIfNeeded();
  await button.tap({ timeout: 8000 });
  await page.waitForTimeout(440);
}
async function resume(page) {
  await page.reload();
  await page.evaluate(() => { FAST = true; });
  await tap(page, '#t-cont');
}
async function fixture(page, c) {
  // These are labeled regression fixtures: directly setting resources, cargo,
  // event stage and RNG here is intentional and excluded from scored gameplay.
  return page.evaluate(c => {
    FAST = true; settings.tutorial = true;
    const state = newState('Event fixture');
    state.day = 15; state.loc = 'lq'; state.cash = c.cash; state.bank = 777;
    state.debt = 0; state.hull = c.hull == null ? 100 : c.hull;
    GOODS.forEach(g => { state.cargo[g.id] = { q: 0, cost: 0 }; });
    state.cargo.kelp = { q: c.kelp == null ? 4 : c.kelp, cost: c.kelp === 0 ? 0 : 20 };
    state.cargo.ink = { q: c.ink == null ? 4 : c.ink, cost: 14000 };
    state.rngE = c.seed; state.rngM = 12345;
    state.trip = null; state.stats.lost = 0;
    startGame(state, false);
    S.trip = { from: 'ch', to: 'lq', stage: 'arrived', ev: c.event, next: null, first: false, counted2: true };
    save();
    const before = JSON.parse(JSON.stringify(S));
    window.__eventDone = false; window.__eventError = null;
    runTrip(true).then(() => { window.__eventDone = true; }, e => { window.__eventError = e.stack || String(e); window.__eventDone = true; });
    return before;
  }, c);
}
async function test(browser, engine, c, out, game) {
  const context = await browser.newContext({ ...pw.devices[engine === 'webkit' ? 'iPhone 13' : 'Pixel 7'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await context.addInitScript(audioInit);
  await context.setOffline(true);
  const page = await context.newPage();
  const errors = [], network = [];
  page.setDefaultTimeout(8000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  context.on('request', r => { if (/^https?:/i.test(r.url())) network.push(r.url()); });
  const prefix = `${engine}-${c.name}`;
  const evidence = { engine, fixture: c, expectedFirstRoll: firstRoll(c.seed), classification: 'Explicit state/RNG fixture; real touch choice and actual save/resume flow' };
  try {
    const response = await page.goto(pathToFileURL(game).href);
    evidence.loadedSha256 = crypto.createHash('sha256').update(await response.body()).digest('hex');
    const initial = await fixture(page, c);
    const before = await snapshot(page);
    // Initial event presentation must neither charge money/cargo nor draw RNG.
    equal(economy(before), economy(initial), 'Offer changed resources or RNG before the player chose');
    const firstOffer = await offer(page);
    evidence.offer = firstOffer;
    equal(firstOffer.title, c.event === 'gull' ? 'A gull takes your purse' : 'Water in the hold', 'Unexpected offer title');
    equal(firstOffer.choices.map(x => x.key).sort(), c.event === 'gull' ? ['pay', 'run'] : ['pay', 'yield'], 'Offer lacks specified choices');
    insist(firstOffer.hasArt, 'Offer lacks its inline event illustration');
    if (c.event === 'gull') {
      const run = firstOffer.choices.find(x => x.key === 'run');
      insist(/70\s*%/.test(run.text + firstOffer.text) && /10/.test(run.text + firstOffer.text), 'Gull offer does not disclose 70% success and 10-hull failure stakes');
    } else {
      const patch = firstOffer.choices.find(x => x.key === 'pay');
      equal(patch.disabled, !!c.patchDisabled, 'Patch affordability is wrong');
      const n = Math.max(1, Math.round(initial.cargo.ink.q * .25));
      const patchCost = Math.max(200, Math.round(n * 19000 * .6));
      insist(firstOffer.text.replace(/,/g, '').includes(String(patchCost)), 'Patch offer omits the calculated cost');
      insist(firstOffer.choices.find(x => x.key === 'yield').text.includes(String(n)), 'Jettison choice omits cargo quantity');
    }
    await page.screenshot({ path: path.join(out, prefix + '-offer.png'), scale: 'css' });
    if (c.reloadOffer) {
      await resume(page);
      const reloadedOffer = await offer(page), afterReload = await snapshot(page);
      equal(economy(afterReload), economy(before), 'Reload while offer was open changed resources or RNG');
      equal(reloadedOffer.choices, firstOffer.choices, 'Reload changed offer choices, odds or price');
      evidence.offerReloadPreserved = true;
    }
    await tap(page, `#modal [data-choice="${c.choice}"]`);
    if (c.sinks) {
      await page.locator('#modal [data-choice="ok"]').waitFor({ state: 'visible' });
      const sinkingText = await page.locator('#modal').innerText();
      insist(/See the reckoning/.test(sinkingText), 'Fatal outcome did not use the existing sinking flow');
      await tap(page, '#modal [data-choice="ok"]');
      await page.locator('.end-hero').waitFor({ state: 'visible' });
      const after = await snapshot(page);
      insist(after.over && after.hull === 0, 'Fatal gull failure did not sink the skiff');
      insist(after.saved === null, 'Sinking retained a resumable save');
      insist(after.scores.length === 1 && after.scores[0].sunk, 'Sinking did not record one losing ledger entry');
      evidence.after = after;
      await page.screenshot({ path: path.join(out, prefix + '-outcome.png'), scale: 'css' });
      await page.reload();
      insist(await page.locator('#t-cont').count() === 0, 'Reload offered Continue after sinking');
      equal(await page.evaluate(() => loadScores().length), 1, 'Reload duplicated the sunk ledger entry');
      evidence.outcomeReloadPreserved = true;
    } else {
      await page.waitForFunction(() => !busy && document.querySelector('#modal').hidden, null, { timeout: 8000 });
      const after = await snapshot(page);
      insist(!after.over && after.trip === null, 'Completed event left an active trip or ended the run');
      insist(after.saved && after.saved.trip === null, 'Outcome did not persist a completed event');
      const expected = JSON.parse(JSON.stringify(economy(before)));
      if (c.event === 'gull') {
        const bag = Math.min(6000, Math.round(before.cash * .1));
        if (c.choice === 'pay' || firstRoll(c.seed) >= .7) expected.cash -= bag;
        if (c.choice === 'run') expected.rngE = (before.rngE + 0x6D2B79F5) >>> 0;
        if (c.choice === 'run' && firstRoll(c.seed) >= .7) expected.hull -= 10;
      } else {
        const n = Math.max(1, Math.round(before.cargo.ink.q * .25));
        if (c.choice === 'pay') expected.cash -= Math.max(200, Math.round(n * 19000 * .6));
        else { expected.cargo.ink.q -= n; if (!expected.cargo.ink.q) expected.cargo.ink.cost = 0; }
      }
      equal(economy(after), expected, 'Outcome violated cash, hull, cargo or RNG conservation');
      evidence.after = after;
      await page.screenshot({ path: path.join(out, prefix + '-outcome.png'), scale: 'css' });
      await resume(page);
      await page.waitForFunction(() => !!S && !busy && document.querySelector('#modal').hidden, null, { timeout: 8000 });
      await page.waitForTimeout(550); // allow the normal delayed runTrip resume, if one was mistakenly saved
      const reloadedOutcome = await snapshot(page);
      equal(economy(reloadedOutcome), economy(after), 'Reload after outcome repeated the charge, loss or random draw');
      insist(reloadedOutcome.trip === null, 'Reload revived the completed event');
      evidence.outcomeReloadPreserved = true;
    }
    insist(errors.length === 0, 'Game console/page errors: ' + errors.join('; '));
    insist(network.length === 0, 'Runtime network request: ' + network.join('; '));
    return { pass: true, ...evidence, errors, network };
  } catch (e) {
    await page.screenshot({ path: path.join(out, prefix + '-failure.png'), scale: 'css' }).catch(() => {});
    return { pass: false, ...evidence, error: e.stack, current: await snapshot(page).catch(() => null), errors, network };
  } finally { await context.close(); }
}
async function main(a) {
  fs.mkdirSync(a.out, { recursive: true });
  const report = { createdAt: new Date().toISOString(), game: a.game, classification: 'Non-scored regression fixtures; resources and RNG deliberately set before event, real WebKit/Chromium touch answers and actual persisted runTrip replay', limitations: ['Does not assess ordinary-play balance or audio quality.', 'Uses FAST=true, reduced motion and the documented WebKit audio stand-in.', 'Fixture seeds select success/failure for coverage; this is not an unbiased gameplay sample.'], tests: [] };
  for (const engine of a.browser === 'all' ? ['webkit', 'chromium'] : [a.browser]) {
    const browser = await pw[engine].launch({ headless: true });
    try {
      for (const c of cases) {
        const result = await test(browser, engine, c, a.out, a.game);
        report.tests.push(result);
        console.log(`${result.pass ? 'PASS' : 'FAIL'} ${engine} ${c.name}${result.error ? ': ' + result.error.split('\n')[0] : ''}`);
        fs.writeFileSync(path.join(a.out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
      }
    } finally { await browser.close(); }
  }
  report.pass = report.tests.length > 0 && report.tests.every(t => t.pass);
  fs.writeFileSync(path.join(a.out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ pass: report.pass, passed: report.tests.filter(t => t.pass).length, total: report.tests.length, report: path.join(a.out, 'report.json') }));
  return report;
}
module.exports = { main, cases, firstRoll };
if (require.main === module) main(parse(process.argv.slice(2))).then(r => { process.exitCode = r.pass ? 0 : 1; }).catch(e => { console.error(e); process.exitCode = 1; });
