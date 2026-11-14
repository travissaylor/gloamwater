// vault: the informed captain, but every time it is at a vault (Lanternquay, Drowned Exchange)
// it withdraws everything before trading and deposits every crown left after buying cargo.
// Idle money compounds at 1.5% a night and is safe from gulls, tolls and sinking.
SIM.register('vault', {
  async night(api, mem) {
    if (api.svcHere('vault') && api.bank() > 0) await api.withdraw(api.bank());
    const dest = await SIM.lib.informedNight(api, mem);
    // keep enough on hand for the next hold tier, so parking money does not starve upgrades
    const next = api.nextTierCost('hold');
    const reserve = next && api.day() <= api.nights() - 5 ? next / 0.4 : 0;
    if (api.svcHere('vault') && api.cash() > reserve) await api.deposit(api.cash() - reserve);
    return dest;
  },
});
