// informed-adj: `informed` that only sails to districts one canal away (no two-night trips).
// Paired against informed, it prices the two-night option.
SIM.register('informed-adj', {
  night(api, mem) { mem.opts = Object.assign({}, mem.opts, { adjOnly: 1 }); return SIM.lib.informedNight(api, mem, { minEdge: mem.opts.minEdge }); },
});
