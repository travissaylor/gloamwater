// whisper-spam: the informed captain, plus a whisper every chance it gets.
// - Buys the whisper on arrival, before selling cargo (the fee is 3% of the purse and vault).
// - Routes to Orchid Terraces whenever it can afford a whisper (fee <= half the purse) and there
//   are at least two nights left; buys Ysolde's whisper on every visit (one a night is all she sells).
// - Acts on every whisper it can, whatever her confidence, taking it at face value (a full-strength
//   shock):
//     spike at D for G: buys G here (depth-aware: while the marginal unit's resale into the told
//       spike clears its marginal cost), carries any G already aboard, and sails to D;
//     crash at D for G: sails to D, and on arrival buys G if the price there makes it worth
//       reselling elsewhere (it sees the real price on arrival), then sells it wherever is best.
//   A whisper about Orchid Terraces itself, a spike in a good not sold here and not aboard, or a
//   crash with no night left to resell, cannot be acted on.
// - Uses only what the card says: told type, district, good, confidence. Never the fate or size.
// - Bookkeeping (see _whisper.js): fee, lots, and the night cost: how much worse the detour was
//   than the best whisper-free plan that night, plus the detour to reach the Salon.
SIM.register('whisper-spam', {
  init(api, mem) { SIM.wlib.init(mem); },

  async night(api, mem) {
    const L = SIM.lib, WL = SIM.wlib, ws = mem.ws, N = api.nights(), day = api.day(), here = api.loc();
    const opt = Object.assign({ feeShare: 0.5 }, mem.opts || {});
    L.observe(api, mem);
    WL.reconcile(api, ws);
    WL.observeLanded(api, ws);
    const onSell = (gid, r) => WL.attribute(ws, gid, r);
    mem.trust = null; mem.ignore = null;

    if (day >= N) {
      for (const gid of api.goods()) { const h = api.held(gid); if (h.q && api.stocked(gid)) onSell(gid, api.sell(gid, h.q)); }
      if (api.svcHere('lender')) await api.repay(api.debt());
      return null;
    }
    // buy tonight's whisper first: the fee is 3% of the purse, and the purse is smallest before selling
    let w = null;
    if (api.svcHere('rumor') && api.whisperAvailable()) {
      const r = await api.whisper();
      if (r && r.type) {
        w = WL.record(r, day);
        w.route = ws.route; ws.route = 0;
        ws.list.push(w);
      }
    }
    await L.prepare(api, mem, { onSell });

    // 1. a crash whisper from last night lands here: whatever G the planner buys here tonight is the whisper's
    const crashHere = ws.list.find(w => w.type === 'crash' && w.acted && w.d === here && w.day === day - 1);


    // whisper-free view of tonight, for the night cost
    const isMine = e => w && e.d === w.d && e.g === w.g && e.type === w.type;
    mem.ignore = isMine;
    const plain = L.plans(api, mem, { bonus: L.repayBonus(api) });
    mem.ignore = null;
    const plainScore = d => { const p = plain.find(x => x.d === d); return p ? p.score : -Infinity; };

    // 3. can tonight's whisper be acted on?
    if (w) {
      const aboard = api.held(w.g).q;
      if (w.d === here) w.actionable = false;
      else if (w.type === 'spike') w.actionable = day <= N - 1 && (api.stocked(w.g) || aboard > 0);
      else if (w.type === 'crash') w.actionable = day <= N - 2;
    }

    let dest, buys = [];
    if (w && w.actionable) {
      mem.trust = isMine; // face value
      const plans = L.plans(api, mem, { bonus: L.repayBonus(api), minEdge: 1.0 });
      const plan = plans.find(p => p.d === w.d);
      const carried = (plan.carry[w.g] || 0);
      const carriedCost = api.held(w.g).cost;
      buys = L.execute(api, mem, plan, onSell);
      if (w.type === 'spike') {
        for (const b of buys) if (b.g === w.g) WL.addLot(ws, w, w.g, b);
        if (carried) WL.addCarried(ws, w, w.g, carried, carriedCost);
      }
      w.acted = true; // it sails to D because of the whisper
      w.forgone = Math.max(0, plain[0].score - plainScore(w.d));
      mem.trust = null;
      dest = w.d;
    } else {
      const canWhisper = !api.svcHere('rumor') && day <= N - 2 && api.cash() >= api.whisperCost() / opt.feeShare;
      let plan = plain[0];
      if (canWhisper) { plan = plain.find(p => p.d === 'ot') || plan; ws.route += Math.max(0, plain[0].score - plan.score); }
      if (api.hull() < 40 && here !== 'ch' && !canWhisper) plan = plain.find(p => p.d === 'ch') || plan;
      buys = L.execute(api, mem, plan, onSell);
      dest = plan.d;
    }
    if (crashHere) for (const b of buys) if (b.g === crashHere.g) WL.addLot(ws, crashHere, crashHere.g, b);
    if (api.svcHere('lender') && api.debt() > 0 && api.cash() > api.debt() * 1.5) await api.repay(api.debt());
    return dest;
  },

  finish(api, mem) { SIM.wlib.finish(api, mem); },
});
