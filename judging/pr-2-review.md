# PR #2 review and follow-up

Three independent code reviewers examined head `769fe3ea2e7b6685e446387563237580a8d596ca`
against base `3d5fcd5acffc88f982c8af38f51fd5094040961f`. Opus 5.5 high covered
gameplay/economy, GPT-6.1 Sol xhigh covered phone interaction/accessibility, and
GPT-6 Astra high covered state integrity and verification. Reviewers left the
repository and GitHub unchanged. The parent reproduced and resolved four findings.

## Resolved findings

- **P2: Notice expiry lost map focus.** A responsive SVG rebuild discarded a
  focused district. Enter then used the old selection and could start the wrong
  voyage. Rebuilds now restore the district or dock action that held keyboard focus.
- **P2: Modal Tab focused offscreen controls.** The focus trap suppressed native
  scrolling. It now scrolls each newly focused control into view, including WebKit
  disclosure summaries after reading a long quote section.
- **P2: Empty ledgers passed persistence checks.** The runner compared equal
  snapshots without proving either contained the result. Touch and keyboard
  runners now require the completed captain, fortune, night and sinking status
  before and after reload. This fixes a test false positive, not a demonstrated
  shipped-game save failure.
- **P3: Fleet hints advertised unreachable closing calls.** The fallback now
  considers travel time and can show the next call with its opening night. A
  selected phone destination also warns when the current call closes before arrival.
  The map's current-night fleet badge remains a statement of tonight's activity.

## Open balance concern

The economy reviewer identified a strong same-port trade before a fleet call opens.
The public demand multiplier switches on at a known time, with guaranteed dealers
and increased depth during the call. Isolated market fixtures reproduced the price
advantage on rain and eels. These fixtures inject capital and capacity, skip actual
mooring events, and do not include financing costs in the reported trade return.
Staying in port can still generate arrival events. This establishes a predictable
timing opportunity, not a complete risk-free strategy or unbounded-money exploit.
Fleet pricing was left unchanged; deciding whether to smooth that premium needs
broader balance work. The concern is disclosed in the PR.

## Verification

`node tools/pr-check.cjs --out tools/pr-check-evidence` passed all 30 focused checks.
It exercises native focus after real notice expiry in both engines at three phone
sizes, modal focus at those sizes and two desktop heights, reachable fleet hints,
and ledger success/failure fixtures for both runners. Ledger fixtures reject
missing writes, stale unrelated entries, wrong scores and entries lost on reload.
These are targeted state/storage fixtures, not full-game or balance claims.

[Before-change evidence and the final focused report](../tools/pr-check-evidence/)
are retained. The first focused attempt exposed an additional WebKit summary-scroll
case and a fleet-test animation-frame race; both were corrected before the final pass.
The ordinary [regression report](../tools/verification-pr2-final/report.json) and
[event-fixture report](../tools/event-evidence-pr2-final/report.json) cover the final source.

The current game SHA-256 is
`514fe0fba64b5fab2cb80c2909198befb7cb1685010bba98a514f4d01c1a3745`.
Physical iPhone behavior and audible quality remain unverified. No fifth council
panel was run; the four retained panel scores apply only to their frozen packets.
