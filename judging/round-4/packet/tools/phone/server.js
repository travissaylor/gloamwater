// Long-lived phone browser for the harness. Started (detached) by start.js; do not run directly
// unless you want it in the foreground. Holds one browser, one context and one page, and runs
// steps posted to http://127.0.0.1:<port>/steps one at a time, so game state survives between calls.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const pw = require('playwright');
const { parseArgs, tmp } = require('./common');

const args = parseArgs(process.argv.slice(2));
const PORT = +args.port;
const BROWSER = String(args.browser || 'webkit').toLowerCase();
const probeSrc = () => fs.readFileSync(path.join(__dirname, 'probe.js'), 'utf8'); // re-read per call so edits apply live

// Records every AudioContext, every resume() call and the gesture event it ran inside, and
// whether the engine granted user activation for each touch/pointer/click event.
const AUDIO_INIT = `(() => {
  if (window.__pwAudio) return;
  const A = window.__pwAudio = { ctxs: [], log: [] };
  const now = () => Math.round(performance.now());
  const evType = () => (window.event && window.event.type) || 'none';
  const ua = () => (navigator.userActivation ? (navigator.userActivation.isActive ? 'active' : 'inactive') : 'n/a');
  if (!window.AudioContext && !window.webkitAudioContext) {
    // Playwright's Windows WebKit build ships without Web Audio. Install a stand-in that applies
    // the strict iOS rule: a context starts suspended and resume() only takes effect when called
    // synchronously inside a touchend, pointerup (touch/pen), click or keydown handler.
    A.shim = 'iOS-policy stand-in (this browser has no Web Audio): resume() works only inside touchend / pointerup(touch) / click / keydown';
    A.sounds = { whileRunning: 0, whileSuspended: 0 };
    const OK = e => e && (e.type === 'touchend' || e.type === 'click' || e.type === 'keydown' || (e.type === 'pointerup' && e.pointerType !== 'mouse'));
    const param = v => ({ value: v, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
    class FakeCtx extends EventTarget {
      constructor() { super(); this.state = 'suspended'; this.sampleRate = 44100; this._t0 = performance.now(); this.destination = this._node(); }
      get currentTime() { return this.state === 'running' ? (performance.now() - this._t0) / 1000 : 0; }
      _set(s) { if (this.state !== s) { this.state = s; this.dispatchEvent(new Event('statechange')); } }
      resume() { if (OK(window.event)) this._set('running'); return Promise.resolve(); }
      suspend() { this._set('suspended'); return Promise.resolve(); }
      close() { this._set('closed'); return Promise.resolve(); }
      _node(extra) {
        const ctx = this;
        return Object.assign({ connect(n) { return n; }, disconnect() {}, gain: param(1), frequency: param(440), Q: param(1), detune: param(0), threshold: param(-24), ratio: param(12), type: 'sine', buffer: null,
          start() { ctx.state === 'running' ? A.sounds.whileRunning++ : A.sounds.whileSuspended++; }, stop() {} }, extra);
      }
      createGain() { return this._node(); } createOscillator() { return this._node(); } createBufferSource() { return this._node(); }
      createBiquadFilter() { return this._node(); } createDynamicsCompressor() { return this._node(); }
      createBuffer(ch, len) { const d = new Float32Array(len); return { getChannelData: () => d, length: len }; }
    }
    window.AudioContext = FakeCtx;
  }
  for (const name of ['AudioContext', 'webkitAudioContext']) {
    const AC = window[name];
    if (!AC || AC.__pw) continue;
    const W = function (...a) {
      const c = new AC(...a);
      const rec = { t: now(), createdIn: evType(), activation: ua(), stateAtCreate: c.state, resumes: [] };
      A.ctxs.push({ c, rec });
      const r = c.resume.bind(c);
      c.resume = function () {
        const e = { t: now(), during: evType(), activation: ua(), before: c.state };
        rec.resumes.push(e);
        const p = r();
        p.then(() => { e.after = c.state; }, err => { e.after = 'rejected: ' + err; });
        setTimeout(() => { if (!e.after) e.after = c.state + ' (still pending after 300ms)'; }, 300);
        return p;
      };
      c.addEventListener('statechange', () => A.log.push({ t: now(), ctx: A.ctxs.length - 1, state: c.state, during: evType() }));
      return c;
    };
    W.prototype = AC.prototype; W.__pw = true;
    try { window[name] = W; } catch (e) {}
  }
  for (const t of ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'mousedown', 'click']) {
    addEventListener(t, e => { if (A.log.length < 200) A.log.push({ t: now(), event: t, pointerType: e.pointerType, activation: ua() }); }, true);
  }
})();`;

