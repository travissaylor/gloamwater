// Gloamwater simulator: in-page adapter.
//
// This file is injected into the game page as a classic script AFTER the game has loaded, so it
// sees the game's top-level bindings (S, FAST, GOODS, sailTo, coreBuy, ...) by name.
// It is the ONLY place that knows how the game is built. Policies call SIM.api and nothing else.
// When the game's API changes, edit this file (see README.md, "Updating the adapter").
//
// Targets the market-depth build (depth, press, quoteBuy/quoteSell, CONF whispers). It still runs
// the bake-off build (no depth, no CONF): the depth helpers fall back to flat prices there.
(function () {
  'use strict';
  const SIM = (window.SIM = window.SIM || {});
  SIM.policies = SIM.policies || {};
  SIM.register = (name, p) => { SIM.policies[name] = p; };

  const fn = name => { try { return typeof window[name] === 'function'; } catch (e) { return false; } };
  const has = name => { try { return eval('typeof ' + name) !== 'undefined'; } catch (e) { return false; } }; // eslint-disable-line no-eval

  // ---------------------------------------------------------------- feature detection
  const DEPTH = has('depthOf') && has('quoteBuy') && has('quoteSell');
  const HAS_CONF = has('CONF');
  const HAS_WHISPER_DAY = HAS_CONF; // one whisper a night arrived with CONF
  SIM.features = { depth: DEPTH, conf: HAS_CONF, auto: has('AUTO'), streams: {} };

  // ---------------------------------------------------------------- RNG streams
  // Math.random is a seeded stream (installed by sim.js before the game loads). Market evolution
  // runs on its own stream so that, on one seed, every policy sees the same prices and the same
  // natural shocks (and their hidden fates) on the same night. Visual-only randomness gets a
  // third stream so rendering never shifts game draws.
  function wrapStream(name, stream) {
    if (!fn(name)) return false;
    const orig = window[name];
    window[name] = function () { return __rng.using(stream, () => orig.apply(this, arguments)); };
    return window[name] !== orig;
  }
  SIM.features.streams.stepMarket = wrapStream('stepMarket', 'market');
  ['sparkSVG', 'fly', 'buildMap', 'titleScene'].forEach(n => { SIM.features.streams[n] = wrapStream(n, 'visual'); });
  try { ['burst', 'lanterns', 'rain'].forEach(k => { const o = FX[k]; FX[k] = function () { return __rng.using('visual', () => o.apply(this, arguments)); }; }); } catch (e) {}
  try { Sound.setMuted(true); } catch (e) {}

  // ---------------------------------------------------------------- game constants and model
  const gd = id => GI[id];
  const dd = id => DI[id];

  // Shock sizes as written in genPending() and landEvent(). SIM.mutate() keeps these in step with
  // any range it changes. A player learns these sizes by playing; the bots use their means.
  SIM.shock = { spike: [2, 3.5], crash: [0.3, 0.52], weak: { spike: [1.25, 1.55], crash: [0.7, 0.82] }, turn: { spike: [0.62, 0.76], crash: [1.3, 1.55] }, fest: 1.3 };
  const mid = r => (r[0] + r[1]) / 2;
  // Expected multiplier of a landed shock, by what the bulletin says happened.
  function landedExpect(told, kind) {
    const K = SIM.shock;
    if (told === 'fest') return K.fest;
    if (kind === 'weak') return mid(K.weak[told]);
    if (kind === 'turn') return mid(K.turn[told]);
    return mid(K[told]);
  }
  // Expected multiplier of a rumour Ysolde or Pell tells about, given only what they say: its
  // type and how sure they are. The odds are the ones the card states (CONF[...].sub).
  function rumourExpect(told, conf, trust) {
    if (told === 'fest') return SIM.shock.fest;
    if (trust || !HAS_CONF || !CONF[conf]) return landedExpect(told, 'full'); // eslint-disable-line no-undef
    const o = CONF[conf].odds; // eslint-disable-line no-undef
    return o[0] * landedExpect(told, 'full') + o[1] * landedExpect(told, 'weak') + o[2] * landedExpect(told, 'turn');
  }

  // Price model as written in stepMarket(). Only the informed-style policies use it.
  SIM.model = {
    trendAR: 0.85, localAR: 0.65,
    trendShare: 0.66,           // share of a log-price deviation that is the city-wide trend
    pressDecay: 0.4,            // stepMarket: press *= .4 each night (|x| < .5 snaps to 0)
    stockP: (did, gid) => (mult(dd(did), gd(gid)) !== 1 ? 0.95 : 0.8),
    landedExpect, rumourExpect,
    clampLo: g => g.min * 0.4, clampHi: g => g.max * 1.6,
  };

  // ---------------------------------------------------------------- depth math (mirrors the game)
  const depthAt = (did, gid) => {
    if (!DEPTH) return { n: Infinity, d: 1 };
    return depthOf(did, gid); // eslint-disable-line no-undef
  };
  function pressF_(x, n, d) { return x > n ? Math.exp((x - n) / d) : x < -n ? Math.exp((x + n) / d) : 1; }
  function pressInt_(a, b, n, d) {
    if (!isFinite(n)) return b - a;
    let s = 0; const e = Math.exp;
    if (Math.min(b, -n) > a) s += d * (e((Math.min(b, -n) + n) / d) - e((a + n) / d));
    const l2 = Math.max(a, -n), h2 = Math.min(b, n); if (h2 > l2) s += h2 - l2;
    if (b > Math.max(a, n)) s += d * (e((b - n) / d) - e((Math.max(a, n) - n) / d));
    return s;
  }
  const pressNow = (did, gid) => (DEPTH && S.press ? S.press[did][gid] : 0);
  function pressAfter(did, gid, nights) {
    let x = pressNow(did, gid);
    for (let i = 0; i < nights; i++) { x *= SIM.model.pressDecay; if (Math.abs(x) < 0.5) x = 0; }
    return x;
  }

  // ---------------------------------------------------------------- choose() override
  // Every modal the game raises (encounters, squalls, arrival events, results) goes through
  // choose(); info() calls choose(). The current policy answers; SIM.defaultChoose otherwise.
  SIM.cards = [];
  SIM.reload = null; // set by api.reload(); the runner restores this saved state after the voyage
  // While a reload is pending, the abandoned voyage keeps running in this page (a real reload
  // would kill it). Stop it from touching the save or ending the game.
  ['save', 'endGame'].forEach(n => { if (fn(n)) { const o = window[n]; window[n] = function () { if (SIM.reload) return Promise.resolve(); return o.apply(this, arguments); }; } });
  class ReloadSignal extends Error {}
  SIM.ReloadSignal = ReloadSignal;

  const num = s => { const m = String(s || '').replace(/<[^>]+>/g, '').match(/[0-9][0-9,]*/); return m ? +m[0].replace(/,/g, '') : 0; };
  const pctOf = s => { const m = String(s || '').match(/(\d+)%/); return m ? +m[1] / 100 : 0; };

  // Normalise a card into something policies can reason about without parsing HTML.
  function cardInfo(c) {
    const art = String(c.art || '');
    let kind = art.startsWith('enc_') ? art.slice(4) : art; // patrol, gulls, collectors, squall, crate, racks, eel, courier, ...
    const opts = {};
    (c.choices || []).forEach(x => { opts[x.key] = { enabled: !x.disabled, cost: num(x.label), p: pctOf(x.sub), label: x.label }; });
    return { kind, title: c.title, opts, keys: Object.keys(opts), card: c };
  }
  SIM.cardInfo = cardInfo;

  function enabled(ci, k) { return ci.opts[k] && ci.opts[k].enabled; }

  // Default answers. Documented in README.md.
  SIM.defaultChoose = function (ci) {
    const hull = S.hull;
    const first = ci.keys.find(k => enabled(ci, k));
    switch (ci.kind) {
      case 'patrol': {
        const atRisk = api.cargoValueHere() / 2 + S.contracts.reduce((s, c) => s + c.reward, 0);
        const bribe = ci.opts.bribe;
        if (bribe && bribe.enabled && (bribe.cost <= atRisk || hull <= 30)) return 'bribe';
        if (atRisk < 400 || hull <= 30) return 'yield';
        return ci.opts.fight.p > ci.opts.run.p + 0.1 ? 'fight' : 'run';
      }
      case 'gulls': {
        // an empty purse no longer pays nothing: the label then reads "empty purse" and they take cargo or hull
        const short = /empty purse/.test(ci.opts.pay.label || '');
        const toll = short ? api.cargoValueHere() / 3 : ci.opts.pay.cost;
        if (toll <= 800 || hull <= 30) return 'pay';
        return ci.opts.fight.p > ci.opts.run.p + 0.1 ? 'fight' : 'run';
      }
      case 'collectors': return 'pay';
      case 'squall': return hull > 35 || !enabled(ci, 'shelter') ? 'push' : 'shelter';
      case 'crate': return hull > 20 ? 'take' : 'leave';
      case 'racks': return enabled(ci, 'buy') && S.cash >= 3 * ci.opts.buy.cost && S.day <= 25 ? 'buy' : 'no';
      case 'eel': return 'no';
      case 'courier': return enabled(ci, 'yes') ? 'yes' : 'no';
      default: return first;
    }
  };

  window.choose = function (c) {
    const ci = cardInfo(c);
    SIM.cards.push(ci.kind);
    if (SIM.reload) return Promise.resolve(ci.keys.find(k => enabled(ci, k))); // a reload is pending: play out quietly
    const cur = SIM.cur;
    let k = null;
    if (cur && cur.pol.choose) {
      k = cur.pol.choose(ci, api, cur.mem);
      if (k instanceof ReloadSignal) return Promise.reject(k);
    }
    if (!k || !enabled(ci, k)) k = SIM.defaultChoose(ci);
    if (!enabled(ci, k)) k = ci.keys.find(x => enabled(ci, x));
    if (cur) { const ev = cur.mem.__events; ev[ci.kind + ':' + k] = (ev[ci.kind + ':' + k] || 0) + 1; }
    return Promise.resolve(k);
  };

  // Amount prompts (repay, borrow, deposit, withdraw) go through askAmount(); answer them directly.
  async function amountAction(act, v) {
    const orig = window.askAmount;
    window.askAmount = async o => { const x = Math.max(0, Math.min(Math.floor(v), Math.floor(o.max))); return x > 0 ? x : null; };
    try { await serviceAction(act); } finally { window.askAmount = orig; }
  }

  // What a bulletin says happened: 'full', 'weak' (text from WEAK_TXT) or 'turn' (told != type).
  function landedKind(e) {
    if (!e.told || e.told === 'fest' || e.type === 'fest') return 'full';
    if (e.told !== e.type) return 'turn';
    try { if (typeof WEAK_TXT !== 'undefined' && e.text === fillTxt(WEAK_TXT[e.told], dd(e.d), gd(e.g))) return 'weak'; } catch (x) {} // eslint-disable-line no-undef
    return 'full';
  }

  // ---------------------------------------------------------------- the API policies use
  // Information rule: everything here is something the player can see on screen or remember
  // (their own trades, prices they have seen, bulletins they heard, what Ysolde or Pell said).
  // Hidden state (unleaked rumours, a rumour's fate, a shock's exact size, unseen prices or
  // stock) is not exposed. api.state() exists for post-hoc accounting only, never for decisions.
  const api = {
    // --- state ---
    day: () => S.day, nights: () => NIGHTS, loc: () => S.loc,
    cash: () => S.cash, bank: () => S.bank, debt: () => S.debt, maxDebt: () => MAX_DEBT, hull: () => S.hull,
    cap: () => capacity(), used: () => holdUsed(), free: () => capacity() - holdUsed(),
    goods: () => GOODS.map(g => g.id), districts: () => DISTRICTS.map(d => d.id),
    good: gid => gd(gid), district: did => dd(did),
    held: gid => ({ q: S.cargo[gid].q, cost: S.cargo[gid].cost }),
    contracts: () => S.contracts.slice(),
    netWorth: () => netWorth(),
    state: () => S,

    // --- market ---
    // stocked here: the market screen. Elsewhere: only what was seen tonight (wireless), else null.
    stocked(gid, did) {
      did = did || S.loc;
      if (did === S.loc) return !!S.stock[did][gid];
      const s = S.seen[did] && S.seen[did][gid];
      return s && s.day === S.day && typeof s.st === 'boolean' ? s.st : null;
    },
    price: gid => price(gid),                       // posted (marginal) price here, tonight
    districtMult: (did, gid) => mult(dd(did), gd(gid)),
    effectMultHere: gid => api.knownEffectMult(S.loc, gid),
    // Known shocks in force, with the size a player would expect from the bulletin text.
    knownEffects: () => S.effects.filter(e => e.known).map(e => {
      const kind = landedKind(e), told = e.told || e.type;
      return { type: e.type, told, kind, d: e.d, g: e.g, age: e.age, days: e.days, m: landedExpect(told, kind) };
    }),
    knownEffectMult(did, gid) { let m = 1; for (const e of api.knownEffects()) if (e.d === did && (e.g === gid || e.g === '*')) m *= e.age === 0 ? e.m : Math.sqrt(e.m); return m; },
    seen: (did, gid) => (S.seen[did] && S.seen[did][gid]) || null,
    // Seen tonight, with the captain's own price pressure taken out (they know what they traded).
    rawSeen(did, gid) {
      const s = api.seen(did, gid);
      if (!s || s.day !== S.day) return null;
      const k = depthAt(did, gid);
      return s.p / pressF_(pressNow(did, gid), k.n, k.d);
    },
    wireless: () => !!S.wireless,
    // Rumours the captain has been told about for tomorrow (whispers and Pell's tips): what the
    // card says, nothing more. Never the fate or the size.
    leakedPending: () => S.pending.filter(e => e.leaked).map(e => ({ type: e.type, d: e.d, g: e.g, days: e.days, conf: e.conf || null })),
    encounterChance: did => encounterChance(did),

    // --- depth (pressure comes only from the captain's own trades, so it is known) ---
    hasDepth: () => DEPTH,
    depth: (did, gid) => depthAt(did, gid),
    pressure: (did, gid) => pressNow(did, gid),
    pressAfter,                                      // pressure at did after n nights of easing
    pressF: pressF_, pressInt: pressInt_,
    // Proceeds of selling q at did, given the pre-pressure unit price p and starting pressure x.
    sellCurve(did, gid, q, p, x) { if (q <= 0) return 0; const k = depthAt(did, gid); return p * pressInt_(x - q, x, k.n, k.d); },
    buyCurve(did, gid, q, p, x) { if (q <= 0) return 0; const k = depthAt(did, gid); return p * pressInt_(x, x + q, k.n, k.d); },
    // pre-pressure price here (what the posted price would be with no pressure)
    rawPrice: gid => (DEPTH ? S.prices[S.loc][gid] : price(gid)),

    quoteBuy(gid, q) {
      if (q <= 0) return 0;
      if (DEPTH) return quoteBuy(gid, q); // eslint-disable-line no-undef
      return price(gid) * q;
    },
    quoteSell(gid, q) {
      if (q <= 0) return 0;
      if (DEPTH) return quoteSell(gid, q); // eslint-disable-line no-undef
      return price(gid) * q;
    },
    maxBuy(gid, cash) {
      if (!S.stock[S.loc][gid]) return 0;
      const budget = cash == null ? S.cash : Math.min(cash, S.cash);
      const room = Math.max(0, capacity() - holdUsed());
      if (!DEPTH) return Math.max(0, Math.min(Math.floor(budget / price(gid)), room));
      let lo = 0, hi = room; // binary search on the quoted total
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (api.quoteBuy(gid, m) <= budget) lo = m; else hi = m - 1; }
      return lo;
    },
    flatLeft: (gid, mode) => (DEPTH ? flatLeft(gid, mode) : Infinity), // eslint-disable-line no-undef
    cargoValueHere() { let v = 0; for (const g of GOODS) { const q = S.cargo[g.id].q; if (q) v += S.stock[S.loc][g.id] ? api.quoteSell(g.id, q) : 0; } return v; },

    // --- actions (all go through the game's own functions) ---
    buy(gid, q) {
      const c0 = S.cash; const r = coreBuy(gid, Math.floor(q));
      const n = typeof r === 'number' ? r : r ? r.q : 0; // old build returns a number, new {q,total}
      return { q: n || 0, total: c0 - S.cash };
    },
    sell(gid, q) {
      const c0 = S.cash; const r = coreSell(gid, Math.floor(q));
      if (!r) return { q: 0, total: 0 };
      const total = S.cash - c0;
      if (SIM.cur && total > SIM.cur.maxSale) SIM.cur.maxSale = total;
      return { q: r.q, total };
    },
    sellAll(filter) { let tot = 0; for (const g of GOODS) { const h = S.cargo[g.id]; if (h.q && S.stock[S.loc][g.id] && (!filter || filter(g.id))) tot += api.sell(g.id, h.q).total; } return tot; },

    svcHere: k => dd(S.loc).svc.includes(k),
    whisperCost: () => rumorCost(),
    // How sure Ysolde sounds before you pay (shown on the Salon card in builds that have CONF_HINT).
    whisperHint: () => (has('CONF_HINT') && has('whisperable') && whisperable().length) ? whisperable()[0].conf : null, // eslint-disable-line no-undef
    // The Salon's button: enabled when she has heard something, you have not had tonight's
    // whisper, it is not the last night and you can pay.
    whisperAvailable() {
      if (!dd(S.loc).svc.includes('rumor') || S.day >= NIGHTS || S.cash < rumorCost()) return false;
      if (HAS_WHISPER_DAY && S.whisperDay === S.day) return false;
      if (has('whisperable') && !whisperable().length) return false; // eslint-disable-line no-undef
      return true;
    },
    // Buy one whisper through the real service. Returns {fee, type, d, g, conf} or null.
    async whisper() {
      if (!api.whisperAvailable()) return null;
      const before = new Set(S.pending.filter(e => e.leaked));
      const c0 = S.cash;
      await serviceAction('rumor');
      const fee = c0 - S.cash;
      if (fee <= 0) return null;
      const e = S.pending.find(x => x.leaked && !before.has(x));
      return e ? { fee, type: e.type, d: e.d, g: e.g, conf: e.conf || null } : { fee, type: null };
    },
    async repay(v) { if (!api.svcHere('lender') || S.debt <= 0) return 0; const d0 = S.debt; await amountAction('repay', Math.min(v, S.cash, S.debt)); return d0 - S.debt; },
    async borrow(v) { if (!api.svcHere('lender')) return 0; const d0 = S.debt; await amountAction('borrow', v); return S.debt - d0; },
    async deposit(v) { if (!api.svcHere('vault') || S.cash <= 0) return 0; const b0 = S.bank; await amountAction('deposit', Math.min(v, S.cash)); return S.bank - b0; },
    async withdraw(v) { if (!api.svcHere('vault') || S.bank <= 0) return 0; const b0 = S.bank; await amountAction('withdraw', Math.min(v, S.bank)); return b0 - S.bank; },

    // Upgrades: 'hold' | 'motor' | 'repair' | 'patch' | 'arms' | 'wireless'
    upgradeCost(kind) {
      const here = dd(S.loc).svc;
      if (kind === 'hold') { const t = HOLD_TIERS[S.holdTier + 1]; return here.includes('yard') && t ? t.cost : null; }
      if (kind === 'motor') { const t = MOTORS[S.motor + 1]; return here.includes('yard') && t ? t.cost : null; }
      if (kind === 'repair') return here.includes('yard') && S.hull < 100 ? Math.ceil((100 - S.hull) * YARD_RATE) : null;
      if (kind === 'patch') return here.includes('gutter') && S.hull < GUTTER_CAP ? Math.ceil((GUTTER_CAP - S.hull) * GUTTER_RATE) : null;
      if (kind === 'arms') { const a = ARMS[S.arms + 1]; const mk = here.includes('arms') ? 1 : here.includes('fence') ? 1.2 : 0; return a && mk ? Math.round(a.cost * mk) : null; }
      if (kind === 'wireless') return here.includes('wireless') && !S.wireless ? WIRELESS_COST : null;
      return null;
    },
    // cost of the next tier wherever it is sold (for planning ahead)
    nextTierCost(kind) {
      const t = kind === 'hold' ? HOLD_TIERS[S.holdTier + 1] : kind === 'motor' ? MOTORS[S.motor + 1] : kind === 'arms' ? ARMS[S.arms + 1] : null;
      return t ? t.cost : null;
    },
    holdTier: () => S.holdTier,
    async upgrade(kind) {
      const cost = api.upgradeCost(kind);
      if (cost == null || (kind !== 'repair' && kind !== 'patch' && S.cash < cost)) return false;
      const c0 = S.cash;
      const btn = { dataset: { mk: dd(S.loc).svc.includes('fence') && !dd(S.loc).svc.includes('arms') ? '1.2' : '1' } };
      await serviceAction(kind, btn);
      return S.cash !== c0;
    },

    // Simulate a reload of the saved game (what a player does by refreshing the page).
    // Call from a policy's choose(); return its result. Returns null when there is no save
    // (the game deletes it on sinking). Records what the reload would restore.
    reload() {
      const saved = store.get(KEY_SAVE, null);
      const R = SIM.cur && SIM.cur.reloadLog;
      if (!saved) { if (R) R.noSave++; return null; }
      if (R) { R.found++; R.cashBack += (saved.cash || 0) - S.cash; R.hullBack += (saved.hull || 0) - S.hull; }
      SIM.reload = JSON.parse(JSON.stringify(saved));
      return new ReloadSignal('reload');
    },

    rand: () => __rng.stream('policy')(),
  };
  SIM.api = api;

  // ---------------------------------------------------------------- data mutation for sweeps
  // cfg keys (all optional):
  //   depthScale: k        multiply every GOODS[i].depth [n,d] by k
  //   conf: {sure:[f,w,t], likely:[...], guess:[...]}  replace CONF odds (the bots read them too,
  //                        as a player would read the card)
  //   spike: [lo,hi], crash: [lo,hi]   full-strength shock ranges (replaces genPending)
  //   holdScale: k         multiply the capacity of hold tiers 1..5 by k (tier 0 stays 30)
  //   holdMaxTier: t       remove hold tiers above t
  const ORIG = {};
  SIM.mutate = function (cfg) {
    cfg = cfg || {};
    SIM.cfg = cfg;
    if (!ORIG.depth && DEPTH) ORIG.depth = GOODS.map(g => g.depth.slice());
    if (!ORIG.hold) ORIG.hold = HOLD_TIERS.map(t => Object.assign({}, t));
    if (!ORIG.conf && HAS_CONF) ORIG.conf = JSON.parse(JSON.stringify(CONF)); // eslint-disable-line no-undef
    if (DEPTH) GOODS.forEach((g, i) => { const k = cfg.depthScale || 1; g.depth = [ORIG.depth[i][0] * k, ORIG.depth[i][1] * k]; });
    HOLD_TIERS.length = 0; ORIG.hold.forEach(t => HOLD_TIERS.push(Object.assign({}, t)));
    if (cfg.holdScale) HOLD_TIERS.forEach((t, i) => { if (i > 0) t.cap = Math.round(t.cap * cfg.holdScale); });
    if (cfg.holdMaxTier != null) HOLD_TIERS.length = cfg.holdMaxTier + 1;
    if (HAS_CONF) for (const k of Object.keys(CONF)) { CONF[k].odds = ORIG.conf[k].odds.slice(); if (cfg.conf && cfg.conf[k]) CONF[k].odds = cfg.conf[k].slice(); } // eslint-disable-line no-undef
    SIM.shock.spike = cfg.spike || [2, 3.5];
    SIM.shock.crash = cfg.crash || [0.3, 0.52];
    if ((cfg.spike || cfg.crash) && fn('genPending')) {
      const sp = SIM.shock.spike, cr = SIM.shock.crash;
      // same draws in the same order as the game's genPending, only the ranges differ
      window.genPending = function () {
        const n = rnd() < .82 ? (rnd() < .4 ? 2 : 1) : 0;
        for (let i = 0; i < n; i++) {
          const d = pick(DISTRICTS), g = pick(GOODS), r = rnd(); let e;
          if (S.pending.some(x => x.d === d.id)) continue;
          if (r < .46) e = { type: 'spike', d: d.id, g: g.id, m: sp[0] + rnd() * (sp[1] - sp[0]), days: 2, text: pick(SPIKE_TXT) };
          else if (r < .92) e = { type: 'crash', d: d.id, g: g.id, m: cr[0] + rnd() * (cr[1] - cr[0]), days: 2, text: pick(CRASH_TXT) };
          else e = { type: 'fest', d: d.id, g: '*', m: 1.3, days: 1, text: pick(FEST_TXT) };
          e.text = fillTxt(e.text, d, g);
          if (e.type !== 'fest' && HAS_CONF) {
            const c = weighted(Object.keys(CONF).map(k => ({ k, w: CONF[k].w }))).k, o = CONF[c].odds, f = rnd(); // eslint-disable-line no-undef
            e.conf = c; e.fate = f < o[0] ? 'full' : f < o[0] + o[1] ? 'weak' : 'turn';
          }
          S.pending.push(e);
        }
      };
    }
    return { depth: DEPTH ? GOODS.map(g => g.depth) : null, hold: HOLD_TIERS.map(t => t.cap), conf: HAS_CONF ? Object.fromEntries(Object.keys(CONF).map(k => [k, CONF[k].odds])) : null, shock: SIM.shock }; // eslint-disable-line no-undef
  };

  // ---------------------------------------------------------------- runner
  const CHECK = [5, 10, 15, 18, 20, 25, 30];
  SIM.checkpoints = CHECK;
  SIM.ranks = RANKS.map(r => r.name);
  SIM.rankMins = RANKS.map(r => r.min);

  SIM.runOne = async function (polName, seed, opts) {
    const pol = SIM.policies[polName];
    if (!pol) throw new Error('unknown policy ' + polName);
    __rng.seed(seed);
    FAST = true; settings.tutorial = true; settings.muted = true;
    if (SIM.features.auto) { try { window.eval('AUTO=false'); } catch (e) {} } // eslint-disable-line no-eval
    busy = false; sel = null; SIM.reload = null; SIM.cards = [];
    try { closeModal(); } catch (e) {}
    const mem = { __events: {}, out: {}, opts: opts || {} };
    SIM.cur = { pol, mem, name: polName, maxSale: 0, reloadLog: { found: 0, noSave: 0, cashBack: 0, hullBack: 0 } };
    startGame(newState('Sim'), true);
    if (pol.init) await pol.init(api, mem);
    const worth = {};
    let reloads = 0, guard = 0;
    const errors = [];
    while (!S.over && guard++ < 120) {
      if (worth[S.day] === undefined) worth[S.day] = netWorth();
      // common random numbers: each night's draws depend only on (seed, night, phase), so one
      // policy's extra draw (a whisper, an eel bet) does not shift every later roll
      __rng.reseed('world', S.day + ':night'); __rng.reseed('policy', S.day);
      let dest = null;
      try { dest = await pol.night(api, mem); } catch (e) { errors.push('night: ' + (e && e.message)); }
      if (S.over || S.day >= NIGHTS) break;
      if (!dest || dest === S.loc || !dd(dest)) dest = S.loc === 'lq' ? 'de' : 'lq';
      const d0 = S.day;
      __rng.reseed('world', S.day + ':sail');
      await sailTo(dest);
      while (SIM.reload && reloads < 200) {
        reloads++;
        const s = SIM.reload; SIM.reload = null;
        S = s; busy = false; sel = null;
        __rng.reseed('world', S.day + ':reload' + reloads);
        await runTrip(true);
      }
      if (!S.over && S.day === d0) { errors.push('sailTo did not advance on night ' + d0); break; }
    }
    const sunk = S.hull <= 0;
    const t = tally(sunk ? 'sunk' : 'complete');
    // fill worth checkpoints: carry forward over skipped nights, use the final fortune after a sinking
    const w = {}; let last = worth[1];
    for (let d = 1; d <= NIGHTS; d++) { if (worth[d] !== undefined && !(sunk && d > S.day)) last = worth[d]; if (sunk && d >= S.day) last = t.net; w[d] = last; }
    if (pol.finish) { try { pol.finish(api, mem); } catch (e) { errors.push('finish: ' + e.message); } }
    const st = S.stats;
    return {
      seed, net: t.net, rank: rankFor(t.net).name, sunk, day: S.day, hull: S.hull, over: !!S.over, tallyCargo: t.cargo,
      worth: CHECK.map(d => w[d]), worthAll: Array.from({ length: NIGHTS }, (_, i) => w[i + 1]),
      stats: { trips: st.trips, fights: st.fights, won: st.won, fled: st.fled, bribes: st.bribes, interest: st.interest, vaultEarned: st.vaultEarned, bestFlip: st.bestFlip, maxSale: SIM.cur.maxSale, whispersBought: st.whispers || 0, holdTier: S.holdTier, wireless: S.wireless, arms: S.arms, motor: S.motor },
      events: mem.__events, out: mem.out, reloads, reloadLog: SIM.cur.reloadLog, errors,
    };
  };

  SIM.runBatch = async function (polName, seeds, opts) {
    const res = [];
    for (const s of seeds) {
      try { res.push(await SIM.runOne(polName, s, opts)); }
      catch (e) { res.push({ seed: s, error: String(e && e.stack || e) }); }
    }
    return res;
  };
})();
