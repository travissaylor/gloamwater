// Whisper bookkeeping shared by whisper-spam and whisper-smart.
//
// A whisper record: {day, fee, type, d, g, conf, acted, units, cost, proceeds, forgone, route,
// landed}. `type` and `conf` are what Ysolde said. `landed` is what the next night's bulletin
// said happened ('full'|'weak'|'turn'), read after the fact for the report only.
// Lots bought because of a whisper are tracked separately (FIFO against sales of that good),
// and cargo lost to leaks or seizure comes out of them last-in first.
(function () {
  'use strict';
  const W = (SIM.wlib = {});

  W.init = function (mem) {
    mem.ws = { list: [], lots: [], route: 0 };
    mem.out.whispers = mem.ws.list;
    return mem.ws;
  };

  W.addLot = function (ws, w, g, r) {
    if (!r || !r.q) return;
    w.acted = true; w.units += r.q; w.cost += r.total;
    ws.lots.push({ w, g, q: r.q });
  };

  // Units already aboard that the captain carries into a told spike: their cost basis counts.
  W.addCarried = function (ws, w, g, q, unitCost) {
    if (!q) return;
    w.acted = true; w.units += q; w.cost += q * unitCost; w.carried = (w.carried || 0) + q;
    ws.lots.push({ w, g, q });
  };

  W.attribute = function (ws, gid, r) {
    if (!r || !r.q) return;
    let rem = r.q; const unit = r.total / r.q;
    for (const lot of ws.lots) {
      if (lot.g !== gid || !lot.q || !rem) continue;
      const t = Math.min(rem, lot.q); lot.w.proceeds += t * unit; lot.q -= t; rem -= t;
    }
    ws.lots = ws.lots.filter(l => l.q > 0);
  };

  W.reconcile = function (api, ws) {
    for (const g of api.goods()) {
      const have = api.held(g).q;
      const lots = ws.lots.filter(l => l.g === g);
      let tot = lots.reduce((s, l) => s + l.q, 0);
      for (let i = lots.length - 1; i >= 0 && tot > have; i--) { const cut = Math.min(lots[i].q, tot - have); lots[i].q -= cut; tot -= cut; }
    }
    ws.lots = ws.lots.filter(l => l.q > 0);
  };

  // Read last night's whispers' outcomes from tonight's bulletins (a leaked rumour is always heard).
  W.observeLanded = function (api, ws) {
    const day = api.day();
    for (const w of ws.list) {
      if (w.landed || w.day !== day - 1 || !w.type) continue;
      const e = api.knownEffects().find(x => x.age === 0 && x.d === w.d && x.g === w.g);
      w.landed = e ? e.kind : 'unseen';
    }
  };

  W.finish = function (api, mem) {
    const ws = mem.ws;
    W.reconcile(api, ws);
    // anything still aboard is dumped at half its depth-aware value here by the game's tally
    for (const g of api.goods()) {
      const lots = ws.lots.filter(l => l.g === g);
      if (!lots.length) continue;
      const h = api.held(g).q;
      const v = h ? api.quoteSell(g, h) * 0.5 / h : 0;
      for (const lot of lots) lot.w.proceeds += lot.q * v;
    }
    ws.lots = [];
    for (const w of ws.list) {
      w.pnl = Math.round(w.proceeds - w.cost - w.fee);
      w.pnlNight = Math.round(w.pnl - w.forgone - w.route);
      w.actedLot = w.units > 0;
    }
  };

  W.record = function (w, day) {
    return { day, fee: w.fee, type: w.type, d: w.d, g: w.g, conf: w.conf, acted: false, actionable: false, units: 0, cost: 0, proceeds: 0, forgone: 0, route: 0, landed: null };
  };
})();