let browser, context, page, frame, deviceName, ctxOpts, landscape = false;
let errors = [];
const say = (...a) => console.log(new Date().toISOString(), ...a);

async function setup() {
  const type = pw[BROWSER];
  if (!type) throw new Error(`Unknown --browser ${BROWSER} (use webkit or chromium)`);
  if (args.size) {
    const m = String(args.size).match(/^(\d+)x(\d+)$/i);
    if (!m) throw new Error('--size must look like 360x640');
    const base = { ...pw.devices[BROWSER === 'chromium' ? 'Pixel 7' : 'iPhone 13'] };
    ctxOpts = { ...base, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, isMobile: true, hasTouch: true };
    deviceName = `custom ${m[1]}x${m[2]} (touch, mobile, ${base.userAgent.includes('iPhone') ? 'iPhone UA' : 'Android UA'})`;
  } else {
    deviceName = args.device || 'iPhone 13';
    const d = pw.devices[deviceName];
    if (!d) throw new Error(`Unknown device "${deviceName}". Examples: iPhone 13, iPhone 14 Pro Max, iPhone SE, Pixel 7.`);
    ctxOpts = { ...d };
  }
  delete ctxOpts.defaultBrowserType;
  if (BROWSER === 'firefox') delete ctxOpts.isMobile;
  browser = await type.launch({ headless: !args.headed });
  context = await browser.newContext(ctxOpts);
  await context.addInitScript(AUDIO_INIT);
  page = await context.newPage();
  frame = page.mainFrame();
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
  page.on('dialog', d => { errors.push(`dialog (${d.type()}): ${d.message()} [auto-dismissed]`); d.dismiss().catch(() => {}); });
  page.on('crash', () => errors.push('PAGE CRASHED'));
}

const summary = () => `${BROWSER} · ${deviceName} · viewport ${page.viewportSize().width}x${page.viewportSize().height}${landscape ? ' (landscape)' : ''} · dpr ${ctxOpts.deviceScaleFactor || 1} · touch ${!!ctxOpts.hasTouch} · mobile ${!!ctxOpts.isMobile}`;

async function probe(fn, ...a) {
  await frame.evaluate(probeSrc());
  return frame.evaluate(([fn, a]) => window.__phoneProbe[fn](...a), [fn, a]);
}
async function frameOffset() {
  if (frame === page.mainFrame()) return { x: 0, y: 0 };
  const fe = await frame.frameElement();
  const b = await fe.boundingBox();
  const inner = await fe.evaluate(e => ({ l: e.clientLeft, t: e.clientTop }));
  return { x: b.x + inner.l, y: b.y + inner.t };
}
function vp() { return page.viewportSize(); }

async function tapMarked(label) {
  const loc = frame.locator('[data-phone-target]').first();
  let box = await loc.boundingBox();
  const v0 = vp();
  if (!box || box.y < 0 || box.x < 0 || box.y + box.height > v0.height || box.x + box.width > v0.width) {
    // Only scroll when needed, and without Playwright's stability wait (it stalls on
    // animating elements). Equivalent to the player swiping the container.
    await loc.evaluate(e => e.scrollIntoView({ block: 'center', inline: 'nearest' })).catch(() => {});
    await page.waitForTimeout(80);
    box = await loc.boundingBox();
  }
  if (!box) throw new Error(`${label} has no box (hidden?)`);
  const off = await frameOffset();
  const aim = () => {
    const v = vp();
    // Tap the centre of the part that is on screen.
    const l = Math.max(box.x, 0), r = Math.min(box.x + box.width, v.width), t = Math.max(box.y, 0), b = Math.min(box.y + box.height, v.height);
    if (r <= l || b <= t) throw new Error(`${label} is off screen at [${Math.round(box.x)},${Math.round(box.y)}]`);
    return [(l + r) / 2, (t + b) / 2];
  };
  let [x, y] = aim();
  let h = await probe('hit', x - off.x, y - off.y), note = '';
  if (h.onTarget === false) {
    // Maybe clipped inside a nested scroller (a card or sheet). Scroll it like a player would.
    await loc.evaluate(e => e.scrollIntoView({ block: 'nearest', inline: 'nearest' })).catch(() => {});
    await page.waitForTimeout(80);
    const b2 = await loc.boundingBox();
    if (b2) { box = b2; [x, y] = aim(); const h2 = await probe('hit', x - off.x, y - off.y); if (h2.onTarget) { note = `  (was clipped under ${h.hit}; scrolled its container first)`; h = h2; } }
  }
  await page.touchscreen.tap(x, y);
  return `tapped ${label} at (${Math.round(x)},${Math.round(y)}) ${Math.round(box.width)}x${Math.round(box.height)}; touch landed on ${h.hit}${h.onTarget === false ? '  !! COVERED: the tap hit something else' : ''}${note}`;
}

