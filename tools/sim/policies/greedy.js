// greedy: a port of the bake-off build's botTurn() dev hook.
// Sell anything above cost (everything on the last night); at Lanternquay repay debt when the
// purse covers 1.3x the debt or after night 24; at Copperhook buy the next hold tier if it costs
// under 35% of cash and repair below 70% hull; then buy the good with the best estimated
// arbitrage (this port's price de-rated by its cheap/dear multiplier and local shock, re-rated
// for the destination) and sail there. No arbitrage: sail somewhere at random. Hull under 45%:
// head to Copperhook. Encounters and events use SIM.defaultChoose (see README).
SIM.register('greedy', {
  async night(api) {
    const here = api.loc(), N = api.nights(), day = api.day();
    for (const gid of api.goods()) {
      const h = api.held(gid);
      if (h.q && api.stocked(gid) && (api.price(gid) > h.cost * 1.02 || day === N)) api.sell(gid, h.q);
    }
    if (here === 'lq' && api.debt() > 0 && (api.cash() > api.debt() * 1.3 || day > 24)) await api.repay(Math.min(api.debt(), api.cash()));
    if (here === 'ch') {
      const c = api.upgradeCost('hold');
      if (c != null && c < api.cash() * 0.35) await api.upgrade('hold');
      if (api.hull() < 70) await api.upgrade('repair');
    }
    if (day >= N) return null;
    const mustRepay = api.debt() > 0 && here !== 'lq' && (api.cash() > api.debt() * 1.3 || day >= 24);
    let best = null;
    for (const gid of api.goods()) {
      if (!api.stocked(gid)) continue;
      const p = api.price(gid);
      const est0 = p / api.districtMult(here, gid) / api.effectMultHere(gid);
      for (const did of api.districts()) {
        if (did === here || (mustRepay && did !== 'lq')) continue;
        const est = est0 * api.districtMult(did, gid);
        const qty = api.maxBuy(gid);
        const gain = est * 0.95 * qty - api.quoteBuy(gid, qty);
        if (!best || gain > best.gain) best = { g: gid, d: did, gain, qty };
      }
    }
    let dest;
    if (best && best.gain > 0) { api.buy(best.g, best.qty); dest = best.d; }
    else { const ds = api.districts().filter(d => d !== here); dest = mustRepay ? 'lq' : ds[Math.floor(api.rand() * ds.length)]; }
    if (api.hull() < 45 && here !== 'ch') dest = 'ch';
    return dest;
  },
});
