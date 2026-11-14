// scum-control: `scum` without the reloads (same fights, same eel bets, same weapons). The paired
// difference scum - scum-control is what save-scumming is worth.
SIM.register('scum-control', {
  night: (api, mem) => SIM.policies.scum.night(api, mem),
  choose(ci) {
    if (ci.kind === 'eel') return 'big';
    if (ci.opts.fight && ci.opts.fight.enabled) return 'fight';
    return null;
  },
});