async function swipe(x1, y1, x2, y2, ms = 300) {
  const n = Math.max(6, Math.round(ms / 16));
  if (BROWSER === 'chromium') {
    const cdp = await context.newCDPSession(page);
    const pt = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x1, y1) });
    for (let i = 1; i <= n; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n) });
      await new Promise(r => setTimeout(r, ms / n));
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
    return `swiped (${x1},${y1}) -> (${x2},${y2}) with native touch events (chromium CDP)`;
  }
  // WebKit has no touch-move API in Playwright. Fire synthetic Touch/Pointer events so page
  // handlers run, then apply the browser's default action (range value or scroll) directly.
  const off = await frameOffset();
  const res = await frame.evaluate(async ([x1, y1, x2, y2, n, ms]) => {
    const start = document.elementFromPoint(x1, y1);
    if (!start) return 'nothing at start point';
    const notes = [];
    const fire = (type, x, y) => {
      try { start.dispatchEvent(new PointerEvent(type.replace('touch', 'pointer').replace('start', 'down').replace('end', 'up'), { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true, pointerId: 7 })); } catch (e) {}
      try {
        const t = new Touch({ identifier: 7, target: start, clientX: x, clientY: y, pageX: x, pageY: y });
        start.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t] }));
      } catch (e) { if (!notes.includes('no-touch-ctor')) notes.push('no-touch-ctor'); }
    };
    fire('touchstart', x1, y1);
    for (let i = 1; i <= n; i++) { fire('touchmove', x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n); await new Promise(r => setTimeout(r, ms / n)); }
    fire('touchend', x2, y2);
    const range = start.closest('input[type=range]');
    if (range) {
      const r = range.getBoundingClientRect(), min = +range.min || 0, max = +range.max || 100;
      const f = Math.min(1, Math.max(0, (x2 - r.left) / r.width));
      range.value = String(Math.round(min + (max - min) * f));
      range.dispatchEvent(new Event('input', { bubbles: true })); range.dispatchEvent(new Event('change', { bubbles: true }));
      return `range ${range.id || ''} set to ${range.value} of ${max}` + (notes.length ? ` (${notes})` : '');
    }
    let sc = start;
    while (sc && sc !== document.documentElement) {
      const cs = getComputedStyle(sc);
      if ((/auto|scroll/.test(cs.overflowY) && sc.scrollHeight > sc.clientHeight) || (/auto|scroll/.test(cs.overflowX) && sc.scrollWidth > sc.clientWidth)) break;
      sc = sc.parentElement;
    }
    sc = sc || document.scrollingElement;
    const before = [sc.scrollLeft, sc.scrollTop];
    sc.scrollBy(x1 - x2, y1 - y2);
    return `scrolled ${sc.id ? '#' + sc.id : sc.tagName.toLowerCase() + (sc.className && typeof sc.className === 'string' ? '.' + sc.className.split(' ')[0] : '')} from ${before} to ${[sc.scrollLeft, sc.scrollTop]}` + (notes.length ? ` (${notes})` : '');
  }, [x1 - off.x, y1 - off.y, x2 - off.x, y2 - off.y, n, ms]);
  return `swiped (${x1},${y1}) -> (${x2},${y2}) [webkit: synthetic touch events + emulated default action] ${res}`;
}

