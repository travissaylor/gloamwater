# Gloamwater — Thirty Nights on the Drowned Canals

**Concept.** The sea took the lower city forty years ago. You run a battered skiff, the *Little Lantern*, between seven
canal districts of a lantern-lit drowned city, trading Glowkelp, Bottled Rain, Rust Pearls, Synth Saffron, Clockwork Eels,
Ghost Chips, Dreamsilk and Moon Ink. You owe the loan broker Marrow Quill ¤6,000 at 6% a night, due by night 10, and you
have thirty nights to get rich. Open `game/index.html` in a browser: no dependencies, no network requests.

## How to play
- **Trade.** Tap a good to open the trade sheet (buy or sell, quantity, totals, a 14-night chart). Each row compares tonight's
  price with that good's usual price across the city: **green** is cheap (a buy), **amber** is dear (a sale). Tags name where
  it recently sold for more. The comparison strip opens a buy quote or a route for cargo you already hold; prices can change.
- **Market depth.** Dealers trade a few units at the posted price; past that each unit costs more (or fetches less) and the
  price takes a night or two to recover. The sheet says how many are left at the posted price and warns before a losing order.
- **Canals.** Sail along a canal for one night. Lanternquay joins every district; the others sit on a ring, so a district with
  no direct canal is two nights via a waypoint. Tap your own district to stay a night in port. Tap during a voyage to skip it.
- **Shocks.** Surges and gluts last two nights, weaker on the second. You hear of them where you are, by rumour, always with the
  wireless set, or a night early from Madame Ysolde or Pell the lamplighter.
- **Fleet calls.** The market's wireless button opens the public calendar and bulletins. Every four nights a new port buys a named good:
  40% extra demand and twice the depth. Arrival prices still drift; missing the closing night loses the boost.
- **Money.** Repay Marrow at Lanternquay: 6% a night, 10% after night 10, and his collectors hunt you while you still owe after
  night 10 (or owe over ¤12,000). He lends only up to what you are worth. The Lockwater Vault pays 1.5% a night and can't be robbed.
- **Upgrades.** Copperhook Docks: hold, engines, repairs. Saint Mire (or Fogmouth, dearer): weapons. Drowned Exchange: a wireless
  set. The Sluices: cheap patches. Any district: a **trading charter** that makes its dealers trade twice as deep with you.
- **Survive.** Tidewardens, the Gull Gang and Marrow's collectors stop you mid-voyage: run, fight, bribe, pay, or be searched.
  Every option shows its odds or price, and the price follows your purse and cargo. A won fight buys three quieter nights.
- **Finish.** On night 30, settle up. Score = cash + vault + cargo at half its sale value − debt. Seven ranks up to Sovereign of
  Gloamwater (¤850k); the Captains' Ledger is saved in localStorage.
- **Phone.** The bottom bar holds Market, Map, Harbor, Log and More (menu, help, ambience). Tap any HUD figure to explain it.
  **Keyboard.** 1–7 pick a district, Enter sails, arrows pick a good, B/S trade, ←/→ quantity, M mutes, ? help, Esc menu.

## Design decisions
- **Phone first.** A compact map dock keeps all seven ports available; full details open separately. Market rows show destination
  names and observation age. Modal focus stays inside the sheet; reduced motion covers the SVG title and score count.
- **Rumours are not certainties.** Tomorrow's shocks are queued a night ahead with a fixed fate: they land in full, land weak,
  or **turn** (everyone heard, and the opposite happened). A whisper only reveals what is queued; it never creates or changes one.
  Ysolde sells one a night for ¤300 + 1.5% of purse, vault and cargo, and says how sure she is before you pay.
- **Bounded late game.** Prices respond to order size (integrated, so no split or round trip pays); the tally uses that sale value.
  Fleet calls rotate opportunities. Charters show tonight's exact held-load proceeds change and approximate payback loads.
- **No reload tricks.** Outcomes are committed before they are shown; a reload resumes the same fight. Dice come from two seeded
  streams in the save (one for the market, one for events). Saved data is validated; damaged saves are discarded with a message.
- **Characters.** Every service keeper and event host has an inline-SVG portrait; synthesized effects plus an optional ambient bed.
- **Economy checks.** `tools/sim` drives the real file; bots use public information. A diagnostic 80-seed sample found:
  - **Competent bot:** median ¤615k; naive greedy bot ¤51k. Late sale revenue: silk 38%, ink 27%, chips 14%, eels 12%.
  - **Whisper test:** spam beats the same bot without whispers on 2/80 seeds; 67% of acted whispers lose money including fees.
  - **Charters:** bought in 87.5% of competent runs; mean fortune +¤58.5k versus the same planner without charters.
  - **Exploit probes:** 24,305 buy/sell round trips, none profitable. No game errors, non-finite final scores or market RNG mismatches.
  This small sample is a regression check, not exhaustive balance proof. Earlier larger runs also tested reloads and final tally inflation.

## Testing done
- `node tools/verify.cjs` records phone input/layout checks, keyboard focus, file://, sandbox, corrupt storage and automated full games.
  `node tools/touch-play.cjs` drives actual UI taps and typed amounts. Its 30-night reference run repaid debt, bought upgrades,
  visited all seven ports and settled at ¤428,983; source hashes and emulation limits are recorded in its evidence report.

## Known issues
- No real iPhone was available. Double-tap zoom, rubber-banding, safe-area insets and the silent switch are handled in CSS
  and code but were only verified in emulation.
- Large hold tiers can still outgrow dealer depth. The public calendar is fixed each run; market prices and encounters vary.
