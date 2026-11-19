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

All three settled a cold touch run on night 30, with varying use of scripts to drive visible controls. All replayed the opening through night 10. No judge applied a cap. The largest disagreement was on economy and progression, which ranged from 76 to 92. Closing fortunes ranged from a ¤2,752 deficit to ¤436,943. The difference reflects individual routes, seeds, choices and judgments.

Round 1 targets findings shared across the panel. Give a badly depleted captain a paid dock shift and show exact payment terms. Make route recommendations account for quote age, buyer availability and expiring demand. Vary the public fleet calendar by voyage, within early and late cargo groups. Point damaged ships to repairs and fix keyboard focus in the map, tour and trade sheet. Keep larger changes to investment balance and the late-game arc open for the next panel's evidence.

## Round 1 verification

The candidate is 258,584 bytes, SHA-256 `8156027f5c8d0896978686a5ea3c49a9c37175e761c659cc12effd20ba35883d`. Seven broad regression groups passed. The sandbox group initially assumed which fleet call was active on night 21. It passed after the fixture selected the active call from the public calendar. All 16 event fixtures, 30 focus, fleet and ledger checks, and six new targeted checks passed on the same build.

The [40-seed repeat](../../tools/sim/results/trading-round1.txt) put the informed median at ¤594k, against ¤606k in the baseline. Its 10th percentile rose from ¤164k to ¤295k. Greedy median fortune fell from ¤67k to ¤53k, and one of its 40 voyages sank. The simulator does not use the new dock shift. These figures measure the scripted policies under the two schedules. The panel tests how the new decisions feel in play.
