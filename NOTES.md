# Gloamwater — Thirty Nights on the Drowned Canals

**Concept.** Trade eight goods across seven canal districts in the *Little Lantern*. You owe Marrow Quill ¤6,000,
due by night 10, and have thirty nights to get rich. Open `game/index.html` offline: no dependencies or network requests.

## How to play
- **Trade.** Tap a good to open the trade sheet (buy or sell, quantity, totals, a 14-night chart). Each row compares tonight's
  price with that good's usual price across the city: **green** is cheap (a buy), **amber** is dear (a sale). Tags name where
  it recently sold for more. The comparison strip opens a buy quote or a route for cargo you already hold; prices can change.
- **First trade.** Night 1's harbor circular records all 56 port quotes. Later, visit or fit wireless to refresh remote quotes.
  Default buys keep 15% of cash aside within flat depth; Max deliberately uses the full legal order size and price impact.
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
- **Gulls and leaks.** Recover a stolen bag at 70% odds or accept the cash loss. Patch a threatened cargo stack or jettison it.
  Costs and failure stakes are explicit; offers do not consume dice or resources until answered and survive reload unchanged.
- **Finish.** On night 30, settle up. Score = cash + vault + cargo at half its sale value − debt. Seven ranks up to Sovereign of
  Gloamwater (¤850k); the Captains' Ledger is saved in localStorage.
- **Phone.** The bottom bar holds Market, Map, Harbor, Log and More (menu, help, ambience). Tap any HUD figure to explain it.
  **Keyboard.** 1–7 pick a district, Enter sails, arrows pick a good, B/S trade, ←/→ quantity, M mutes, ? help, Esc menu.

## Design decisions
- **Phone first.** A compact map dock keeps all seven ports available; full details open separately. Market rows show destination
  names and observation age. Phone reading text is 15px or larger; modal focus, reduced motion and 8px control gaps are supported.
- **Rumours are not certainties.** Tomorrow's shocks are queued a night ahead with a fixed fate: they land in full, land weak,
  or **turn** (everyone heard, and the opposite happened). A whisper only reveals what is queued; it never creates or changes one.
  Ysolde sells one a night for ¤300 + 1.5% of purse, vault and cargo, and says how sure she is before you pay.
- **Bounded late game.** Prices respond to order size (integrated, so no split or round trip pays); the tally uses that sale value.
  Fleet calls rotate opportunities. Charters show tonight's exact held-load proceeds change and approximate payback loads.
- **No reload tricks.** Outcomes are committed before they are shown; a reload resumes the same fight. Dice come from two seeded
  streams in the save (one for the market, one for events). Saved data is validated; damaged saves are discarded with a message.
- **Economy checks.** `tools/sim` drives the real file; bots use public information. A diagnostic 80-seed sample found:
  - **Competent bot:** median ¤606k; naive greedy bot ¤55k. Late sale revenue: silk 38%, ink 26%, chips 15%, eels 12%.
  - **Whisper test:** spam beats the same bot without whispers on 13/80 seeds; 65.5% of acted whispers lose money including fees.
    Careful use: whole-run mean +¤28k, median −¤4.8k versus no whispers. Information remains a gamble.
  - **Exploit probes:** 23,735 buy/sell round trips, none profitable; 23,576 numerical invariant checks passed.
    No game errors, non-finite final scores or market RNG mismatches. Both new event choices were used in simulations.
  This small sample is a regression check, not exhaustive balance proof. Earlier larger runs also tested reloads and final tally inflation.

## Testing done
- `node tools/verify.cjs` records phone input/layout checks, keyboard focus, file://, sandbox, corrupt storage and automated full games.
  `tools/touch-play.cjs` records real UI runs; reports retain source hashes, settlement, ledger reload and emulation limits.
- `tools/event-check.cjs` verifies event offers, both outcomes, reload commitment and resource conservation with explicit fixtures.

## Known issues
- No real iPhone was available. Double-tap zoom, rubber-banding, safe-area insets and the silent switch are handled in CSS
  and code but were only verified in emulation.
- Large hold tiers can still outgrow dealer depth. The public calendar is fixed each run; market prices and encounters vary.
