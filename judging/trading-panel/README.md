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
