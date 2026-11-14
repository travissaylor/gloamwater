// whisper-smart: the informed captain, plus whispers when they are cheap to get.
// - Never detours for Ysolde. It buys a whisper only when it is at Orchid Terraces anyway, and
//   steers there only when "passing": the Terraces plan (one canal away) scores within
//   opts.passTol (5%) of the best plan. It buys only if the fee is at most opts.feeCap (4%) of its
//   net worth, and not when the Salon card says she has only a guess tonight.
// - Acts only on 'sure' or 'likely' whispers about valuable goods (base price >= opts.minBase,
//   default ¤1,000: saffron, eels, chips, silk, ink). It weighs each told shock by the odds on
//   Ysolde's card (CONF), so it detours (or stays the night, for a rumour about the Terraces)
//   only when the expected gain beats the best ordinary plan.
// - A whisper counts as acted on when the plan it picks differs from the whisper-free plan
//   (different destination, or a different amount of the whispered good).
// opts.camp=1: at the Terraces, stay another night (for another whisper) when staying scores
// within passTol of the best plan. opts.hereAny=1: rumours about the port it stands in count for
// any good. stay-whisper sets both.
SIM.register('whisper-smart', {
  init(api, mem) { SIM.wlib.init(mem); },

  async night(api, mem) {
    const L = SIM.lib, WL = SIM.wlib, ws = mem.ws, N = api.nights(), day = api.day(), here = api.loc();
    const opt = Object.assign({ feeCap: 0.04, minBase: 1000, passTol: 0.05, camp: 0, hereAny: 0 }, mem.opts || {});
    L.observe(api, mem);
    await L.vaultIn(api, mem);
    WL.reconcile(api, ws);
    WL.observeLanded(api, ws);
    const onSell = (gid, r) => WL.attribute(ws, gid, r);

    const mine = () => ws.list.filter(x => x.day === day);
    const isMine = e => mine().some(x => e.d === x.d && e.g === x.g && e.type === x.type);
    const usable = x => (x.conf === 'sure' || x.conf === 'likely') && (api.good(x.g).base >= opt.minBase || (opt.hereAny && x.d === here));
    mem.ignore = e => mine().some(x => e.d === x.d && e.g === x.g && e.type === x.type && !usable(x));
    mem.trust = null;

    if (day >= N) {
      for (const gid of api.goods()) { const h = api.held(gid); if (h.q && api.stocked(gid)) onSell(gid, api.sell(gid, h.q)); }
      if (api.svcHere('lender')) await api.repay(api.debt());
      return null;
    }
    let w = null;
    if (api.svcHere('rumor') && api.whisperAvailable() && api.whisperHint() !== 'guess' && api.whisperCost() <= opt.feeCap * Math.max(1, api.netWorth())) {
      const r = await api.whisper();
      if (r && r.type) { w = WL.record(r, day); ws.list.push(w); }
    }
    await L.prepare(api, mem, { onSell });
    const crashHere = ws.list.find(x => x.type === 'crash' && x.acted && x.d === here && x.arrive === day);

    if (w) {
      const n = w.d === here ? 1 : api.nightsTo(here, w.d);
      w.actionable = usable(w) && (w.d !== here || api.canStay()) && (w.type === 'crash' ? day + n + 1 <= N : day + n <= N);
    }

    const bonus = L.repayBonus(api, mem);
    const plans = L.plans(api, mem, { bonus });
    const ig = mem.ignore;
    mem.ignore = e => isMine(e) || ig(e);
    const plain = L.plans(api, mem, { bonus });
    mem.ignore = ig;
    const plainScore = d => { const p = plain.find(x => x.d === d); return p ? p.score : -Infinity; };

    let plan = plans[0];
    const tol = s => opt.passTol * Math.abs(s);
    if (here !== 'ot' && day <= N - 2) {
      const ot = plans.find(p => p.d === 'ot' && p.n === 1);
      if (ot && ot.score >= plan.score - tol(plan.score)) plan = ot;
    }
    if (opt.camp && here === 'ot' && day <= N - 2) {
      const st = plans.find(p => p.stay);
      if (st && st.score >= plan.score - tol(plan.score)) plan = st;
    }
    if (api.hull() < 40 && here !== 'ch') plan = plans.find(p => p.d === 'ch') || plan;

    let acted = false;
    if (w && w.actionable && plan.d === w.d) {
      const pb = plain[0];
      const q = p => (p.basket.items.find(i => i.g === w.g) || { q: 0 }).q;
      acted = pb.d !== w.d || q(plan) !== (pb.d === w.d ? q(pb) : 0);
    }
    const carried = acted && w.type === 'spike' ? (plan.carry[w.g] || 0) : 0;
    const carriedCost = api.held(w ? w.g : 'kelp').cost;
    L.noteRoute(api, mem, plan);
    const buys = L.execute(api, mem, plan, onSell);
    if (acted) {
      w.acted = true; w.arrive = day + plan.n; w.how = plan.stay ? 'stay' : plan.n === 2 ? 'two' : 'one';
      w.forgone = Math.max(0, plain[0].score - plainScore(w.d));
      if (w.type === 'spike') {
        for (const b of buys) if (b.g === w.g) WL.addLot(ws, w, w.g, b);
        if (carried) WL.addCarried(ws, w, w.g, carried, carriedCost);
      }
    }
    if (crashHere) for (const b of buys) if (b.g === crashHere.g) WL.addLot(ws, crashHere, crashHere.g, b);
    if (L.shouldRepay(api)) await api.repay(api.debt());
    await L.vaultOut(api, mem, mem.lastPlan);
    return plan.d;
  },

  finish(api, mem) { SIM.wlib.finish(api, mem); },
});
