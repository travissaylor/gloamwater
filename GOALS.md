# Gloamwater: road to 95

## Current continuation (2026-11-14)

The owner's latest instruction supersedes the original target, model selection, branch,
and plateau stop below: reach **90.0**, or stop after **four new council rounds**
(rounds 3–6). Use fresh Opus 5.5 high, GPT-6.1 Sol xhigh, and GPT-6 Astra high
judges each round. Keep the frozen rubric, independent evidence, and blind judging rules.
Work on the current `t3/raise-gloamwater-panel-score` branch; commit each round and do not push.
The original brief and historical results follow for context.

Current progress: round 3 scored **83.9**. Round 4 has Sol **83.5** and Astra **84.1**;
its Opus judgment is still pending. Do not re-roll either round. The next candidate has
opening quotes, event choices, readable phone text and distinct district landmarks.
Its general regressions and normal-speed diagnostic pass. After recording round 4,
freeze and judge rounds 5 and, if still needed, 6. Helpers are frozen with each new packet.

Gloamwater won the bake-off with a panel score of 87.0 out of 100. This file is the
standing brief for taking it further. Re-read it whenever context is compacted.

## The target

**A council round with a panel score of 95.0 or higher** (a 9.5 average on the
[rubric](RUBRIC.md)): the mean of three judges' weighted totals, judged phone-first.

## Three priorities, in order

1. **Phone is the main interface.** The owner plays on an iPhone. Design for a thumb on a
   390pt-wide touch screen first; desktop is the secondary layout.
2. **Close the whisper loophole** (below). No strategy may be a sure win.
3. **Raise every criterion that sits under 9.5**, starting with the bake-off findings.

[BRIEF.md](BRIEF.md) still applies in full, including the hard constraints: one
self-contained `game/index.html`, vanilla, no network, runs from `file://` and inside a
sandboxed iframe, guarded `localStorage`, under 1 MB.

## The whisper loophole

Reported by the owner from play: late in a run you can buy whispers without limit and
always have a way to make a lot of money.

How it works today in `game/index.html`:

- Madame Ysolde's Salon at Orchid Terraces sells a whisper for `250 + 25 × day` (`rumorCost`).
- There is no limit per visit or per night, and the price ignores the player's wealth.
- Each purchase calls `leakPending()`. It reveals a queued shock. **If none is queued it
  creates a new one**: a guaranteed spike (2.2 to 3.4×) or crash for tomorrow.
- So a rich player manufactures certain price shocks on demand for pocket change.

What "fixed" means:

- A whisper never creates a market event. It can only reveal what the market already holds.
- Whispers are scarce, their price matters at every stage of a run, and acting on one
  carries real risk (for example partial or sometimes wrong information). The design is yours.
- Ysolde stays worth visiting. A dead service is not a fix.
- **Acceptance test, by simulation:** a bot that buys every whisper it can and acts on each
  one must not beat the same bot without whispers reliably, and must lose money on a real
  share of the whispers it acts on. Record the numbers in `NOTES.md`.
- Hunt for the same class of exploit elsewhere (any way to buy certainty or unbounded
  money), and fix what you find.

## Phone-first requirements

- Primary device: iPhone, Safari, portrait, 390×844. Also check 360×640 and 430×932.
- Every action reachable with one thumb. Primary actions sit in the lower half of the screen.
- Touch targets 44px or larger with spacing between them. Nothing depends on hover.
- Respect safe-area insets (notch, home indicator) and the collapsing browser toolbar
  (`dvh`, not `vh`).
- No accidental zoom: no double-tap zoom on buttons, inputs at 16px or larger.
- No horizontal scroll, no clipped content, no toast or sheet covering the control it refers to.
- Audio unlocks on the first touch, as iOS requires.
- Fast repeat play: travel and night animations can be skipped or shortened with a tap.
- Readable outdoors: text contrast 4.5:1 or better, body text 15px or larger.

## Findings from the bake-off judges

Scores for Gloamwater (entry C) are in `judging/bakeoff/`. Per criterion, the three judges gave:

| Criterion | Scores | Criterion | Scores | Criterion | Scores |
|---|---|---|---|---|---|
| A1 Trade decisions | 9, 9, 9 | B1 Art direction | 9, 9, 9 | C1 Requirements | 10, 9, 10 |
| A2 Economy balance | 8, 8, 8 | B2 Trading UI | 9, 9, 9 | C2 Hard constraints | 9, 8, 10 |
| A3 Risk and events | 9, 8, 9 | B3 Feedback, audio | 9, 9, 9 | C3 Stability | 9, 8, 8 |
| A4 Pacing and arc | 8, 8, 8 | B4 Map and travel | 9, 9, 9 | C4 State integrity | 8, 7, 7 |
| A5 Legibility | 9, 9, 9 | B5 Responsive, input | 8, 9, 9 | C5 Code quality | 8, 8, 8 |

What they flagged:

- **Economy runs away late.** 45,917 on night 18 became 2.89M by night 30; one sale made 870,390.
  The first 18 nights barely count. Results swing from debtor to millionaire on the same policy.
- **Price signals mislead.** Row sparklines and arrows show change since yesterday, coloured red
  for falling, which reads as bad when a falling price is the buy signal. Nothing at the home
  port is tagged Cheap on night 1.
- **Toasts cover content**: the trade-sheet title, Net Worth, encounter art, the end-screen emblem.
  Worst at 390px.
- **Travel is slow on repeat**: about 3 seconds per voyage, no skip.
- **Corrupt saved data crashes** the ledger dialog, Continue voyage and the end screen.
- **Dev hooks ship in the game** (`#sim`, `#auto`, `#autoslow`, `#shot=`) and write to the real
  high-score table. Move simulation tooling out of the shipped file.

## The council

Each round, three fresh judges score the current build. The process exists to produce an
honest number, so these rules are fixed:

- **Fresh judges every round**, one per lens in [RUBRIC.md](RUBRIC.md) (game design, visual and
  interaction, technical). Each scores all 15 criteria and plays the game for real through the
  browser harness in [tools/](tools/README.md).
- **Judges are blind to the goal.** Never tell a judge the target score, earlier scores, what
  changed, or what you hope to hear. Give them `BRIEF.md`, `RUBRIC.md`, a copy of the game and
  `NOTES.md`, the harness instructions and the phone-first rule below.
- **Phone-first judging.** Judges play at 390×844 with touch first and score every criterion from
  that experience, then check desktop at 1280 wide. A failure at phone width counts in full.
- **Evidence or it does not count.** A score of 9 or 10 must cite what the judge did and saw.
  Each judge lists the specific things that keep each criterion below 10.
- **The rubric is frozen.** Do not edit criteria, weights, anchors or caps.
- **Every round is recorded** in `judging/round-N/` (one JSON per judge plus a short summary),
  including rounds that scored worse. No re-rolling a round to get a better number.
- **Same model as the bake-off panel where possible.** The bake-off judges ran on Claude Fable 5.2.
  If your subagent tool can select it, use it for judges. Record which model judged each round.
- **Done** means one recorded round at 95.0 or higher. If three rounds in a row fail to improve
  the panel score, stop and report the plateau and what blocks it. Do not soften the judges.

## Working rules

- Work on branch `gloamwater-next`. Commit after each round. Do not push.
- Update `NOTES.md` as the design changes.
- The old `opus-5-5` branch and its worktree are the bake-off snapshot. Leave them alone.
