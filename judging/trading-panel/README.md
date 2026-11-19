# Trading-game panel

This evaluation starts from the merged PR #2 build and uses a new [ten-criterion rubric](../trading-rubric.md). The earlier panels used a 15-criterion scale. Their scores belong to that rubric and those builds.

## Rubric calibration

Fable 5.2 high, Opus 5.5 high and GPT-6.2 Astra high independently reviewed the draft. Their main concern was that some top anchors asked for evidence similar to the old rubric's 80-point marks. The frozen rubric requires specific observations at the top, assigns each defect a primary criterion, maps the original brief to the ten criteria, and gives presentation nine points. The rubric makes hard delivery failures and reproducible game-breaking tactics consequential in the total.

The rubric requires a complete phone run, a contrasting opening through night 10 and desktop checks on each core screen. More extensive second-context checks can support the highest marks. Judges can score Web Audio operation and emulated touch from observed behavior and describe the coverage limits.

## How scores are compared

The baseline uses the current game before changes. Up to five development rounds can follow it. Each round uses a fresh independent panel of three judges, the same rubric and a fixed game build. The stopping condition is an unrounded arithmetic mean of at least 90 across the three weighted totals, or five development rounds. Every completed panel remains in the record. Individual totals and the spread describe how consistently the panel saw the result.

Read the [research](../trading-research.md) for source notes and the baseline simulation. The organizer's record includes earlier scores and is kept outside the judge packet.

## Baseline verification

The 253,939-byte game at SHA-256 `514fe0fba64b5fab2cb80c2909198befb7cb1685010bba98a514f4d01c1a3745` passed all eight `tools/verify.cjs` checks, all 16 `tools/event-check.cjs` fixtures and all 30 `tools/pr-check.cjs` checks. These cover source constraints, emulated phone and desktop play, settlement and reload, event outcomes, sandbox and corrupt storage, focus and ledger assertions. The separate simulation used 40 seeds and five policies. These checks are supporting diagnostics. Each judge makes and records an independent assessment of the experience.

## Baseline panel and selected changes

| Game | Fable 5.2 high | Opus 5.5 high | GPT-6.2 Astra high | Panel mean |
|---|---:|---:|---:|---:|
| Baseline | [90.53](baseline/fable.json) | [83.53](baseline/opus.json) | [89.86](baseline/astra.json) | **87.97** |
| Round 1 | [89.56](round-1/fable.json) | [86.10](round-1/opus.json) | [88.93](round-1/astra.json) | **88.20** |
| Round 2 | [90.06](round-2/fable.json) | [88.67](round-2/opus.json) | [90.83](round-2/astra.json) | **89.85** |
| Round 3 | [89.68](round-3/fable.json) | [88.69](round-3/opus.json) | [89.42](round-3/astra.json) | **89.26** |
| Round 4 | [90.29](round-4/fable.json) | [87.06](round-4/opus.json) | [91.39](round-4/astra.json) | **89.58** |
| Round 5 | [89.80](round-5/fable.json) | [87.54](round-5/opus.json) | [92.70](round-5/astra.json) | **90.01** |

All three settled a cold touch run on night 30, with varying use of scripts to drive visible controls. All replayed the opening through night 10. No judge applied a cap. The largest disagreement was on economy and progression, which ranged from 76 to 92. Closing fortunes ranged from a ¤2,752 deficit to ¤436,943. The difference reflects individual routes, seeds, choices and judgments.

Round 1 targets findings shared across the panel. Give a badly depleted captain a paid dock shift and show exact payment terms. Make route recommendations account for quote age, buyer availability and expiring demand. Vary the public fleet calendar by voyage, within early and late cargo groups. Point damaged ships to repairs and fix keyboard focus in the map, tour and trade sheet. Keep larger changes to investment balance and the late-game arc open for the next panel's evidence.

## Round 1 verification

The candidate is 258,584 bytes, SHA-256 `8156027f5c8d0896978686a5ea3c49a9c37175e761c659cc12effd20ba35883d`. Seven broad regression groups passed. The sandbox group initially assumed which fleet call was active on night 21. It passed after the fixture selected the active call from the public calendar. All 16 event fixtures, 30 focus, fleet and ledger checks, and six new targeted checks passed on the same build.

The [40-seed repeat](../../tools/sim/results/trading-round1.txt) put the informed median at ¤594k, against ¤606k in the baseline. Its 10th percentile rose from ¤164k to ¤295k. Greedy median fortune fell from ¤67k to ¤53k, and one of its 40 voyages sank. The simulator does not use the new dock shift. These figures measure the scripted policies under the two schedules. The panel tests how the new decisions feel in play.