function fmtUi(u) {
  const lines = [`viewport ${u.viewport} · page scrollWidth ${u.scrollWidth}${u.scrollWidth > +u.viewport.split('x')[0] ? '  !! HORIZONTAL OVERFLOW' : ''}`];
  lines.push(`targets (${u.targets.length}), centre [x,y] and size; flags: SMALL<44, GAP<8px:`);
  for (const t of u.targets) lines.push(`  [${t.x},${t.y} ${t.w}x${t.h}] ${t.desc}${t.flags.length ? '   ⚠ ' + t.flags.join(' · ') : ''}`);
  if (u.covered.length) lines.push(`covered (${u.covered.length}): ` + u.covered.join(' | '));
  if (u.offscreen.length) lines.push(`off screen, scroll to reach (${u.offscreen.length}): ` + u.offscreen.join(' | '));
  if (u.offset) lines.push(`(frame content: x,y above are page coordinates; the frame starts at ${Math.round(u.offset.x)},${Math.round(u.offset.y)})`);
  if (u.frames) lines.push(`frames: ${u.frames}  (use 'frame <n>' to inspect one)`);
  if (u.text !== undefined) lines.push('--- visible text ---', u.text);
  return lines.join('\n');
}
function fmtAudit(a) {
  const L = [];
  const sec = (name, list) => { L.push(`${name} (${list.length})${list.length ? ':' : ''}`); list.forEach(x => L.push('  ' + x)); };
  L.push(`viewport ${a.viewport} · document scrollWidth ${a.docScrollWidth} · body scrollWidth ${a.bodyScrollWidth} · ${a.targetCount} on-screen targets`);
  sec('tap targets under 44x44', a.smallTargets);
  sec('tap targets under 8px from a neighbour', a.tightGaps);
  sec('text under 15px (svg text is rendered size)', a.smallText);
  sec('text contrast under 4.5:1 (approximate: gradients averaged)', a.lowContrast);
  sec('inputs under 16px (iOS zooms on focus)', a.inputsUnder16);
  sec('elements past the viewport edge (not clipped by a scroller)', a.overflowX);
  sec('truncated text (overflow with ellipsis/hidden)', a.truncated);
  L.push(`touch-action on targets: ${JSON.stringify(a.touchAction)}`);
  L.push('selectability on targets:'); for (const [k, v] of Object.entries(a.selectability)) L.push(`  ${k}: ${v}`);
  L.push(`root: html ${a.rootBehaviour.html}; body ${a.rootBehaviour.body}`);
  sec('scrollable areas', a.scrollers);
  return L.join('\n');
}

