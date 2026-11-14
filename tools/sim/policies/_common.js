// Shared planning helpers for the informed family of policies. Uses only SIM.api and SIM.model.
//
// Information the planner uses, and why a player has it:
//  - prices seen (S.seen via api.seen/rawSeen): the market screen here, every district with the
//    wireless set; the map shows the last price seen and its age.
//  - its own price pressure (api.pressure): only the captain's own trades move prices, the trade
//    sheet shows how many more units go at the posted price, and pressure eases 60% a night.
//  - depth per good (api.depth): learnt from the trade sheet. A charter's effect is stated on the
//    Harbor card ("twice as deep"), so api.hypoCharter may price a plan as if one were bought.
//  - bulletins it heard (api.knownEffects) and rumours told (api.leakedPending): type, district,
//    good, confidence; never the fate or the exact size.
//  - the canals (api.adjacent, nightsTo, nextHop): drawn on the map.
//  - the stepMarket model (SIM.model), encounterChance() and the encounter odds and costs
//    (api.encExpect): a seasoned player's sense of how prices move and what a canal costs.
(function () {
  'use strict';
  const L = (SIM.lib = {});

  L.observe = function (api, mem) {
    const obs = (mem.obs = mem.obs || {});
    const day = api.day();
    for (const did of api.districts()) {
      for (const gid of api.goods()) {
        const raw = api.rawSeen(did, gid);
        if (raw == null) continue;
        const g = api.good(gid);
        (obs[did] = obs[did] || {})[gid] = { x: Math.log(raw / (g.base * api.districtMult(did, gid) * api.knownEffectMult(did, gid))), day };
      }
    }
    mem.trend = {};
    for (const gid of api.goods()) {
      const xs = [];
      for (const did of api.districts()) { const o = obs[did] && obs[did][gid]; if (o && o.day === day) xs.push(o.x); }
      const mean = xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
      mem.trend[gid] = xs.length ? (xs.length >= 4 ? mean : mean * SIM.model.trendShare) : 0;
    }
    // nights spent at each port (for charters)
    if (mem.visitDay !== day) { mem.visitDay = day; (mem.visits = mem.visits || {})[api.loc()] = (mem.visits[api.loc()] || 0) + 1; }
  };

  const ignored = (mem, e) => !!(mem && mem.ignore && mem.ignore(e));
  const trusted = (mem, e) => !!(mem && mem.trust && mem.trust(e));

  // Expected multiplier at `did` for `gid` on night day+ahead from shocks the captain knows about.
  L.expectEffect = function (api, mem, did, gid, ahead) {
    let m = 1;
    for (const e of api.knownEffects()) {
      if (e.d !== did || (e.g !== gid && e.g !== '*')) continue;
      const age = e.age + ahead;
      if (age >= e.days) continue;
      m *= age === 0 ? e.m : Math.sqrt(e.m);
    }
    if (ahead >= 1) {
      for (const e of api.leakedPending()) {
        if (ignored(mem, e)) continue;
        if (e.d !== did || (e.g !== gid && e.g !== '*')) continue;
        const age = ahead - 1;
        if (age >= e.days) continue;
        const em = SIM.model.rumourExpect(e.type, e.conf, trusted(mem, e));
        m *= age === 0 ? em : Math.sqrt(em);
      }
    }
    return m;
  };

  L.estPrice = function (api, mem, did, gid, ahead) {
    ahead = ahead == null ? 1 : ahead;
    const g = api.good(gid), M = SIM.model;
    const T = (mem.trend && mem.trend[gid]) || 0;
    const o = mem.obs && mem.obs[did] && mem.obs[did][gid];
    let loc = 0;
    if (o) { const age = api.day() - o.day; loc = (o.x - T) * Math.pow(M.localAR, age + ahead); }
    const x = T * Math.pow(M.trendAR, ahead) + loc;
    let p = Math.min(g.max, Math.max(g.min, g.base * api.districtMult(did, gid, api.day() + ahead) * Math.exp(x)));
    p *= L.expectEffect(api, mem, did, gid, ahead);
    return Math.min(M.clampHi(g), Math.max(M.clampLo(g), p));
  };

  L.stockFactor = function (api, mem, did, gid, ahead) {
    const shocked = L.expectEffect(api, mem, did, gid, ahead) !== 1;
    const sp = shocked ? 1 : SIM.model.stockP(did, gid, api.day() + ahead);
    return sp + (1 - sp) * 0.85;
  };

  // Expected proceeds of selling q units of gid at did on night day+ahead, starting from the
  // pressure left there by then, less `off` (units already sold there in this plan, or tonight's
  // own sales at this port, eased).
  L.saleValue = function (api, mem, did, gid, q, ahead, off) {
    if (q <= 0) return 0;
    ahead = ahead == null ? 1 : ahead;
    const p = L.estPrice(api, mem, did, gid, ahead) * L.stockFactor(api, mem, did, gid, ahead);
    const x = api.pressAfter(did, gid, ahead) - (off || 0);
    return api.sellCurve(did, gid, q, p, x, ahead);
  };
  L.estSell = (api, mem, did, gid, ahead) => L.saleValue(api, mem, did, gid, 1, ahead, 0);

  // Order sizing: fills room and budget with goods bought here for sale at dest on night
  // day+ahead, chunk by chunk, best profit per share of the binding resource first, while each
  // chunk's expected resale clears its exact cost by minEdge. carry: units of each good already
  // going to dest (they sell first). When dest is here (staying the night), tonight's buys push
  // tomorrow's price up too (eased by pressDecay), and `soldTonight` pushes it down.
  L.basket = function (api, mem, dest, budget, room, carry, minEdge, ahead, soldTonight) {
    minEdge = minEdge == null ? 1.05 : minEdge;
    ahead = ahead == null ? 1 : ahead;
    const self = dest === api.loc();
    const dk = self ? Math.pow(SIM.model.pressDecay, ahead) : 0;
    const C = [];
    for (const gid of api.goods()) {
      if (!api.stocked(gid)) continue;
      const p = L.estPrice(api, mem, dest, gid, ahead) * L.stockFactor(api, mem, dest, gid, ahead);
      if (p < api.price(gid) * minEdge) continue;
      const kh = api.depth(api.loc(), gid), kd = api.depth(dest, gid, ahead);
      const step = api.hasDepth() ? Math.max(1, Math.round(Math.min(kh.d, kd.d) / 3)) : Math.max(1, Math.ceil(room / 8));
      const x0 = api.pressAfter(dest, gid, ahead) - ((carry && carry[gid]) || 0) - (self ? dk * ((soldTonight && soldTonight[gid]) || 0) : 0);
      C.push({ g: gid, p, x0, k: 0, cost: 0, resale: 0, step, done: false });
    }
    const total = (c, k) => api.sellCurve(dest, c.g, k, c.p, c.x0 + dk * k, ahead);
    let spent = 0, left = room, gain = 0;
    const B0 = Math.max(1, budget), R0 = Math.max(1, room);
    for (let it = 0; it < 600 && left > 0; it++) {
      let best = null;
      for (const c of C) {
        if (c.done) continue;
        let q = Math.min(c.step, left);
        const base = api.quoteBuy(c.g, c.k);
        let cost = api.quoteBuy(c.g, c.k + q) - base;
        while (q > 0 && spent + cost > budget) { q = Math.floor(q / 2); cost = q ? api.quoteBuy(c.g, c.k + q) - base : 0; }
        if (q <= 0) { c.done = true; continue; }
        const resale = total(c, c.k + q) - total(c, c.k);
        if (resale < cost * minEdge) { c.done = true; continue; }
        const util = (resale - cost) / (cost / B0 + q / R0);
        if (!best || util > best.util) best = { c, q, cost, resale, util };
      }
      if (!best) break;
      const c = best.c;
      c.k += best.q; c.cost += best.cost; c.resale += best.resale;
      spent += best.cost; left -= best.q; gain += best.resale - best.cost;
    }
    const items = C.filter(c => c.k > 0).map(c => ({ g: c.g, q: c.k, cost: c.cost, resale: c.resale }));
    return { items, cost: spent, gain, units: room - left, d: dest, resale: items.reduce((a, it) => a + it.resale, 0) };
  };

  // Expected loss to encounters on the way to did with this cash and cargo (the solver's price of
  // a typical patrol or gang, times the chance of meeting one).
  L.voyageRisk = function (api, did, o) {
    const p = api.encounterChance(did, o.cargoBase);
    return p * api.encExpect(did, o);
  };

  // A crash rumour at did is a chance to buy there tomorrow and sell the night after. Worth half
  // the depth-limited profit of that, as a routing bonus.
  L.crashBonus = function (api, mem, did, cash, cap) {
    if (api.day() > api.nights() - 2) return 0;
    let best = 0;
    for (const e of api.leakedPending()) {
      if (e.d !== did || e.type !== 'crash' || ignored(mem, e)) continue;
      const em = SIM.model.rumourExpect('crash', e.conf, trusted(mem, e));
      if (em > 0.85) continue;
      const pD = L.estPrice(api, mem, did, e.g, 1);
      const pOut = (pD / em) * 0.95;
      const kd = api.depth(did, e.g, 1), xd = api.pressAfter(did, e.g, 1);
      let q = 0, spent = 0, prof = 0;
      const step = Math.max(1, Math.round(kd.d / 3));
      while (q < cap) {
        const s = Math.min(step, cap - q);
        const cost = api.buyCurve(did, e.g, s, pD, xd + q, 1);
        if (spent + cost > cash) break;
        const kk = api.depth('lq', e.g, 2);
        const sale = pOut * api.pressInt(-q - s, -q, kk.n, kk.d);
        if (sale < cost * 1.08) break;
        q += s; spent += cost; prof += sale - cost;
      }
      best = Math.max(best, prof * 0.5);
    }
    return best;
  };

  // Best split of a held good between selling here tonight and carrying it to did (arriving in
  // `ahead` nights). Staying: tonight's sales still weigh on tomorrow's price here.
  function splitHeld(api, mem, did, gid, h, ahead) {
    const self = did === api.loc();
    const dk = self ? Math.pow(SIM.model.pressDecay, ahead) : 0;
    const there = (q, s) => 0.97 * L.saleValue(api, mem, did, gid, q, ahead, dk * s);
    if (!api.stocked(gid)) return { s: 0, here: 0, there: there(h, 0) };
    const f = s => api.quoteSell(gid, s) + there(h - s, s);
    let lo = 0, hi = h;
    while (hi - lo > 2) { const m1 = lo + Math.floor((hi - lo) / 3), m2 = hi - Math.floor((hi - lo) / 3); if (f(m1) < f(m2)) lo = m1 + 1; else hi = m2 - 1; }
    let s = lo, fb = f(lo);
    for (let x = lo + 1; x <= hi; x++) { const v = f(x); if (v > fb) { fb = v; s = x; } }
    if (f(h) >= fb) s = h;
    return { s, here: api.quoteSell(gid, s), there: there(h - s, s) };
  }

  // Value of a night, for pricing the extra night a two-night trip costs: a running average of
  // the best one-night plan's score.
  function noteNightValue(api, mem, best1) {
    if (mem.nvDay === api.day() || best1 == null) return;
    mem.nvDay = api.day();
    mem.nv = mem.nv == null ? Math.max(0, best1) : 0.7 * mem.nv + 0.3 * Math.max(0, best1);
  }

  // Score every destination: districts one canal away (one night), the rest (two nights, via
  // the game's waypoint), and staying here (o.allowStay). Returns sorted plans:
  // {d, n, hop, stay, score, sell, carry, basket, value, cargoBase, cashAvail}
  L.plans = function (api, mem, o) {
    o = o || {};
    const here = api.loc(), out = [];
    const day = api.day(), N = api.nights(), nightsLeft = N - day;
    const opts = mem.opts || {};
    const allowStay = o.allowStay != null ? o.allowStay : !opts.noStay;
    const adjOnly = o.adjOnly != null ? o.adjOnly : !!opts.adjOnly;
    const twoCost = opts.twoNightCost != null ? opts.twoNightCost : 0.6;
    const cands = api.districts().filter(d => d !== here);
    if (allowStay && api.canStay()) cands.push(here);
    let best1 = null;
    for (const did of cands) {
      const stay = did === here;
      const n = stay ? 1 : api.nightsTo(here, did);
      if (n > nightsLeft || (adjOnly && n > 1)) continue;
      const hop = stay ? here : api.nextHop(here, did);
      let score = 0, cash = api.cash(), room = api.free(), keptValue = 0, keptBase = 0;
      const sell = {}, carry = {};
      for (const gid of api.goods()) {
        const h = api.held(gid);
        if (!h.q) continue;
        const all = api.stocked(gid) ? api.quoteSell(gid, h.q) : 0;
        const sp = splitHeld(api, mem, did, gid, h.q, n);
        sell[gid] = sp.s; carry[gid] = h.q - sp.s;
        score += sp.here + sp.there - all;
        cash += sp.here; room += sp.s; keptValue += sp.there; keptBase += carry[gid] * api.good(gid).base;
      }
      const reserve = o.reserve || 0;
      const basket = L.basket(api, mem, did, Math.max(0, cash - reserve), room, carry, o.minEdge, n, stay ? sell : null);
      score += basket.gain;
      for (const c of api.contracts()) {
        if (c.to === did && c.due >= day + n) score += c.reward;
        else if (n === 2 && c.to === hop && c.due >= day + 1) score += c.reward;
      }
      if (n === 1) score += L.crashBonus(api, mem, did, cash, api.cap());
      let base = keptBase; for (const it of basket.items) base += it.q * api.good(it.g).base;
      const value = keptValue + basket.resale;
      if (!stay) {
        const ro = { cash: cash - basket.cost, cargoV: value, cargoBase: base, load: (api.cap() - room + basket.units) / api.cap(), free: room - basket.units };
        score -= L.voyageRisk(api, hop, ro);
        if (n === 2) score -= L.voyageRisk(api, did, ro);
      }
      if (o.bonus) score += o.bonus(did) || 0;
      if (n === 1 && (best1 == null || score > best1)) best1 = score;
      if (n === 2) score -= twoCost * (mem.nv || 0);
      out.push({ d: did, n, hop, stay, score, sell, carry, basket, value, cargoBase: base, cashAvail: cash, nightsLeft });
    }
    noteNightValue(api, mem, best1);
    out.sort((a, b) => b.score - a.score);
    return out;
  };

  L.execute = function (api, mem, plan, onSell, noBuy) {
    for (const gid of api.goods()) {
      const s = plan.sell[gid];
      if (!s || !api.stocked(gid)) continue;
      const r = api.sell(gid, Math.min(s, api.held(gid).q));
      if (onSell) onSell(gid, r);
    }
    const buys = [];
    if (!noBuy && plan.basket) {
      for (const it of plan.basket.items) {
        const q = Math.min(it.q, api.maxBuy(it.g));
        if (q > 0) { const r = api.buy(it.g, q); if (r.q) buys.push(Object.assign({ g: it.g }, r)); }
      }
      // what the cargo should fetch where it is going (the encounter solver prices seizures with it)
      mem.cargoV = plan.value; mem.cargoVDay = api.day();
    }
    mem.fills = (mem.fills || []).concat([api.used() / api.cap()]).slice(-4);
    return buys;
  };

  // Debt: clear it once comfortable, and before Marrow's deadline (night 10, or 12,000) when the
  // purse covers it.
  L.shouldRepay = function (api, o) {
    if ((o && o.noRepay) || !api.svcHere('lender') || api.debt() <= 0) return false;
    const day = api.day(), N = api.nights(), c = api.cash(), d = api.debt();
    return c > d * 1.5 || day >= N - 6 || (day >= 8 && c >= d) || (d > api.huntRule.limit * 0.9 && c >= d);
  };

  L.housekeeping = async function (api, mem, o) {
    o = o || {};
    const day = api.day(), N = api.nights();
    if (api.svcHere('yard') && api.hull() < 80) await api.upgrade('repair');
    if (api.svcHere('gutter') && api.hull() < 50) await api.upgrade('patch');
    const fills = mem.fills || [];
    const full = fills.length ? fills.reduce((a, b) => a + b, 0) / fills.length : 1;
    let c;
    const maxHoldTier = mem.opts && mem.opts.maxHoldTier != null ? mem.opts.maxHoldTier : 5;
    while (api.holdTier() < maxHoldTier && (c = api.upgradeCost('hold')) != null && day <= N - 5 && c <= api.cash() * 0.4 && (api.holdTier() < 2 || full >= ((mem.opts && mem.opts.holdFill) != null ? mem.opts.holdFill : 0.8))) { if (!(await api.upgrade('hold'))) break; }
    if (SIM.cfg?.freightLicense && mem.opts.freightAware && api.svcHere('yard')) {
      const f = L.freightPlan(api, mem);
      if (f) {
        const before = api.holdTier();
        while (api.holdTier() < f.tier && await api.upgrade('hold')) {}
        if (api.holdTier() !== before) (mem.out.freightBuys = mem.out.freightBuys || []).push({ day, from: before, to: api.holdTier(), cost: f.cost, uplift: f.u, estimatedValue: f.value });
      }
    }
    if ((c = api.upgradeCost('motor')) != null && day <= N - 8 && c <= api.cash() * 0.2) await api.upgrade('motor');
    if (!o.noWireless && (c = api.upgradeCost('wireless')) != null && day <= N - 8 && c <= api.cash() * 0.25) await api.upgrade('wireless');
    if (L.shouldRepay(api, o)) await api.repay(api.debt());
  };

  // Bonus for heading to Lanternquay to clear debt: the interest it stops, and Marrow's collectors
  // once the deadline passes.
  // With mem, also a bonus for a vault port while the purse holds idle money: the tolls and bribes
  // it would otherwise carry through the next voyages (about 4% of the idle purse).
  L.repayBonus = function (api, mem) {
    const freight = SIM.cfg?.freightLicense && mem && mem.opts.freightAware ? L.freightPlan(api, mem) : null;
    return did => {
      let vb = 0;
      if (mem && !(mem.opts && mem.opts.noVault) && (did === 'lq' || did === 'de') && api.day() < api.nights() - 1) vb = 0.04 * Math.max(0, api.cash() - L.vaultKeep(api, mem));
      if (freight && did === 'ch' && api.loc() !== 'ch') vb += Math.max(0, freight.value - 1.25 * freight.cost) * 0.3;
      if (did !== 'lq' || api.debt() <= 0) return vb;
      const day = api.day(), d = api.debt(), c = api.cash();
      let v = 0;
      if (c >= d * 1.3) v += d * (Math.pow(1.06, Math.min(6, api.nights() - day)) - 1) * 0.5;
      if (c >= d && day >= 7 && day <= 10) v += 0.25 * d;
      return v + vb;
    };
  };

  // Opt-in experimental policy. The license, quotes and tier costs are public information.
  // Price at most four future voyages from tonight's observed uplift, keep trading capital,
  // and require a 25% cushion. No future prices or hidden event outcomes are consulted.
  L.freightPlan = function (api, mem) {
    const opts = mem.opts || {}, maxTier = opts.maxHoldTier != null ? opts.maxHoldTier : 5;
    if (maxTier < 3 || api.holdTier() >= maxTier || api.day() > api.nights() - 5) return null;
    const base = L.plans(api, mem, {})[0];
    if (!base) return null;
    let cost = 0, best = null;
    const nv = mem.nv, nvDay = mem.nvDay;
    for (let tier = api.holdTier() + 1; tier <= maxTier; tier++) {
      const c = api.holdTierCost(tier); if (c == null) break; cost += c;
      if (tier < 3 || cost > api.cash() * 0.4) continue;
      const plan = api.hypoHold(tier, () => L.plans(api, mem, { reserve: cost })[0]);
      mem.nv = nv; mem.nvDay = nvDay;
      if (!plan || plan.cashAvail - plan.basket.cost < cost) continue;
      const u = Math.max(0, plan.score - base.score);
      const value = u * Math.min(4, (api.nights() - api.day()) / 3);
      if (value < 1.25 * cost) continue;
      const f = { tier, cost, u: Math.round(u), value: Math.round(value) };
      if (!best || value - cost > best.value - best.cost) best = f;
    }
    return best;
  };

  // Trading charter: bought at the port it stands in when the counterfactual plan says it pays.
  // Value = tonight's uplift (best plan with the charter minus without, averaged over the nights
  // it has measured here) x (1 + expected visits left, from how often it has been here). Paid
  // only from idle capital: the purse left after tonight's basket must cover it.
  L.charterCheck = async function (api, mem, o) {
    o = o || {};
    const opts = mem.opts || {};
    if (!api.hasCharters() || opts.noCharter || o.noCharter) return null;
    const here = api.loc(), day = api.day(), N = api.nights();
    if (api.hasCharter(here) || day > N - 3) return null;
    const cost = api.charterCost();
    if (api.cash() < cost * (opts.charterProbe != null ? opts.charterProbe : 0.8)) return null;
    const bonus = o.bonus || L.repayBonus(api, mem);
    const base = L.plans(api, mem, { bonus })[0];
    const withC = api.hypoCharter(here, () => L.plans(api, mem, { bonus })[0]);
    if (!base || !withC) return null;
    const u = Math.max(0, withC.score - base.score);
    const cu = (mem.cu = mem.cu || {});
    cu[here] = (cu[here] || []).concat([u]).slice(-4);
    const uMean = cu[here].reduce((a, b) => a + b, 0) / cu[here].length;
    const visits = (mem.visits && mem.visits[here]) || 1;
    const rate = (visits + 1) / (day + 7);
    const value = uMean * (1 + rate * (N - day));
    const idle = withC.cashAvail - withC.basket.cost;
    const margin = opts.charterMargin != null ? opts.charterMargin : 1.25;
    const rec = { day, d: here, cost, u: Math.round(u), uMean: Math.round(uMean), value: Math.round(value), idle: Math.round(idle) };
    if (api.cash() >= cost && idle >= cost && value >= margin * cost) {
      if (await api.buyCharter()) { (mem.out.charterBuys = mem.out.charterBuys || []).push(rec); return rec; }
    }
    return null;
  };

  L.prepare = async function (api, mem, o) {
    o = o || {};
    await L.charterCheck(api, mem, o);
    const first = L.plans(api, mem, { bonus: o.bonus || L.repayBonus(api, mem) })[0];
    if (first) L.execute(api, mem, first, o.onSell, true);
    await L.housekeeping(api, mem, o);
  };

  // Route bookkeeping: one-night hops, first legs of two-night trips (and whether the next night
  // carried on), and nights spent in port.
  L.noteRoute = function (api, mem, plan) {
    mem.lastPlan = plan;
    const R = (mem.out.route = mem.out.route || { one: 0, twoFirst: 0, twoOn: 0, twoOff: 0, stay: 0 });
    if (mem.twoTarget) { if (plan.d === mem.twoTarget) R.twoOn++; else R.twoOff++; mem.twoTarget = null; }
    if (plan.stay) R.stay++;
    else if (plan.n === 2) { R.twoFirst++; mem.twoTarget = plan.d; }
    else R.one++;
  };

  // Vault: tolls take a quarter of the purse and bribes a tenth, so idle money belongs in the vault
  // (Lanternquay, Drowned Exchange; 1.5% a night). At a vault the captain takes everything out
  // before trading and, after buying, banks all but a working purse: 1.1x the typical basket of the
  // last four nights (median), plus enough for a bribe on the way (¤1,000 + 7% of the cargo).
  L.vaultIn = async function (api, mem) {
    if ((mem.opts && mem.opts.noVault) || !api.svcHere('vault') || api.bank() <= 0) return;
    await api.withdraw(api.bank());
  };
  L.vaultKeep = function (api, mem) {
    const b = (mem.baskets || [0]).slice().sort((x, y) => x - y);
    return 1.1 * b[Math.floor((b.length - 1) / 2)] + 1000 + 0.07 * api.cargoBase();
  };
  L.vaultOut = async function (api, mem, plan) {
    if ((mem.opts && mem.opts.noVault) || api.day() >= api.nights()) return;
    mem.baskets = (mem.baskets || []).concat([plan && plan.basket ? plan.basket.cost : 0]).slice(-4);
    if (!api.svcHere('vault')) return;
    const keep = L.vaultKeep(api, mem);
    if (api.cash() > keep + 500) await api.deposit(api.cash() - keep);
  };

  // Standard informed night. Returns the destination (its own district to stay the night).
  L.informedNight = async function (api, mem, o) {
    o = o || {};
    L.observe(api, mem);
    const N = api.nights();
    await L.vaultIn(api, mem);
    if (api.day() >= N) { const tot = api.sellAll(); if (o.onSellAll) o.onSellAll(tot); if (api.svcHere('lender')) await api.repay(api.debt()); return null; }
    await L.prepare(api, mem, o);
    const bonus = o.bonus || L.repayBonus(api, mem);
    const plans = L.plans(api, mem, { bonus, reserve: o.reserve, minEdge: o.minEdge });
    let plan = plans[0];
    if (o.forceDest) plan = plans.find(p => p.d === o.forceDest) || plan;
    if (api.hull() < 40 && api.loc() !== 'ch') plan = plans.find(p => p.d === 'ch') || plan;
    mem.lastPlan = plan; mem.lastPlans = plans;
    L.noteRoute(api, mem, plan);
    const buys = L.execute(api, mem, plan, o.onSell);
    if (o.onBuys) o.onBuys(buys, plan);
    if (L.shouldRepay(api, o)) await api.repay(api.debt());
    if (!o.noVaultOut) await L.vaultOut(api, mem, plan);
    return plan.d;
  };
})();
