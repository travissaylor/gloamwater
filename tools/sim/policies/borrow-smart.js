// borrow-smart: borrows to Marrow's limit on night 1 like borrow-max, but clears the whole debt at
// Lanternquay as soon as the purse covers it from night 7 on, so the collectors' deadline (any
// debt after night 10, or over 12,000) costs as little as possible. Tests whether the deadline
// takes the edge off borrowing.
SIM.register('borrow-smart', {
  async night(api, mem) {
    const day = api.day();
    if (day === 1 && api.svcHere('lender') && api.debt() < api.maxDebt()) await api.borrow(api.maxDebt() - api.debt());
    const hold = (day < 7 || api.cash() < api.debt()) && day < api.nights() - 6;
    const rb = SIM.lib.repayBonus(api, mem);
    const bonus = d => rb(d) + (d === 'lq' && day >= 6 && api.debt() > 0 && api.cash() >= api.debt() * 0.8 ? 0.3 * api.debt() : 0);
    return SIM.lib.informedNight(api, mem, { noRepay: hold, bonus });
  },
});
