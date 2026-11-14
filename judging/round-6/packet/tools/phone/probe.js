// Page-side probe for the phone harness. Evaluated in the page (or a frame) before each
// inspection step; defines window.__phoneProbe. Plain ES2019, no dependencies.
(() => {
  const INTERACTIVE = 'a[href],button,input,select,textarea,summary,[role=button],[role=tab],[role=link],[role=checkbox],[role=switch],[tabindex]:not([tabindex="-1"]),[onclick],[data-act],label[for]';
  const MIN = 44, GAP = 8;

  const cls = el => { const c = el.getAttribute && el.getAttribute('class'); return c ? '.' + c.trim().split(/\s+/).slice(0, 3).join('.') : ''; };
  const txt = el => ((el.innerText !== undefined ? el.innerText : el.textContent) || el.getAttribute('aria-label') || el.getAttribute('value') || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim();
  function desc(el, n = 40) {
    if (!el || el.nodeType !== 1) return String(el);
    const id = el.id ? '#' + el.id : '';
    let t = txt(el); if (!t && el.getAttribute) t = el.getAttribute('aria-label') || '';
    if (t.length > n) t = t.slice(0, n - 1) + '…';
    return `${el.tagName.toLowerCase()}${id}${cls(el)}${t ? ` "${t}"` : ''}`;
  }
  function cssPath(el) {
    // Short, human-usable selector: nearest id plus class chain.
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && parts.length < 4; e = e.parentElement) {
      if (e.id) { parts.unshift('#' + e.id); break; }
      parts.unshift(e.tagName.toLowerCase() + cls(e));
    }
    return parts.join(' > ');
  }
  function opacityChain(el) { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= +getComputedStyle(e).opacity; return o; }
  function visible(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    if (opacityChain(el) < 0.05) return false;
    return true;
  }
  const inView = r => r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  function hitAt(x, y) { return document.elementFromPoint(x, y); }
  function uncovered(el) {
    const r = el.getBoundingClientRect();
    const pts = [[.5, .5], [.25, .5], [.75, .5], [.5, .25], [.5, .75]];
    let coverer = null;
    for (const [fx, fy] of pts) {
      const x = r.left + r.width * fx, y = r.top + r.height * fy;
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
      const h = hitAt(x, y);
      if (h && (h === el || el.contains(h) || (h.closest && h.closest('label') && h.closest('label').control === el))) return { ok: true };
      if (h && !coverer) coverer = h;
    }
    return { ok: false, by: coverer };
  }
  function gapBetween(a, b) {
    const dx = Math.max(0, b.left - a.right, a.left - b.right);
    const dy = Math.max(0, b.top - a.bottom, a.top - b.bottom);
    return dx && dy ? Math.hypot(dx, dy) : Math.max(dx, dy);
  }
  function targets() {
    const els = [...document.querySelectorAll(INTERACTIVE)].filter(el => !el.disabled && visible(el));
    // Drop elements nested inside another interactive element (the outer one is the target).
    return els.filter(el => !els.some(o => o !== el && o.contains(el) && o.matches('button,a,[role=button],[data-act]')));
  }

  function ui(opts = {}) {
    const out = { viewport: `${innerWidth}x${innerHeight}`, scrollWidth: document.documentElement.scrollWidth, targets: [], covered: [], offscreen: [] };
    const list = targets();
    const onscreen = [];
    for (const el of list) {
      const r = el.getBoundingClientRect();
      if (!inView(r)) { out.offscreen.push(desc(el, 28)); continue; }
      const u = uncovered(el);
      if (!u.ok) { out.covered.push(`${desc(el, 28)} under ${desc(u.by, 28)}`); continue; }
      onscreen.push({ el, r });
    }
    for (const t of onscreen) {
      let best = null;
      for (const o of onscreen) {
        if (o === t || o.el.contains(t.el) || t.el.contains(o.el)) continue;
        const g = gapBetween(t.r, o.r);
        if (!best || g < best.g) best = { g, o };
      }
      const r = t.r, flags = [];
      if (r.width < MIN - 0.5 || r.height < MIN - 0.5) flags.push('SMALL<44');
      if (best && best.g < GAP) flags.push(`GAP ${best.g.toFixed(0)}px to ${desc(best.o.el, 20)}`);
      if (r.left < -0.5 || r.right > innerWidth + 0.5) flags.push('CLIPPED-X');
      if (r.top < 0 || r.bottom > innerHeight) flags.push('PART-OFFSCREEN');
      out.targets.push({ desc: desc(t.el), sel: cssPath(t.el), x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), flags });
    }
    if (opts.text !== false) out.text = (document.body.innerText || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 4000);
    return out;
  }

  // Find the shortest visible, enabled clickable whose text contains `needle`; mark it for the harness.
  function findText(needle) {
    document.querySelectorAll('[data-phone-target]').forEach(e => e.removeAttribute('data-phone-target'));
    const n = needle.toLowerCase();
    const els = [...document.querySelectorAll(INTERACTIVE + ',.choice,.row,.node')].filter(el => !el.disabled && el.getAttribute('aria-disabled') !== 'true' && visible(el));
    const hits = els.map(el => ({ el, t: txt(el) })).filter(x => x.t.toLowerCase().includes(n));
    if (!hits.length) return null;
    // Prefer uncovered matches, then the shortest text.
    hits.sort((a, b) => (uncovered(a.el).ok ? 0 : 1) - (uncovered(b.el).ok ? 0 : 1) || a.t.length - b.t.length);
    hits[0].el.setAttribute('data-phone-target', '1');
    return desc(hits[0].el);
  }
  function mark(sel) {
    document.querySelectorAll('[data-phone-target]').forEach(e => e.removeAttribute('data-phone-target'));
    const el = [...document.querySelectorAll(sel)].find(visible) || document.querySelector(sel);
    if (!el) return null;
    el.setAttribute('data-phone-target', '1');
    return desc(el);
  }
  function hit(x, y) {
    const h = hitAt(x, y), t = document.querySelector('[data-phone-target]');
    return { hit: h ? desc(h) : 'nothing', onTarget: t ? !!(h && (h === t || t.contains(h))) : null };
  }

  // ---- contrast ----
  function parseColor(s) {
    const m = s && s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function gradientAvg(img) {
    const cols = (img.match(/rgba?\([^)]+\)/g) || []).map(parseColor).filter(Boolean);
    if (!cols.length) return null;
    const s = cols.reduce((o, c) => ({ r: o.r + c.r, g: o.g + c.g, b: o.b + c.b, a: o.a + c.a }), { r: 0, g: 0, b: 0, a: 0 });
    const n = cols.length; return { r: s.r / n, g: s.g / n, b: s.b / n, a: s.a / n };
  }
  const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  function effectiveBg(el) {
    const layers = [];
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage.includes('gradient')) { const g = gradientAvg(cs.backgroundImage); if (g) layers.push(g); }
      const c = parseColor(cs.backgroundColor); if (c && c.a > 0) layers.push(c);
      if (layers.length && layers[layers.length - 1].a >= 0.999) break;
    }
    let bg = parseColor(getComputedStyle(document.body).backgroundColor) || { r: 6, g: 9, b: 22, a: 1 };
    if (bg.a < 1) bg = over(bg, { r: 255, g: 255, b: 255, a: 1 });
    for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
    return bg;
  }
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  function ownText(el) { let s = ''; for (const n of el.childNodes) if (n.nodeType === 3) s += n.nodeValue; return s.replace(/\s+/g, ' ').trim(); }
  function scrollParentClips(el) {
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      const ox = getComputedStyle(e).overflowX; if (ox !== 'visible') return e;
    }
    return null;
  }

  function audit() {
    const res = { viewport: `${innerWidth}x${innerHeight}`, docScrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth };
    const u = ui({ text: false });
    res.smallTargets = u.targets.filter(t => t.flags.some(f => f.startsWith('SMALL'))).map(t => `${t.w}x${t.h} ${t.sel}  ${t.desc}`);
    res.tightGaps = u.targets.filter(t => t.flags.some(f => f.startsWith('GAP'))).map(t => `${t.sel}  ${t.flags.find(f => f.startsWith('GAP'))}`);
    res.targetCount = u.targets.length;
    // Text size and contrast, grouped by selector signature.
    const groups = new Map();
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'text') continue;
      const t = el.tagName.toLowerCase() === 'text' ? el.textContent.trim() : ownText(el);
      if (!t || !visible(el)) continue;
      const cs = getComputedStyle(el);
      // Skip text hidden under an overlay (title screen over the HUD, sheet over the market).
      const rr = el.getBoundingClientRect();
      if (inView(rr) && cs.pointerEvents !== 'none') {
        const cx = Math.min(innerWidth - 1, Math.max(0, rr.left + rr.width / 2)), cy = Math.min(innerHeight - 1, Math.max(0, rr.top + rr.height / 2));
        const h = hitAt(cx, cy);
        if (h && h !== el && !el.contains(h) && !h.contains(el)) continue;
      }
      let px = parseFloat(cs.fontSize), contrast = null, note = '';
      if (el instanceof SVGElement) {
        const m = el.getScreenCTM(); if (m) px = px * Math.abs(m.d);
        note = 'svg';
      } else {
        const fg = parseColor(cs.color);
        if (fg && (cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || fg.a === 0)) note = 'clip-text';
        else if (fg) {
          const bg = effectiveBg(el);
          const a = fg.a * opacityChain(el);
          contrast = ratio(over({ ...fg, a }, bg), bg);
        }
      }
      const key = `${cssPath(el)}|${px.toFixed(1)}|${contrast ? contrast.toFixed(1) : note}`;
      if (!groups.has(key)) groups.set(key, { sel: cssPath(el), px: +px.toFixed(1), contrast: contrast ? +contrast.toFixed(2) : null, note, sample: t.slice(0, 40), n: 0 });
      groups.get(key).n++;
    }
    const all = [...groups.values()];
    res.smallText = all.filter(g => g.px < 15).sort((a, b) => a.px - b.px).map(g => `${g.px}px ${g.sel} "${g.sample}"${g.n > 1 ? ' ×' + g.n : ''}`);
    res.lowContrast = all.filter(g => g.contrast !== null && g.contrast < 4.5).sort((a, b) => a.contrast - b.contrast).map(g => `${g.contrast}:1 ${g.px}px ${g.sel} "${g.sample}"${g.n > 1 ? ' ×' + g.n : ''}`);
    res.inputsUnder16 = [...document.querySelectorAll('input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]),select,textarea')].filter(visible).map(el => [el, parseFloat(getComputedStyle(el).fontSize)]).filter(([, p]) => p < 16).map(([el, p]) => `${p}px ${cssPath(el)}`);
    // Horizontal overflow and truncation.
    res.overflowX = [];
    res.truncated = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el) || el.closest('svg')) continue;
      const r = el.getBoundingClientRect();
      if ((r.right > innerWidth + 0.5 || r.left < -0.5) && !scrollParentClips(el) && getComputedStyle(el).position !== 'fixed') res.overflowX.push(`${cssPath(el)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
      const cs = getComputedStyle(el);
      if (cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1 && ownText(el)) res.truncated.push(`${cssPath(el)} "${ownText(el).slice(0, 30)}" (${el.clientWidth}/${el.scrollWidth}px)`);
    }
    res.overflowX = res.overflowX.slice(0, 30);
    // Touch behaviour.
    const ta = {};
    for (const el of targets()) { const k = getComputedStyle(el).touchAction; ta[k] = (ta[k] || 0) + 1; }
    res.touchAction = ta;
    const sel = {};
    for (const el of targets()) { const cs = getComputedStyle(el); const k = `user-select:${cs.getPropertyValue('user-select') || 'n/a'} -webkit-user-select:${cs.webkitUserSelect || 'n/a'} callout:${cs.webkitTouchCallout || 'n/a'}`; (sel[k] = sel[k] || []).push(el.tagName.toLowerCase() + cls(el)); }
    res.selectability = Object.fromEntries(Object.entries(sel).map(([k, v]) => [k, [...new Set(v)].slice(0, 12).join(' ')]));
    const ob = e => { const cs = getComputedStyle(e); return `overscroll:${cs.overscrollBehaviorY || 'n/a'} overflow:${cs.overflowX}/${cs.overflowY} touch-action:${cs.touchAction}`; };
    res.rootBehaviour = { html: ob(document.documentElement), body: ob(document.body) };
    res.scrollers = [...document.querySelectorAll('body *')].filter(e => visible(e) && /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1).map(e => `${cssPath(e)} ${e.clientHeight}/${e.scrollHeight}px ${ob(e)}`);
    return res;
  }

  // What is underneath each visible match of `sel` (toasts, sheets, cards)?
  function covers(sel) {
    const out = [];
    for (const el of document.querySelectorAll(sel)) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect(), under = new Set();
      for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
        const x = r.left + r.width * (i + .5) / 6, y = r.top + r.height * (j + .5) / 3;
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
        const stack = document.elementsFromPoint(x, y);
        const k = stack.findIndex(e => e === el || el.contains(e));
        for (const e of stack.slice(k + 1)) {
          if (el.contains(e) || e.contains(el) || e === document.body || e === document.documentElement) continue;
          if (e.matches(INTERACTIVE) || (ownText(e) && visible(e))) { under.add(desc(e, 30)); break; }
        }
      }
      out.push({ el: `${desc(el, 50)} [${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}]`, covers: [...under] });
    }
    return out;
  }

  window.__phoneProbe = { v: 3, ui, findText, mark, hit, audit, covers, desc };
})();
