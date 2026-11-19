# Gloamwater — Thirty Nights on the Drowned Canals

**Concept.** Trade eight goods across seven canal districts in the *Little Lantern*. You owe Marrow Quill ¤6,000,
due by night 10, and have thirty nights to get rich. Open `game/index.html` offline: no dependencies or network requests.

## How to play
- **Trade.** Tap a good to open the trade sheet (buy or sell, quantity, totals, a 14-night chart). Each row compares tonight's
  price with that good's usual price across the city: **green** is cheap (a buy), **amber** is dear (a sale). Tags name where
  it recently sold for more. The comparison strip opens a buy quote or a route for cargo you already hold; prices can change.
- **First trade.** Night 1 records all 56 port quotes. Later, visit, pay ¤180 in Port details for one report a night, or fit wireless.
  Default buys keep 15% of cash aside within flat depth; Max deliberately uses the full legal order size and price impact.
- **Market depth.** Dealers trade a few units at the posted price; past that each unit costs more (or fetches less) and the
  price takes a night or two to recover. The sheet shows order impact, cash left for repairs and tolls, and a factor offer if dealers are absent.
- **Canals.** Sail along a canal for one night. Lanternquay joins every district; the others sit on a ring, so a district with
  no direct canal is two nights via a waypoint. Tap your own district to stay a night in port. Tap during a voyage to skip it.
- **Shocks.** Surges and gluts last two nights, weaker on the second. You hear of them where you are, by rumour, always with the
  wireless set, or a night early from Madame Ysolde or Pell the lamplighter.
- **Fleet calls.** The market's Fleet calendar shows upcoming calls. Every four nights a new port buys a named good:
  40% extra demand and twice the depth. The order varies per voyage. Prices can drift and the boost ends after the closing night.
  Route comparisons stress-test lower prices. The trade sheet shows the break-even sale price. Surge and glut quotes are marked.
- **Money.** Repay at Lanternquay: 6% nightly, 10% after night 10. Collectors pursue overdue debt or debt over ¤12,000.
  The vault pays 1.5% nightly. If you are deeply in the red, ask Marrow to revise the loan at Lanternquay for a fee and give up further credit.
- **Upgrades.** Copperhook Docks: hold, engines, repairs. Saint Mire (or Fogmouth, dearer): weapons. Drowned Exchange: a wireless
  set. The Sluices: cheap patches. Any district: a **trading charter** that makes its dealers trade twice as deep with you.
- **Survive.** Encounter offers quote cash, cargo, hull damage and debt credit. A won fight buys three quieter nights.
  Badly damaged skiffs get a repair route. With almost no funds and an empty hold, work one night for ¤350 once per voyage.
- **Freight.** Compare jobs from night 15. Heavy freight once per run uses 65 hold slots and a ¤50k stake. Late or seized deliveries forfeit the bond.
- **Gulls and leaks.** Recover a stolen bag at 70% odds or accept the cash loss. Patch a threatened cargo stack or jettison it.
  Costs and failure stakes are explicit; offers do not consume dice or resources until answered and survive reload unchanged.
- **Finish.** On night 30, settle up. Score = cash + vault + cargo at half its sale value − debt. Seven ranks up to Sovereign of
  Gloamwater (¤850k); the Captains' Ledger is saved in localStorage.
- **Phone.** The bottom bar holds Market, Map, Harbor, Log and More (menu, help, ambience). Tap any HUD figure to explain it.
  **Keyboard.** 1–7 pick a district, Enter sails, arrows pick a good, B/S trade, ←/→ quantity, M mutes, ? help, Esc menu.

## Design decisions
- **Phone first.** All seven map ports remain available; full details open separately. Optional trade charts and port quotes fold away.
  Notices reserve space below the HUD; teaching tips persist in Log. Reading text, modal focus, reduced motion and control gaps are supported.
- **Rumours are not certainties.** Tomorrow's shocks are queued a night ahead with a fixed fate: they land in full, land weak,
  or **turn** (everyone heard, and the opposite happened). A whisper only reveals what is queued; it never creates or changes one.
  Ysolde sells one a night for ¤300 + 1.5% of purse, vault and cargo, and says how sure she is before you pay.
- **Bounded late game.** Prices respond to order size (integrated, so no split or round trip pays); the tally uses that sale value.
  Fleet calls rotate opportunities. Charters show tonight's exact held-load proceeds change and approximate payback loads.
- **No reload tricks.** Outcomes are committed before they are shown; a reload resumes the same fight. Dice come from two seeded
  streams in the save (one for the market, one for events). Saved data is validated; damaged saves are discarded with a message.
- **Economy checks.** `tools/sim` drives the real file; bots use public information. A diagnostic 80-seed sample found:
  - **Competent bot:** median ¤606k; naive greedy bot ¤55k. Late sale revenue: silk 38%, ink 26%, chips 15%, eels 12%.
  - **Whispers:** spam wins 13/80; 65.5% of acted whispers lose including fees. Careful use: whole-run mean +¤28k, median −¤4.8k.
  - **Combat (40 seeds):** weapon-rush always-fight sank 18/40; conditional and never-fight 0/40. Route and spending policies confound comparisons.
  - **Exploit probes:** 23,735 buy/sell round trips, none profitable; 23,576 numerical invariant checks passed.
  This small sample is a regression check, not exhaustive balance proof. Earlier larger runs also tested reloads and final tally inflation.

## Testing done
- `node tools/verify.cjs` records phone input/layout checks, keyboard focus, file://, sandbox, corrupt storage and automated full games.
  Touch and keyboard completion runners record native inputs, source hashes, settlement, ledger reload and emulation limits.
- `tools/event-check.cjs` verifies event offers, both outcomes, reload commitment and resource conservation with explicit fixtures.

## Known issues
- No real iPhone was available. Double-tap zoom, rubber-banding, safe-area insets and the silent switch are handled in CSS
  and code but were only verified in emulation.