## Round 1 panel and Round 2 design

All three Round 1 judges settled a cold touch voyage and played a fresh opening through night 10. They used a mix of personal choices and scripts driving visible controls. None applied a cap. The mean rose 0.22 points. Routes averaged 91.00, while economy and progression averaged 83.33. Late idle cash, low demand for hold upgrades, and outsized early gains drove the second iteration.

Round 2 lets players choose a smaller post delivery or spend hold space and a deposit on bonded freight. Work opens on night 15 and each five-night window permits one contract. The known payout competes with uncertain dealer prices and uses capacity that could carry trade goods. Early salvage grows with the voyage, the credit limit depends on positive net worth, and consecutive voyages see fewer repeated encounters.

Port details compare mixed holds at lower prices and show the proceeds if the largest quoted buyer is absent. Dock work shows its cash and interest consequences in advance. The tour takes focus before the market opens, trades return keyboard focus to the market row, and the ending's peak tracks the HUD's net worth.

## Round 2 verification

The frozen candidate is 265,439 bytes, SHA-256 `171b8e099897e93624ded39d6110babef3a3b8c4038e1b00897236b318778bb4`. All eight broad regression groups, 16 event fixtures, 30 focus/fleet/ledger checks and eight trading fixtures passed. The freight fixture verifies the hold requirement, bond deduction and single payout across reload. The trading fixtures also verify the revised credit limit, route comparisons and native keyboard focus after a trade and voyage.

The [40-seed simulation](../../tools/sim/results/trading-round2.txt) put the informed median at ¤563k and the greedy median at ¤75k. The informed lower tail fell from ¤295k to ¤216k at the 10th percentile. The maximum-borrowing policy won 23 of 40 matched seeds, with a paired median advantage of ¤37.8k. The bots omit consignments, so the simulation measures changes to salvage, credit and encounter sequencing within the normal trade loop. The human-style panel assesses the new jobs.

The initial Opus and Fable reviews hit a provider limit on nights 23 and 26. After the reset, fresh sessions of the same models and settings took over their original browser voyages and play transcripts. Neither interrupted attempt had submitted a score.

## Round 2 panel and Round 3 design

All three Round 2 judges settled their first voyages and checked another opening through night 10. Each scored independently, with no caps. The panel mean gained 1.66 points. Fable took freight jobs and still saw late capital sit idle. Astra and Opus found that choices improved when the relevant payout, interest or risk was shown before committing.

Round 3 puts Settle up and the exact projected score above the market rows. Repayment shows interest saved, and the map shows the current load's possible Gull toll. The trade sheet remembers its mode for the same good at the same mooring. Route cards distinguish proceeds from margin and show when the public fleet calendar schedules a buyer. High-capacity captains can stake more cash on one two-night heavy freight delivery late in a voyage.

## Round 3 verification

The frozen candidate is 267,386 bytes, SHA-256 `4b9fd917e9ab94a8ae9c9cdd015d9e4d34f91180f9d4b274c9fe982ab912539d`. All eight broad regression groups, 16 event fixtures, 30 focus/fleet/ledger checks and 10 trading fixtures passed. The latter verify the visible settlement preview and the larger freight bond, capacity, risk and save state. A separate quote fixture reproduced the route-card proceeds, toll disclosure and trade mode cases. The modal focus check initially found a covered disclosure at 360 px. Centering the control when needed resolved it in the final run.

## Round 3 panel and Round 4 design

Each judge settled a cold touch voyage and played another opening through night 10. No caps applied. The panel mean fell 0.59 points to 89.26. Economy and progression averaged 85.67. The judges identified missing buyers, quote drift, repeated encounters and a late economy concentrated in a few expensive goods. None exercised heavy freight in direct play.

Round 4 shows two routes when available and states how much cash the proposed load leaves for a leak or toll. Raw port quotes flag temporary surges. Route estimates label the boost when a scheduled fleet begins before arrival, and use the corresponding dealer depth. When regular dealers are absent, the player can keep the cargo or sell the whole stack locally at 60% of appraised value. New voyages get a late Saffron fleet call in place of one Dreamsilk call.

Arrival events avoid the last three results when other eligible events exist. Encounter options show escape damage, inspection rounding and the potential payoff for fighting.

## Round 4 verification

