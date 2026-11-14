// informed-nostay: `informed` that never stays the night in port. Paired against informed, it
// prices the stay option.
SIM.register('informed-nostay', {
  night(api, mem) { mem.opts = Object.assign({}, mem.opts, { noStay: 1 }); return SIM.lib.informedNight(api, mem, { minEdge: mem.opts.minEdge }); },
});
