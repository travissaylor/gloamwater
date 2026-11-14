// Informed comparator that never purchases hold tiers above 70 units.
SIM.register('informed-nohigh', {
  night(api, mem) {
    mem.opts = Object.assign({}, mem.opts, { maxHoldTier: 2 });
    return SIM.lib.informedNight(api, mem, { minEdge: mem.opts.minEdge });
  },
});
