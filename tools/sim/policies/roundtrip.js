// roundtrip: hunts for spread and depth exploits inside one night. In every port, for every good
// on sale, it trades and undoes the trade several ways, recording the cash change of each:
//   one:   buy q in one order, sell q in one order (q = the most it can buy)
//   splitB: buy q as q one-unit orders, sell q in one order
//   splitS: buy q in one order, sell q as q one-unit orders
//   alt:    buy 1, sell 1, twenty times
//   walk:   buy q, sell q/2, buy q/2, sell q
// Pressure ends where it started, so any positive change is free money. Then it plays the
// informed policy for the night, so its paired difference against `informed` is the exploit.
SIM.register('roundtrip', {
  init(api, mem) {
    mem.out.rt = { tests: 0, positive: 0, sum: 0, max: -Infinity, min: Infinity, best: null, by: {} };
  },
  async night(api, mem) {
    const R = mem.out.rt;
    const rec = (kind, d, info) => {
      R.tests++; R.sum += d; if (d > 0) R.positive++;
      const b = (R.by[kind] = R.by[kind] || { tests: 0, positive: 0, sum: 0, max: -Infinity });
      b.tests++; b.sum += d; if (d > 0) b.positive++; if (d > b.max) b.max = d;
      if (d > R.max) { R.max = d; R.best = Object.assign({ kind, day: api.day(), loc: api.loc() }, info); }
      if (d < R.min) R.min = d;
    };
    for (const gid of api.goods()) {
      const q = api.maxBuy(gid);
      if (q <= 0) continue;
      const info = { g: gid, q };
      let c0 = api.cash(), b = api.buy(gid, q); if (!b.q) continue; api.sell(gid, b.q); rec('one', api.cash() - c0, info);
      c0 = api.cash(); let n = 0; for (let i = 0; i < q; i++) n += api.buy(gid, 1).q; api.sell(gid, n); rec('splitB', api.cash() - c0, info);
      c0 = api.cash(); b = api.buy(gid, q); for (let i = 0; i < b.q; i++) api.sell(gid, 1); rec('splitS', api.cash() - c0, info);
      c0 = api.cash(); for (let i = 0; i < 20; i++) { const x = api.buy(gid, 1); if (x.q) api.sell(gid, 1); } rec('alt', api.cash() - c0, info);
      c0 = api.cash(); b = api.buy(gid, q); const h = Math.floor(b.q / 2); api.sell(gid, h); const b2 = api.buy(gid, h); api.sell(gid, b.q - h + b2.q); rec('walk', api.cash() - c0, info);
    }
    return SIM.lib.informedNight(api, mem);
  },
});
