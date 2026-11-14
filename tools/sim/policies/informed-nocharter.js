// informed-nocharter: `informed` that never buys a trading charter. Paired against informed, it
// prices informed's charter rule.
SIM.register('informed-nocharter', {
  night(api, mem) { mem.opts = Object.assign({}, mem.opts, { noCharter: 1 }); return SIM.lib.informedNight(api, mem, { minEdge: mem.opts.minEdge }); },
});