async function runStep(step) {
  const sp = step.indexOf(' ');
  const cmd = (sp < 0 ? step : step.slice(0, sp)).toLowerCase();
  const rest = sp < 0 ? '' : step.slice(sp + 1).trim();
  const nums = () => rest.split(/[\s,]+/).map(Number);
  switch (cmd) {
    case 'ui': {
      const u = await probe('ui', {});
      const off = await frameOffset();
      u.targets.forEach(t => { t.x += Math.round(off.x); t.y += Math.round(off.y); });
      if (off.x || off.y) u.offset = off;
      const fr = page.frames();
      if (fr.length > 1) u.frames = fr.map((f, i) => i + ' ' + f.url()).join(' | ');
      return fmtUi(u);
    }
    case 'text': return frame.evaluate(() => (document.body.innerText || '').replace(/\n{3,}/g, '\n\n').trim());
    case 'audit': return fmtAudit(await probe('audit'));
    case 'covers': return JSON.stringify(await probe('covers', rest || '.toast'), null, 1);
    case 'shot': case 'fullshot': {
      if (!rest) throw new Error(`${cmd} needs a path`);
      fs.mkdirSync(path.dirname(path.resolve(rest)), { recursive: true });
      await page.screenshot({ path: rest, fullPage: cmd === 'fullshot', scale: args['shot-scale'] === 'device' ? 'device' : 'css', animations: 'allow' });
      return `saved ${rest}`;
    }
    case 'tap': {
      const d = await probe('mark', rest);
      if (!d) throw new Error(`no element matches ${rest}`);
      return tapMarked(d);
    }
    case 'taptext': {
      const d = await probe('findText', rest);
      if (!d) throw new Error(`no visible, enabled clickable contains "${rest}"`);
      return tapMarked(d);
    }
    case 'tapxy': {
      const [x, y] = nums();
      const off = await frameOffset();
      const h = await probe('hit', x - off.x, y - off.y);
      await page.touchscreen.tap(x, y);
      return `tapped (${x},${y}); touch landed on ${h.hit}`;
    }
    case 'swipe': { const [x1, y1, x2, y2, ms] = nums(); return swipe(x1, y1, x2, y2, ms || 300); }
    case 'type': await page.keyboard.type(rest); return `typed ${JSON.stringify(rest)}`;
    case 'key': await page.keyboard.press(rest === 'Space' ? ' ' : rest); return `pressed ${rest}`;
    case 'eval': return JSON.stringify(await frame.evaluate(rest), null, 1);
    case 'evalfile': return JSON.stringify(await frame.evaluate(fs.readFileSync(rest, 'utf8')), null, 1);
    case 'wait': await page.waitForTimeout(+rest || 0); return `waited ${+rest || 0}ms`;
    case 'waitfor': {
      // waitfor <js expression> [timeoutMs]: polls every 25ms, prints how long it took.
      const m = rest.match(/^(.*?)(?:\s+(\d+))?$/);
      const expr = m[1], timeout = +(m[2] || 15000), t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        let ok = false;
        try { ok = await frame.evaluate(expr); } catch (e) { /* page busy or navigating */ }
        if (ok) return `true after ${Date.now() - t0}ms`;
        await new Promise(r => setTimeout(r, 25));
      }
      throw new Error(`still false after ${timeout}ms: ${expr}`);
    }
    case 'nav': {
      errors = []; frame = page.mainFrame();
      await page.goto(rest, { waitUntil: 'load' });
      await page.waitForTimeout(300);
      return `loaded ${rest} · ${await page.evaluate(() => innerWidth + 'x' + innerHeight + ' · ' + document.title)}`;
    }
    case 'frame': {
      if (!rest || rest === 'main') { frame = page.mainFrame(); return 'target frame: main'; }
      const fr = page.frames();
      const f = /^\d+$/.test(rest) ? fr[+rest] : fr.find(x => x.url().includes(rest));
      if (!f) throw new Error(`no frame ${rest}; frames: ${fr.map((x, i) => i + ' ' + x.url()).join(' | ')}`);
      frame = f; return `target frame: ${f.url()}`;
    }
    case 'errors': return errors.length ? errors.join('\n') : 'no errors';
    case 'rotate': {
      const v = vp(); landscape = !landscape;
      await page.setViewportSize({ width: v.height, height: v.width });
      await page.waitForTimeout(250);
      return `viewport now ${v.height}x${v.width} (${landscape ? 'landscape' : 'portrait'}); note: real Safari landscape toolbars differ`;
    }
    case 'size': { const m = rest.match(/(\d+)\D+(\d+)/); await page.setViewportSize({ width: +m[1], height: +m[2] }); return `viewport now ${m[1]}x${m[2]}`; }
    case 'audio': {
      const r = await frame.evaluate(() => {
        const A = window.__pwAudio; if (!A) return { note: 'audio probe missing' };
        return { shim: A.shim || 'none: real Web Audio', sounds: A.sounds, contexts: A.ctxs.map(({ c, rec }) => ({ ...rec, stateNow: c.state, currentTime: +c.currentTime.toFixed(2) })), events: A.log.slice(-12) };
      });
      return JSON.stringify(r, null, 1);
    }
    case 'info': return summary();
    default: throw new Error(`unknown step "${cmd}"`);
  }
}

let queue = Promise.resolve();
async function handle(req, res) {
  const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (req.method === 'GET' && req.url === '/ping') return send(200, { ready: !!page, summary: page ? summary() : '', navResult: startNav });
  let body = '';
  for await (const c of req) body += c;
  const data = body ? JSON.parse(body) : {};
  if (req.url === '/stop') {
    send(200, { ok: true });
    setTimeout(async () => { try { await browser.close(); } catch (e) {} try { fs.unlinkSync(tmp(PORT, 'pid')); } catch (e) {} process.exit(0); }, 50);
    return;
  }
  if (req.url === '/steps') {
    queue = queue.then(async () => {
      const results = [];
      for (const step of data.steps || []) {
        const r = { step };
        try { r.out = String(await runStep(step)); } catch (e) { r.error = String(e && e.message || e).split('\n')[0]; }
        results.push(r);
        say(step, r.error ? 'ERROR ' + r.error : 'ok');
        if (r.error) break;
      }
      send(200, { results });
    });
    return;
  }
  send(404, { error: 'unknown route' });
}

let startNav = '';
(async () => {
  await setup();
  if (args.url) startNav = await runStep(`nav ${args.url}`);
  fs.writeFileSync(tmp(PORT, 'pid'), String(process.pid));
  http.createServer((q, s) => handle(q, s).catch(e => { try { s.writeHead(500); s.end(JSON.stringify({ results: [{ step: '?', error: e.message }] })); } catch (x) {} }))
    .listen(PORT, '127.0.0.1', () => say(`listening on ${PORT}: ${summary()}`));
})().catch(e => { console.error(e.stack || e); process.exit(1); });
