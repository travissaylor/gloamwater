// corner: tries to inflate the final tally. The tally values cargo still aboard at half what it
// would fetch here (cargoValueHere, depth-aware). On the final night, before selling, it records
// the tally, buys as much as it can of the good it holds most value in (pushing that price up),
// and records the tally again (probe). Then, as a cornering player would, it sells everything
// into its own inflated price. The probe and the cash result show whether cornering pays.
// Otherwise it plays `informed`.
SIM.register('corner', {
  init(api, mem) { mem.out.corner = { probes: 0, tallyDelta: 0, sellDelta: 0 }; },
  async night(api, mem) {
    const C = mem.out.corner;
    if (api.day() >= api.nights()) {
      let gBest = null, vBest = 0;
      for (const gid of api.goods()) { const h = api.held(gid); if (h.q && api.stocked(gid)) { const v = api.quoteSell(gid, h.q); if (v > vBest) { vBest = v; gBest = gid; } } }
      if (gBest) {
        // what selling everything would bring without cornering
        let plain = 0; for (const gid of api.goods()) { const h = api.held(gid); if (h.q && api.stocked(gid)) plain += api.quoteSell(gid, h.q); }
        const c0 = api.cash();
        const t0 = c0 + 0.5 * api.cargoValueHere();
        const b = api.buy(gBest, api.maxBuy(gBest));
        const t1 = api.cash() + 0.5 * api.cargoValueHere();
        C.probes++; C.tallyDelta += t1 - t0;
        api.sellAll();
        C.sellDelta += (api.cash() - c0) - plain;
        C.lastBuy = b.q;
      }
    }
    return SIM.lib.informedNight(api, mem);
  },
});
