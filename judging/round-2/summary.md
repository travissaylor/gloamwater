# Council round 2

- **Build:** commit `5c16122` (game/index.html sha256 `a9daab6a…62e6`; see BUILD.txt)
- **Judges:** three fresh judges on Claude Fable 5.2 (`claude-fable-5-2`), one per lens, blind to the target, to round 1 and to
  the change history. Same packet and judging sheet as round 1, pointed at the new build.
- **Phone first:** iPhone 13 profile in Playwright WebKit with touch (390×664 visible), plus 360×640, iPhone 14 Pro Max and desktop 1280.

## Panel score: 80.7 / 100 (round 1: 81.1)

| Judge | Lens | Total | Caps |
|---|---|---|---|
| 1 | Game design | 80.2 | none |
| 2 | Visual and interaction | 79.0 | none |
| 3 | Technical | 83.0 | none |

| Criterion | R2 scores | R1 | Criterion | R2 scores | R1 | Criterion | R2 scores | R1 |
|---|---|---|---|---|---|---|---|---|
| A1 Trade decisions | 8, 8, 8 | 8, 8, 8 | B1 Art direction | 8, 8, 8 | 7, 8, 8 | C1 Requirements | 9, 9, 9 | 9, 9, 10 |
| A2 Economy balance | 8, 7, 8 | 7, 7, 8 | B2 Trading UI | 8, 8, 8 | 8, 8, 8 | C2 Hard constraints | 9, 9, 10 | 9, 9, 10 |
| A3 Risk and events | 8, 8, 8 | 7, 8, 7 | B3 Feedback, audio | 8, 8, 8 | 8, 8, 8 | C3 Stability | 7, 7, 9 | 9, 8, 9 |
| A4 Pacing and arc | 7, 8, 8 | 7, 8, 8 | B4 Map and travel | 8, 8, 8 | 8, 8, 8 | C4 State integrity | 9, 8, 9 | 8, 8, 8 |
| A5 Legibility | 8, 8, 8 | 8, 8, 8 | B5 Responsive, input | 8, 7, 8 | 8, 9, 9 | C5 Code quality | 7, 8, 8 | 7, 8, 8 |

**Up:** A2 (debt, encounters, no dominant opening), A3 (encounters with stated odds and stakes), B1 (portraits), C4.
**Down:** C3 (an uncaught `ReferenceError` from a key press in the trade sheet of a good with no dealers; WebKit swallowing the
first tap after typing a quantity), B5 (the map collapses to a tiny strip above an open destination card on a 390×664 phone).

## What held it back (two or three judges)

- **Late game still flattens:** after about night 18 one loop (Saint Mire ↔ Orchid Terraces Moon Ink) carries most voyages;
  cash outgrows market depth and idles in the vault; hold tiers 3–5 stop mattering; charters lack a visible payback.
- **Phone map with a destination card open** shrinks to about 120px wide on a 390×664 screen (27px nodes, 6px labels).
- **Phone market list** shows only 2–4 of 8 goods; rows are tall and bulletins sit above them; tags still truncate.
- **Input:** the first tap on Buy after typing a quantity is swallowed in WebKit (the input's blur re-render); a fast second tap
  can still reach the nav or cancel an upgrade's confirm card; a `ReferenceError` (`qin` before initialization) on a key press
  in a no-dealers trade sheet.
- **Advice that misleads:** stale margins on map badges, "Wanted" tags read as price signals, default buy and sell sizes run
  past the flat depth.
- **Luck:** "No dealers today" rolled on arrival and invisible beforehand; shocks decide more of the score than routing.

The panel score did not improve on round 1 (−0.4). Gains in game design and art were offset by new phone-input defects
introduced while fixing the round-1 findings.
