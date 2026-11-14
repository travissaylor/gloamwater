// whisper-spam: the informed captain, plus a whisper every chance it gets.
// - Buys the whisper on arrival at Orchid Terraces (the fee is ¤300 plus 1.5% of purse, vault and
//   cargo, so buying before or after selling no longer matters).
// - Routes to Orchid Terraces whenever it can afford a whisper (fee <= half the purse) and there
//   are at least two nights left; buys Ysolde's whisper on every visit (one a night is all she sells).
// - Acts on every whisper it can, whatever her confidence, taking it at face value (a full-strength
//   shock):
//     spike at D for G: buys G here (depth-aware), carries any G already aboard, and sails to D
//       (two nights if no canal joins them: it arrives for the shock's weaker second night);
//     crash at D for G: sails to D, and on arrival buys G if the price makes it worth reselling;
//     about Orchid Terraces itself: stays the night (spike: buy G tonight, sell tomorrow; crash:
//       buy tomorrow).
//   A spike in a good not sold here and not aboard, or no night left to use it, cannot be acted on.
// - Uses only what the card says: told type, district, good, confidence. Never the fate or size.
// - Bookkeeping (see _whisper.js): fee, lots, and the night cost: how much worse the detour was
//   than the best whisper-free plan that night, plus the detour to reach the Salon.
SIM.register('whisper-spam', {
  init(api, mem) { SIM.wlib.init(mem); },

  async night(api, mem) {
    const L = SIM.lib, WL = SIM.wlib, ws = mem.ws, N = api.nights(), day = api.day(), here = api.loc();
    const opt = Object.assign({ feeShare: 0.5 }, mem.opts || {});
    L.observe(api, mem);
    await L.vaultIn(api, mem);
    WL.reconcile(api, ws);
    WL.observeLanded(api, ws);
    const onSell = (gid, r) => WL.attribute(ws, gid, r);
    mem.trust = null; mem.ignore = null;

    if (day >= N) {
      for (const gid of api.goods()) { const h = api.held(gid); if (h.q && api.stocked(gid)) onSell(gid, api.sell(gid, h.q)); }
      if (api.svcHere('lender')) await api.repay(api.debt());
      return null;
    }
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

    // a crash whisper lands where we are tonight: whatever G the planner buys here is the whisper's
    const crashHere = ws.list.find(x => x.type === 'crash' && x.acted && x.d === here && x.arrive === day);

    const isMine = e => w && e.d === w.d && e.g === w.g && e.type === w.type;
    mem.ignore = isMine;
    const plain = L.plans(api, mem, { bonus: L.repayBonus(api, mem) });
    mem.ignore = null;
    const plainScore = d => { const p = plain.find(x => x.d === d); return p ? p.score : -Infinity; };

    if (w) {
      const n = w.d === here ? 1 : api.nightsTo(here, w.d);
      const aboard = api.held(w.g).q;
      if (w.d === here && !api.canStay()) w.actionable = false;
      else if (w.type === 'spike') w.actionable = day + n <= N && (api.stocked(w.g) || aboard > 0);
      else if (w.type === 'crash') w.actionable = day + n + 1 <= N;
    }

    let dest = null, buys = [];
    if (w && w.actionable) {
      mem.trust = isMine; // face value
      const plans = L.plans(api, mem, { bonus: L.repayBonus(api, mem), minEdge: 1.0 });
      const plan = plans.find(p => p.d === w.d);
      if (plan) {
        const carried = plan.carry[w.g] || 0;
        const carriedCost = api.held(w.g).cost;
        L.noteRoute(api, mem, plan);
        buys = L.execute(api, mem, plan, onSell);
        if (w.type === 'spike') {
          for (const b of buys) if (b.g === w.g) WL.addLot(ws, w, w.g, b);
          if (carried) WL.addCarried(ws, w, w.g, carried, carriedCost);
        }
        w.acted = true; w.arrive = day + plan.n; w.how = plan.stay ? 'stay' : plan.n === 2 ? 'two' : 'one';
        w.forgone = Math.max(0, plain[0].score - plainScore(w.d));
        dest = w.d;
      } else w.actionable = false;
      mem.trust = null;
    }
    if (!dest) {
      const canWhisper = !api.svcHere('rumor') && day <= N - 2 && api.cash() >= api.whisperCost() / opt.feeShare;
      let plan = plain[0];
      if (canWhisper) { plan = plain.find(p => p.d === 'ot') || plan; ws.route += Math.max(0, plain[0].score - plan.score); }
      if (api.hull() < 40 && here !== 'ch' && !canWhisper) plan = plain.find(p => p.d === 'ch') || plan;
      L.noteRoute(api, mem, plan);
      buys = L.execute(api, mem, plan, onSell);
      dest = plan.d;
    }
    if (crashHere) for (const b of buys) if (b.g === crashHere.g) WL.addLot(ws, crashHere, crashHere.g, b);
    if (L.shouldRepay(api)) await api.repay(api.debt());
    await L.vaultOut(api, mem, mem.lastPlan);
    return dest;
  },

  finish(api, mem) { SIM.wlib.finish(api, mem); },
});
