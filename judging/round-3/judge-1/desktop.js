// Judge 1 desktop + network + sandbox checks. Keyboard/mouse only; decisions are a fixed keyboard sequence (no hidden data used).
const { chromium, webkit } = require('C:/Users/travi/.t3/worktrees/gloamwater/t3-201b6bf7-54dc20bc5d519c6e/tools/node_modules/playwright');
const fs = require('fs');
const BASE = 'C:/Users/travi/.t3/worktrees/gloamwater/t3-201b6bf7-54dc20bc5d519c6e/judging/round-3';
const GAME = 'file:///' + BASE + '/packet/index.html';
const OUT = BASE + '/judge-1/shots';
const log = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  for (const [name, bt] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await bt.launch();
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const reqs = [], errs = [];
    page.on('request', r => reqs.push(r.url().slice(0, 120)));
    page.on('pageerror', e => errs.push('pageerror ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
    await page.goto(GAME);
    await sleep(1200);
    await page.screenshot({ path: `${OUT}/d-${name}-title.png` });
    // keyboard: focus Cast off and press Enter, then Enter on intro
    await page.keyboard.press('Tab');
    await page.click('#t-new');
    await sleep(900);
    await page.click('#go');
    await sleep(1200);
    // skip tour if present
    const skip = await page.$('text=Skip tour'); if (skip) { await skip.click(); await sleep(600); }
    await page.screenshot({ path: `${OUT}/d-${name}-market.png` });
    // keyboard trading: ArrowDown to a good, B to buy, Enter to confirm
    await page.keyboard.press('ArrowDown'); await sleep(300);
    await page.keyboard.press('b'); await sleep(900);
    await page.screenshot({ path: `${OUT}/d-${name}-kbd-trade.png` });
    await page.keyboard.press('Enter'); await sleep(900);
    const afterBuy = await page.evaluate(() => [S.cash, holdUsed()]);
    // keyboard travel: '6' selects Copperhook, Enter sails
    await page.keyboard.press('6'); await sleep(700);
    await page.screenshot({ path: `${OUT}/d-${name}-kbd-map.png` });
    await page.keyboard.press('Enter');
    const t0 = Date.now();
    await page.waitForFunction(() => !busy || !document.querySelector('#modal').hidden, null, { timeout: 30000 });
    const voyageMs = Date.now() - t0;
    await sleep(800);
    await page.screenshot({ path: `${OUT}/d-${name}-after-voyage.png` });
    const st = await page.evaluate(() => ({ day: S.day, loc: S.loc, modal: !document.querySelector('#modal').hidden }));
    // ? help, Esc
    await page.keyboard.press('Escape'); await sleep(300);
    // focus-visible check: tab a few times and screenshot
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); await sleep(100); }
    await page.screenshot({ path: `${OUT}/d-${name}-focus.png` });
    const focusInfo = await page.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return [a.tagName, a.className, cs.outlineStyle, cs.outlineWidth, cs.boxShadow.slice(0, 60)]; });
    log.push({ name, requests: reqs.filter(u => !u.startsWith('file:') && !u.startsWith('data:')), allRequestCount: reqs.length, errs, afterBuy, voyageMs, st, focusInfo });
    // sandboxed iframe
    const wrap = `${BASE}/judge-1/sandbox.html`;
    fs.writeFileSync(wrap, `<!doctype html><body style="margin:0"><iframe sandbox="allow-scripts" src="${GAME}" style="width:100%;height:95vh;border:0"></iframe></body>`);
    const p2 = await ctx.newPage(); const e2 = [];
    p2.on('pageerror', e => e2.push('pageerror ' + e.message));
    p2.on('console', m => { if (m.type() === 'error') e2.push('console ' + m.text()); });
    await p2.goto('file:///' + wrap); await sleep(1500);
    const fr = p2.frames().find(f => f.url().includes('index.html'));
    let sb = 'no frame';
    if (fr) {
      await fr.click('#t-new'); await sleep(900);
      await fr.click('#go'); await sleep(1200);
      const sk = await fr.$('text=Skip tour'); if (sk) { await sk.click(); await sleep(500); }
      sb = await fr.evaluate(() => [S && S.day, S && S.cash, !!document.querySelector('.row')]);
    }
    await p2.screenshot({ path: `${OUT}/d-${name}-sandbox.png` });
    log.push({ name: name + '-sandbox', sb, e2 });
    await browser.close();
  }
  fs.writeFileSync(BASE + '/judge-1/desktop-log.json', JSON.stringify(log, null, 1));
  console.log(JSON.stringify(log, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
