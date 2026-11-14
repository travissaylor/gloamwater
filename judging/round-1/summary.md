# Council round 1

- **Build:** commit `da7c13b` (game/index.html sha256 `b9864046…e148`; see BUILD.txt)
- **Judges:** three fresh judges on Claude Fable 5.2 (`claude-fable-5-2`), one per lens, blind to the target, to earlier scores and to the change history. Packet: BRIEF.md, RUBRIC.md, NOTES.md, the game, the harness docs and a judging sheet with the phone-first rule.
- **Phone first:** iPhone 13 profile in Playwright WebKit with touch (390×664 visible), plus 360×640, iPhone 14 Pro Max and desktop 1280.

## Panel score: 81.1 / 100

| Judge | Lens | Total | Caps |
|---|---|---|---|
| 1 | Game design | 78.9 | none |
| 2 | Visual and interaction | 81.1 | none |
| 3 | Technical | 83.4 | none |

| Criterion | Scores | Criterion | Scores | Criterion | Scores |
|---|---|---|---|---|---|
| A1 Trade decisions | 8, 8, 8 | B1 Art direction | 7, 8, 8 | C1 Requirements | 9, 9, 10 |
| A2 Economy balance | 7, 7, 8 | B2 Trading UI | 8, 8, 8 | C2 Hard constraints | 9, 9, 10 |
| A3 Risk and events | 7, 8, 7 | B3 Feedback, audio | 8, 8, 8 | C3 Stability | 9, 8, 9 |
| A4 Pacing and arc | 7, 8, 8 | B4 Map and travel | 8, 8, 8 | C4 State integrity | 8, 8, 8 |
| A5 Legibility | 8, 8, 8 | B5 Responsive, input | 8, 9, 9 | C5 Code quality | 7, 8, 8 |

This panel is stricter than the bake-off panel (phone-first, evidence required for every 9 or 10), so the number is not
directly comparable with the bake-off's 87.0.

## What held it back (common to two or three judges)

- **Encounters:** bribes and tolls follow the purse, not the cargo, so a fully invested captain pays a few hundred crowns;
  fighting is never worth it; paying the collectors is always right; squall and crate hide their odds.
- **Geography:** every district is one night from every other, so the canals are decoration; no way to wait a night.
- **Late game:** market depth caps deployable capital, so wealth idles in the vault and growth flattens; hold tiers 3–5 are
  traps; debt pressure is weak; no visible next-rank goal.
- **Trade sheet:** defaults to Max even when slippage makes that a losing order.
- **Phone market list:** no sparklines, only 4.5 rows visible, tags clipped without ellipsis, small text (11–13px labels).
- **Map card** covers most of the map on phone; **toasts** sit over the lower rows and nodes for a few seconds.
- **Bugs:** `+Infinity%` on free cargo; wrong average cost after a partial sell-back; tour text "(or press )."; festival
  bulletin says it lasts into tomorrow; boatyard hold figures ignore Fenna's racks; HUD stale under event cards; captain name
  and saved log text not escaped; second tap falls through to the nav; validation gaps on hand-edited saves.
- **Art:** no character portraits; repetitive event art. **Audio:** effects only, no ambient bed; mute two taps deep.
- **Code:** unseeded `Math.random`, inline encounter constants, very dense lines.
