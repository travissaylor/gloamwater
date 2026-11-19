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
  assert.match(await page.locator('#modal').innerText(), /350.*11,000.*1,000/s);
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
    state.stock.lq.rain = true;
    state.prices.lq.pearl = 400;
    state.prices.lq.ink = 19000;
    state.prices.lq.rain = 150;
    state.cargo.pearl = { q: 4, cost: 420 };
    state.cargo.rain = { q: 10, cost: 130 };
    for (const d of DISTRICTS) if (d.id !== 'lq') state.seen[d.id] = {};
    state.seen.de.pearl = { p: 925, day: 13, st: true, sh: false };
    state.seen.de.rain = { p: 180, day: 14, st: true, sh: false };
    state.seen.ch.pearl = { p: 5000, day: 14, st: true, sh: true };
    startGame(state, false);
  });
  const guide = page.locator('.best-run');
  assert.match(await guide.innerText(), /Patch at the Sluices/);
  assert.match(await page.locator('.row[data-g="ink"] .row-note').innerText(), /Above your purse/);
  await page.evaluate(() => { S.hull = 100; renderAll(); });
  assert.match(await guide.innerText(), /Rust Pearls → Exchange/);
  assert.match(await guide.innerText(), /At 25% lower:.*buyer unconfirmed/i);
  await page.locator('.row[data-g="pearl"]').tap();
  await page.waitForTimeout(450);
  await page.locator('[data-sale-port="de"]').tap();
  await page.waitForTimeout(450);
  await page.locator('[data-act="portdetails"]').tap();
  const hold = await page.getByRole('region', { name: 'Hold sale scenarios' }).innerText();
  assert.match(hold, /All quoted buyers open.*4,215.*If Rust Pearls buyer is absent.*1,440/s);
  await page.keyboard.press('Escape');
  await page.evaluate(() => setView('market'));
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
  await page.locator('#qin').fill('1');
  await page.locator('#qgo').press('Enter');
  assert.equal(await page.evaluate(() => S.cargo.pearl.q), 3);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.g), 'pearl');
  await page.evaluate(() => {
    rollVoyageEvent = () => 'squall';
    rollArrivalEvent = () => null;
  });
  await page.keyboard.press('4');
  await page.keyboard.press('Enter');
  await page.locator('[data-choice="push"]').waitFor();
  await page.keyboard.press('1');
  await page.waitForFunction(() => S.day === 2 && !busy && !S.trip);
  assert.equal(await page.evaluate(() => !!document.activeElement.closest('.row')), true);
}

async function creditLine(page) {
  await fresh(page);
  await page.evaluate(() => {
    const state = newState('Credit fixture');
    state.cash = 12000;
    startGame(state, false);
    setView('harbor');
  });
  const balance = () => page.evaluate(() => [S.cash, S.debt, creditLimit(), netWorth()]);
  const borrow = page.locator('[data-act="borrow"]');
  await borrow.press('Space');
  await page.locator('#modal [data-x]').last().press('Enter');
  assert.deepEqual(await balance(), [12000, 6000, 12000, 6000]);
  for (const amount of [2000, 4000]) {
    await borrow.press('Space');
    await page.locator('#ain').fill(String(amount));
    await page.locator('#ago').press('Enter');
  }
  assert.deepEqual(await balance(), [18000, 12000, 12000, 6000]);
  assert.equal(await borrow.isDisabled(), true);
}

