// stay-whisper: exploit hunter for "stay the night". Staying makes a rumour about the port you
// stand in actionable (in round 1, 401 of 534 unusable spam whispers were about Orchid Terraces
// itself). Plays whisper-smart (odds-weighted, sure/likely only, fee at most 4% of net worth, no
// 'guess' nights) with two changes:
//  - a rumour about the port it stands in counts for any good, not only goods worth ¤1,000+;
//  - it camps at the Terraces: stays another night, for another whisper, whenever staying scores
//    within 5% of the best plan.
// Pell's tips about where it is are used as well (the planner reads every rumour it was told).
SIM.register('stay-whisper', {
  init(api, mem) { mem.opts = Object.assign({ camp: 1, hereAny: 1 }, mem.opts || {}); SIM.wlib.init(mem); },
  night: (api, mem) => SIM.policies['whisper-smart'].night(api, mem),
  finish(api, mem) { SIM.wlib.finish(api, mem); },
});
