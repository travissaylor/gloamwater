// informed: a competent captain. Uses every price it has legitimately seen (S.seen, with age),
// the city-wide trend implied by tonight's prices, known bulletins (and their weaker second
// night), and rumours it has been told for tomorrow, each weighted by the odds on the card.
// Depth-aware: sizes every order with the game's own quotes, so the marginal unit's expected
// resale (integrated over the destination's price curve, after the pressure it left there eases)
// clears its marginal cost by opts.minEdge (default 5%), and spreads its purse and hold across
// goods by profit per share of the binding resource. Splits held cargo between selling here and
// carrying on. Scores every destination by that, plus parcels due, minus voyage risk. Buys hold
// tiers while the hold has been filling up (opts.holdFill, 0.8), a second engine and the wireless
// set when affordable early enough, repairs, and clears debt once comfortable.
SIM.register('informed', {
  night(api, mem) {
    const o = mem.opts || {};
    return SIM.lib.informedNight(api, mem, { minEdge: o.minEdge });
  },
});
