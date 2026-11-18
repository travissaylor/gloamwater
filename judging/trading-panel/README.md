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
