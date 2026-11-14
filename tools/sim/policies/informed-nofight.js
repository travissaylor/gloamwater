// Same trading and services as informed; the encounter solver must use nonfight
// choices throughout its continuation, so a failed flee does not assume fighting later.
SIM.register('informed-nofight', {
  night(api, mem) { return SIM.lib.informedNight(api, mem, { minEdge: mem.opts.minEdge }); },
  choose(ci) {
    if (!['patrol', 'gulls', 'collectors'].includes(ci.kind)) return null;
    const sol = SIM.encSolve(Object.assign({}, SIM.encCtx(ci), { noFight: true }));
    const options = Object.keys(sol.costs).filter(k => k !== 'fight' && SIM.enabled(ci, k));
    const best = options.sort((a, b) => sol.costs[a] - sol.costs[b])[0];
    if (SIM.encOpen && !SIM.encOpen.expect) SIM.encOpen.expect = { best, costs: sol.costs };
    return best;
  },
});
