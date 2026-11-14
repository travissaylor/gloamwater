// purse-floor: keeps the purse near zero to see whether encounters are still cheap now that
// bribes, tolls and collections follow the cargo (at usual prices) as well as the purse.
// At a vault (Lanternquay, Drowned Exchange) it withdraws before trading and deposits every crown
// left after buying. Elsewhere it spends what is left on more cargo for the same destination,
// accepting an expected 3% loss on the extra (minEdge 0.97). Otherwise plays `informed`.
SIM.register('purse-floor', {
  async night(api, mem) {
    const L = SIM.lib;
    if (api.svcHere('vault') && api.bank() > 0) await api.withdraw(api.bank());
    const dest = await L.informedNight(api, mem);
    if (api.day() >= api.nights()) return dest;
    if (api.svcHere('vault')) { if (api.cash() > 0) await api.deposit(api.cash()); }
    else if (api.cash() > 200 && api.free() > 0 && mem.lastPlan) {
      const p = mem.lastPlan;
      const extra = L.basket(api, mem, p.d, api.cash() - 100, api.free(), p.carry, 0.97, p.n, p.stay ? p.sell : null);
      for (const it of extra.items) { const q = Math.min(it.q, api.maxBuy(it.g)); if (q > 0) api.buy(it.g, q); }
    }
    return dest;
  },
});
