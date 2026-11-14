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

## Freight-license experiment

The fleet calendar improved trade diversity, but the informed bot bought none of the three hold tiers above 70 in 80 runs. A browser-only prototype therefore tested an additional dealer-depth multiplier: `max(1, min(200/70, holdCapacity/70))`. The existing tier costs remained ¤18k, ¤40k and ¤85k. Charters and fleet calls still multiplied depth independently.

The prototype runs only with `--set freightLicense=1`. The game file was not changed. An opt-in policy, `--opt freightAware=1`, compares current public quotes with hypothetical advertised capacity and depth. It prices at most four future voyages from tonight's estimated uplift, reserves the purchase cost and requires a 25% cushion. A small Copperhook routing bonus values that same public opportunity. It reads no future prices, hidden shocks or outcomes. The no-high comparator uses the same informed planner with hold tiers capped at 70.

One comparison used 40 paired seeds and three policies. Results are in `tools/sim/results/freight-prototype.json` and `freight-prototype-summary.md`.

| Observation | Freight aware | No high tiers | No charters |
|---|---:|---:|---:|
| Final fortune, median | ¤827.6k | ¤627.5k | ¤673.0k |
| Final fortune, mean | ¤842.9k | ¤686.4k | ¤715.8k |
| Mean final hold tier | 2.25 | 1.27 | 1.95 |
| Finish with tier 3 / 4 / 5 | 37.5% / 15% / 2.5% | 0% / 0% / 0% | 35% / 10% / 0% |
| Median per-run N30/N18 growth | 3.72× | 3.17× | 3.17× |
| Largest sale in the sample | ¤1.11M | ¤584.5k | ¤654.7k |
| Mean charters purchased | 1.57 | 1.43 | 0 |

Twenty-two of forty informed runs bought licensed capacity, on mean night 17.2. Against the no-high comparator, 21 seeds improved, 16 tied and 3 worsened. The paired median gain was about ¤10k, while the mean gain was ¤156.5k. Large gains in a few runs account for much of the higher median final fortune; a larger number alone does not establish better play.

Late revenue shares barely moved: silk 36.0%, ink 27.9%, chips 15.2%, eels 11.9%. Without high tiers they were 36.0%, 27.3%, 15.0% and 12.3%. The leading late route remained Exchange–Orchid, at 35.4% of hops. This experiment adds capital deployment and an investment milestone. It adds little strategic variety.

**Recommendation:** do not ship all three licensed tiers as a variety fix. A 100/140-capacity license with a 2× cap could make a useful optional milestone, but that simpler variant is untested. The 200-capacity tier still drew only one buyer and is a reasonable pruning candidate. If the judges see no need for another investment milestone, pruning unused tiers is simpler than adding a global multiplier.

The integrated quote curve remains unchanged at a fixed license tier, so the same buy/sell round trip cannot gain money. Only three paid tier transitions exist; they cannot create an unbounded loop. The prototype did not rerun deliberate round-trip probes. Existing pressure can revalue when a license is purchased, as with charters, so check that one-time transition explicitly before shipping. Larger cargo also increases encounter stakes: mean encounter cost rose from ¤15.1k without high tiers to ¤16.8k with them. All three policies finished with no reported runtime errors, non-finite final scores or RNG mismatches.
