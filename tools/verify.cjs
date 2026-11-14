#!/usr/bin/env node
'use strict';
// Run from the repo root: node tools/verify.cjs [--game path] [--out path] [--only "check name"]
// UI regressions use actual mouse/touch events. Full runs use the external simulator,
// calling the game's real trade/voyage/event functions; they are not manual playtests.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { chromium, webkit, devices } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const gameArg=process.argv.indexOf('--game');
const GAME = gameArg<0?path.join(ROOT, 'game/index.html'):path.resolve(process.argv[gameArg+1]);
const URL = pathToFileURL(GAME).href;
const outArg = process.argv.indexOf('--out');
const onlyArg = process.argv.indexOf('--only');
const ONLY = onlyArg < 0 ? null : process.argv[onlyArg+1];
const OUT = outArg < 0 ? path.join(__dirname, 'verification') : path.resolve(process.argv[outArg + 1]);
fs.mkdirSync(OUT, { recursive: true });
const source = fs.readFileSync(GAME, 'utf8');
const report = {
  generatedAt: new Date().toISOString(),
  gameSha256: crypto.createHash('sha256').update(source).digest('hex'),
  bytes: Buffer.byteLength(source), selection:ONLY || 'all', checks: [],
  limitations: [
    'Emulated WebKit on Windows is not a physical iPhone; no real keyboard, browser toolbar, safe-area or silent-switch test.',
    'WebKit AudioContext stand-in tests gesture policy, not audible sound quality.',
    'Full-game regressions run the informed policy through external simulator functions, not human touch play.',
    'UI tests set FAST=true and reduced motion to avoid Windows headless WebKit animation throttling.'
  ]
};
function assert(ok, message) { if (!ok) throw new Error(message); }
async function check(name, fn) {
  if(ONLY && name!==ONLY)return;
  const started = Date.now();
  try { const evidence = await fn(); report.checks.push({ name, pass: true, ms: Date.now() - started, evidence }); }
  catch (e) { report.checks.push({ name, pass: false, ms: Date.now() - started, error: e.stack || String(e) }); }
  const item = report.checks[report.checks.length - 1];
  console.log(`${item.pass ? 'PASS' : 'FAIL'} ${name}${item.error ? ': ' + item.error.split('\n')[0] : ''}`);
}
// Reuse the existing phone harness's documented WebKit audio-policy instrument.
const harness = fs.readFileSync(path.join(__dirname, 'phone/server.js'), 'utf8');
const audioInit = harness.match(/const AUDIO_INIT = `([\s\S]*?)`;/)[1];
const simSource = fs.readFileSync(path.join(__dirname, 'sim/sim.js'), 'utf8');
const rngInit = simSource.match(/const RNG_INIT = `([\s\S]*?)`;/)[1];
const pause = page => page.waitForTimeout(550);
async function act(page, selector, touch) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: 'visible' });
  await el.scrollIntoViewIfNeeded();
  if (touch) await el.tap(); else await el.click();
  await pause(page);
}
async function boot(page, touch) {
  await page.goto(URL);
  assert(await page.locator('#title animate').count() === 0, 'Title SVG animation ignores reduced motion');
  await page.waitForFunction(() => /^t-(new|cont)$/.test(document.activeElement.id));
  for (const key of ['Shift+Tab', 'Tab']) for (let i = 0; i < 12; i++) {
    await page.keyboard.press(key);
    assert(await page.evaluate(() => !document.querySelector('#app').contains(document.activeElement)), 'Title focus entered the covered game');
  }
  await act(page, '#t-help', touch);
  await page.keyboard.press('Escape');
  await pause(page);
  assert(await page.evaluate(() => document.querySelector('#app').inert), 'Closing title help exposed background controls to focus');
  await page.evaluate(() => { FAST = true; });
  await act(page, '#t-new', touch);
  await act(page, '#go', touch);
  await page.waitForFunction(() => !!S && !document.querySelector('#app').hasAttribute('hidden'));
  // The tour opens on a timer; under loaded WebKit it may appear well after 650ms.
  await page.waitForFunction(() => settings.tutorial || document.querySelector('[data-skip]'));
  const skip = page.locator('[data-skip]');
  if (await skip.isVisible()) await act(page, '[data-skip]', touch);
  await page.waitForFunction(() => !coachOpen);
  assert(await page.evaluate(() => S.day === 1), 'UI did not start on night 1');
}
async function instrument(browser, opts) {
  const context = await browser.newContext({ ...opts, reducedMotion: 'reduce' });
  await context.addInitScript(audioInit);
  await context.addInitScript(rngInit);
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [], network = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  context.on('request', r => { if (/^https?:/i.test(r.url())) network.push(r.url()); });
  return { context, page, errors, network };
}
async function uiCase(browser, name, opts, touch) {
  const { context, page, errors, network } = await instrument(browser, opts);
  try {
    await boot(page, touch);
    const good = await page.evaluate(() => {
      const g = GOODS.find(g => S.stock[S.loc][g.id] && maxBuy(g.id) >= 2);
      return { id: g.id, before: S.cargo[g.id].q };
    });
    await act(page, `.row[data-g="${good.id}"]`, touch);
    await act(page, '#qin', touch);
    await page.keyboard.type('2');
    await pause(page);
    await act(page, '#qgo', touch); // Deliberately one tap only, after the focused input.
    const bought = await page.evaluate(id => S.cargo[id].q, good.id);
    assert(bought === good.before + 2, 'First confirm tap after typing did not buy exactly 2 units');
    await act(page, '#st-debt', touch);
    assert(await page.locator('#modal').isVisible(), 'HUD debt explanation did not open');
    const hudTitle = await page.locator('#modal h3').first().innerText();
    for (let i=0;i<12;i++) {
      await page.keyboard.press(i%2?'Shift+Tab':'Tab');
      assert(await page.evaluate(() => !!document.activeElement.closest('#modal')), 'Keyboard focus escaped the modal');
    }
    assert(await page.evaluate(() => document.querySelector('#app').inert), 'Covered game is not inert');
    await page.keyboard.press('Escape');
    await pause(page);
    assert(await page.evaluate(() => !document.querySelector('#app').inert), 'Background stayed inert after closing modal');
    const fixture = await page.evaluate(() => {
      let g = GOODS.find(g => !S.stock[S.loc][g.id]);
      let planted = false;
      if (!g) { g = GOODS[GOODS.length - 1]; S.stock[S.loc][g.id] = false; renderSide(); planted = true; }
      return { id: g.id, planted };
    });
    await act(page, `.row[data-g="${fixture.id}"]`, touch);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');
    // Enter may activate the focused Close button on this informational sheet.
    if (await page.locator('#modal').isVisible()) await page.keyboard.press('Escape');
    await pause(page);
    await page.screenshot({ path: path.join(OUT, name + '-market.png'), scale: 'css' });
    if (touch) await act(page, '#mnav [data-v="map"]', true);
    const mapBefore=await page.locator('#map').boundingBox();
    await act(page, '#nodes .node[data-d="ch"]', touch);
    await act(page, '#nodes .node[data-d="ch"]', touch);
    assert(await page.evaluate(()=>sel==='ch'),'Repeated port selection unexpectedly cleared the destination');
    const map = await page.evaluate(() => {
      const b = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
      return {
        nodes: [...document.querySelectorAll('#nodes .node')].map(el => ({ id: el.dataset.d, ...b(el) })),
        card: b(document.querySelector('.tcard')),
        svg: b(document.querySelector('#map')),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        viewport: { width: innerWidth, height: innerHeight }
      };
    });
    assert(!map.overflow, 'Document has horizontal overflow');
    const small = map.nodes.filter(n => n.width < 43.5 || n.height < 43.5);
    assert(small.length === 0, 'Map nodes below 44px after selecting destination: ' + JSON.stringify(small));
    if(touch){
      assert(Math.abs(map.svg.height-mapBefore.height)<1,'Selecting destination resized the map');
      const sail=await page.locator('.tcard [data-act="sail"]').boundingBox();
      const nav=await page.locator('#mnav').boundingBox();
      assert(sail && sail.height>=44 && sail.y>=0 && sail.y+sail.height<=nav.y+1,'Sail is clipped behind navigation');
    }
    await page.screenshot({ path: path.join(OUT, name + '-selected-map.png'), scale: 'css' });
    // Separate final-night fixture: the settlement banner must not cover the last good.
    await page.evaluate(() => { S.day=30;setView('market'); });
    const last=page.locator('.row').last();await last.scrollIntoViewIfNeeded();
    assert(await last.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.row')===el;}),'Final-night banner covers the last market row');
    assert(errors.length === 0, 'Console/page errors: ' + errors.join('; '));
    assert(network.length === 0, 'Game made network requests: ' + network.join('; '));
    return { input: 'First confirm bought 2; no-dealers arrow/Enter clean', hudTitle, outOfStockFixture: fixture.planted, map, networkRequests: network, audio: await page.evaluate(() => ({ shim: window.__pwAudio.shim || null, contexts: window.__pwAudio.ctxs.map(x => ({ state: x.c.state, createdIn: x.rec.createdIn })) })) };
  } catch (e) {
    await page.screenshot({ path: path.join(OUT, name + '-failure.png'), scale: 'css' }).catch(() => {});
    throw e;
  } finally { await context.close(); }
}
async function fullRuns(browser) {
  const { context, page, errors, network } = await instrument(browser, { viewport: { width: 1280, height: 800 } });
  try {
    await page.goto(URL);
    for (const file of ['adapter.js', 'policies/_common.js', 'policies/informed.js']) {
      await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'sim', file), 'utf8') });
    }
    const results = [];
    for (const seed of [100002, 100003]) {
      const result = await page.evaluate(seed => SIM.runOne('informed', seed, {}), seed);
      assert(result.errors.length === 0, 'Simulator/game errors: ' + result.errors.join('; '));
      assert(result.day === 30 && !result.sunk, 'Run did not reach night 30: ' + JSON.stringify({ seed, day: result.day, sunk: result.sunk }));
      const integrity = await page.evaluate(() => ({ cash: S.cash, used: holdUsed(), capacity: capacity(), finite: [S.cash, S.bank, S.debt, tally('complete').net].every(Number.isFinite), tally: tally('complete') }));
      assert(integrity.finite && integrity.cash >= 0 && integrity.used <= integrity.capacity, 'Invalid final state');
      await page.evaluate(() => endGame('complete'));
      assert(await page.locator('#final-n').isVisible(), 'Score screen absent');
      results.push({ seed, day: result.day, trips: result.stats.trips, fights: result.stats.fights, fortune: result.net, integrity });
    }
    await page.screenshot({ path: path.join(OUT, 'full-run-ending.png'), scale: 'css' });
    await page.reload();
    await act(page, '#t-ledger', false);
    const ledger = await page.locator('#modal').innerText();
    assert(ledger.includes('Sim'), 'High-score ledger did not survive reload');
    assert(errors.length === 0, errors.join('; '));
    assert(network.length === 0, 'Runtime network request detected');
    return { method: 'External informed bot, real game functions, Chromium; no manual touch claim', runs: results, ledgerSurvivedReload: true, errors, network };
  } finally { await context.close(); }
}
async function storageAndSandbox(browser) {
  const { context, page, errors, network } = await instrument(browser, { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
  try {
    await page.goto(URL);
    await page.evaluate(() => {
      localStorage.setItem('gloamwater.save.v1', '{bad json');
      localStorage.setItem('gloamwater.scores.v1', JSON.stringify([null, {}, { name: '<script>', score: 'NaN' }]));
      localStorage.setItem('gloamwater.settings.v1', 'null');
    });
    await page.reload();
    assert((await page.locator('#title').innerText()).includes('saved voyage could not be loaded'), 'Damaged saved voyage was silently discarded');
    await boot(page, true);
    // Separate late-night fixture checks copy against the actual late rate.
    await page.evaluate(() => { S.day=15;renderAll();void serviceAction('repay'); });
    await page.waitForFunction(() => /10%\s+nightly/.test(document.querySelector('#modal').textContent));
    await page.keyboard.press('Escape');
    // An active demand multiplier can coexist with a below-usual market price.
    // Keep the demand cue explicit instead of presenting it as guaranteed profit.
    await page.evaluate(() => { S.day=21;S.loc='sl';S.stock.sl.chips=true;renderAll(); });
    assert((await page.locator('.row[data-g="chips"] .row-note').innerText()).includes('Fleet demand +40%'), 'Fleet demand is missing from its market row');
    const wrapper = path.join(OUT, 'sandbox.html');
    fs.writeFileSync(wrapper, '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,iframe{margin:0;width:100%;height:100%;border:0}</style><iframe sandbox="allow-scripts" src="' + URL + '"></iframe>');
    await page.goto(pathToFileURL(wrapper).href);
    const frame = page.frames().find(f => f.url() === URL);
    assert(frame, 'Sandbox game frame did not load');
    await frame.evaluate(() => { FAST = true; });
    const blocked = await frame.evaluate(() => { try { localStorage.getItem('x'); return false; } catch { return true; } });
    assert(blocked, 'Sandbox did not block localStorage as intended');
    await frame.locator('#t-new').tap(); await pause(page);
    await frame.locator('#go').tap(); await page.waitForTimeout(700);
    if (await frame.locator('[data-skip]').isVisible()) await frame.locator('[data-skip]').tap();
    assert(await frame.evaluate(() => S && S.day === 1), 'Sandbox could not start game');
    await page.screenshot({ path: path.join(OUT, 'sandbox.png'), scale: 'css' });
    assert(errors.length === 0, errors.join('; '));
    assert(network.length === 0, 'Network requests in sandbox');
    return { corruptStorageRecovered: true, corruptSaveNotice: true, lateRateCopyFixture: true, fleetDemandCopyFixture: true, sandboxStorageBlocked: blocked, sandboxStarted: true, errors, network };
  } finally { await context.close(); }
}
async function main() {
  await check('source constraints', async () => {
    assert(report.bytes < 1000000, 'Game exceeds 1MB');
    new Function(source.match(/<script>([\s\S]*?)<\/script>/)[1]);
    assert(!/<(?:script|link|img|audio|video)[^>]+(?:src|href)=["']https?:/i.test(source), 'External resource tag');
    assert(!/\b(?:fetch\s*\(|XMLHttpRequest\s*\(|new\s+WebSocket\s*\(|navigator\.sendBeacon\s*\()/.test(source), 'Network API in shipped source');
    return { bytes: report.bytes, syntaxValid: true, externalResources: false };
  });
  let cr, wk;
  try {
    cr = await chromium.launch({ headless: true });
    wk = await webkit.launch({ headless: true });
    for (const [width, height] of [[390, 844], [390, 664], [360, 640], [430, 932]]) {
      await check(`WebKit touch ${width}x${height}`, () => uiCase(wk, `webkit-${width}x${height}`, { ...devices['iPhone 13'], viewport: { width, height } }, true));
    }
    await check('Chromium desktop 1280x800', () => uiCase(cr, 'chromium-desktop', { viewport: { width: 1280, height: 800 } }, false));
    await check('Two full games plus persistent ledger', () => fullRuns(cr));
    await check('Corrupt storage and restricted sandbox', () => storageAndSandbox(wk));
  } finally {
    if (cr) await cr.close();
    if (wk) await wk.close();
    report.pass = report.checks.length>0 && report.checks.every(x => x.pass);
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(`Report: ${path.join(OUT, 'report.json')}`);
  }
  process.exitCode = report.pass ? 0 : 1;
}
main().catch(e => { console.error(e); process.exitCode = 1; });
