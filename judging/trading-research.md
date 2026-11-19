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
