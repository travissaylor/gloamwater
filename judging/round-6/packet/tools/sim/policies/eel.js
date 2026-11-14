// eel: the informed captain, but always takes Grandmother Wick's big offering (20% of the purse,
// 40% chance to win 2.5x). Measures what the gamble does to the spread of outcomes.
SIM.register('eel', {
  night: (api, mem) => SIM.lib.informedNight(api, mem),
  choose: ci => (ci.kind === 'eel' ? 'big' : null),
});
