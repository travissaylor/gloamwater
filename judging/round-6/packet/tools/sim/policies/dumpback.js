// dumpback: tries to profit from pressure easing. In every port it dumps ALL its cargo, however
// deep that pushes the price down, then prefers to return to ports where it dumped two or more
// nights ago and the price is still pressed down, so the planner buys the same goods back below
// their usual price. If dumping and buying back paid, this would beat `informed`.
SIM.register('dumpback', {
  init(api, mem) { mem.out.dump = { dumps: 0, dumpUnits: 0, buybacks: 0, buybackUnits: 0, buybackDiscount: 0 }; mem.dumped = {}; },
  async night(api, mem) {
    const D = mem.out.dump, here = api.loc(), day = api.day();
    // buy back: what the planner buys tonight in goods dumped here earlier
    const onBuys = buys => {
      for (const b of buys) {
        const dd = mem.dumped[here] && mem.dumped[here][b.g];
        if (dd != null && dd < day && api.pressure(here, b.g) < 0) {
          D.buybacks++; D.buybackUnits += b.q;
          D.buybackDiscount += b.q * api.rawPrice(b.g) - b.total; // crowns saved vs the pressure-free price
        }
      }
    };
    if (day < api.nights()) {
      for (const gid of api.goods()) {
        const h = api.held(gid);
        if (!h.q || !api.stocked(gid)) continue;
        const r = api.sell(gid, h.q);
        if (r.q) { D.dumps++; D.dumpUnits += r.q; (mem.dumped[here] = mem.dumped[here] || {})[gid] = day; }
      }
    }
    const rb = SIM.lib.repayBonus(api, mem);
    const bonus = d => {
      let v = rb(d);
      for (const gid in (mem.dumped[d] || {})) { const x = api.pressAfter(d, gid, 1); if (x < 0 && day - mem.dumped[d][gid] >= 1) v += -x * api.good(gid).base * 0.05; }
      return v;
    };
    return SIM.lib.informedNight(api, mem, { bonus, onBuys });
  },
});