The frozen candidate is 272,410 bytes, SHA-256 `012cb10f88025f762235b1e087402d015a17793c839659006a747b7d24eef206`. All eight broad regression groups, 16 event fixtures, 30 focus/fleet/ledger checks and 14 trading fixtures passed. New fixtures verify route context and reserve math, the factor's exact payout after reload, the arrival cooldown and fleet estimate labeling. An older save keeps its established fleet cargo.

## Round 4 panel and Round 5 design

All three judges reached settlement on night 30 and played a contrasting opening through night 10. No caps applied. The mean rose to 89.58. The strongest disagreements were about the economy, from 80 to 90, and market intelligence, from 84 to 92. One judge reached ¤777,037. Another ended ¤58,634 in debt after one of their opening purchases was lost. The panel used a mix of personal decisions and supporting runs through visible controls.

Round 5 labels the fleet calendar in Market and keeps the next leg visible at a waypoint. A ¤180 report refreshes tonight's quotes at one remote port, once per night. Wider price scenarios and an exact break-even sale price clarify the risk of chasing dated quotes. Temporary gluts and surges are marked. Severely indebted captains can refinance at Lanternquay for a 10% fee added to their balance, 3% nightly interest and no further borrowing. The repair sheet lets players spend only what they choose. Fresh navigation taps and the current purse are available immediately after confirming a trade.

## Round 5 verification

The frozen candidate is 277,415 bytes, SHA-256 `426e0c8b6bb73453c40d544db862a82285b0ce8f79f9093fc81d3e58fc2c53b1`. It passed eight broad regression groups, 16 event fixtures, 30 focus/fleet/ledger checks and 17 trading fixtures. Added tests cover one-time refinancing and exact interest, fresh reports with the nightly limit intact after reload, and continued voyages and partial repairs. The automated drivers were adapted to confirm a repair under the new purchase flow. A separate 390×844 WebKit touch run reached settlement and checked the saved ledger.

On 40 matched market seeds, the informed policy's median fortune was ¤546k and the greedy policy's median was ¤74.2k. The informed policy reached settlement on all 40 seeds. The greedy policy sank twice. These policies skipped paid port reports and refinancing, so the figures check the existing loop. The trading fixtures exercise the new offers.

Fable and Opus hit their provider's usage limit on night 13 before submitting scores. The organizer preserved both exact voyage states and restarted each review after the reset with the same model and effort. Their continuation reports attribute the inherited play to the original attempts.

## Final result

Round 5's reported mean was 270.04 ÷ 3, about 90.0133, up 2.04 points from the baseline. No judge applied a cap. Fable and Opus each reported a pacing score of 90 and documented continuous decisions from night 13 onward. Their reports describe opening decisions but leave parts of nights 1–12 undocumented for the rubric's pacing requirement. Reducing either pacing score by one point would bring the mean to 89.98. The individual reports and scores are preserved as submitted.

The panel scored the HTML at commit `45afd42` with CRLF line endings. The LF Git blob has SHA-256 `e6faa27012f889e6415a26abe7462f47dd92244de95a875c28f56b09a54250a5`. To reproduce the scored bytes, read `45afd42:game/index.html` from Git and convert each LF to CRLF before hashing. The rubric uses LF, and its committed bytes match the panel digest. Repository attributes now pin these checkout conventions. The PR review fixes are subsequent to the scored build and have their own regression checks.

| Criterion | Mean out of 100 | Judge range |
|---|---:|---:|
| Trade and cargo decisions | 91.00 | 88–95 |
| Routes and market intelligence | 92.00 | 90–95 |
| Economy and progression | 86.33 | 80–91 |
| Risk, consequences and recovery | 90.67 | 89–93 |
| Run pacing and ending | 91.00 | 90–93 |
| Replay and adaptation | 90.33 | 89–92 |
| Onboarding and decision clarity | 90.00 | 88–92 |
| Input and accessibility | 88.33 | 85–90 |
| World, feedback and sound | 87.67 | 85–89 |
| Reliability and delivery | 94.00 | 92–96 |

Reliability and routes led the panel. Economy and progression scored lowest and had the widest spread. In particular, late cash could outgrow the available investments, and a profitable route under the displayed stress scenario could still lose money when a buyer disappeared or a market shock hit.

All three reviewers reached night 30 and completed contrasting openings through night 10. Fable and Opus resumed in their original live browser pages. Fable logged a helper mis-tap in its own run and one command that reached Opus's browser and toggled animation acceleration without taking an in-game action. Both reports retain their original scores. The panel used emulated touch and instrumented audio checks, with personal choices, scripted turns, and fixtures identified in the reports.