async function freight(page) {
  await fresh(page);
  await page.evaluate(() => {
    const state = newState('Freight fixture');
    Object.assign(state, { day: 15, cash: 40000, debt: 0 });
    startGame(state, false);
  });
  const button = page.locator('#side-body [data-act="freight"]');
  await button.tap();
  const bonded = page.locator('[data-choice="1"]');
  assert.equal(await bonded.isDisabled(), true);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { S.holdTier = 1; renderAll(); });
  await page.waitForTimeout(440);
  await button.tap();
  await page.waitForTimeout(440);
  await bonded.tap();
  const signed = await page.evaluate(() => ({ cash: S.cash, used: holdUsed(), job: S.contracts[0] }));
  assert.deepEqual([signed.cash, signed.used, signed.job.bond], [22000, 40, 18000]);
  await fresh(page);
  await page.locator('#t-cont').tap();
  assert.deepEqual(await page.evaluate(() => S.contracts[0]), signed.job);
  assert.equal(await button.count(), 0);
  await page.evaluate(() => { rollVoyageEvent = () => null; rollArrivalEvent = () => null; });
  await page.locator('#mnav [data-v="map"]').tap();
  await page.locator('#nodes [data-d="' + signed.job.to + '"]').tap();
  await page.locator('#tcard-slot [data-act="sail"]').tap();
  await page.waitForFunction(() => S.day === 16 && !busy && !S.trip);
  assert.deepEqual(await page.evaluate(() => [S.cash, holdUsed(), S.contracts.length]), [64000, 0, 0]);
  await fresh(page);
  await page.locator('#t-cont').tap();
  assert.deepEqual(await page.evaluate(() => [S.cash, S.freightSlot]), [64000, 0]);
}

async function heavyFreight(page) {
  await fresh(page);
  await page.evaluate(() => {
    const state = newState('Heavy freight fixture');
    Object.assign(state, { loc: 'ch', day: 24, cash: 200000, debt: 0, holdTier: 2 });
    startGame(state, false);
  });
  await page.locator('#side-body [data-act="freight"]').tap();
  const choice = page.locator('[data-choice="2"]');
  assert.match(await choice.innerText(), /65 hold.*2 nights.*50,000.*96,000.*more encounters/s);
  await page.waitForTimeout(450);
  await choice.tap();
  const signed = await page.evaluate(() => ({
    cash: S.cash, used: holdUsed(), cargo: S.contracts[0], risk: encounterChance(S.contracts[0].to)
  }));
  assert.deepEqual([signed.cash, signed.used, signed.cargo.bond, signed.cargo.due], [150000, 65, 50000, 27]);
  await fresh(page);
  await page.locator('#t-cont').tap();
  assert.deepEqual(await page.evaluate(() => S.contracts[0]), signed.cargo);
  const remaining = await page.evaluate(() => {
    S.contracts = [];
    S.day = 25;
    return freightOffers().map(job => job.size);
  });
  assert.deepEqual(remaining, [10, 40]);
  assert(await page.evaluate(dest => encounterChance(dest), signed.cargo.to) < signed.risk);
}

async function finalPreview(page) {
  await fresh(page);
  await page.evaluate(() => {
    const state = newState('Settlement fixture');
    Object.assign(state, { day: 30, cash: 4518, debt: 0 });
    state.cargo.eels = { q: 1, cost: 2400 };
    state.prices.lq.eels = 2855;
    state.stock.lq.eels = false;
    startGame(state, false);
  });
  const settle = page.locator('.final-banner [data-act="settle"]');
  await page.waitForFunction(() => {
    const button = document.querySelector('.final-banner [data-act="settle"]');
    if (!button) return false;
    const rect = button.getBoundingClientRect();
    return rect.height > 0 && rect.top >= 0 && rect.bottom <= innerHeight
      && button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
  });
  assert.match(await page.locator('.final-banner').innerText(), /5,946.*1,428 at half value/s);
  await settle.tap();
  assert.match(await page.locator('#modal').innerText(), /1,428.*5,946/s);
  await page.waitForTimeout(450);
  await page.locator('[data-choice="yes"]').tap();
  assert.match(await page.locator('#final-n').innerText(), /5,946/);
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
    ['repair and quote guides offer reachable options and compare a mixed hold', marketGuide],
    ['bonded freight needs upgraded hold space and pays once across reload', freight],
    ['heavy freight saves the larger stake and can be accepted once', heavyFreight],
    ['settlement prediction matches the result and stays above the fold', finalPreview]
  ]);
  await run(chromium, { viewport: { width: 1280, height: 800 } }, [
    ['keyboard follows Sail and keeps context after trading and sailing', keyboardTrade],
    ['repeat borrowing cannot enlarge the credit limit', creditLine],
    ['fleet order varies and persists, with focus held inside the tour', calendarAndTour]
  ]);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
