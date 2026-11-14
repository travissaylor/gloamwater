// fight-farm: buys the best weapon it can as early as it can and fights every encounter, to see
// whether loot plus calm nights (a win halves encounters for three nights) make fighting dominant.
// Whenever the purse covers the next weapon it steers to Saint Mire's armory and buys it with no
// reserve (or at the Fog Fence, at 1.2x, if it is there). Otherwise plays `informed`.
SIM.register('fight-farm', {
  async night(api, mem) {
    let c;
    while ((c = api.upgradeCost('arms')) != null && api.cash() >= c) { if (!(await api.upgrade('arms'))) break; }
    const rb = SIM.lib.repayBonus(api, mem);
    const next = api.nextTierCost('arms');
    return SIM.lib.informedNight(api, mem, {
      bonus: d => rb(d) + (d === 'sm' && next != null && api.cash() >= next ? next * 1.5 : 0),
    });
  },
  choose: ci => (ci.opts.fight && ci.opts.fight.enabled ? 'fight' : null),
});
