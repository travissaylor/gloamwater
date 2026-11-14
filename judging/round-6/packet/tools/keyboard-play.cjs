#!/usr/bin/env node
'use strict';
// Full game through native keyboard events, with no programmatic focus, pointer
// action, resource fixture, dispatchEvent or direct gameplay-function action.
// Usage: node tools/keyboard-play.cjs --game game/index.html --seed 31
//        --out tools/keyboard-evidence
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const { TouchRun, observe, surface, seedStart } = require('./touch-play.cjs');
const insist = (ok, message) => { if (!ok) throw Error(message); };
function parse(argv) {
  const a = { game: path.resolve(__dirname, '../game/index.html'), out: path.join(__dirname, 'keyboard-evidence'), seed: 31, fast: true };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--game') a.game = path.resolve(argv[++i]);
    else if (argv[i] === '--out') a.out = path.resolve(argv[++i]);
    else if (argv[i] === '--seed') a.seed = Number(argv[++i]);
    else throw Error('Unknown option ' + argv[i]);
  }
  return a;
}
function captureInput() {
  const e = window.__keyboardEvidence = { keys: {}, pointerEvents: {}, nativeKeyboardClicks: 0, pointerClicks: 0, inputEvents: 0, focusOutsideOpenModal: [] };
  for (const name of ['pointerdown', 'pointerup', 'pointermove', 'touchstart', 'touchend', 'touchmove', 'mousedown', 'mouseup', 'mousemove']) {
    addEventListener(name, () => { e.pointerEvents[name] = (e.pointerEvents[name] || 0) + 1; }, true);
  }
  addEventListener('keydown', event => { e.keys[event.key] = (e.keys[event.key] || 0) + 1; }, true);
  addEventListener('input', () => { e.inputEvents++; }, true);
  addEventListener('click', event => { if (event.detail === 0) e.nativeKeyboardClicks++; else e.pointerClicks++; }, true);
  addEventListener('focusin', event => {
    const modal = document.querySelector('#modal');
    if (modal && !modal.hidden && !modal.contains(event.target)) e.focusOutsideOpenModal.push({ tag: event.target.tagName, id: event.target.id });
  }, true);
}
class KeyboardRun extends TouchRun {
  constructor(page, config) {
    super(page, config, 1);
    this.focusTrails = [];
    this.tabPresses = 0;
  }
  // All focus changes come from native Tab/Shift+Tab. DOM reads choose the
  // shorter direction in the current visible focus order, then verify the real
  // activeElement after every key. No locator.focus() or element.focus().
  async focusByTab(selector) {
    const target = this.page.locator(selector).first();
    await target.waitFor({ state: 'visible', timeout: 10000 });
    const trail = [];
    let searchDirection = null;
    for (let i = 0; i < 200; i++) {
      const state = await this.page.evaluate(selector => {
        const visible = el => !!el && !el.closest('[inert]') && !el.disabled && el.getAttribute('tabindex') !== '-1' && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
        const targets = [...document.querySelectorAll(selector)].filter(visible);
        const wanted = targets[0], active = document.activeElement;
        const modal = document.querySelector('#modal');
        const scope = modal && !modal.hidden ? modal : document;
        const order = [...scope.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')].filter(visible);
        const index = order.indexOf(active), goal = order.indexOf(wanted);
        const describe = el => el ? { tag: el.tagName, id: el.id || '', cls: typeof el.className === 'string' ? el.className : el.getAttribute('class'), text: (el.textContent || '').trim().slice(0, 45) } : null;
        return { reached: !!wanted && active === wanted, index, goal, total: order.length, active: describe(active), wanted: describe(wanted), activeInsideModal: !modal || modal.hidden || modal.contains(active) };
      }, selector);
      if (state.reached) {
        this.focusTrails.push({ selector, presses: trail.length, reached: state.active });
        this.record({ action: 'keyboard-focus', selector, presses: trail.length, target: state.active });
        return;
      }
      insist(state.goal >= 0, `Target is not in the visible keyboard order: ${selector}; ${JSON.stringify(state)}`);
      const forward = state.index >= 0 ? (state.goal - state.index + state.total) % state.total : state.goal + 1;
      const backward = state.index >= 0 ? (state.index - state.goal + state.total) % state.total : state.total - state.goal;
      // Chromium also places some scroll containers in the native focus order
      // without a tabindex. Keep this direction for the whole search: changing
      // direction whenever such a stop has index -1 can oscillate forever.
      if (!searchDirection) searchDirection = backward < forward ? 'Shift+Tab' : 'Tab';
      const key = searchDirection;
      trail.push({ key, active: state.active });
      await this.page.keyboard.press(key);
      this.tabPresses++;
      await this.page.waitForTimeout(12);
      // Repeated cycles mean a real inaccessible target or focus-management
      // conflict. Preserve the trail instead of bypassing it with script focus.
      if (trail.length > state.total * 3 + 10) break;
    }
    this.record({ action: 'keyboard-focus-failed', selector, trail });
    throw Error('Tab navigation could not reach ' + selector + '; last focus: ' + JSON.stringify(trail.slice(-12)));
  }
  desktopSelector(selector) {
    if (selector === '#mnav [data-v="market"]') return '#tab-market';
    if (selector === '#mnav [data-v="harbor"]') return '#tab-harbor';
    return selector;
  }
  async tap(requested) {
    if (requested === '#mnav [data-v="map"]') {
      insist(await this.page.locator('#panel-map').isVisible(), 'Desktop map is not visible');
      this.record({ action: 'desktop-map-already-visible' });
      return;
    }
    const selector = this.desktopSelector(requested);
    await this.focusByTab(selector);
    const kind = await this.page.evaluate(() => ({ tag: document.activeElement.tagName.toLowerCase(), cls: document.activeElement.getAttribute('class') || '' }));
    // Space uses native button activation and avoids modal-specific Enter
    // handlers interpreting Cancel as confirmation. Rows and SVG nodes expose
    // their documented Enter handler instead.
    const key = kind.tag === 'button' ? 'Space' : 'Enter';
    this.record({ action: 'keyboard-activate', selector, key });
    await this.page.keyboard.press(key);
    await this.page.waitForTimeout(120);
  }
  async type(selector, value) {
    await this.focusByTab(selector);
    const text = selector === '#cap-name' ? 'Keyboard 1' : String(value);
    await this.page.keyboard.press('ControlOrMeta+A');
    await this.page.keyboard.type(text);
    this.record({ action: 'keyboard-type', selector, text });
    await this.page.waitForTimeout(80);
  }
  async resolve() {
    // FAST skips travel/night-card animation; no pointer fallback is allowed.
    // In particular, do not inherit TouchRun's touchscreen night-card skip.
    const deadline = Date.now() + 60000;
    let idleSince = null;
    while (Date.now() < deadline) {
      const ui = await surface(this.page);
      if (ui.ended) return 'ended';
      if (ui.choices.length) {
        const s = await observe(this.page), keys = ui.choices.map(c => c.key);
        const preference = ['ok', 'bribe', 'yield', 'pay', 'shelter', 'push', 'leave', 'no'];
        const key = preference.find(key => keys.includes(key)) || keys[0];
        const event = { day: s?.day, title: ui.title, choice: key, choiceText: ui.choices.find(c => c.key === key)?.text, text: ui.text };
        this.events.push(event);
        this.record({ action: 'keyboard-event', ...event });
        if (this.events.filter(e => e.title === ui.title).length === 1) await this.shot('event-' + ui.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 45));
        await this.tap(`#modal [data-choice="${key}"]`);
        idleSince = null;
        continue;
      }
      if (ui.night) {
        // Native keydown is a documented voyage skip input, if a night card
        // survives a future animation change. Still no mouse/touch fallback.
        await this.page.keyboard.press('Space');
        this.record({ action: 'keyboard-nightcard-skip', key: 'Space' });
        await this.page.waitForTimeout(120);
        continue;
      }
      if (ui.modal) throw Error('Unexpected non-choice modal: ' + ui.text.slice(0, 300));
      if (!ui.busy) {
        if (idleSince === null) idleSince = Date.now();
        if (Date.now() - idleSince >= 200) return 'ready';
      } else idleSince = null;
      await this.page.waitForTimeout(80);
    }
    throw Error('Keyboard voyage/event resolution timed out: ' + JSON.stringify(await surface(this.page)));
  }
}
async function main(config) {
  fs.mkdirSync(config.out, { recursive: true });
  const report = {
    createdAt: new Date().toISOString(), config,
    driverSha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
    method: 'Chromium 1280x800, native Tab/Shift+Tab to actual activeElement, Space on native buttons, Enter on focusable rows/SVG nodes, native typing. No scripted focus, pointer, dispatchEvent, direct gameplay functions or resource fixtures. Existing current-information traveller policy reused.',
    timing: 'FAST=true and prefers-reduced-motion:reduce; animation-only acceleration. Native key presses still traverse the real UI.',
    limitations: ['One seeded conservative strategy; combat, every upgrade and every event branch are not exhaustive.', 'Desktop Chromium keyboard coverage; this does not establish phone external-keyboard or screen-reader behavior.', 'Audio context/policy can be logged, but audible sound quality is not evaluated.'],
    navigationResponses: []
  };
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  await context.addInitScript(captureInput);
  await context.addInitScript(seedStart, config.seed);
  await context.setOffline(true);
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [], network = [], responseTasks = [], inputDocuments = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  context.on('request', r => { if (/^https?:/i.test(r.url())) network.push(r.url()); });
  page.on('response', response => {
    if (response.request().isNavigationRequest() && response.frame() === page.mainFrame()) responseTasks.push(response.body().then(body => report.navigationResponses.push({ url: response.url(), sha256: crypto.createHash('sha256').update(body).digest('hex') })).catch(() => {}));
  });
  // Preserve the pre-reload event counters too. init scripts intentionally
  // create a fresh counter for each document; total coverage sums both.
  await page.exposeFunction('__recordKeyboardDocument', data => { inputDocuments.push(data); });
  await context.addInitScript(() => {
    addEventListener('beforeunload', () => { if (window.__keyboardEvidence) window.__recordKeyboardDocument(window.__keyboardEvidence); });
  });
  const traveller = new KeyboardRun(page, config);
  try {
    report.result = await traveller.play();
    inputDocuments.push(await page.evaluate(() => window.__keyboardEvidence));
    await Promise.all(responseTasks);
    report.inputDocuments = inputDocuments;
    const pointerCount = inputDocuments.reduce((n, doc) => n + Object.values(doc.pointerEvents).reduce((a, b) => a + b, 0) + doc.pointerClicks, 0);
    report.pointerEventCount = pointerCount;
    report.tabPresses = traveller.tabPresses;
    report.focusTrails = traveller.focusTrails;
    insist(pointerCount === 0, 'Pointer/touch/mouse activity invalidates keyboard-only claim: ' + pointerCount);
    insist(report.result.day === 30 && !report.result.sunk && report.result.reachedSettlementScreen, 'Keyboard run did not complete all 30 nights and settle');
    insist(errors.length === 0, 'Game console/page errors: ' + errors.join('; '));
    insist(network.length === 0, 'Runtime network requests: ' + network.join('; '));
    insist(inputDocuments.some(d => d.nativeKeyboardClicks > 0 && (d.keys.Tab || d.keys.Shift)), 'Native keyboard activation/focus evidence is absent');
    report.pass = true;
  } catch (e) {
    report.pass = false; report.error = e.stack;
    await traveller.shot('failure').catch(() => {});
    report.surface = await surface(page).catch(() => null);
    report.observation = await observe(page).catch(() => null);
    report.inputDocuments = [...inputDocuments, await page.evaluate(() => window.__keyboardEvidence).catch(() => null)].filter(Boolean);
    report.tabPresses = traveller.tabPresses;
    report.focusTrails = traveller.focusTrails;
    report.turns = traveller.turns;
    await Promise.all(responseTasks);
  } finally {
    report.errors = errors; report.network = network;
    fs.writeFileSync(path.join(config.out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    await context.close();
    await browser.close();
    console.log(JSON.stringify({ pass: report.pass, day: report.result?.day, sunk: report.result?.sunk, pointerEvents: report.pointerEventCount, error: report.error?.split('\n')[0], report: path.join(config.out, 'report.json') }));
  }
  return report;
}
module.exports = { KeyboardRun, main };
if (require.main === module) main(parse(process.argv.slice(2))).then(r => { process.exitCode = r.pass ? 0 : 1; }).catch(e => { console.error(e); process.exitCode = 1; });
