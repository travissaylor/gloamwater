// whisper-smart: the informed captain, plus whispers when they are cheap to get.
// - Never detours for Ysolde. It buys a whisper only when it is at Orchid Terraces anyway, and
//   steers there only when "passing": the Terraces plan scores within opts.passTol (5%) of the
//   best plan. It buys only if the fee is at most opts.feeCap (4%) of its net worth.
// - Buys before selling its cargo, so the fee (3% of the purse) is as small as it gets.
// - Acts only on 'sure' or 'likely' whispers about valuable goods (base price >= opts.minBase,
//   default ¤1,000: saffron, eels, chips, silk, ink). It does not take them at face value: the
//   planner weighs each told shock by the odds on Ysolde's card (CONF), so it detours only when
//   the expected gain beats the best ordinary plan.
// - A whisper counts as acted on when the plan it picks differs from the whisper-free plan
//   (different destination, or a different amount of the whispered good).
SIM.register('whisper-smart', {
  init(api, mem) { SIM.wlib.init(mem); },

  async night(api, mem) {
    const L = SIM.lib, WL = SIM.wlib, ws = mem.ws, N = api.nights(), day = api.day(), here = api.loc();
    const opt = Object.assign({ feeCap: 0.04, minBase: 1000, passTol: 0.05 }, mem.opts || {});
    L.observe(api, mem);
    WL.reconcile(api, ws);
    WL.observeLanded(api, ws);
    const onSell = (gid, r) => WL.attribute(ws, gid, r);

    // my whispers that I do not use: guesses and cheap goods. Pell's tips are used as informed does.
    const mine = () => ws.list.filter(w => w.day === day);
    const isMine = e => mine().some(w => e.d === w.d && e.g === w.g && e.type === w.type);
    const usable = w => (w.conf === 'sure' || w.conf === 'likely') && api.good(w.g).base >= opt.minBase;
    mem.ignore = e => mine().some(w => e.d === w.d && e.g === w.g && e.type === w.type && !usable(w));
    mem.trust = null;

    if (day >= N) {
      for (const gid of api.goods()) { const h = api.held(gid); if (h.q && api.stocked(gid)) onSell(gid, api.sell(gid, h.q)); }
      if (api.svcHere('lender')) await api.repay(api.debt());
      return null;
    }
    // buy first: the fee is 3% of the purse, which is smallest before the cargo is sold
    let w = null;
    if (api.svcHere('rumor') && api.whisperAvailable() && api.whisperHint() !== 'guess' && api.whisperCost() <= opt.feeCap * Math.max(1, api.netWorth())) {
      const r = await api.whisper();
      if (r && r.type) { w = WL.record(r, day); ws.list.push(w); }
    }
    await L.prepare(api, mem, { onSell });
    const crashHere = ws.list.find(w => w.type === 'crash' && w.acted && w.d === here && w.day === day - 1);

    if (w) w.actionable = usable(w) && w.d !== here && (w.type === 'crash' ? day <= N - 2 : day <= N - 1);

    const bonus = L.repayBonus(api);
    const plans = L.plans(api, mem, { bonus });
    const ig = mem.ignore;
    mem.ignore = e => isMine(e) || ig(e);
    const plain = L.plans(api, mem, { bonus });
    mem.ignore = ig;
    const plainScore = d => { const p = plain.find(x => x.d === d); return p ? p.score : -Infinity; };

    let plan = plans[0];
    // passing the Terraces: take that route when it costs next to nothing
    if (here !== 'ot' && day <= N - 2) {
      const ot = plans.find(p => p.d === 'ot');
      if (ot && ot.score >= plan.score - opt.passTol * Math.abs(plan.score)) plan = ot;
    }
    if (api.hull() < 40 && here !== 'ch') plan = plans.find(p => p.d === 'ch') || plan;

    let acted = false, gq = 0, gq0 = 0;
    if (w && w.actionable && plan.d === w.d) {
      const pb = plain[0];
      const q = p => (p.basket.items.find(i => i.g === w.g) || { q: 0 }).q;
      gq = q(plan); gq0 = pb.d === w.d ? q(pb) : 0;
      acted = pb.d !== w.d || gq !== gq0;
    }
    const carried = acted && w.type === 'spike' ? (plan.carry[w.g] || 0) : 0;
    const carriedCost = api.held(w ? w.g : 'kelp').cost;
    const buys = L.execute(api, mem, plan, onSell);
    if (acted) {
      w.acted = true;
      w.forgone = Math.max(0, plain[0].score - plainScore(w.d));
      if (w.type === 'spike') {
        for (const b of buys) if (b.g === w.g) WL.addLot(ws, w, w.g, b);
        if (carried) WL.addCarried(ws, w, w.g, carried, carriedCost);
      }
    }
    if (crashHere) for (const b of buys) if (b.g === crashHere.g) WL.addLot(ws, crashHere, crashHere.g, b);
    if (api.svcHere('lender') && api.debt() > 0 && api.cash() > api.debt() * 1.5) await api.repay(api.debt());
    return plan.d;
  },

  finish(api, mem) { SIM.wlib.finish(api, mem); },
});
