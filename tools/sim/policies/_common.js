// Shared planning helpers for the informed family of policies. Uses only SIM.api and SIM.model.
//
// Information the planner uses, and why a player has it:
//  - prices seen (S.seen via api.seen/rawSeen): the market screen here, every district with the
//    wireless set; the map shows the last price seen and its age.
//  - its own price pressure (api.pressure): only the captain's own trades move prices, the trade
//    sheet shows how many more units go at the posted price, and pressure eases 60% a night.
//  - depth per good (api.depth): learnt from the trade sheet ("dealers sell about N more at this
//    price", "the last goes at ¤X").
//  - bulletins it heard (api.knownEffects): told type, what landed (the text says weak or turned),
//    and the expected size for that kind, never the exact multiplier.
//  - rumours told by Ysolde or Pell (api.leakedPending): type, district, good, confidence.
//  - the stepMarket model (SIM.model: AR coefficients, stock odds, shock sizes) and
//    encounterChance(): a seasoned player's sense of how prices move and which canals are rough.
//    These are the main places the bot knows more than a new player, not more than the screen.
(function () {
  'use strict';
  const L = (SIM.lib = {});

  // Record tonight's observations: log deviation of the pressure-free price from its structural
  // level, after the known shocks there.
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
    // city-wide trend estimate per good
    mem.trend = {};
    for (const gid of api.goods()) {
      const xs = [];
      for (const did of api.districts()) { const o = obs[did] && obs[did][gid]; if (o && o.day === day) xs.push(o.x); }
      const mean = xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
      // one port: most of the deviation is trend; many ports: the mean is mostly trend
      mem.trend[gid] = xs.length ? (xs.length >= 4 ? mean : mean * SIM.model.trendShare) : 0;
    }
  };

  // rumours this policy should not use right now (mem.ignore) or should take at face value (mem.trust)
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

  // Expected pressure-free unit price of gid at did on night day+ahead.
  L.estPrice = function (api, mem, did, gid, ahead) {
    ahead = ahead == null ? 1 : ahead;
    const g = api.good(gid), M = SIM.model;
    const T = (mem.trend && mem.trend[gid]) || 0;
    const o = mem.obs && mem.obs[did] && mem.obs[did][gid];
    let loc = 0;
    if (o) { const age = api.day() - o.day; loc = (o.x - T) * Math.pow(M.localAR, age + ahead); }
    const x = T * Math.pow(M.trendAR, ahead) + loc;
    let p = Math.min(g.max, Math.max(g.min, g.base * api.districtMult(did, gid) * Math.exp(x)));
    p *= L.expectEffect(api, mem, did, gid, ahead);
    return Math.min(M.clampHi(g), Math.max(M.clampLo(g), p));
  };

  // Discount for the chance the good is not traded at did (sell it elsewhere at ~85%).
  L.stockFactor = function (api, mem, did, gid, ahead) {
    const shocked = L.expectEffect(api, mem, did, gid, ahead) !== 1;
    const sp = shocked ? 1 : SIM.model.stockP(did, gid);
    return sp + (1 - sp) * 0.85;
  };

  // Expected proceeds of selling q units of gid at did on night day+ahead, after `off` units of
  // the same good already sold there in this plan. Depth-aware: integrates the price curve from
  // the pressure the captain will have left there by then.
  L.saleValue = function (api, mem, did, gid, q, ahead, off) {
    if (q <= 0) return 0;
    ahead = ahead == null ? 1 : ahead;
    const p = L.estPrice(api, mem, did, gid, ahead) * L.stockFactor(api, mem, did, gid, ahead);
    const x = api.pressAfter(did, gid, ahead) - (off || 0);
    return api.sellCurve(did, gid, q, p, x);
  };
  // per-unit sale estimate for one unit (greedy and some reports)
  L.estSell = (api, mem, did, gid, ahead) => L.saleValue(api, mem, did, gid, 1, ahead, 0);

  // Order sizing. Fills `room` and `budget` with goods bought here for sale at `dest`, chunk by
  // chunk, taking the chunk with the best profit per share of the binding resource, and only
  // while the chunk's expected resale clears its exact cost (the game's quote) by minEdge.
  // carry: {gid: units already being carried to dest} (they sell first and use up its depth).
  L.basket = function (api, mem, dest, budget, room, carry, minEdge, ahead) {
    minEdge = minEdge == null ? 1.05 : minEdge;
    ahead = ahead == null ? 1 : ahead;
    const C = [];
    for (const gid of api.goods()) {
      if (!api.stocked(gid)) continue;
      const p = L.estPrice(api, mem, dest, gid, ahead) * L.stockFactor(api, mem, dest, gid, ahead);
      if (p < api.price(gid) * minEdge) continue; // even the first unit does not pay
      const kh = api.depth(api.loc(), gid), kd = api.depth(dest, gid);
      const step = api.hasDepth() ? Math.max(1, Math.round(Math.min(kh.d, kd.d) / 3)) : Math.max(1, Math.ceil(room / 8));
      C.push({ g: gid, p, x: api.pressAfter(dest, gid, ahead) - ((carry && carry[gid]) || 0), k: 0, cost: 0, resale: 0, step, done: false });
    }
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
        const resale = api.sellCurve(dest, c.g, q, c.p, c.x - c.k);
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
    return { items, cost: spent, gain, units: room - left, d: dest };
  };

  // Rough expected loss from an encounter on the way to did.
  L.voyageRisk = function (api, did, cargoValue) {
    return api.encounterChance(did) * (0.12 * cargoValue + 400);
  };

  // A crash rumour at did is a chance to buy there tomorrow and sell the night after. Worth half
  // the depth-limited profit of that, as a routing bonus (two nights out, so heavily discounted).
  L.crashBonus = function (api, mem, did, cash, cap) {
    if (api.day() > api.nights() - 2) return 0;
    let best = 0;
    for (const e of api.leakedPending()) {
      if (e.d !== did || e.type !== 'crash' || ignored(mem, e)) continue;
      const em = SIM.model.rumourExpect('crash', e.conf, trusted(mem, e));
      if (em > 0.85) continue;
      const pD = L.estPrice(api, mem, did, e.g, 1);
      const pOut = (pD / em) * 0.95; // a normal price elsewhere
      const kd = api.depth(did, e.g), xd = api.pressAfter(did, e.g, 1);
      let q = 0, spent = 0, prof = 0;
      const step = Math.max(1, Math.round(kd.d / 3));
      while (q < cap) {
        const s = Math.min(step, cap - q);
        const cost = api.buyCurve(did, e.g, s, pD, xd + q);
        if (spent + cost > cash) break;
        const kk = api.depth('lq', e.g);
        const sale = pOut * api.pressInt(-q - s, -q, kk.n, kk.d);
        if (sale < cost * 1.08) break;
        q += s; spent += cost; prof += sale - cost;
      }
      best = Math.max(best, prof * 0.5);
    }
    return best;
  };

  // Best split of a held good between selling here tonight and carrying to dest.
  // Maximises quoteSell(s) + 0.97 * saleValue(dest, h - s); both sides are concave, so ternary search.
  function splitHeld(api, mem, did, gid, h) {
    const there = q => 0.97 * L.saleValue(api, mem, did, gid, q, 1, 0);
    if (!api.stocked(gid)) return { s: 0, here: 0, there: there(h) };
    const f = s => api.quoteSell(gid, s) + there(h - s);
    let lo = 0, hi = h;
    while (hi - lo > 2) { const m1 = lo + Math.floor((hi - lo) / 3), m2 = hi - Math.floor((hi - lo) / 3); if (f(m1) < f(m2)) lo = m1 + 1; else hi = m2 - 1; }
    let s = lo, fb = f(lo);
    for (let x = lo + 1; x <= hi; x++) { const v = f(x); if (v > fb) { fb = v; s = x; } }
    if (f(h) >= fb) s = h; // ties: sell
    return { s, here: api.quoteSell(gid, s), there: there(h - s) };
  }

  // Score every destination. Returns sorted plans:
  // {d, score, sell:{gid:units to sell here}, carry:{gid:units kept}, basket}
  L.plans = function (api, mem, o) {
    o = o || {};
    const here = api.loc(), out = [];
    const nightsLeft = api.nights() - api.day();
    const lastHop = nightsLeft <= 1;
    for (const did of api.districts()) {
      if (did === here) continue;
      let score = 0, cash = api.cash(), room = api.free(), keptValue = 0;
      const sell = {}, carry = {};
      for (const gid of api.goods()) {
        const h = api.held(gid);
        if (!h.q) continue;
        const all = api.stocked(gid) ? api.quoteSell(gid, h.q) : 0;
        const sp = splitHeld(api, mem, did, gid, h.q);
        sell[gid] = sp.s; carry[gid] = h.q - sp.s;
        score += sp.here + sp.there - all;
        cash += sp.here; room += sp.s; keptValue += sp.there;
      }
      const reserve = o.reserve || 0;
      const basket = L.basket(api, mem, did, Math.max(0, cash - reserve), room, carry, o.minEdge);
      score += basket.gain;
      for (const c of api.contracts()) if (c.to === did && c.due >= api.day() + 1) score += c.reward;
      if (!lastHop) score += L.crashBonus(api, mem, did, cash, api.cap());
      score -= L.voyageRisk(api, did, keptValue + basket.cost);
      if (o.bonus) score += o.bonus(did) || 0;
      out.push({ d: did, score, sell, carry, basket, nightsLeft });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  };

  // Carry out a plan: sell what it sells here, then buy its basket. Returns the buys.
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
    }
    mem.fills = (mem.fills || []).concat([api.used() / api.cap()]).slice(-4);
    return buys;
  };

  // Housekeeping a competent captain does: upgrades, repairs, debt.
  L.housekeeping = async function (api, mem, o) {
    o = o || {};
    const day = api.day(), N = api.nights();
    if (api.svcHere('yard') && api.hull() < 80) await api.upgrade('repair');
    if (api.svcHere('gutter') && api.hull() < 50) await api.upgrade('patch');
    // hold, while there is time to use it and the hold has been filling up
    const fills = mem.fills || [];
    const full = fills.length ? fills.reduce((a, b) => a + b, 0) / fills.length : 1;
    let c;
    while ((c = api.upgradeCost('hold')) != null && day <= N - 5 && c <= api.cash() * 0.4 && (api.holdTier() < 2 || full >= ((mem.opts && mem.opts.holdFill) != null ? mem.opts.holdFill : 0.8))) { if (!(await api.upgrade('hold'))) break; }
    if ((c = api.upgradeCost('motor')) != null && day <= N - 8 && c <= api.cash() * 0.2) await api.upgrade('motor');
    if (!o.noWireless && (c = api.upgradeCost('wireless')) != null && day <= N - 8 && c <= api.cash() * 0.25) await api.upgrade('wireless');
    if (!o.noRepay && api.svcHere('lender') && api.debt() > 0 && (api.cash() > api.debt() * 1.5 || day >= N - 6)) await api.repay(api.debt());
  };

  // Bonus for heading to Lanternquay to clear debt: the interest it stops.
  L.repayBonus = function (api) {
    return did => {
      if (did !== 'lq' || api.debt() <= 0 || api.cash() < api.debt() * 1.3) return 0;
      const n = Math.min(6, api.nights() - api.day());
      return api.debt() * (Math.pow(1.06, n) - 1) * 0.5;
    };
  };

  // Sell what is better sold here (judged against the best plan), then do housekeeping with
  // the proceeds. Buying happens after, against a fresh plan.
  L.prepare = async function (api, mem, o) {
    o = o || {};
    const first = L.plans(api, mem, { bonus: o.bonus || L.repayBonus(api) })[0];
    if (first) L.execute(api, mem, first, o.onSell, true);
    await L.housekeeping(api, mem, o);
  };

  // Standard informed night. Returns destination.
  L.informedNight = async function (api, mem, o) {
    o = o || {};
    L.observe(api, mem);
    const N = api.nights();
    if (api.day() >= N) { const tot = api.sellAll(); if (o.onSellAll) o.onSellAll(tot); if (api.svcHere('lender')) await api.repay(api.debt()); return null; }
    await L.prepare(api, mem, o);
    const bonus = o.bonus || L.repayBonus(api);
    const plans = L.plans(api, mem, { bonus, reserve: o.reserve, minEdge: o.minEdge });
    let plan = plans[0];
    if (o.forceDest) plan = plans.find(p => p.d === o.forceDest) || plan;
    if (api.hull() < 40 && api.loc() !== 'ch') plan = plans.find(p => p.d === 'ch') || plan;
    mem.lastPlan = plan; mem.lastPlans = plans;
    const buys = L.execute(api, mem, plan, o.onSell);
    if (o.onBuys) o.onBuys(buys, plan);
    if (api.svcHere('lender') && api.debt() > 0 && api.cash() > api.debt() * 1.5 && !o.noRepay) await api.repay(api.debt());
    return plan.d;
  };
})();
