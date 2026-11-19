# Mechanics for a thirty-night trading game

Gloamwater benefits most from **legible uncertainty**. Players need enough information to choose a cargo and route, then enough change to reconsider that choice on the next night. The following are design hypotheses transferred from developer accounts and Gloamwater's recorded play. Those accounts establish what designers tried. The panel and matched-seed checks can test the transfer.

| Design question | Evidence from comparable games | Implication for Gloamwater |
|---|---|---|
| What makes repeated trading decisions hold up? | Failbetter found repeatable routes in *Sunless Sea* became routine as holds grew. *Sunless Skies* paired reliable smaller trades with time-limited higher rewards and signaled opportunities on the map. [Failbetter trade redesign](https://www.failbettergames.com/news/trade-in-the-skies-roche-limit) | Give a captain a sensible fallback and a better deal worth changing course for. Keep a fleet call an opportunity with finite depth. Test whether repeated same-port waiting dominates travel. |
| How much uncertainty is useful? | Subset's telegraphed threats shift attention toward what the player can do about an impending outcome. Sid Meier links interesting decisions to pacing, essential information and feedback. [Subset design talk](https://www.youtube.com/watch?v=4LDazcvZwzI) · [Meier's GDC session](https://www.gdcvault.com/play/1016165/Interesting) | Reveal tolls, cargo losses and travel time before commitment. Disclose what is firm, dated or uncertain. Keep shocks that change the plan and show workable responses. |
| What makes the same route feel different? | *Offworld Trading Company* puts adaptive play at the center of its market design. Changing supply and demand changes what production is worth and where players invest. [Johnson's postmortem](https://media.gdcvault.com/gdc2017/Presentations/Johnson_Soren_OffworldTradingCompany.pdf) · [Mohawk's design introduction](https://mohawkgames.com/2014/05/19/introducing-offworld-trading-company/) | Preserve stable district identities, then use events, depth and price impact to change marginal returns. Compare large single-good holds with smaller mixed loads and early investment with reserve-first play. |
| How do short runs develop an arc? | Inkle balanced *80 Days* around a reference route and timed alternatives with different costs and risks. [Inkle's development account](https://www.inklestudios.com/2014/07/14/approaching-journeys-end) | Use a plausible first trade as the baseline. Make the middle about opportunity cost and the last nights about committing cargo before settlement. Compare ordinary and adverse seeds to see whether either phase disappears. |
| How should a balance change be evaluated? | Mega Crit tracked choice availability, usage and outcomes, and combined metrics with feedback on difficulty and feel. [Giovannetti's GDC slides](https://media.gdcvault.com/gdc2019/presentations/Giovannetti_Anthony_SlayTheSpire.pdf) | Record what a captain could choose as well as what they chose. Compare outcomes on the same seeds and policies. Inspect low outcomes and dead turns as well as average fortune. Use play observations to judge whether choices felt fair. |
| What belongs at the point of action? | WCAG 2.2 specifies keyboard operation, visible focus, contrast and minimum pointer targets. [W3C accessibility guidance](https://www.w3.org/TR/WCAG22/) | Put price, time and cost next to the action they change. Check the route selector, trade sheet, event choices and ledger with touch and keyboard. |

## Mechanics to test first

1. **Trade before teaching the whole economy.** Wube's onboarding experiments focus on reaching the core activity quickly, giving players an early goal, and teaching through experimentation. For Gloamwater, test whether the first two nights get a newcomer to buy, sail and sell. Record where they hunted for a control, misunderstood a quote or needed help. Delay lender, fleet and charter detail until a decision needs it. [Factorio's new-player design notes](https://direct.factorio.com/blog/post/fff-241)
2. **Bound loss streaks by the choices they leave.** Randomization techniques such as weighting, shuffle bags and adjusting for recent outcomes can preserve variety while reducing streaks. Track consecutive bad arrivals, nights spent unable to fund a trade and time to recover. Keep market discovery separate from the roll that resolves a chosen risk. Test whether exact cargo previews or an affordable response resolve the complaint before changing event frequency. [Pierce's RNG talk](https://www.gdcvault.com/play/1024367/Math-for-Game-Programmers-Dark) · [Smith on intentional randomness](https://www.gdcvault.com/play/1028736/Cards-Dice-and-RNGs-Using)
3. **Keep the clock as a price.** A destination with higher headline prices can lose appeal after two nights of transit, a closing fleet call or a depleted reserve. Show arrival night and observed quote age at the same decision point. Compare a safe sale now with a riskier later sale after accounting for order size and the lost night. If a fixed fleet schedule creates an easy repeat, measure the in-port return against a real voyage before changing it. [Inkle's reference-route approach](https://www.inklestudios.com/2014/07/14/approaching-journeys-end) · [Failbetter trade redesign](https://www.failbettergames.com/news/trade-in-the-skies-roche-limit)
4. **Let a poor run change plans.** A low-cash captain still needs a choice with upside, such as a small trade, a delivery, or giving up time to protect scarce cargo. A healthy captain should still have reasons to keep capital free. Track finishing fortune by policy and the low end of the distribution. Check whether a fallback is worth using and whether a wealthy captain could farm it. Failbetter's legacy design addresses a related concern across runs. Gloamwater can test recovery inside a voyage without changing what scores measure. [Failbetter's legacy design retrospective](https://www.failbettergames.com/news/sunless-sea-vs-sunless-skies-death-legacies-and-repetition)

## Starting evidence in Gloamwater

The previous four panels used a different, 15-criterion rubric. Their common observations identify places to inspect. Cargo taken to cover tolls can exceed the quote, poor runs may stall on empty markets, and fleet pricing can reward predictable in-port waiting. The last scored packet predates keyboard and ledger fixes on the current branch. [Earlier panel synthesis](continuation-summary.md) · [Follow-up verification](pr-2-review.md)

### Matched-seed baseline

Five scripted policies each played seeds 100000–100039 on game SHA-256 `514fe0fba64b5fab2cb80c2909198befb7cb1685010bba98a514f4d01c1a3745`. Each used the game's voyage, event and settlement code. The harness aligns event random streams by seed and night. The values are diagnostics of the tested policies.

| Policy | 10th percentile | Median closing fortune | Matched seeds above informed |
|---|---:|---:|---:|
| Informed | 163,600 | 605,900 | Reference |
| Greedy | 1,840 | 67,100 | 1 of 40 |
| Borrow to the cap | 236,400 | 610,400 | 16 of 40 |
| Informed, always travel | 232,000 | 634,900 | 23 of 40 |
| Keep little cash aboard | 134,400 | 644,900 | 17 of 40 |

The informed policy uses forecasts, wireless, financing decisions and different cargo sizing from the greedy policy. The gap shows a large difference between those bundles. It leaves the contribution of each tool open. The travel variant gives no evidence that broad waiting dominates. A policy built specifically to camp ahead of a fleet call would test the narrower concern.

Full command and output are retained in the [baseline simulation log](../tools/sim/results/trading-baseline.txt).

## Follow-up on recovery and payment terms

Astra's baseline play supplied two concrete cases. A captain without cash, goods or credit had to wait for a random payout. A collector demand presented as a cash amount consumed the captain's remaining cash and last eel. Both cases narrowed the player's choices at the point when the game needed to make the stakes clearest.

Patrick Redding's GDC session describes how multiple recovery options let players stay with the consequences of a mistake. Failbetter uses port reports to add a cash reward outside the main trading loop. For Gloamwater, a paid night on the docks can trade time and interest for a small amount of working capital. Restricting the offer to a depleted captain and a single use preserves the pressure to trade. [Redding on recoverable setbacks](https://www.gdcvault.com/play/1021237/contactUs) · [Failbetter's port-report reward change](https://www.failbettergames.com/news/sunless-skies-patch-notes-1-1-0-4-cd2a9a87a-7th-june-2018)

The collector's nominal demand and the actual bundle can diverge whenever cargo is indivisible. Explain the exact cash, whole goods, hull damage and debt credit before the player commits. Generate the offer and outcome from the same calculation. For a destination quote, show when the buyer was observed and make availability uncertainty visible before departure. These disclosures preserve uncertainty about what happens next while resolving uncertainty about the rules in force now. [Meier on information and feedback](https://www.gdcvault.com/play/1016165/Interesting) · [Smith on intentional randomness](https://www.gdcvault.com/play/1028736/Cards-Dice-and-RNGs-Using)

## Follow-up on quote reliability and input

Opus observed successive arrival quotes 47% and 69% below their displayed observations. To check how typical those drops were, a market-only diagnostic ran the unchanged game's market clock on 80 seeds with no trades. It compared every stocked district-good observation with the same district and good one and two nights later. Buyer availability includes every stocked starting observation. Price percentiles are conditional on a buyer still being there.

| Observed quote | Nights later | Buyer available | 10th percentile price versus observation | Median price versus observation |
|---|---:|---:|---:|---:|
| Regular | 1 | 88% | 82% | 101% |
| Regular | 2 | 88% | 77% | 101% |
| Surge | 1 | 91% | 55% | 74% |
| Surge | 2 | 88% | 39% | 70% |
| Fleet | 1 | 98% | 70% | 96% |
| Fleet | 2 | 95% | 61% | 86% |

Use a clearly labeled downside comparison on the suggested route. The regular-market readings support trying the deal at 20% below a one-night quote, 25% below a two-night quote, and 30% below older observations. These are planning scenarios. They omit voyage losses, arrival price impact and absent buyers. Keep surges and fleet bonuses that expire before arrival in the quote details and omit them from the headline recommendation. The raw observation, its age, the travel time and the downside test each affect whether the trip is worthwhile. [ONS guidance on showing consequential uncertainty](https://service-manual.ons.gov.uk/data-visualisation/guidance/showing-uncertainty-in-charts) · [Inkle's route timing analysis](https://www.inklestudios.com/2014/07/14/approaching-journeys-end)

Opus also found that activating a district moved focus to its Close button, and tapping a cargo row could silently switch the trade side. Move focus to the selected route's main action, distinguish focus from selection, and keep the trade side visible and consistent with the player's last choice. [W3C ARIA keyboard guidance](https://www.w3.org/TR/2019/NOTE-wai-aria-practices-1.1-20190207/)

## Follow-up on replay

Fable and Opus both found the same fleet calendar after restarting. An unchanging sequence can turn a timed choice into a memorized schedule. *Offworld Trading Company* uses changing maps and markets to make players revisit plans. For Gloamwater, shuffle the order of the eight existing fleet calls in two groups. Affordable cargo stays in the opening half, while higher-capital opportunities vary late. The whole schedule remains public within a run, so a captain can plan ahead. Save the order with the voyage and keep the original order in older saves. [Johnson on markets and adaptive play](https://mohawkgames.com/2014/05/19/introducing-offworld-trading-company/)

## Investment diagnostics on Round 1

The baseline judges questioned how often engines, weapons and holds compete with wireless and charters. A 40-seed diagnostic on the Round 1 candidate disabled one purchase at a time for the informed policy. The full policy bought wireless in 37 runs and expanded the hold at the yard in 28. Its simulated median fortune was ¤594,375.

| Purchase disabled | Median fortune | Median paired change | Seeds with a higher fortune |
|---|---:|---:|---:|
| Wireless | 569,455 | −16,643 | 15 of 40 |
| Hold upgrades at the yard | 567,755 | 0 | 13 of 40 |
| Trading charters | 525,857 | −35,921 | 3 of 40 |

The wireless variant used the same simulator with the purchase branch disabled in memory. The hold variant used `--opt maxHoldTier=0` and could still accept the racks event. The charter variant used `informed-nocharter`. Each ran seeds 100000–100039. Medians use the simulator's lower middle value. These comparisons suggest that skipping wireless can work for this policy, while charters are harder to replace. They leave the discoverability of alternatives and the utility of other upgrades open for play.

## Follow-up on recovering a voyage

Astra's first Round 1 run reached dock work on night 22. The job put ¤350 back in the purse while the ordinary night's interest raised debt from ¤17,071 to ¤18,778. The second run retired its debt on night 7. The contrast shows why passing one bad night can restore an action without restoring a credible path to solvency. Soren Johnson describes a related distinction between setbacks that invite a response and losses that decide the rest of a game. [Johnson's design column](https://media.gdcvault.com/GD_Mag_Archives/GDM_April_2012.pdf)

The prototype discloses the exact post-work purse and debt in the offer using the existing pay and interest rules. The Round 1 simulation also gives context for the difference between the two runs. Of three informed voyages below zero net worth on night 10, one finished above zero. Three of six greedy voyages in that state recovered. Both groups are too small to set a new interest rate from them.

A multi-good destination comparison can show the subtotal if its largest buyer disappears. Tom Lehmann's designer talk uses resource choice and hand management to explain how players can manage their exposure to random outcomes. In Gloamwater, a diversified load can serve the same purpose when the player can see what each good contributes. [Lehmann's Race for the Galaxy design talk](https://www.youtube.com/watch?v=JcyyeAww2wc)

The opening tour now has a prototype that starts before the first market input. A sale shortcut inside a held good's trade sheet provides just-in-time guidance for players who skip the tour. The goal is to teach the action where it becomes useful. [Jones's tutorial design matrix](https://media.gdcvault.com/gdc2026/Slides/Jones_Michael_Creating_Player_Expertise_Microtalks_MEGA_DECK.pdf)

## Follow-up on early windfalls and repeat routes

Opus's first voyage found a free crate worth roughly ¤16,000 on a ¤2,500 starting purse. Its second voyage's crate was worth ¤1,400. The voyages reached night 10 at ¤255,000 and ¤18,500 net worth. The two voyages took different routes, so this does not isolate the crate's effect. It does show how a random early grant can change the options available for much of the run. Jaffe describes how snowballing gives early decisions more weight. Pierce describes how weighting random draws can retain variety while limiting extremes. [Jaffe on decision impact](https://media.gdcvault.com/gdc2019/presentations/Jaffe_Alex_Cursed_Problems_In.pdf) · [Pierce's RNG talk](https://www.gdcvault.com/play/1024367/Math-for-Game-Programmers-Dark)

The salvage prototype budgets a crate at ¤1,200 in usual cargo value on night 1, growing by ¤425 per night. It retains the existing trap odds and discloses the exact quantity that fits in the hold. In a 40-seed comparison, the informed policy's median falling from ¤594k to ¤544k came alongside a rise from ¤53k to ¤82k for the greedy policy. Their lower tails and sinking counts were similar. The simulator tests the market consequences of changed loot and does not measure whether the encounter feels better.

The Saint Mire–Orchid Moon Ink route is a strong small trade. In a market-only diagnostic across 80 seeds, 1,260 of 1,370 stocked departures could sell three units at a profit on arrival, before voyage losses. The median gain when the buyer was present was 54%. At nine units, price impact reduced it to 14% and 936 departures sold at a profit. A 40-seed policy comparison then sent the informed trader onto the fixed circuit once it reached ¤50k net worth from night 10 on, with normal trading and repairs along the way. It won 15 of 40 seeds against unrestricted informed play and had a paired median disadvantage of ¤28,593. Retain the district identities and measure any future route change against both the small trade and the full-run comparison.

The credit prototype bases the limit on opening credit plus positive net worth, bounded by the existing cap. A fixture drew the line in two installments and showed that borrowed cash could no longer raise its own limit. Keyboard instrumentation also reproduced focus loss when a refreshed market replaced the focused row. The prototype restores the relevant control and returns keyboard players to the arriving market after a voyage. [W3C keyboard focus persistence](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)

## Follow-up on late-game investment

After night 18, Fable often had ¤60k–110k idle and little reason to expand its hold. The charter comparison shows that dealer depth has real value, yet investing in more traded volume alone still depends on finding the same kind of deal. Failbetter's fixed-payout prospects add a different reason to pick a destination. Gloamwater uses its own parcel rules to offer ordinary post or larger bonded freight. The post pays ¤2,800 with no deposit and uses 10 slots. Freight stakes ¤18,000 and uses 40 slots for a ¤42,000 payout if delivered. Both can be seized, and a late delivery forfeits the bond. The five-night window limits repeat income while leaving room for trade and repairs. [Failbetter's trade redesign](https://www.failbettergames.com/news/trade-in-the-skies-roche-limit)

Fable also saw consecutive patrols and repeated arrival events. The new event selection remembers the previous voyage and arrival separately. It avoids an immediate repeat and leaves the encounter risks, deadline, and market RNG in place. [Pierce on limiting random streaks](https://media.gdcvault.com/gdc2017/Presentations/Shay_Pierce_DarkSecretsRNG.pdf)

Two scripted variants tested consignments on the Round 2 candidate across 40 matched seeds. Both used the informed trade policy, accepted a job only if it fit the free hold and its bond cost at most 40% of the purse, and routed toward the accepted destination. One limited itself to post. The other chose bonded freight when available under those limits.

| Policy | Accepted jobs | Bonded jobs | Median fortune | Higher than informed on the same seed |
|---|---:|---:|---:|---:|
| Informed, no consignments | 0 | 0 | About 562,900 | Reference |
| Post only | 107 | 0 | 585,072 | 24 of 40 |
| Bonded freight when affordable | 109 | 20 | 591,653 | 23 of 40 |

Neither variant sank or changed the end-of-run market RNG. The bonded option was useful in some circumstances and the flexible trader still won a substantial share of the paired runs. This probe uses scripted selection and does not measure whether players notice the opportunity. Separate phone fixtures confirmed that an inspection and an overdue job each forfeit one bond and that the inspection result persists on save.

## Follow-up on closing and lending numbers

Astra's Round 2 run carried an eel worth ¤2,855 with no local dealer. Settlement paid ¤1,428. The confirmation gave the amount, but the final market footer gave only the larger value. A prototype puts the exact payout and score beside Settle up. It also previews how much rounded interest a chosen repayment saves that night. Both displays use the same calculations that settle the run and accrue the loan. This makes the relevant costs visible at the decision. [Meier on game feedback and decisions](https://www.gdcvault.com/play/1016165/Interesting)

A contrasting solid background made the shortcut labels easier to read. The prototype measured 12.22:1 text contrast. Touch fixtures reproduced the missing-buyer settlement and a partial repayment that saved ¤101 after rounding. [W3C on minimum text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

Opus found that a route card could label an entire sale as a gain when the local buyer was absent. The prototype labels that amount as projected proceeds and identifies the missing local buyer. A good with cargo aboard defaults to Sell when opened from its row. The last mode can carry over when reopening the same good in the same market. Explicit Buy and Sell commands still set the mode. This follows guidance on preventing slips when the same control has different effects. [Budiu on interface modes](https://www.nngroup.com/articles/modes/)

Opus also paid a Gull toll equal to its entire purse. The prototype shows the possible cash cost before sailing and lists the precise cargo or hull cost in Port details. The quote uses the current purse and hold. Sailing and encounters can change both. An emulated touch fixture checked the same whole-unit payment the encounter will offer. [Subset Games on telegraphing consequences](https://media.gdcvault.com/gdc2019/presentations/Into%20the%20Breach%20Postmortem%20Final.pdf)

## Follow-up on closing choices

Fable's last two trades moved 2% and 0.2% of net worth, after it banked roughly 90% of its fortune. The earlier probes support keeping ordinary price impact because it gives small and large orders different economics. The first heavy-freight prototype required 90 slots and a ¤72,000 stake. An informed policy that tried to prepare for it accepted none in 40 voyages. The revised job uses 65 slots, stakes ¤50,000 and pays ¤96,000 on delivery, so a second-tier hold can carry it. It appears only for two-night routes on nights 24–27. Each voyage can accept it once. The load raises encounter risk, and the time window leaves one spare night for a setback. [Inkle on route costs and fixed deadlines](https://www.inklestudios.com/2014/07/14/approaching-journeys-end) · [Failbetter on time-limited trade prospects](https://www.failbettergames.com/news/trade-in-the-skies-roche-limit)

Fable also saw conflicting warnings about live fleet calls and a Settle up button below the phone fold. The public fleet schedule determines buyer availability for its named good on the arrival night. The price still moves. The route card distinguishes those two facts. The trade sheet suggests a smaller order only when quantity changes unit cost, and settlement terms sit before the final market rows.

A revised 40-seed policy prepared for heavy freight from night 19 by visiting the yard, preserving room in the hold and withdrawing reserves when possible. It accepted heavy freight in 34 voyages. It finished above unrestricted informed play on 22 seeds, with a paired median gain of ¤25,994 and no sinks in the sample. This was a purpose-built policy. Its upgrade and reserve decisions were part of the comparison, so the result includes their opportunity costs.
