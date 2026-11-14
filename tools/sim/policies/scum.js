// scum: the informed captain with save-scumming. Fights every encounter (loot), takes the eel's
// big offering, buys weapons like `fight`, and "reloads the page" whenever the eel turns black
// or the skiff sinks, exactly as a player refreshing the tab would. The game now commits every
// outcome before showing it (commitOutcome) and deletes the save on sinking, so a reload should
// restore nothing. The run records what each reload found (reloadLog: saves found, saves
// missing, cash and hull a reload gave back). opts.noReload=1 plays the same policy without
// reloading; `scum-control` is that policy, for a paired comparison.
SIM.register('scum', {
  async night(api, mem) {
    const c = api.upgradeCost('arms');
    if (c != null && api.cash() >= c + 500) await api.upgrade('arms');
    return SIM.lib.informedNight(api, mem);
  },
  choose(ci, api, mem) {
    if (ci.kind === 'eel') return 'big';
    if (ci.opts.fight && ci.opts.fight.enabled) return 'fight';
    if (!(mem.opts && mem.opts.noReload) && (ci.kind === 'eellose' || ci.kind === 'sunk')) return api.reload();
    return null;
  },
});
