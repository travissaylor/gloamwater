// borrow-max: borrows to Marrow Quill's credit limit on night 1 (it starts at Lanternquay) and
// goes all-in with the informed planner. Holds the debt until the purse is 3x the debt or the
// last six nights, then clears it. Re-borrows to the limit whenever it is back at Lanternquay
// before night 10.
SIM.register('borrow-max', {
  async night(api, mem) {
    const early = api.day() <= 10;
    const cap = Math.min(api.maxDebt(), (mem.opts && mem.opts.cap) || Infinity); // --opt cap=N: borrow only to N (a lower credit limit)
    if (early && api.svcHere('lender') && api.debt() < cap) await api.borrow(cap - api.debt());
    const late = api.day() >= api.nights() - 6;
    const hold = !late && api.cash() < api.debt() * 3;
    return SIM.lib.informedNight(api, mem, { noRepay: hold, bonus: hold ? () => 0 : undefined });
  },
});
