// fight: always fights every encounter, buys the next weapon whenever it can afford it with
// ¤500 to spare (Saint Mire's armory, or the Fog Fence at 1.2x), and steers toward dangerous
// districts to farm loot: each destination gets a bonus of encounter chance x ¤2,500.
SIM.register('fight', {
  async night(api, mem) {
    const c = api.upgradeCost('arms');
    if (c != null && api.cash() >= c + 500) await api.upgrade('arms');
    const rb = SIM.lib.repayBonus(api, mem);
    return SIM.lib.informedNight(api, mem, {
      bonus: d => rb(d) + api.encounterChance(d) * 2500 + (d === 'sm' && api.nextTierCost('arms') != null ? 400 : 0),
    });
  },
  choose: ci => (ci.opts.fight && ci.opts.fight.enabled ? 'fight' : null),
});
