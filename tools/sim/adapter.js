// Gloamwater simulator: in-page adapter.
//
// This file is injected into the game page as a classic script AFTER the game has loaded, so it
// sees the game's top-level bindings (S, FAST, GOODS, sailTo, coreBuy, ...) by name.
// It is the ONLY place that knows how the game is built. Policies call SIM.api and nothing else.
// When the game's API changes, edit this file (see README.md, "Updating the adapter").
//
// Targets the round-2 build: market depth, canals (EDGES, nextHop, nightsTo), stayNight(),
// trading charters, confirm cards, cargo-scaled encounters, the debt deadline, and the game's own
// seeded RNG streams in the save (S.rngM for the market, S.rngE for events).
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
  const CANALS = has('EDGES') && has('nextHop') && has('nightsTo');
  const CHARTERS = has('charterCost') && has('CHARTER_DEPTH');
  const STAY = fn('stayNight');
  const ENC_T = has('ENC') ? ENC : null; // eslint-disable-line no-undef
  SIM.features = { depth: DEPTH, conf: HAS_CONF, canals: CANALS, charters: CHARTERS, stay: STAY, encTable: !!ENC_T, gameRng: has('marketDice') };
  try { Sound.setMuted(true); } catch (e) {}

  // ---------------------------------------------------------------- RNG
  // The game draws from two seeded streams kept in the save: S.rngM (market) and S.rngE (events).
  // newState() seeds both from Math.random, which sim.js seeds per run, so a run is reproducible
  // from its seed, and the market is the same for every policy on that seed (the game guarantees
  // this). For paired comparisons the runner also reseeds S.rngE from (seed, night, phase) right
  // before the voyage roll and the arrival roll, so one policy's extra draw (a fight round, an
  // eel bet) does not shift every later roll. Reloads restore S.rngE from the save as the game does.
  function hash32(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; }
  SIM.seedBase = '0';
  SIM.reseedE = key => { if (S && Number.isInteger(S.rngE) && SIM.crn !== false) S.rngE = hash32(SIM.seedBase + ':E:' + key); };
  function wrapRoll(name, keyFn) {
    if (!fn(name)) return false;
    const orig = window[name];
    window[name] = function () { if (!SIM.reload) SIM.reseedE(keyFn.apply(this, arguments)); return orig.apply(this, arguments); };
    return true;
  }
  SIM.features.crnVoyage = wrapRoll('rollVoyageEvent', () => S.day + ':voy');
  SIM.features.crnArrival = wrapRoll('rollArrivalEvent', () => S.day + ':arr');

  // ---------------------------------------------------------------- game constants and model
  const gd = id => GI[id];
  const dd = id => DI[id];
  const clamp_ = (v, a, b) => Math.max(a, Math.min(b, v));

  // Shock sizes as written in genPending() and landEvent(). SIM.mutate() keeps these in step with
  // any range it changes. A player learns these sizes by playing; the bots use their means.
  SIM.shock = { spike: [2, 3.5], crash: [0.3, 0.52], weak: { spike: [1.25, 1.55], crash: [0.7, 0.82] }, turn: { spike: [0.62, 0.76], crash: [1.3, 1.55] }, fest: 1.3 };
  const mid = r => (r[0] + r[1]) / 2;
  function landedExpect(told, kind) {
    const K = SIM.shock;
    if (told === 'fest') return K.fest;
    if (kind === 'weak') return mid(K.weak[told]);
    if (kind === 'turn') return mid(K.turn[told]);
    return mid(K[told]);
  }
  // Expected multiplier of a rumour, given only what the card says: type and confidence (CONF odds).
  function rumourExpect(told, conf, trust) {
    if (told === 'fest') return SIM.shock.fest;
    if (trust || !HAS_CONF || !CONF[conf]) return landedExpect(told, 'full'); // eslint-disable-line no-undef
    const o = CONF[conf].odds; // eslint-disable-line no-undef
    return o[0] * landedExpect(told, 'full') + o[1] * landedExpect(told, 'weak') + o[2] * landedExpect(told, 'turn');
  }

  SIM.model = {
    trendAR: 0.85, localAR: 0.65,
    trendShare: 0.66,
    pressDecay: 0.4,            // stepMarket: press *= .4 each night (|x| < .5 snaps to 0)
    stockP: (did, gid, day = S.day) => (has('fleetMult') && fleetMult(did, gid, day) > 1 ? 1 : mult(dd(did), gd(gid), day) !== 1 ? 0.95 : 0.8), // eslint-disable-line no-undef
    landedExpect, rumourExpect,
    clampLo: g => g.min * 0.4, clampHi: g => g.max * 1.6,
    hullValue: () => (has('YARD_RATE') ? YARD_RATE : 35), // eslint-disable-line no-undef
  };

  // ---------------------------------------------------------------- depth math (mirrors the game)
  const depthAt = (did, gid, day = S.day) => (DEPTH ? depthOf(did, gid, day) : { n: Infinity, d: 1 }); // eslint-disable-line no-undef
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

  // ---------------------------------------------------------------- encounters
  // Mirrors fightLoop(): what each option costs and how likely it is to work. The card states the
  // run and fight odds, the bribe, toll or collection, the boats and the cargo at stake. Damage
  // ranges are not on the card; a seasoned captain knows them roughly, and the bots use the means.
  const EN = ENC_T || { flee: { base: .46, motor: .15, perBoat: .06, load: .16, min: .12, max: .9 }, fightPerBoat: .03, returnFire: .6, bribe: { perBoat: 250, purse: .1, cargo: .07 }, toll: { min: 200, purse: .25, cargo: .12 }, collect: { min: 500, share: .35, credit: .75 }, runSeize: .12, loot: { gulls: [400, 900], other: [600, 1400] }, calmNights: 3, calmFactor: .5 };
  const fleeP = (b, load, motor) => clamp_(EN.flee.base + EN.flee.motor * motor - EN.flee.perBoat * (b - 1) - EN.flee.load * load, EN.flee.min, EN.flee.max);
  const fightP = (b, arms) => clamp_(ARMS[arms].p - EN.fightPerBoat * (b - 1), 0.08, 0.85);
  const dist = (lo, hi, b) => { const out = new Map(); const n = (hi - lo + 1) * 3; for (let a = lo; a <= hi; a++) for (let m = 2; m <= 4; m++) { const d = a + b * m; out.set(d, (out.get(d) || 0) + 1 / n); } return [...out.entries()]; };
  const RUN_D = [0, 1, 2, 3, 4, 5, 6].map(b => dist(5, 10, b));
  const RET_D = [0, 1, 2, 3, 4, 5, 6].map(b => dist(4, 8, b));
  // What winning is worth, as fightLoop pays it: a strongbox scaled by the starting boats and the
  // night; the gang's cargo (one of the five cheapest goods, about ENC.gullCargo at usual prices,
  // valued at 60% since it must still be sold); Marrow's collectors pay nothing and add a fee to the debt.
  // (Older builds: loot.other, and a bigger gull cargo.)
  function winValue(kind, start, day, free, debt) {
    if (kind === 'collectors') return EN.collectFee != null ? -EN.collectFee * debt : mid((EN.loot && EN.loot.other) || [600, 1400]) * start * (1 + day / 12);
    const lr = (EN.loot && (EN.loot[kind] || EN.loot.other)) || [0, 0];
    const newer = EN.gullCargo != null;
    let v = mid(lr) * start * (1 + day / (newer ? 20 : 12));
    if (kind === 'gulls') {
      if (newer) { const goods = GOODS.slice(0, 5); v += goods.reduce((a, g) => a + Math.min(Math.max(0, free), Math.max(1, Math.floor(EN.gullCargo * (1 + day / 15) / g.base))) * g.base, 0) / goods.length * 0.6; }
      else v += Math.min(Math.max(0, free), 6.5 * start) * (GOODS.slice(0, 6).reduce((a, g) => a + g.base, 0) / 6) * 0.6;
    }
    return v;
  }
  SIM.encModel = { fleeP, fightP, EN, winValue };

  // Expected cost (crowns) of each option from the current round, solved over boats x hull by
  // dynamic programming, then the cheapest. ctx: {kind, b, start, hull, cash, cargoV (what the cargo
  // would fetch), cargoBase, load, motor, arms, day, free, parcels, bribe (card), toll, collect,
  // sinkCost, calmValue}. Lower is better; a win is negative (loot).
  SIM.encSolve = function (ctx) {
    const hv = SIM.model.hullValue();
    const kind = ctx.kind, H = Math.max(1, Math.round(ctx.hull));
    const cargoV = Math.max(0, ctx.cargoV || 0), base = Math.max(0, ctx.cargoBase || 0);
    const seize = kind === 'collectors' ? 0 : EN.runSeize * cargoV;
    const sink = ctx.sinkCost;
    // A battered hull is not only a repair bill: until it is mended, the next encounter or squall
    // can sink the skiff with everything aboard. Ending the encounter at hull h costs roughly
    // sink x 0.5 x exp(-h/12) more (2% of the stake at 40% hull, 9% at 20%).
    const R = h => (h <= 0 ? sink : sink * 0.5 * Math.exp(-h / 12));
    const win = winValue(kind, ctx.start, ctx.day, ctx.free || 0, ctx.debt || 0) + (ctx.calmValue || 0);
    const inKind = short => (base > 0 ? cargoV * Math.min(1, short / base) : null);
    const smash = h => (h <= 12 ? sink : 12 * hv + R(h - 12)); // an empty hold pays in hull
    // options that end the encounter here (cost, or absent if not offered)
    const term = (b, h) => {
      const t = {};
      if (kind === 'patrol') {
        const br = ctx.bribe != null ? ctx.bribe - EN.bribe.perBoat * (ctx.b - b) : null;
        if (br != null && ctx.cash >= br) t.bribe = br + R(h);
        t.yield = 0.5 * cargoV + (ctx.parcels || 0) + R(h);
      } else if (kind === 'gulls') {
        const toll = ctx.toll;
        if (ctx.cash >= toll) t.pay = toll + R(h);
        else { const k = inKind(toll - ctx.cash); t.pay = ctx.cash + (k != null ? k + R(h) : smash(h)); }
      } else if (kind === 'collectors') {
        const due = ctx.collect, amt = Math.min(due, ctx.cash);
        let c = amt * (1 - EN.collect.credit);
        if (amt < due) { const short = due - amt; const k = inKind(short); c += k != null ? k - EN.collect.credit * Math.min(short, base) + R(h) : smash(h); }
        else c += R(h);
        t.pay = c;
      }
      return t;
    };
    const V = [];
    const B = Math.max(1, Math.min(6, ctx.b));
    for (let b = 0; b <= B; b++) V.push(new Float64Array(H + 1));
    const choice = {};
    const step = (b, h, wantDetail) => {
      const det = {};
      // run
      const p = fleeP(b, ctx.load, ctx.motor);
      let s = 0;
      for (const [d, pr] of RUN_D[b]) s += pr * (h - d <= 0 ? sink : d * hv + seize + V[b][h - d]);
      det.run = p * R(h) + (1 - p) * s;
      // fight (stationary, so the miss-and-no-return-fire self loop is solved in closed form)
      const fp = fightP(b, ctx.arms), rf = EN.returnFire;
      let hit;
      if (b - 1 === 0) hit = -win + R(h);
      else { let r = 0; for (const [d, pr] of RET_D[b - 1]) r += pr * (h - d <= 0 ? sink : d * hv + V[b - 1][h - d]); hit = rf * r + (1 - rf) * V[b - 1][h]; }
      let miss = 0; for (const [d, pr] of RET_D[b]) miss += pr * (h - d <= 0 ? sink : d * hv + V[b][h - d]);
      det.fight = (fp * hit + (1 - fp) * rf * miss) / (1 - (1 - fp) * (1 - rf));
      Object.assign(det, term(b, h));
      let best = null;
      for (const [k, v] of Object.entries(det)) if (!(ctx.noFight && k === 'fight') && (best == null || v < det[best])) best = k;
      V[b][h] = det[best];
      if (wantDetail) { choice.best = best; choice.costs = det; }
    };
    for (let h = 1; h <= H; h++) for (let b = 1; b <= B; b++) step(b, h, h === H && b === B);
    return choice;
  };

  // Context for the solver from the live card and the policy's view of its cargo.
  function encCtx(ci, extra) {
    const mem = SIM.cur && SIM.cur.mem;
    const T = S.trip && typeof S.trip === 'object' ? S.trip : {};
    const b = T.boats || ci.boats || 2;
    const cargoV = Math.max(api.cargoValueHere(), (mem && mem.cargoVDay === S.day && mem.cargoV) || 0);
    const nightsLeft = Math.max(0, NIGHTS - S.day);
    const nv = (mem && mem.nv) || 0;
    const future = nightsLeft * Math.max(1500, nv, 0.06 * Math.max(0, netWorth()));
    const pAvg = 0.15;
    return Object.assign({
      kind: ci.kind, b, start: T.boats0 || b, hull: S.hull, cash: S.cash, cargoV, cargoBase: cargoBaseValue(),
      load: holdUsed() / capacity(), motor: S.motor, arms: S.arms, day: S.day, free: capacity() - holdUsed(), debt: S.debt,
      parcels: S.contracts.reduce((s, c) => s + c.reward, 0),
      bribe: ci.opts.bribe ? ci.opts.bribe.cost : null, toll: ci.opts.pay ? ci.opts.pay.cost : 0, collect: ci.opts.pay ? ci.opts.pay.cost : 0,
      sinkCost: S.cash + cargoV + future,
      calmValue: EN.calmNights * (1 - EN.calmFactor) * pAvg * 1500,
    }, extra || {});
  }
  SIM.encCtx = encCtx;

  // Expected cost of an encounter on a voyage to `did`, for planning: a typical patrol or gang for
  // the night, priced with the solver for the cash and cargo the captain would carry.
  const encMemo = new Map();
  function encExpect(did, o) {
    const day = S.day, cash = Math.max(0, o.cash), cargoV = Math.max(0, o.cargoV), base = Math.max(0, o.cargoBase);
    const pPatrol = did === 'fm' ? 0.7 : did === 'sl' ? 0.3 : 0.5;
    const key = [did === 'fm' ? 'f' : did === 'sl' ? 's' : 'o', day > 18 ? 2 : day > 5 ? 1 : 0, Math.round(S.hull / 5), Math.round(cash / 1000), Math.round(cargoV / 2000), Math.round(base / 2000), S.motor, S.arms, Math.round((o.load || 0) * 4)].join(',');
    if (encMemo.has(key)) return encMemo.get(key) * pPatrol + encMemo.get(key + 'g') * (1 - pPatrol);
    const nightsLeft = Math.max(0, NIGHTS - day);
    const common = { start: 0, debt: S.debt, hull: S.hull, cash, cargoV, cargoBase: base, load: o.load || 0, motor: S.motor, arms: S.arms, day, free: Math.max(0, o.free || 0), parcels: 0, sinkCost: cash + cargoV + nightsLeft * Math.max(1500, 0.06 * (cash + cargoV)), calmValue: 0 };
    const pb = day <= 5 ? 2 : 2 + (day > 18 ? 1 : 0), gb = day <= 5 ? 2 : 3;
    const patrol = SIM.encSolve(Object.assign({}, common, { kind: 'patrol', b: pb, start: pb, bribe: Math.round(EN.bribe.perBoat * pb + EN.bribe.purse * cash + EN.bribe.cargo * base) }));
    const gulls = SIM.encSolve(Object.assign({}, common, { kind: 'gulls', b: gb, start: gb, toll: Math.max(EN.toll.min, Math.round(EN.toll.purse * cash + EN.toll.cargo * base)) }));
    const cp = patrol.costs[patrol.best], cg = gulls.costs[gulls.best];
    if (encMemo.size > 20000) encMemo.clear();
    encMemo.set(key, cp); encMemo.set(key + 'g', cg);
    return cp * pPatrol + cg * (1 - pPatrol);
  }
  // encounterChance() with a planned cargo (the formula in the game; the bots know which canals are rough)
  function encChance(did, cargoBase) {
    if (!has('ENC')) return encounterChance(did); // eslint-disable-line no-undef
    const calm = typeof S.calmUntil === 'number' && S.day < S.calmUntil ? EN.calmFactor : 1;
    const b = cargoBase == null ? cargoBaseValue() : cargoBase;
    return clamp_((0.07 + 0.035 * dd(did).danger + Math.min(0.12, b / 300000) - 0.04 * S.motor + (S.day > 20 ? 0.03 : 0)) * calm, 0.03, 0.4);
  }

  // ---------------------------------------------------------------- choose() override
  SIM.cards = [];
  SIM.reload = null;
  ['save', 'endGame'].forEach(n => { if (fn(n)) { const o = window[n]; window[n] = function () { if (SIM.reload) return Promise.resolve(); return o.apply(this, arguments); }; } });
  class ReloadSignal extends Error {}
  SIM.ReloadSignal = ReloadSignal;

  const num = s => { const m = String(s || '').replace(/<[^>]+>/g, '').match(/[0-9][0-9,]*/); return m ? +m[0].replace(/,/g, '') : 0; };
  const pctOf = s => { const m = String(s || '').match(/(\d+)%/); return m ? +m[1] / 100 : 0; };
  // portraits renamed some event art keys; map them back to the event
  const ART_ALIAS = { fenna: 'racks', wick: 'eel', salon: 'whisper', pell: 'tip' };

  function cardInfo(c) {
    const art = String(c.art || '');
    let kind = art.startsWith('enc_') ? art.slice(4) : (ART_ALIAS[art] || art);
    if (c.confirm) kind = 'confirm';
    const opts = {};
    (c.choices || []).forEach(x => { opts[x.key] = { enabled: !x.disabled, cost: num(x.label), p: pctOf(x.sub), label: x.label, sub: x.sub }; });
    const boats = /Enemy boats<b>(\d+)/.exec(c.extra || '');
    return { kind, title: c.title, kicker: c.kicker, opts, keys: Object.keys(opts), card: c, round: c.result ? 2 : 1, boats: boats ? +boats[1] : null };
  }
  SIM.cardInfo = cardInfo;
  function enabled(ci, k) { return ci.opts[k] && ci.opts[k].enabled; }
  SIM.enabled = enabled;

  function leakReference(ci) {
    // The choice reveals quantity and good. Do not infer the selected cargo from hidden event state.
    const text = String(ci.opts.yield && ci.opts.yield.label || '').replace(/<[^>]+>/g, '');
    const q = /Jettison\s+(\d+)/i.exec(text);
    const g = GOODS.find(g => text.includes(g.name));
    return q && g ? +q[1] * g.base : null;
  }

  // Default answers. Documented in README.md.
  SIM.defaultChoose = function (ci) {
    const hull = S.hull;
    const first = ci.keys.find(k => enabled(ci, k));
    switch (ci.kind) {
      case 'patrol': case 'gulls': case 'collectors': {
        const sol = SIM.encSolve(encCtx(ci));
        if (SIM.encOpen && !SIM.encOpen.expect) SIM.encOpen.expect = { best: sol.best, costs: sol.costs };
        return enabled(ci, sol.best) ? sol.best : first;
      }
      case 'squall': return hull > 25 || !enabled(ci, 'shelter') ? 'push' : 'shelter';
      case 'gull': {
        if (!enabled(ci, 'run') || !enabled(ci, 'pay')) return first; // older one-button event
        const pay = ci.opts.pay.cost, p = ci.opts.run.p;
        const mem = SIM.cur && SIM.cur.mem;
        const future = Math.max(0, NIGHTS - S.day) * Math.max(1500, mem && mem.nv || 0, 0.06 * Math.max(0, netWorth()));
        const damage = hull <= 10 ? S.cash + api.cargoValueHere() + future : 10 * SIM.model.hullValue();
        const runCost = (1 - p) * (pay + damage);
        return runCost < pay ? 'run' : 'pay';
      }
      case 'leak': {
        if (!enabled(ci, 'yield')) return first; // older one-button event
        const value = leakReference(ci);
        return enabled(ci, 'pay') && value != null && ci.opts.pay.cost <= value && ci.opts.pay.cost <= S.cash ? 'pay' : 'yield';
      }
      case 'crate': return hull > 20 && enabled(ci, 'take') ? 'take' : 'leave';
      case 'racks': return enabled(ci, 'buy') && S.cash >= 3 * ci.opts.buy.cost && S.day <= 25 ? 'buy' : 'no';
      case 'eel': return 'no';
      case 'courier': return enabled(ci, 'yes') ? 'yes' : 'no';
      case 'confirm': return SIM.expectConfirm ? 'yes' : 'no';
      default: return first;
    }
  };

  // Encounter bookkeeping: one record per encounter, from its first card to the card that ends it.
  function cargoSnap() { const o = {}; for (const g of GOODS) o[g.id] = S.cargo[g.id].q; return o; }
  function encOpen(ci) {
    const m = SIM.cur && SIM.cur.mem, cv = Math.max(api.cargoValueHere(), (m && m.cargoVDay === S.day && m.cargoV) || 0), cb = cargoBaseValue();
    SIM.encOpen = { kind: ci.kind, day: S.day, boats: (S.trip && S.trip.boats) || ci.boats || 0, seq: [], cash: S.cash, hull: S.hull, debt: S.debt, cargo: cargoSnap(), ratio: cb > 0 ? cv / cb : 1, cargoV: cv, cargoBase: cb, parcels: S.contracts.reduce((s, c) => s + c.reward, 0), fleeP: ci.opts.run ? ci.opts.run.p : null, fightP: ci.opts.fight ? ci.opts.fight.p : null, offer: (ci.opts.bribe || ci.opts.pay || {}).cost || 0 };
  }
  function encClose(endKind, endKicker) {
    const e = SIM.encOpen; if (!e) return; SIM.encOpen = null;
    let lostBase = 0, gained = 0;
    for (const g of GOODS) { const d = e.cargo[g.id] - S.cargo[g.id].q; if (d > 0) lostBase += d * g.base; else if (d < 0) gained += -d * g.base; }
    const parcelsLost = e.parcels - S.contracts.reduce((s, c) => s + c.reward, 0);
    const rec = {
      kind: e.kind, day: e.day, boats: e.boats, first: e.seq[0], last: e.seq[e.seq.length - 1], rounds: e.seq.length, seq: e.seq.join(','),
      end: endKind === 'sunk' ? 'sunk' : endKind === 'victory' ? 'won' : (endKicker || endKind || 'other'),
      cash: S.cash - e.cash, hull: S.hull - e.hull, debt: e.debt - S.debt, cargoLost: Math.round(lostBase * e.ratio), lootGoods: Math.round(gained * 0.6), parcelsLost: Math.max(0, parcelsLost),
      cargoV: Math.round(e.cargoV), cashBefore: e.cash, fleeP: e.fleeP, fightP: e.fightP, offer: e.offer,
      expectBest: e.expect && e.expect.best, expectCost: e.expect ? Math.round(e.expect.costs[e.expect.best]) : null,
    };
    // realised cost: crowns out of the purse, hull at the yard rate, cargo at what it would fetch,
    // parcels lost, less what came off the debt and loot goods (at 60% of usual price)
    rec.cost = Math.round(-rec.cash + -rec.hull * SIM.model.hullValue() + rec.cargoLost + rec.parcelsLost - rec.debt - rec.lootGoods);
    if (SIM.cur) SIM.cur.enc.push(rec);
  }
  SIM.encCloseAny = () => encClose('other', 'unfinished');

  window.choose = function (c) {
    const ci = cardInfo(c);
    SIM.cards.push(ci.kind);
    if (SIM.reload) return Promise.resolve(ci.keys.find(k => enabled(ci, k)));
    const isEnc = ci.kind === 'patrol' || ci.kind === 'gulls' || ci.kind === 'collectors';
    if (isEnc && !SIM.encOpen) encOpen(ci);
    else if (!isEnc && SIM.encOpen) encClose(ci.kind, ci.kicker);
    const cur = SIM.cur;
    let k = null;
    if (cur && cur.pol.choose) {
      k = cur.pol.choose(ci, api, cur.mem);
      if (k instanceof ReloadSignal) return Promise.reject(k);
    }
    if (!k || !enabled(ci, k)) k = SIM.defaultChoose(ci);
    if (!enabled(ci, k)) k = ci.keys.find(x => enabled(ci, x));
    if (isEnc && SIM.encOpen) SIM.encOpen.seq.push(k);
    if (cur && ci.kind !== 'confirm') { const ev = cur.mem.__events; ev[ci.kind + ':' + k] = (ev[ci.kind + ':' + k] || 0) + 1; }
    return Promise.resolve(k);
  };

  async function amountAction(act, v) {
    const orig = window.askAmount;
    window.askAmount = async o => { const x = Math.max(0, Math.min(Math.floor(v), Math.floor(o.max))); return x > 0 ? x : null; };
    try { await serviceAction(act); } finally { window.askAmount = orig; }
  }
  // Purchases open a confirm card; answer it yes for the purchase the policy asked for, no otherwise.
  async function confirmed(act, btn) {
    SIM.expectConfirm = true;
    try { await serviceAction(act, btn); } finally { SIM.expectConfirm = false; }
  }

  function landedKind(e) {
    if (!e.told || e.told === 'fest' || e.type === 'fest') return 'full';
    if (e.told !== e.type) return 'turn';
    try { if (typeof WEAK_TXT !== 'undefined' && e.text === fillTxt(WEAK_TXT[e.told], dd(e.d), gd(e.g))) return 'weak'; } catch (x) {} // eslint-disable-line no-undef
    return 'full';
  }

  // ---------------------------------------------------------------- the API policies use
  // Information rule: everything here is something the player can see on screen or remember.
  // Hidden state (unleaked rumours, a rumour's fate, a shock's exact size, unseen prices or
  // stock, the RNG state) is not exposed. api.state() exists for post-hoc accounting only.
  const api = {
    // --- state ---
    day: () => S.day, nights: () => NIGHTS, loc: () => S.loc,
    cash: () => S.cash, bank: () => S.bank, debt: () => S.debt, maxDebt: () => (typeof creditLimit === 'function' ? creditLimit() : MAX_DEBT), /* eslint-disable-line no-undef */ hull: () => S.hull,
    cap: () => capacity(), used: () => holdUsed(), free: () => capacity() - holdUsed(),
    goods: () => GOODS.map(g => g.id), districts: () => DISTRICTS.map(d => d.id),
    good: gid => gd(gid), district: did => dd(did),
    held: gid => ({ q: S.cargo[gid].q, cost: S.cargo[gid].cost }),
    contracts: () => S.contracts.slice(),
    netWorth: () => netWorth(),
    cargoBase: () => cargoBaseValue(),
    arms: () => S.arms, motor: () => S.motor,
    state: () => S,

    // --- canals (the map draws them) ---
    canals: () => CANALS,
    adjacent: (a, b) => (CANALS ? adjacent(a, b) : a !== b), // eslint-disable-line no-undef
    nightsTo: (a, b) => (CANALS ? nightsTo(a, b) : a === b ? 0 : 1), // eslint-disable-line no-undef
    nextHop: (a, b) => (CANALS ? nextHop(a, b) : b), // eslint-disable-line no-undef
    neighbours: did => DISTRICTS.map(d => d.id).filter(x => x !== did && api.adjacent(did, x)),
    canStay: () => STAY && S.day < NIGHTS,

    // --- debt deadline (the toast on night 8 and Marrow's office say it) ---
    debtHunted: () => (has('debtHunted') ? debtHunted() : false), // eslint-disable-line no-undef
    huntRule: { limit: 12000, day: 10 },

    // --- market ---
    stocked(gid, did) {
      did = did || S.loc;
      if (did === S.loc) return !!S.stock[did][gid];
      const s = S.seen[did] && S.seen[did][gid];
      return s && s.day === S.day && typeof s.st === 'boolean' ? s.st : null;
    },
    price: gid => price(gid),
    // Public fleet schedules, when present, can be read for the arrival night too.
    districtMult: (did, gid, day = S.day) => mult(dd(did), gd(gid), day),
    effectMultHere: gid => api.knownEffectMult(S.loc, gid),
    knownEffects: () => S.effects.filter(e => e.known).map(e => {
      const kind = landedKind(e), told = e.told || e.type;
      return { type: e.type, told, kind, d: e.d, g: e.g, age: e.age, days: e.days, m: landedExpect(told, kind) };
    }),
    knownEffectMult(did, gid) { let m = 1; for (const e of api.knownEffects()) if (e.d === did && (e.g === gid || e.g === '*')) m *= e.age === 0 ? e.m : Math.sqrt(e.m); return m; },
    seen: (did, gid) => (S.seen[did] && S.seen[did][gid]) || null,
    rawSeen(did, gid) {
      const s = api.seen(did, gid);
      if (!s || s.day !== S.day) return null;
      const k = depthAt(did, gid);
      return s.p / pressF_(pressNow(did, gid), k.n, k.d);
    },
    wireless: () => !!S.wireless,
    leakedPending: () => S.pending.filter(e => e.leaked).map(e => ({ type: e.type, d: e.d, g: e.g, days: e.days, conf: e.conf || null })),
    encounterChance: (did, cargoBase) => encChance(did, cargoBase),
    encExpect,

    // --- depth ---
    hasDepth: () => DEPTH,
    depth: (did, gid, ahead = 0) => depthAt(did, gid, S.day + ahead),
    pressure: (did, gid) => pressNow(did, gid),
    pressAfter,
    pressF: pressF_, pressInt: pressInt_,
    sellCurve(did, gid, q, p, x, ahead = 0) { if (q <= 0) return 0; const k = depthAt(did, gid, S.day + ahead); return p * pressInt_(x - q, x, k.n, k.d); },
    buyCurve(did, gid, q, p, x, ahead = 0) { if (q <= 0) return 0; const k = depthAt(did, gid, S.day + ahead); return p * pressInt_(x, x + q, k.n, k.d); },
    rawPrice: gid => (DEPTH ? S.prices[S.loc][gid] : price(gid)),
    quoteBuy(gid, q) { if (q <= 0) return 0; return DEPTH ? quoteBuy(gid, q) : price(gid) * q; }, // eslint-disable-line no-undef
    quoteSell(gid, q) { if (q <= 0) return 0; return DEPTH ? quoteSell(gid, q) : price(gid) * q; }, // eslint-disable-line no-undef
    maxBuy(gid, cash) {
      if (!S.stock[S.loc][gid]) return 0;
      const budget = cash == null ? S.cash : Math.min(cash, S.cash);
      const room = Math.max(0, capacity() - holdUsed());
      if (!DEPTH) return Math.max(0, Math.min(Math.floor(budget / price(gid)), room));
      let lo = 0, hi = room;
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (api.quoteBuy(gid, m) <= budget) lo = m; else hi = m - 1; }
      return lo;
    },
    flatLeft: (gid, mode) => (DEPTH ? flatLeft(gid, mode) : Infinity), // eslint-disable-line no-undef
    cargoValueHere() { let v = 0; for (const g of GOODS) { const q = S.cargo[g.id].q; if (q && S.stock[S.loc][g.id]) v += api.quoteSell(g.id, q); } return v; },

    // --- charters (Harbor tab, any district) ---
    hasCharters: () => CHARTERS,
    charterCost: () => (CHARTERS ? charterCost() : null), // eslint-disable-line no-undef
    hasCharter: did => !!(S.charters && S.charters[did || S.loc]),
    charters: () => Object.keys(S.charters || {}),
    async buyCharter() {
      if (!CHARTERS || api.hasCharter() || S.cash < api.charterCost()) return false;
      const c0 = S.cash; await confirmed('charter');
      if (S.cash !== c0 && SIM.cur) SIM.cur.charters.push({ day: S.day, d: S.loc, cost: c0 - S.cash });
      return S.cash !== c0;
    },
    // What the plan would look like with a charter at did (the Harbor card says what it does:
    // twice as deep). Evaluates fn with the charter in place, then takes it away again.
    hypoCharter(did, f) {
      if (!CHARTERS || api.hasCharter(did)) return f();
      S.charters[did] = true;
      try { return f(); } finally { delete S.charters[did]; }
    },

    // --- actions ---
    buy(gid, q) {
      const c0 = S.cash; const r = coreBuy(gid, Math.floor(q));
      const n = typeof r === 'number' ? r : r ? r.q : 0;
      if (SIM.cur && n > 0) recordTrade(gid, 'buy', n, c0 - S.cash);
      return { q: n || 0, total: c0 - S.cash };
    },
    sell(gid, q) {
      const c0 = S.cash; const r = coreSell(gid, Math.floor(q));
      if (!r) return { q: 0, total: 0 };
      const total = S.cash - c0;
      if (SIM.cur && total > SIM.cur.maxSale) SIM.cur.maxSale = total;
      if (SIM.cur) recordTrade(gid, 'sell', r.q, total);
      return { q: r.q, total };
    },
    sellAll(filter) { let tot = 0; for (const g of GOODS) { const h = S.cargo[g.id]; if (h.q && S.stock[S.loc][g.id] && (!filter || filter(g.id))) tot += api.sell(g.id, h.q).total; } return tot; },

    svcHere: k => dd(S.loc).svc.includes(k),
    whisperCost: () => rumorCost(),
    whisperHint: () => (has('CONF_HINT') && has('whisperable') && whisperable().length) ? whisperable()[0].conf : null, // eslint-disable-line no-undef
    whisperAvailable() {
      if (!dd(S.loc).svc.includes('rumor') || S.day >= NIGHTS || S.cash < rumorCost()) return false;
      if (S.whisperDay === S.day) return false;
      if (has('whisperable') && !whisperable().length) return false; // eslint-disable-line no-undef
      return true;
    },
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
    nextTierCost(kind) {
      const t = kind === 'hold' ? HOLD_TIERS[S.holdTier + 1] : kind === 'motor' ? MOTORS[S.motor + 1] : kind === 'arms' ? ARMS[S.arms + 1] : null;
      return t ? t.cost : null;
    },
    holdTier: () => S.holdTier,
    holdTierCap: tier => HOLD_TIERS[tier] ? HOLD_TIERS[tier].cap : null,
    holdTierCost: tier => HOLD_TIERS[tier] ? HOLD_TIERS[tier].cost || 0 : null,
    hypoHold(tier, f) {
      const before = S.holdTier;
      S.holdTier = tier;
      try { return f(); } finally { S.holdTier = before; }
    },
    async upgrade(kind) {
      const cost = api.upgradeCost(kind);
      if (cost == null || (kind !== 'repair' && kind !== 'patch' && S.cash < cost)) return false;
      const c0 = S.cash, h0 = S.hull;
      const btn = { dataset: { mk: dd(S.loc).svc.includes('fence') && !dd(S.loc).svc.includes('arms') ? '1.2' : '1' } };
      await confirmed(kind, btn);
      if (SIM.cur && S.cash < c0) SIM.cur.purchases.push({ day: S.day, d: S.loc, kind, cost: c0 - S.cash, hullRestored: S.hull - h0 });
      return S.cash !== c0;
    },

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

  function recordTrade(gid, kind, q, total) {
    const key = [S.day, S.loc, gid, kind].join(':');
    const t = SIM.cur.trades[key] || (SIM.cur.trades[key] = { day: S.day, d: S.loc, g: gid, kind, q: 0, total: 0 });
    t.q += q; t.total += total;
  }

  function assertEconomy() {
    for (const key of ['cash', 'bank', 'debt']) if (!Number.isFinite(S[key]) || S[key] < 0) throw new Error('economy invariant: invalid ' + key);
    for (const g of GOODS) {
      const c = S.cargo[g.id];
      if (!Number.isInteger(c.q) || c.q < 0 || !Number.isFinite(c.cost) || c.cost < 0) throw new Error('economy invariant: invalid cargo ' + g.id);
    }
    if (holdUsed() > capacity()) throw new Error('economy invariant: hold over capacity');
    if (SIM.cur) SIM.cur.numericChecks++;
  }

  // ---------------------------------------------------------------- data mutation for sweeps
  const ORIG = {};
  SIM.mutate = function (cfg) {
    cfg = cfg || {};
    SIM.cfg = cfg;
    if (!ORIG.depth && DEPTH) ORIG.depth = GOODS.map(g => g.depth.slice());
    if (!ORIG.hold) ORIG.hold = HOLD_TIERS.map(t => Object.assign({}, t));
    if (!ORIG.conf && HAS_CONF) ORIG.conf = JSON.parse(JSON.stringify(CONF)); // eslint-disable-line no-undef
    if (DEPTH) GOODS.forEach((g, i) => { const k = cfg.depthScale || 1; g.depth = [ORIG.depth[i][0] * k, ORIG.depth[i][1] * k]; });
    // Experimental public freight license; never changes the shipped game file.
    if (DEPTH) {
      if (!ORIG.depthFn) ORIG.depthFn = window.depthOf;
      window.depthOf = cfg.freightLicense ? function (did, gid, day = S.day) {
        const k = ORIG.depthFn(did, gid, day);
        const factor = Math.max(1, Math.min(200 / 70, HOLD_TIERS[S.holdTier].cap / 70));
        return { n: k.n * factor, d: k.d * factor };
      } : ORIG.depthFn;
    }
    HOLD_TIERS.length = 0; ORIG.hold.forEach(t => HOLD_TIERS.push(Object.assign({}, t)));
    if (cfg.holdScale) HOLD_TIERS.forEach((t, i) => { if (i > 0) t.cap = Math.round(t.cap * cfg.holdScale); });
    if (cfg.holdMaxTier != null) HOLD_TIERS.length = cfg.holdMaxTier + 1;
    if (HAS_CONF) for (const k of Object.keys(CONF)) { CONF[k].odds = ORIG.conf[k].odds.slice(); if (cfg.conf && cfg.conf[k]) CONF[k].odds = cfg.conf[k].slice(); } // eslint-disable-line no-undef
    // ENC is a const object: its fields can be changed (encounter sweeps), e.g. --set enc.bribe.cargo=0.1
    if (ENC_T) { if (!ORIG.enc) ORIG.enc = JSON.parse(JSON.stringify(ENC_T)); const restore = (dst, src) => { for (const k of Object.keys(src)) { if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k])) restore(dst[k], src[k]); else dst[k] = Array.isArray(src[k]) ? src[k].slice() : src[k]; } }; restore(ENC_T, ORIG.enc); if (cfg.enc) restore(ENC_T, cfg.enc); }
    SIM.shock.spike = cfg.spike || [2, 3.5];
    SIM.shock.crash = cfg.crash || [0.3, 0.52];
    const target = fn('genPendingInner') ? 'genPendingInner' : 'genPending';
    if (!ORIG.gen) ORIG.gen = window[target];
    window[target] = ORIG.gen;
    if (cfg.spike || cfg.crash) {
      const sp = SIM.shock.spike, cr = SIM.shock.crash;
      // same draws in the same order as the game's genPendingInner, only the ranges differ
      window[target] = function () {
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
    return { depth: DEPTH ? GOODS.map(g => g.depth) : null, freightLicense: !!cfg.freightLicense, hold: HOLD_TIERS.map(t => t.cap), conf: HAS_CONF ? Object.fromEntries(Object.keys(CONF).map(k => [k, CONF[k].odds])) : null, shock: SIM.shock, enc: ENC_T ? JSON.parse(JSON.stringify(ENC_T)) : null }; // eslint-disable-line no-undef
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
    SIM.seedBase = String(seed);
    SIM.crn = !(opts && opts.noCrn);
    encMemo.clear(); // the memo rounds its keys, so a value cached by another run would leak into this one
    FAST = true; settings.tutorial = true; settings.muted = true;
    busy = false; sel = null; SIM.reload = null; SIM.cards = []; SIM.encOpen = null; SIM.expectConfirm = false;
    try { closeModal(); } catch (e) {}
    const mem = { __events: {}, out: {}, opts: opts || {} };
    SIM.cur = { pol, mem, name: polName, maxSale: 0, enc: [], charters: [], stays: 0, purchases: [], trades: {}, routeLog: [], numericChecks: 0, reloadLog: { found: 0, noSave: 0, cashBack: 0, hullBack: 0 } };
    startGame(newState('Sim'), true);
    const rng0 = { m: S.rngM, e: S.rngE };
    if (pol.init) await pol.init(api, mem);
    const worth = {};
    let reloads = 0, guard = 0, mkt = null;
    const errors = [];
    while (!S.over && guard++ < 120) {
      if (worth[S.day] === undefined) worth[S.day] = netWorth();
      if (S.day === NIGHTS && !mkt) mkt = S.rngM;
      __rng.reseed('policy', S.day);
      let dest = null;
      try { dest = await pol.night(api, mem); } catch (e) { errors.push('night: ' + (e && e.message)); }
      assertEconomy();
      if (S.over || S.day >= NIGHTS) break;
      const d0 = S.day, loc0 = S.loc;
      if ((dest === 'stay' || dest === S.loc) && STAY) { SIM.cur.stays++; await stayNight(); } // eslint-disable-line no-undef
      else {
        if (!dest || !dd(dest) || dest === S.loc) dest = S.loc === 'lq' ? 'de' : 'lq';
        await sailTo(dest);
      }
      SIM.encCloseAny();
      assertEconomy();
      SIM.cur.routeLog.push({ day: d0, from: loc0, to: S.loc });
      while (SIM.reload && reloads < 200) {
        reloads++;
        const s = SIM.reload; SIM.reload = null;
        S = s; busy = false; sel = null;
        await runTrip(true);
        SIM.encCloseAny();
      }
      if (!S.over && S.day === d0) { errors.push('night did not advance on night ' + d0); break; }
    }
    const sunk = S.hull <= 0;
    const t = tally(sunk ? 'sunk' : 'complete');
    const w = {}; let last = worth[1];
    for (let d = 1; d <= NIGHTS; d++) { if (worth[d] !== undefined && !(sunk && d > S.day)) last = worth[d]; if (sunk && d >= S.day) last = t.net; w[d] = last; }
    if (pol.finish) { try { pol.finish(api, mem); } catch (e) { errors.push('finish: ' + e.message); } }
    const st = S.stats;
    return {
      seed, net: t.net, rank: rankFor(t.net).name, sunk, day: S.day, hull: S.hull, over: !!S.over, tallyCargo: t.cargo, debtEnd: S.debt,
      worth: CHECK.map(d => w[d]), worthAll: Array.from({ length: NIGHTS }, (_, i) => w[i + 1]),
      stats: { trips: st.trips, fights: st.fights, won: st.won, fled: st.fled, bribes: st.bribes, interest: st.interest, vaultEarned: st.vaultEarned, bestFlip: st.bestFlip, maxSale: SIM.cur.maxSale, whispersBought: st.whispers || 0, holdTier: S.holdTier, wireless: S.wireless, arms: S.arms, motor: S.motor, lost: st.lost || 0, numericChecks: SIM.cur.numericChecks },
      events: mem.__events, out: mem.out, reloads, reloadLog: SIM.cur.reloadLog, errors,
      enc: SIM.cur.enc, charters: SIM.cur.charters, stays: SIM.cur.stays, purchases: SIM.cur.purchases, trades: Object.values(SIM.cur.trades), routeLog: SIM.cur.routeLog, rng0, mkt,
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
