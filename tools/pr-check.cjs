#!/usr/bin/env node
'use strict';
// Focused PR regressions. These deliberately set game/storage fixtures; they are not full games.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { chromium, webkit, devices } = require('playwright');
const { TouchRun } = require('./touch-play.cjs');
const { KeyboardRun } = require('./keyboard-play.cjs');
const option = (key, fallback) => process.argv.includes(key) ? path.resolve(process.argv[process.argv.indexOf(key) + 1]) : fallback;
const GAME = option('--game', path.resolve(__dirname, '../game/index.html'));
const OUT = option('--out', path.join(__dirname, 'pr-check-evidence'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const audio = fs.readFileSync(path.join(__dirname, 'phone/server.js'), 'utf8').match(/const AUDIO_INIT = `([\s\S]*?)`;/)[1];
const report = { game: GAME, gameSha256: hash(fs.readFileSync(GAME)), driverSha256: hash(fs.readFileSync(__filename)), checks: [],
  method: 'Explicit initialization/storage fixtures with native keyboard/touch interactions on the paths under test.',
  limitations: ['Not a full-game or balance test.', 'Emulated WebKit/Chromium; no physical iPhone or audible assessment.', 'Reduced motion; notice tests retain ordinary timeout timing.'] };
fs.mkdirSync(OUT, { recursive: true });
const insist = (ok, message) => { if (!ok) throw Error(message); };
async function check(name, fn) {
  try { report.checks.push({ name, pass: true, evidence: await fn() }); }
  catch (e) { report.checks.push({ name, pass: false, error: e.stack }); }
  console.log(`${report.checks.at(-1).pass ? 'PASS' : 'FAIL'} ${name}`);
}
async function fixture(browser, size, fn) {
  const [width, height] = size;
  const context = await browser.newContext({ ...(width < 800 ? devices['iPhone 13'] : { hasTouch: true }), viewport: { width, height }, reducedMotion: 'reduce' });
  await context.addInitScript(audio);
  await context.setOffline(true);
  const page = await context.newPage(), errors = [], network = [];
  page.setDefaultTimeout(8000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  context.on('request', r => { if (/^https?:/.test(r.url())) network.push(r.url()); });
  try {
    const response = await page.goto(pathToFileURL(GAME).href);
    insist(hash(await response.body()) === report.gameSha256, 'Loaded game differs from the recorded source');
    await page.waitForFunction(() => document.activeElement.id === 't-new');
    await page.evaluate(() => { settings.tutorial = true; Sound.setMuted(true); startGame(newState('PR fixture'), false); clearToasts(); });
    await page.waitForTimeout(400);
    const result = await fn(page, context);
    insist(!errors.length && !network.length, JSON.stringify({ errors, network }));
    return result;
  } finally { await context.close(); }
}
async function tabTo(page, selector, key = 'Tab') {
  for (let i = 0; i < 50; i++) {
    if (await page.evaluate(s => document.activeElement.matches(s), selector)) return;
    await page.keyboard.press(key);
  }
  throw Error('Native Tab could not reach ' + selector);
}
async function noticeFocus(page, action) {
  await page.evaluate(() => { FAST = false; setView('map'); sel = 'fm'; renderMapState(); });
  await page.locator('#b-mute2').tap();
  const selector = action ? '#tcard-slot [data-act="portdetails"]' : '#nodes .node[data-d="sm"]';
  await tabTo(page, selector);
  await page.waitForFunction(() => document.querySelector('#toasts').children.length === 0);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  insist(await page.evaluate(s => document.activeElement.matches(s), selector), 'Notice expiry removed the keyboard target');
  await page.keyboard.press('Enter');
  const after = await page.evaluate(() => ({ selected: sel, busy, trip: S.trip, modal: !document.querySelector('#modal').hidden }));
  insist(!after.busy && !after.trip, 'Enter on the preserved control started a voyage');
  insist(action ? after.modal : after.selected === 'sm', 'Preserved control did not perform its own action');
  return { target: selector, after };
}
async function modalFocus(page) {
  await page.evaluate(() => { S.stock[S.loc].kelp = true; openTrade('kelp', 'buy'); });
  await page.waitForTimeout(400);
  await tabTo(page, '.trade-intel > summary', 'Shift+Tab');
  if (!await page.locator('.trade-intel').evaluate(el => el.open)) await page.keyboard.press('Enter');
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(200);
  const positions = [];
  for (const key of ['Tab', 'Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
    await page.keyboard.press(key);
    const focus = await page.evaluate(() => {
      const a = document.activeElement, r = a.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { tag: a.tagName, id: a.id, y: r.y, inModal: !!a.closest('#modal'), visible: !!hit && (a === hit || a.contains(hit)) };
    });
    positions.push(focus);
    insist(focus.inModal && focus.visible, 'Tab focused a covered or offscreen control: ' + JSON.stringify(focus));
  }
  return { positions };
}
async function fleetHints(page) {
  const rows = await page.evaluate(() => {
    for (const d of DISTRICTS) for (const g of GOODS) S.seen[d.id][g.id] = null;
    const result = [];
    for (const day of [3, 4, 7, 8, 11, 12, 15, 16, 19, 20, 23, 24, 27, 28, 29]) for (const d of DISTRICTS) {
      S.day = day; S.loc = d.id; setView('market'); renderSide();
      const text = document.querySelector('.best-run')?.textContent || '';
      const current = fleetCall(), next = fleetCall(current.to + 1);
      const calls = [current, next].filter(Boolean);
      const arrival = f => Math.max(day + nightsTo(d.id, f.d), f.from);
      const advertised = calls.find(f => text.includes(GI[f.g].name) && text.includes(portName(f.d)));
      result.push({ day, from: d.id, text, reachable: calls.some(f => arrival(f) <= f.to), arrives: advertised ? arrival(advertised) : null, closes: advertised?.to });
    }
    S.day = 4; S.loc = 'lq'; setView('map'); sel = fleetCall().d; renderMapState();
    return { result, selectedPort: DI[sel].name };
  });
  for (const row of rows.result) {
    const valid = row.reachable ? row.arrives !== null && row.arrives <= row.closes : !row.text;
    insist(valid, 'Fleet hint does not match reachable calls: ' + JSON.stringify(row));
  }
  // setView builds the responsive map on its next animation frame.
  await page.locator('.tcard h3').filter({ hasText: rows.selectedPort }).waitFor({ state: 'visible' });
  rows.dockNote = await page.locator('.dock-note').innerText();
  insist(rows.dockNote?.includes('before your arrival'), 'Selected port hides the known fleet closing time');
  return rows;
}
async function ledgerFixture(page, context, Runner, fault) {
  // Seed an unrelated old entry to catch the equal-but-stale-ledger false positive too.
  await page.evaluate(fault => {
    FAST = true; S.day = 30;
    if (fault === 'stale') store.set(KEY_SCORES, [{ name: 'Old captain', score: 123, night: 30, sunk: false, id: 'old', date: '2020-01-01' }]);
    if (fault === 'missing' || fault === 'stale') {
      const set = store.set; store.set = (k, v) => { if (k !== KEY_SCORES) set(k, v); };
    }
    if (fault === 'wrong-score') {
      const set = store.set; store.set = (k, v) => set(k, k === KEY_SCORES ? v.map(e => ({ ...e, score: e.score + 1 })) : v);
    }
    endGame('complete');
  }, fault);
  await page.locator('.end-hero').waitFor({ state: 'visible' });
  if (fault === 'lost-on-reload') {
    await context.addInitScript(() => localStorage.removeItem('gloamwater.scores.v1'));
  }
  const runner = new Runner(page, { game: GAME, out: OUT, fast: true }, 1);
  if (fault === 'none') return runner.verifyLedger();
  let rejected = '';
  try { await runner.verifyLedger(); } catch (e) { rejected = e.message; }
  insist(rejected.includes('Completed run is missing from the ledger'), 'Invalid completed entry was not rejected: ' + fault + ' / ' + rejected);
  return { deliberateStorageFault: fault, rejected };
}
async function main() {
  for (const [engine, factory] of Object.entries({ webkit, chromium })) {
    const browser = await factory.launch({ headless: true });
    try {
      for (const size of [[360, 640], [390, 664], [390, 844], [1280, 640], [1280, 800]]) {
        if (size[0] < 800) await check(`${engine} ${size.join('x')} notice preserves map focus`, () => fixture(browser, size, p => noticeFocus(p, false)));
        await check(`${engine} ${size.join('x')} modal focus stays visible`, () => fixture(browser, size, modalFocus));
      }
      await check(`${engine} notice preserves dock focus`, () => fixture(browser, [390, 664], p => noticeFocus(p, true)));
      await check(`${engine} fleet hints allow arrival`, () => fixture(browser, [390, 664], fleetHints));
      if (engine === 'chromium') for (const Runner of [TouchRun, KeyboardRun]) for (const fault of ['none', 'missing', 'stale', 'wrong-score', 'lost-on-reload']) {
        await check(`${Runner.name} ledger ${fault}`, () => fixture(browser, [1280, 800], (p, c) => ledgerFixture(p, c, Runner, fault)));
      }
    } finally { await browser.close(); }
  }
  report.pass = report.checks.every(c => c.pass);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ pass: report.pass, passed: report.checks.filter(c => c.pass).length, total: report.checks.length, report: path.join(OUT, 'report.json') }));
  process.exitCode = report.pass ? 0 : 1;
}
main().catch(e => { console.error(e); process.exitCode = 1; });
