# Four-round Gloamwater continuation

**Stopped at the requested four-round limit. The target of 90/100 was not reached.**
The best panel scored **87.67**; the final panel scored **83.53**.

| New round | Repository round | Opus 5.5 high | GPT-6.1 Sol xhigh | GPT-6 Astra high | Panel mean |
|---|---|---:|---:|---:|---:|
| 1 | [3](round-3/summary.md) | 85.2 | 83.5 | 83.0 | 83.90 |
| 2 | [4](round-4/summary.md) | 81.3 | 83.5 | 84.1 | 82.97 |
| 3 | [5](round-5/summary.md) | 86.6 | 86.1 | 90.3 | 87.67 |
| 4 | [6](round-6/summary.md) | 83.4 | 84.0 | 83.2 | 83.53 |

The earlier thread's criteria were recovered from its record and this repository.
The same 15-criterion rubric and weights were retained: game design 36%, visual
and interaction design 36%, technical quality 28%. Each new round used three fresh,
independent judges with the requested models and settings. Each judge scored all
criteria, phone first, with evidence for high scores and explicit coverage limits.
They were blind to the target, prior scores and change history. All totals were
recalculated, and every report and packet is retained. No caps or model substitutions
were reported. The older Fable panels are historical context, not a controlled
comparison with this panel composition.

Implementation and verification work ran in parallel with separate file ownership.
Games were frozen for review. From round 4 onward, helper sources were frozen too;
round 3's shared simulator changed during one review, so its simulation figures
remain indicative, as recorded in that round. Later game/rubric/helper hashes passed.

The current [game](../game/index.html) is the final judged candidate, 253,094 bytes,
SHA-256 `a1273a762e4284d5bc323895b5a14d99cf2603e337c4f9e8fed689cf80521a03`.
The [best-scoring packet](round-5/packet/index.html) is preserved separately. The
latest game's score is 83.53; the earlier 87.67 is not attributed to it.

## Changes delivered

- Trading now exposes dated observations and usable routes. The opening circular,
  reserve-aware default buys, integrated price impact, public fleet calendar and
  charter payback information support planning without guaranteed arrival profits.
- Phone play has a spatial map with reachable ports and district landmarks, wrapped
  route quotes, readable text, optional trade details and notices that reserve space.
  Typed quantities confirm on the first tap; final-night actions remain reachable.
- Modals keep focus and make the covered game inert. Title focus, reduced motion,
  damaged-save feedback, fleet wording and ending statistics received corrections.
- Gulls and leaks offer explicit choices, with deterministic offers and committed
  outcomes across reload. Whisper limits, pricing and uncertain information remain
  covered by paired simulations and round-trip probes.
- A freight-license prototype was rejected because it enlarged trades without
  adding useful variety. A [combat audit](../tools/combat-audit.md) did not support
  harsher blanket combat penalties: always fighting sank 18/40 runs, while a
  nonfight strategy stayed competitive. These findings do not resolve loss-event fairness.

## Verification and its limits

The final candidate passed all [eight regression groups](../tools/verification-round6-final/report.json)
and [16 event fixtures](../tools/event-evidence-round6-final/report.json).
All three final judges completed personal 30-night touch games and verified their
ledger entries after reload. Their reports include supporting native keyboard,
policy-driven touch, function-driven completion and exploit checks. These are
different methods, not interchangeable claims of human play.

Normal-speed diagnostic evidence is separate from accelerated completion tests.
WebKit on Windows emulates a phone; it does not establish physical iPhone behavior.
Audio contexts and mute were checked, but audible quality was not judged. Coverage
of screen readers, landscape, every branch and every exploit remains incomplete.
Passing the recorded regression suite did not detect every defect found in personal play.

## What still blocks a higher score

1. **Underquoted cargo tolls.** `shortSub` quotes the cash shortfall, while `payInKind`
   seizes whole cargo units until their usual value covers it. One Dreamsilk can be
   taken for a much smaller quoted toll. The final game-design judge documented
   this during actual play; source inspection confirms the mismatch.
2. **Recovery and pacing.** An unaffordable leak can remove an entire expensive
   one-unit stack. Repeated events, no-dealer arrivals, seed variance and losing
   runs with little capital make stretches of the game feel arbitrary or thin.
   Wireless remains a dominant route to informed late play; debt fades in successful runs.
3. **Credit and quote disclosures.** Borrowed cash supports repeated credit up to
   the fixed cap, contrary to the stated collateral rule. Borrowing needs clearer
   late-rate/collector warnings. The best-sale warning filters quotes to two nights
   without making that restriction explicit beside older listed observations.
4. **Quantity display.** Huge typed quantities remain in the input while totals
   and the transaction button safely use the legal amount. No unbounded-money
   exploit was observed, but the conflicting numbers are confusing.

These findings remain in the scored build. The four-round limit ended the iteration;
no fifth panel or post-score game changes were made. Work is committed on
`t3/raise-gloamwater-panel-score`.
