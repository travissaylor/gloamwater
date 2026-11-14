#!/usr/bin/env node
'use strict';
// UI regression traveller, not a scoring tool. Every gameplay mutation is made by
// a real touch event or typed input. evaluate() only reads player-visible state.
// Usage: node tools/touch-play.cjs --game game/index.html --seed 31 --runs 1
//        --size 390x844 --out tools/touch-evidence [--normal-speed] [--headed]
// Independent judges can reuse the helpers/policy, or run it as supplementary
// regression evidence. It does not replace their own exploration or judgment.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { webkit, devices } = require('playwright');

function args(argv) {
  const a = { game: path.join(__dirname, '../game/index.html'), out: path.join(__dirname, 'touch-evidence'), seed: 31, runs: 1, size: '390x844', fast: true, headed: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = () => argv[++i];
    if (k === '--game') a.game = path.resolve(v());
    else if (k === '--out') a.out = path.resolve(v());
    else if (k === '--seed') a.seed = Number(v());
    else if (k === '--runs') a.runs = Number(v());
    else if (k === '--size') a.size = v();
    else if (k === '--normal-speed') a.fast = false;
    else if (k === '--headed') a.headed = true;
    else throw Error('Unknown option ' + k);
  }
  if (!/^\d+x\d+$/.test(a.size)) throw Error('--size must be WIDTHxHEIGHT');
  return a;
}
const AUDIO = fs.readFileSync(path.join(__dirname, 'phone/server.js'), 'utf8').match(/const AUDIO_INIT = `([\s\S]*?)`;/)[1];
const insist = (condition, message) => { if (!condition) throw Error(message); };
function seedStart(seed) {
  let n = seed >>> 0;
  Math.random = () => { n |= 0; n = n + 0x6D2B79F5 | 0; let t = Math.imul(n ^ n >>> 15, 1 | n); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  // Title art also uses Math.random. Reset on the one actual Cast off gesture,
  // before its handler seeds the run. Never reset during an active voyage.
  let started = false;
  addEventListener('click', e => {
    if (!started && e.target.closest && e.target.closest('#go')) { n = seed >>> 0; started = true; }
  }, true);
}

// The observation deliberately excludes remote unseen prices, pending events,
// outcome fates, RNG states and other hidden state. Local quotes/max quantities,
// one's own cargo/cost, seen prices and the fleet calendar are shown by the UI.
async function observe(page) {
  return page.evaluate(() => {
    if (!S) return null;
    return {
      day: S.day, loc: S.loc, cash: S.cash, bank: S.bank, debt: S.debt, hull: S.hull,
      over: S.over, capacity: capacity(), used: holdUsed(), motor: S.motor,
      holdTier: S.holdTier, arms: S.arms, wireless: S.wireless,
      goods: GOODS.map(g => ({
        id: g.id, name: g.name, base: g.base, depth: [...g.depth],
        stock: S.stock[S.loc][g.id], price: price(g.id),
        owned: S.cargo[g.id].q, cost: S.cargo[g.id].cost,
        maxBuy: maxBuy(g.id), flatBuy: flatLeft(g.id, 'buy'),
        sellTotal: quoteSell(g.id, S.cargo[g.id].q),
        buyTotals: Array.from({ length: Math.min(80, maxBuy(g.id)) + 1 }, (_, q) => quoteBuy(g.id, q))
      })),
      districts: DISTRICTS.map(d => ({ id: d.id, name: d.name, danger: d.danger, cheap: [...d.cheap], dear: [...d.dear], services: [...d.svc] })),
      seen: JSON.parse(JSON.stringify(S.seen)),
      canals: EDGES.map(e => [...e]),
      fleet: typeof FLEET_CALLS === 'undefined' ? [] : FLEET_CALLS.map(f => ({ d: f.d, g: f.g })),
      upgrade: { hold: HOLD_TIERS[S.holdTier + 1] || null, motor: MOTORS[S.motor + 1] || null },
      finalText: document.querySelector('.end-hero') ? document.querySelector('#modal').innerText : null
    };
  });
}
async function surface(page) {
  return page.evaluate(() => ({
    busy: typeof busy !== 'undefined' && busy,
    ended: !!document.querySelector('.end-hero'),
    night: !!document.querySelector('.nightcard'),
    modal: !document.querySelector('#modal').hidden,
    title: document.querySelector('#modal h3')?.innerText || '',
    text: document.querySelector('#modal')?.innerText || '',
    choices: [...document.querySelectorAll('#modal [data-choice]:not(:disabled)')].map(b => ({ key: b.dataset.choice, text: b.innerText })),
    coachSkip: !!document.querySelector('#coach [data-skip]')
  }));
}
function fleetAt(s, day) {
  const f = s.fleet[Math.floor((day - 1) / 4)];
  return f ? { ...f, to: Math.min(30, Math.floor((day - 1) / 4) * 4 + 4) } : null;
}
function destinationEstimate(s, d, g) {
  const identity = d.cheap.includes(g.id) ? .8 : d.dear.includes(g.id) ? 1.22 : 1;
  const f = fleetAt(s, s.day + 1);
  const structural = g.base * identity * (f?.d === d.id && f.g === g.id ? 1.4 : 1);
  const sn = s.seen[d.id]?.[g.id];
  if (!sn || s.day - sn.day > 3) return structural;
  // Stale prices are uncertain: blend back toward the known local identity.
  const age = s.day - sn.day, weight = age === 0 ? .8 : age === 1 ? .55 : .3;
  return sn.p * weight + structural * (1 - weight);
}
function planRoute(s) {
  const neighbours = s.canals.filter(([a, b]) => a === s.loc || b === s.loc).map(([a, b]) => a === s.loc ? b : a);
  const reserve = Math.min(Math.max(250, s.cash * .15), 10000);
  const routes = neighbours.map(id => {
    const d = s.districts.find(d => d.id === id);
    const free = s.capacity - s.used;
    let budget = Math.max(0, s.cash - reserve), slots = free;
    const buys = [];
    const candidates = s.goods.filter(g => g.stock && g.maxBuy > 0).map(g => {
      const expected = destinationEstimate(s, d, g);
      // Avoid buying past the displayed flat depth. Actual arrival prices remain unknown.
      const limit = Math.min(g.maxBuy, Math.max(1, Math.floor(g.flatBuy)), 80);
      let q = 0, best = 0;
      for (let n = 1; n <= limit; n++) {
        const cost = g.buyTotals[n], marginal = cost - g.buyTotals[n - 1];
        const locationDepth = g.depth[0] * ((d.cheap.includes(g.id) || d.dear.includes(g.id)) ? 1.5 : 1) * (fleetAt(s, s.day + 1)?.d === id && fleetAt(s, s.day + 1)?.g === g.id ? 2 : 1);
        const sale = expected * Math.exp(-Math.max(0, n - locationDepth) / (g.depth[1] * 1.5));
        if (sale < marginal * 1.12) break;
        const gain = sale * n - cost;
        if (gain > best) { best = gain; q = n; }
      }
      return { g, q, expected, gain: best, efficiency: best / Math.max(1, Math.min(g.buyTotals[q] || 1, s.cash / Math.max(1, free) * q)) };
    }).filter(x => x.q > 0).sort((a, b) => b.efficiency - a.efficiency);
    let expectedGain = 0;
    for (const c of candidates) {
      let q = Math.min(c.q, slots);
      while (q > 0 && c.g.buyTotals[q] > budget) q--;
      if (!q) continue;
      const cost = c.g.buyTotals[q];
      buys.push({ id: c.g.id, q, cost, expectedPrice: Math.round(c.expected) });
      slots -= q; budget -= cost;
      expectedGain += c.expected * q - cost;
    }
    for (const g of s.goods.filter(g => g.owned > 0)) expectedGain += Math.max(0, destinationEstimate(s, d, g) * g.owned - g.sellTotal);
    let serviceValue = 0;
    if (s.hull < 72 && id === 'ch') serviceValue += (100 - s.hull) * 120;
    if (s.hull < 45 && id === 'sl') serviceValue += (75 - s.hull) * 140;
    if (s.day >= 7 && s.debt > 0 && s.cash > s.debt * 1.25 && id === 'lq') serviceValue += Math.min(s.debt * .5, 15000);
    if (!s.wireless && s.cash > 14000 && id === 'de') serviceValue += 3500;
    if (s.motor === 0 && s.cash > 10000 && id === 'ch') serviceValue += 3000;
    return { id, buys, score: expectedGain * (1 - d.danger * .035) - d.danger * Math.min(800, s.cash * .01) + serviceValue, expectedGain: Math.round(expectedGain) };
  }).sort((a, b) => b.score - a.score);
  return routes[0];
}

class TouchRun {
  constructor(page, config, index) {
    this.page = page; this.config = config; this.index = index;
    this.events = []; this.actions = []; this.turns = []; this.shots = new Set();
    this.actionsPath = path.join(config.out, `run-${index}-actions.jsonl`);
    fs.writeFileSync(this.actionsPath, '');
  }
  record(action) {
    const entry = { at: new Date().toISOString(), ...action };
    this.actions.push(entry);
    fs.appendFileSync(this.actionsPath, JSON.stringify(entry) + '\n');
  }
  async tap(selector) {
    const locator = this.page.locator(selector).first();
    await locator.waitFor({ state: 'visible', timeout: 10000 });
    await locator.scrollIntoViewIfNeeded();
    this.record({ action: 'tap', selector, text: (await locator.innerText().catch(() => '')).slice(0, 160) });
    await locator.tap({ timeout: 10000 });
    // Keep real taps outside the game's 350ms transition guard. FAST changes
    // animation timing only; it does not bypass the game's guard or rules.
    await this.page.waitForTimeout(440);
  }
  async type(selector, number) {
    await this.tap(selector);
    await this.page.keyboard.press('ControlOrMeta+A');
    await this.page.keyboard.type(String(number));
    this.record({ action: 'type', selector, text: String(number) });
    await this.page.waitForTimeout(100);
  }
  async shot(label) {
    const name = `run-${this.index}-${label}`;
    if (this.shots.has(name)) return;
    this.shots.add(name);
    await this.page.screenshot({ path: path.join(this.config.out, name + '.png'), scale: 'css' });
  }
  async start() {
    const response = await this.page.goto(pathToFileURL(this.config.game).href);
    if (response) this.loadedSha256 = crypto.createHash('sha256').update(await response.body()).digest('hex');
    if (this.config.fast) await this.page.evaluate(() => { FAST = true; });
    await this.shot('title');
    await this.tap('#t-new');
    const name = this.page.locator('#cap-name');
    if (await name.isVisible()) await this.type('#cap-name', `Touch ${this.index}`);
    await this.tap('#go');
    // coachOpen is set before showCoach's RAF creates the actual button.
    // Waiting for this visible control avoids the startup race entirely.
    await this.page.locator('#coach [data-skip]').waitFor({ state: 'visible', timeout: 10000 });
    await this.tap('#coach [data-skip]');
    await this.page.locator('.rows .row').first().waitFor({ state: 'visible' });
    await this.shot('market-night-1');
  }
  async resolve() {
    const deadline = Date.now() + 60000;
    let idleSince = null;
    for (let guard = 0; guard < 100 && Date.now() < deadline; guard++) {
      const ui = await surface(this.page);
      if (ui.ended) return 'ended';
      if (ui.choices.length) {
        const state = await observe(this.page);
        const keys = ui.choices.map(x => x.key);
        let key;
        if (keys.includes('ok')) key = 'ok'; // also advances a recorded sinking to its actual ending
        else if (keys.includes('bribe')) key = 'bribe';
        else if (keys.includes('yield')) key = 'yield';
        else if (keys.includes('pay')) key = 'pay';
        else if (keys.includes('shelter')) key = 'shelter';
        else if (keys.includes('push')) key = 'push';
        else if (keys.includes('leave')) key = 'leave';
        else if (keys.includes('no')) key = 'no';
        else key = keys[0];
        const event = { day: state?.day, title: ui.title, choice: key, choiceText: ui.choices.find(x => x.key === key)?.text, text: ui.text };
        this.events.push(event);
        this.record({ action: 'event', ...event });
        if (this.events.filter(x => x.title === ui.title).length === 1) await this.shot('event-' + ui.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 45));
        await this.tap(`#modal [data-choice="${key}"]`);
        idleSince = null;
        continue;
      }
      if (ui.night) {
        await this.page.touchscreen.tap(195, 280);
        this.record({ action: 'tap-nightcard', x: 195, y: 280 });
        await this.page.waitForTimeout(440);
        continue;
      }
      if (ui.modal) throw Error('Unexpected non-choice modal: ' + ui.text.slice(0, 300));
      if (!ui.busy) {
        if (idleSince === null) idleSince = Date.now();
        if (Date.now() - idleSince > 350) return 'ready';
      } else idleSince = null;
      await this.page.waitForTimeout(140);
    }
    throw Error('Voyage/event resolution timed out: ' + JSON.stringify(await surface(this.page)));
  }
  async market() {
    await this.tap('#mnav [data-v="market"]');
  }
  async trade(id, mode, q) {
    const before = await observe(this.page), good = before.goods.find(g => g.id === id);
    if (q <= 0 || !good.stock) return;
    await this.tap(`.row[data-g="${id}"]`);
    const currentMode = await this.page.locator(`#modal [data-mode="${mode}"]`).getAttribute('aria-pressed');
    if (currentMode !== 'true') await this.tap(`#modal [data-mode="${mode}"]`);
    await this.type('#qin', q);
    const confirm = this.page.locator('#qgo');
    if (!(await confirm.isEnabled())) {
      await this.tap('#modal [data-x]');
      this.record({ action: 'trade-disabled', id, mode, q });
      return;
    }
    await this.tap('#qgo');
    const after = await observe(this.page), now = after.goods.find(g => g.id === id);
    const expected = mode === 'buy' ? good.owned + q : good.owned - q;
    insist(now.owned === expected, `Trade UI changed wrong quantity: ${mode} ${id} ${q}; ${good.owned} -> ${now.owned}`);
    this.record({ action: 'trade-result', id, mode, q, cashBefore: before.cash, cashAfter: after.cash, ownedBefore: good.owned, ownedAfter: now.owned });
  }
  async sellCargo() {
    await this.market();
    let state = await observe(this.page);
    for (const g of state.goods.filter(g => g.owned && g.stock)) {
      // A conservative trader cashes out when there is a profit, a high local
      // price, or the deadline is close. Otherwise carry to an import district.
      if (g.sellTotal >= g.owned * g.cost * 1.02 || g.price >= g.base * 1.1 || state.day >= 29) await this.trade(g.id, 'sell', g.owned);
    }
  }
  async amount(action, value) {
    await this.tap(`#side-body [data-act="${action}"]`);
    await this.type('#ain', Math.floor(value));
    await this.tap('#ago');
    this.record({ action: 'service', service: action, amount: Math.floor(value) });
  }
  async buyUpgrade(action) {
    await this.tap(`#side-body [data-act="${action}"]`);
    await this.tap('#modal [data-choice="yes"]');
    this.record({ action: 'upgrade', upgrade: action });
  }
  async services() {
    let s = await observe(this.page);
    const d = s.districts.find(d => d.id === s.loc);
    const relevant = d.services.some(k => ['lender', 'yard', 'gutter', 'wireless', 'vault'].includes(k));
    if (!relevant) return;
    await this.tap('#mnav [data-v="harbor"]');
    const enabled = async action => { const b = this.page.locator(`#side-body [data-act="${action}"]`); return await b.count() > 0 && await b.isEnabled(); };
    if (s.hull < 90 && await enabled('repair')) {
      await this.tap('#side-body [data-act="repair"]');
      this.record({ action: 'service', service: 'repair' });
    } else if (s.hull < 70 && await enabled('patch')) {
      await this.tap('#side-body [data-act="patch"]');
      this.record({ action: 'service', service: 'patch' });
    }
    s = await observe(this.page);
    if (s.debt > 0 && await enabled('repay') && s.cash > s.debt + 1200) await this.amount('repay', s.debt);
    s = await observe(this.page);
    if (s.day < 23 && !s.wireless && s.cash > 15000 && await enabled('wireless')) await this.buyUpgrade('wireless');
    s = await observe(this.page);
    if (s.day < 24 && s.motor < 2 && s.upgrade.motor && s.cash > s.upgrade.motor.cost * 2.5 + 1500 && await enabled('motor')) await this.buyUpgrade('motor');
    s = await observe(this.page);
    if (s.day < 23 && s.holdTier < 2 && s.upgrade.hold && s.cash > s.upgrade.hold.cost * 3 + 1500 && await enabled('hold')) await this.buyUpgrade('hold');
    s = await observe(this.page);
    if (s.cash > 100000 && await enabled('deposit')) await this.amount('deposit', Math.floor((s.cash - 50000) * .6));
    await this.market();
  }
  async sail(destination, day) {
    await this.tap('#mnav [data-v="map"]');
    await this.tap(`#nodes .node[data-d="${destination}"]`);
    if ([1, 10, 20, 29].includes(day)) await this.shot(`map-night-${day}`);
    await this.tap(`#tcard-slot [data-act="sail"]`);
    await this.resolve();
  }
  async finish() {
    await this.market();
    await this.tap('#side-body [data-act="settle"]');
    await this.tap('#modal [data-choice="yes"]');
    await this.page.locator('.end-hero').waitFor({ state: 'visible', timeout: 10000 });
  }
  async play() {
    await this.start();
    for (let turn = 0; turn < 40; turn++) {
      const resolution = await this.resolve();
      if (resolution === 'ended') break;
      let s = await observe(this.page);
      console.log(`run ${this.index} night ${s.day} ${s.loc} cash ${s.cash} debt ${s.debt} hull ${s.hull}`);
      this.turns.push({ day: s.day, loc: s.loc, cash: s.cash, bank: s.bank, debt: s.debt, hull: s.hull, used: s.used, capacity: s.capacity });
      await this.sellCargo();
      await this.services();
      s = await observe(this.page);
      if ([5, 10, 15, 20, 25, 30].includes(s.day)) await this.shot(`market-night-${s.day}`);
      if (s.day >= 30) { await this.finish(); break; }
      const plan = planRoute(s);
      insist(plan, 'No adjacent district plan');
      this.record({ action: 'plan', day: s.day, loc: s.loc, ...plan });
      for (const buy of plan.buys.slice(0, 2)) {
        const now = await observe(this.page), good = now.goods.find(g => g.id === buy.id);
        const q = Math.min(buy.q, good.maxBuy, now.capacity - now.used);
        if (q > 0) await this.trade(buy.id, 'buy', q);
      }
      await this.sail(plan.id, s.day);
    }
    const ending = await surface(this.page);
    insist(ending.ended, 'Run ended without visible settlement screen');
    await this.shot('settled');
    const state = await observe(this.page);
    const body = await this.page.locator('#modal').innerText();
    const entriesBefore = await this.page.evaluate(() => loadScores().map(e => ({ name: e.name, score: e.score, night: e.night, sunk: e.sunk })));
    const audio = await this.page.evaluate(() => ({ shim: window.__pwAudio?.shim || null, sounds: window.__pwAudio?.sounds, contexts: (window.__pwAudio?.ctxs || []).map(x => ({ createdIn: x.rec.createdIn, state: x.c.state, resumes: x.rec.resumes })) }));
    await this.page.reload();
    await this.tap('#t-ledger');
    const entriesAfter = await this.page.evaluate(() => loadScores().map(e => ({ name: e.name, score: e.score, night: e.night, sunk: e.sunk })));
    insist(JSON.stringify(entriesBefore) === JSON.stringify(entriesAfter), 'Ledger entries did not survive reload');
    return {
      loadedSha256: this.loadedSha256,
      day: state.day, sunk: state.hull <= 0, reachedSettlementScreen: true,
      distinctPorts: [...new Set(this.turns.map(t => t.loc))], ending: body,
      finalState: { cash: state.cash, bank: state.bank, debt: state.debt, hull: state.hull, used: state.used, capacity: state.capacity },
      turns: this.turns, events: this.events, actions: this.actions.length,
      entriesBefore, ledgerSurvivedReload: true, audio
    };
  }
}
async function run(config) {
  fs.mkdirSync(config.out, { recursive: true });
  const file = fs.readFileSync(config.game);
  const report = {
    game: config.game, sha256: crypto.createHash('sha256').update(file).digest('hex'),
    driverSha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
    createdAt: new Date().toISOString(), config,
    method: 'WebKit real touch gameplay; quantities and amounts use native keyboard typing. Reads only local quotes/inventory, remembered seen prices and public map/calendar. No direct game action calls or resource/state fixtures.',
    timing: config.fast ? 'FAST=true and prefers-reduced-motion:reduce; animation-only acceleration, 440ms between taps' : 'Normal game timing and no reduced-motion preference; 440ms between taps',
    limitations: [
      'Windows WebKit emulates iPhone profile; no physical iPhone/Safari chrome, safe areas or software keyboard.',
      'WebKit lacks Web Audio here; existing harness stand-in records unlock policy and cannot assess audible quality.',
      'The policy is one conservative traveller, not an exhaustive balance or strategy comparison.',
      'This driver is supplementary verification; independent judges should explore and assess the game themselves.'
    ], runs: []
  };
  const [width, height] = config.size.split('x').map(Number);
  const browser = await webkit.launch({ headless: !config.headed });
  try {
    for (let index = 1; index <= config.runs; index++) {
      const context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: config.fast ? 'reduce' : 'no-preference' });
      const errors = [], network = [];
      await context.addInitScript(AUDIO);
      // Deterministic initialization only. The policy never observes RNG or
      // queued outcomes; no outcome is selected or re-rolled during the run.
      await context.addInitScript(seedStart, config.seed + index - 1);
      await context.setOffline(true);
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      context.on('request', r => { if (/^https?:/i.test(r.url())) network.push(r.url()); });
      const traveller = new TouchRun(page, config, index);
      try {
        const result = await traveller.play();
        report.runs.push({ index, seed: config.seed + index - 1, pass: errors.length === 0 && network.length === 0, ...result, errors, network });
      } catch (e) {
        await traveller.shot('failure').catch(() => {});
        report.runs.push({ index, seed: config.seed + index - 1, pass: false, error: e.stack, surface: await surface(page).catch(() => null), observation: await observe(page).catch(() => null), turns: traveller.turns, events: traveller.events, errors, network });
      } finally {
        fs.writeFileSync(path.join(config.out, `run-${index}.json`), JSON.stringify(report.runs[report.runs.length - 1], null, 2) + '\n');
        await context.close();
      }
    }
  } finally {
    await browser.close();
    report.pass = report.runs.length === config.runs && report.runs.every(r => r.pass);
    report.fullThirtyNightRuns = report.runs.filter(r => r.pass && r.day === 30 && !r.sunk && r.reachedSettlementScreen).length;
    fs.writeFileSync(path.join(config.out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ pass: report.pass, fullThirtyNightRuns: report.fullThirtyNightRuns, runs: report.runs.map(r => ({ index: r.index, pass: r.pass, day: r.day, sunk: r.sunk, error: r.error?.split('\n')[0] })), report: path.join(config.out, 'report.json') }));
  }
  return report;
}
module.exports = { TouchRun, observe, surface, planRoute, seedStart, run };
if (require.main === module) run(args(process.argv.slice(2))).then(report => { process.exitCode = report.pass ? 0 : 1; }).catch(e => { console.error(e); process.exitCode = 1; });
