# Economy changes for the next build

Add a public four-night fleet calendar and show charter payback in crowns. Keep depth integration, whisper scarcity and seeded randomness.

## Why another economy system helps

Flat-price capital rises steeply by good: Glowkelp trades `60 × 42 = ¤2,520` before ordinary depth moves, while Moon Ink trades `3 × 19,000 = ¤57,000`. Specialty districts multiply both by 1.5. Expensive goods therefore absorb capital much better than staples. Capacity cannot fix that disparity alone.

A focused baseline used 40 paired seeds, `100000..100039`, with the existing informed, greedy, whisper-spam and informed-nocharter bots. It loaded the game once before each worker's runs. The game SHA is recorded in `tools/sim/results/round3-baseline.json`.

| Observation | Result |
|---|---:|
| Informed final fortune, median | ¤331.1k |
| Greedy final fortune, median | ¤39.9k |
| Informed without charters, median | ¤351.1k |
| Informed / no-charter mean fortune | ¤354.0k / ¤353.8k |
| Informed runs buying any charter | 40% |
| First charter, mean night | 18.3 |
| Informed final hold tier, mean | 1.15 of 5 |
| Whisper spam beating informed | 30% of paired seeds |
| Whisper spam paired median deficit | ¤106.6k |
| Acted whispers losing money, fee included | 65% |
| Game errors / seeded-market mismatches | 0 / 0 |

This is a small diagnostic sample. It confirms unused high hold tiers and weak average charter value; it does not establish stable balance across the full seed space.

## Public fleet calls

Each call lasts four nights. Prices for the named good receive a 1.4 multiplier, applied before existing trend/local variation and shocks. That good's depth doubles at the host district. The whole calendar is public. A forecast says when the call closes, so arriving after it ends is a visible timing error.

| Nights | District | Good |
|---|---|---|
| 1–4 | Copperhook Docks | Glowkelp |
| 5–8 | Saint Mire | Bottled Rain |
| 9–12 | Orchid Terraces | Rust Pearls |
| 13–16 | Fogmouth | Synth Saffron |
| 17–20 | Drowned Exchange | Clockwork Eels |
| 21–24 | The Sluices | Ghost Chips |
| 25–28 | Orchid Terraces | Dreamsilk |
| 29–30 | Lanternquay | Dreamsilk |

These calls move from affordable cargo to larger capital commitments. Fogmouth and the Sluices add route danger. Two late Dreamsilk calls create a final repositioning choice. Avoid increasing Moon Ink depth: that would strengthen the dominant loop.

Use `FLEET_CALLS` for the table. `fleetCall(day)` returns `{d,g,from,to,m:1.4,depth:2}` or null past night 30. `fleetMult(did,gid,day)` returns 1.4 for the active pair and 1 otherwise. Give `mult(d,g,day=S.day)` and `depthOf(did,gid,day=S.day)` optional arrival-day arguments.

The simulator now passes arrival day to price multipliers and depth curves in `adapter.js` and `_common.js`. Ordinary calls still default to tonight. The forecast reads public schedule data, never hidden pending events or their fates.

Calls improve known opportunities without guaranteeing a profit. Prices still drift, order size still moves prices, the buyer can overpay, and voyages still carry costs and risk. The calendar multiplier must stay outside whisper generation: whispers continue to reveal only previously queued shocks.

## Charter payback

Show the exact change in sale proceeds for currently held cargo, comparing existing depth with `n × 2, d × 2` at current raw prices and pressure. Label it as tonight's estimate. Show charter cost beside it and estimate `ceil(cost / positiveUplift)` similar loads to break even. If uplift is zero, say there is no benefit for this load.

For empty holds, show the before/after flat quantities for the district's specialty goods. Do not present a made-up profit or guaranteed number of future visits. After integration, compare informed with informed-nocharter again and inspect the high-tier hold purchase rate.

## Keep the change bounded

Do not simply remove depth, increase vault interest, or make all expensive goods liquid. Those changes restore runaway wealth or make banking even more dominant. Keep current rank thresholds until the changed game has a larger seed sample. Run informed, greedy, whisper-spam and roundtrip first; expand only if they reveal a problem.
