#!/usr/bin/env node
'use strict';

// Targeted state fixtures for trading decisions and dock work. Inputs use the actual UI.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium, devices, webkit } = require('playwright');
const game = pathToFileURL(path.resolve(process.argv[2] || path.join(__dirname, '../game/index.html'))).href;

async function fresh(page) {
  await page.goto(game);
  await page.evaluate(() => { FAST = true; settings.tutorial = true; });
}

async function dockWork(page) {
  await fresh(page);
  await page.evaluate(() => {
    const state = newState('Dock fixture');
    Object.assign(state, { day: 14, cash: 0, bank: 0, debt: 10000 });
    startGame(state, false);
  });
  await page.locator('[data-act="dockwork"]').tap();
  await page.waitForTimeout(450);
  await page.locator('[data-choice="work"]').tap();
  await page.waitForFunction(() => S.day === 15 && !busy && !S.trip);
  const settlement = () => [S.day, S.cash, S.debt, S.dockWorkUsed];
  const expected = [15, 350, 11000, true];
  assert.deepEqual(await page.evaluate(settlement), expected);
  await fresh(page);
  await page.locator('#t-cont').tap();
  assert.deepEqual(await page.evaluate(settlement), expected);
  await page.evaluate(() => { S.cash = 0; renderAll(); });
  assert.equal(await page.locator('[data-act="dockwork"]').count(), 0);
}

async function payment(page, encounter) {
  await fresh(page);
  await page.evaluate(event => {
    const state = newState('Payment fixture');
    Object.assign(state, { day: 15, cash: 77, debt: 13875 });
    state.cargo.eels = { q: 1, cost: 1400 };
    startGame(state, false);
    S.trip = { from: 'lq', to: 'ch', stage: 'mid', ev: event, next: null };
    save();
    void runTrip(true);
  }, encounter);
  const choice = page.locator('[data-choice="pay"]');
  const offer = await choice.innerText();
  assert.match(offer, /77 cash.*1 Clockwork Eels.*2,400/);
  if (encounter === 'collectors') assert.match(offer, /1,858 off your debt/);
  await page.waitForTimeout(450);
  await choice.tap();
  await page.locator('[data-choice="ok"]').waitFor();
  assert.match(await page.locator('#modal').innerText(), /77 cash.*1 Clockwork Eels/);
  const after = await page.evaluate(() => [S.cash, S.cargo.eels.q, S.debt, store.get(KEY_SAVE).trip.ev]);
  assert.deepEqual(after, [0, 0, encounter === 'collectors' ? 12017 : 13875, null]);
}

async function marketGuide(page) {
  await fresh(page);
  await page.evaluate(() => {
    const state = newState('Market fixture');
    Object.assign(state, { day: 14, cash: 2000, hull: 46 });
    state.stock.lq.pearl = true;
    state.stock.lq.ink = true;
    state.prices.lq.pearl = 400;
    state.prices.lq.ink = 19000;
    state.cargo.pearl = { q: 4, cost: 420 };
    for (const d of DISTRICTS) if (d.id !== 'lq') state.seen[d.id] = {};
    state.seen.de.pearl = { p: 925, day: 13, st: true, sh: false };
    state.seen.ch.pearl = { p: 5000, day: 14, st: true, sh: true };
    startGame(state, false);
  });
  const guide = page.locator('.best-run');
  assert.match(await guide.innerText(), /Patch at the Sluices/);
  assert.match(await page.locator('.row[data-g="ink"] .row-note').innerText(), /Above your purse/);
  await page.evaluate(() => { S.hull = 100; renderAll(); });
  assert.match(await guide.innerText(), /Rust Pearls → Exchange/);
  assert.match(await guide.innerText(), /At 25% lower:.*buyer unconfirmed/i);
  await page.evaluate(() => { S.day = 16; renderAll(); });
  assert.equal(await page.locator('.best-run[data-trade-tip="pearl"], .best-run[data-route-tip="de"]').count(), 0);
}

async function keyboardTrade(page) {
  await fresh(page);
  await page.evaluate(() => {
    const state = newState('Keyboard fixture');
    state.stock.lq.pearl = true;
    state.cargo.pearl = { q: 4, cost: 420 };
    startGame(state, false);
  });
  await page.locator('#nodes .node[data-d="ch"]').focus();
  await page.keyboard.press('Enter');
  assert.deepEqual(await page.evaluate(() => [sel, document.activeElement.dataset.act]), ['ch', 'sail']);
  await page.keyboard.press('Escape');
  const row = page.locator('.row[data-g="pearl"]');
  await row.focus();
  await page.keyboard.press('b');
  assert.equal(await page.locator('[data-mode="buy"]').getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Escape');
  await row.focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('[data-mode="buy"]').getAttribute('aria-pressed'), 'true');
  const sell = page.locator('[data-mode="sell"]');
  await sell.focus();
  await page.keyboard.press('Enter');
  assert.equal(await sell.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => S.cargo.pearl.q), 4);
  await page.locator('#qin').fill('999999');
  assert.match(await page.locator('#qsum').innerText(), /Order limited to 4/);
}

async function calendarAndTour(page) {
  await fresh(page);
  const before = await page.evaluate(() => {
    const first = makeFleetOrder(11), second = makeFleetOrder(12);
    const state = newState('Calendar fixture');
    state.fleetOrder = first;
    startGame(state, false);
    const calls = Array.from({ length: 8 }, (_, i) => fleetCall(i * 4 + 1));
    return { first, second, calls };
  });
  assert.notDeepEqual(before.first, before.second);
  assert.deepEqual([...before.first].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(before.calls.at(-1).to, 30);
  await fresh(page);
  await page.locator('#t-cont').press('Space');
  assert.deepEqual(await page.evaluate(() => Array.from({ length: 8 }, (_, i) => fleetCall(i * 4 + 1))), before.calls);
  await page.evaluate(() => startCoach());
  const next = page.locator('#coach [data-next]');
  await next.waitFor();
  assert.equal(await page.evaluate(() => document.querySelector('#app').inert), true);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => !!document.activeElement.closest('#coach')), true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => !!document.activeElement.closest('#coach')), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#coach').count(), 0);
  assert.equal(await page.evaluate(() => document.querySelector('#app').inert), false);
}

async function run(engine, options, cases) {
  const browser = await engine.launch();
  try {
    for (const [name, check] of cases) {
      const page = await browser.newPage(options);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.setDefaultTimeout(8000);
      try {
        await check(page);
        assert.deepEqual(errors, []);
        console.log('PASS ' + name);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  await run(webkit, { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }, [
    ['dock work pays for one night, accrues interest and survives reload', dockWork],
    ['collector payment matches its offer', page => payment(page, 'collectors')],
    ['Gull Gang payment matches its offer', page => payment(page, 'gulls')],
    ['repair and quote guides offer reachable options', marketGuide]
  ]);
  await run(chromium, { viewport: { width: 1280, height: 800 } }, [
    ['keyboard follows Sail and selects trade mode without trading', keyboardTrade],
    ['fleet order varies and persists, with focus held inside the tour', calendarAndTour]
  ]);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
