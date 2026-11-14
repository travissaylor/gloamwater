# Judging rubric

Three judges score every entry on all 15 criteria, each 1 to 10. Weights sum to 100.
An entry's score from one judge is the weighted sum (out of 100). The panel score is
the mean of the three judges. Each judge leads on one lens and writes the deeper notes there.

The rubric was drafted by the three judges from the brief before any entry was finished.
Builders never saw it.

## Lens A: game design (36) — led by Judge 1, lead game designer

| # | Criterion | Weight | What it measures |
|---|---|---|---|
| A1 | Meaningful trade decisions | 10 | Each turn poses a real choice among goods, routes, capacity and cash, not one obvious move. |
| A2 | Economy balance | 9 | Debt, bank, prices and upgrades stay in tension with no dominant or degenerate strategy. |
| A3 | Risk and events | 6 | Events and encounters create real stakes, informed choices and proportionate outcomes. |
| A4 | Pacing and arc | 6 | A run has a shape (scrappy start, growth, endgame push) and a sensible length. |
| A5 | Decision legibility and onboarding | 5 | A new player can see what they need to decide well, and understands why they won or lost. |

Anchors:
- **A1** 2: prices are noise, any purchase works. 5: one readable arbitrage repeated all game. 8: location price identities plus spikes force route and cargo trade-offs most turns. 10: several viable strategies; the best move changes with state.
- **A2** 2: infinite-money exploit, or unwinnable. 5: winnable, but debt or bank is irrelevant, or one good dominates. 8: debt pressure is real early, upgrades pay back at a cost, no single loop wins. 10: holds up under deliberate exploit attempts; scores spread with skill.
- **A3** 2: events are cosmetic or end the run arbitrarily. 5: events move numbers, but the encounter has one always-correct option. 8: each encounter option has distinct odds and stakes; upgrades or state change the calculation. 10: events reshape plans and outcomes feel earned.
- **A4** 2: flat or grindy; days are interchangeable. 5: growth is visible, but the middle drags or the ending is abrupt. 8: clear early, mid and late phases; upgrades and debt payoff land as milestones; final days are tense. 10: the player wants another run immediately.
- **A5** 2: cannot tell whether a price is good; debt and day costs hidden. 5: basics learnable by trial; score is a bare number. 8: price context, profit per trade, debt growth and days left are visible when deciding; score breakdown explains the result. 10: the first three turns teach the loop unprompted.

## Lens B: visual and interaction design (36) — led by Judge 2, art director and UX designer

| # | Criterion | Weight | What it measures |
|---|---|---|---|
| B1 | Art direction cohesion | 7 | Palette, type, iconography, illustration and copy form one deliberate identity that fits the theme. |
| B2 | Trading UI legibility | 9 | How fast a player can read state (cash, debt, day, capacity) and find a good trade. |
| B3 | Feedback and audio | 8 | Quality of animated and sonic response to buying, selling, travelling, events, winning and losing. |
| B4 | Map and travel | 5 | The map is a real spatial, interactive object, not a styled list. |
| B5 | Responsive, input, accessibility | 7 | Playable at phone and desktop widths with mouse, touch and keyboard, with adequate contrast and motion handling. |

Anchors:
- **B1** 2: default-looking page; theme exists only in text. 5: consistent palette and type, but a generic dark dashboard; emoji or stock shapes as art. 8: distinct look with custom inline art for goods, places and characters; title, play and end screens match. 10: identifiable from one cropped screenshot; every surface feels authored.
- **B2** 2: undifferentiated wall of numbers; no trend information. 5: all data present, trend arrows only; key stats need hunting. 8: clear hierarchy; sparklines or charts per good; cheap/dear and owned-cost versus price visible. 10: best trade spottable in under 5 seconds; spikes and crashes flagged.
- **B3** 2: state changes silently and instantly; audio missing or broken. 5: some transitions and a few beeps; several actions have no response. 8: every action has distinct, well-timed visual and sound feedback; mute works. 10: layered, theme-fitting sound; number tweens, travel animation, event staging; never slows repeat play.
- **B4** 2: list or grid of buttons. 5: static picture with clickable nodes; no current-location or route feedback. 8: illustrated geography, clear "you are here", hover/focus states, animated travel. 10: the map carries information (cost, risk, price hints) and is a pleasure to use.
- **B5** 2: broken at 390px, or mouse-only. 5: both widths work, but with horizontal scroll, tiny targets or partial keyboard support. 8: purpose-built layouts at each width; targets 44px or larger; visible focus; full keyboard play. 10: also honours `prefers-reduced-motion`, 4.5:1 text contrast, shortcut hints.

## Lens C: technical quality (28) — led by Judge 3, technical director and QA lead

| # | Criterion | Weight | What it measures |
|---|---|---|---|
| C1 | Requirement coverage | 8 | How many of the brief's 10 gameplay and 5 presentation requirements are present and actually work. |
| C2 | Hard-constraint compliance | 5 | Single file, vanilla, no network, runs from file:// and in a sandboxed iframe, guarded storage, under 1 MB. |
| C3 | Stability and soft-locks | 7 | A full game completes without errors, dead ends or stuck UI. |
| C4 | State integrity | 5 | The economy and persistence stay numerically correct and exploit-free. |
| C5 | Code quality and performance | 3 | The source is structured and maintainable, and runs smoothly. |

Anchors:
- **C1** 2: five or more requirements missing or non-functional. 5: two or three missing or stubbed. 8: all present and working; one meets only the bare minimum. 10: all 15 verified working, several minimums clearly exceeded.
- **C2** 2: makes a network request or needs a second file. 5: runs offline, but one constraint is broken. 8: all met; one minor lapse. 10: all met and verified by both grep and runtime test.
- **C3** 2: throws or soft-locks in normal play; cannot reach the ending. 5: completable, but with console errors or a reproducible stuck state. 8: clean console across a full game; only cosmetic glitches under abuse. 10: clean across two full games plus abuse testing.
- **C4** 2: negative cash, over-capacity inventory or NaN reachable in normal play. 5: invariants hold normally but break on edge input. 8: invariants hold under edge input; interest and score breakdown sum correctly. 10: also no infinite-money loop; high scores survive reload and tolerate corrupt stored data.
- **C5** 2: tangled globals, copy-pasted logic, visible jank. 5: readable, but state mutated from everywhere; magic numbers scattered. 8: data tables separate from logic, single state object, smooth animation. 10: also isolated RNG, no leaked timers or listeners.

## Score caps (red flags)

| Flag | Cap |
|---|---|
| A run cannot reach the score screen, or soft-locks | A1 to A5 at 3; C3 at 3; C1 at 5 |
| Trivial unbounded-money exploit | A2 at 3; A1 at 5 |
| A required system (debt, bank, upgrades, risky encounter) is missing or has no effect | The relevant criterion at 4 |
| A core action is unreachable or clipped at 390px | B5 at 3 |
| No working audio, or no mute toggle | B3 at 4 |
| Map is a list, or there is no price-trend visual | B4 or B2 at 3 |
| Throws on load, or a game cannot start from file:// | C1 and C3 at 2 |
| Any network request or external resource | C2 at 2 |
