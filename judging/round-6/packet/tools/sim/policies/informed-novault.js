// informed-novault: `informed` that never uses the vault (round 1's informed). Paired against
// informed, it prices informed's vault rule.
SIM.register('informed-novault', {
  night(api, mem) { mem.opts = Object.assign({}, mem.opts, { noVault: 1 }); return SIM.lib.informedNight(api, mem, { minEdge: mem.opts.minEdge }); },
});
