// charter-rush: buys a trading charter wherever it stands as soon as the purse covers one
// (¤20k, then ¤40k, ¤60k...), up to three nights before the end. Otherwise plays `informed`, with
// informed's own charter rule switched off. Tests whether charters bought early, wherever you
// happen to be, beat charters bought only where they pay.
SIM.register('charter-rush', {
  async night(api, mem) {
    mem.opts = Object.assign({}, mem.opts, { noCharter: 1 });
    if (api.day() <= api.nights() - 3 && api.hasCharters() && !api.hasCharter() && api.cash() >= api.charterCost()) await api.buyCharter();
    return SIM.lib.informedNight(api, mem);
  },
});
