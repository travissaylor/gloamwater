# Gloamwater — Thirty Nights on the Drowned Canals

**Concept.** The sea took the lower city forty years ago. You run a battered skiff, the *Little Lantern*, between seven
canal districts of a lantern-lit drowned city, trading Glowkelp, Bottled Rain, Rust Pearls, Synth Saffron, Clockwork Eels,
Ghost Chips, Dreamsilk and Moon Ink. You owe the loan broker Marrow Quill ¤6,000 at 6% a night, due by night 10, and you
have thirty nights to get rich. Open `game/index.html` in a browser: no dependencies, no network requests.

## How to play
- **Trade.** Tap a good to open the trade sheet (buy or sell, quantity, totals, a 14-night chart). Each row compares tonight's
  price with that good's usual price across the city: **green** is cheap (a buy), **amber** is dear (a sale). Tags name where
  it recently sold for more; "Best known" names the biggest margin you have seen.
- **Market depth.** Dealers trade a few units at the posted price; past that each unit costs more (or fetches less) and the
  price takes a night or two to recover. The sheet says how many are left at the posted price and warns before a losing order.
- **Canals.** Sail along a canal for one night. Lanternquay joins every district; the others sit on a ring, so a district with
  no direct canal is two nights via a waypoint. Tap your own district to stay a night in port. Tap during a voyage to skip it.
- **Shocks.** Surges and gluts last two nights, weaker on the second. You hear of them where you are, by rumour, always with the
  wireless set, or a night early from Madame Ysolde or Pell the lamplighter.
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
- **Phone first.** Actions sit low at 44px or more; sheets pin their main button; the map fills portrait screens and shrinks
  above the destination card; toasts dock under the HUD and take no taps; body text 16px, contrast 4.5:1; audio unlocks on tap.
- **Rumours are not certainties.** Tomorrow's shocks are queued a night ahead with a fixed fate: they land in full, land weak,
  or **turn** (everyone heard, and the opposite happened). A whisper only reveals what is queued; it never creates or changes one.
  Ysolde sells one a night for ¤300 + 1.5% of purse, vault and cargo, and says how sure she is before you pay.
- **Bounded late game.** Prices respond to order size (integrated, so no split or round trip pays); the tally uses that sale value.
  Charters give late capital somewhere to go. Encounter costs scale with cargo, so a near-empty purse is no shield.
- **No reload tricks.** Outcomes are committed before they are shown; a reload resumes the same fight. Dice come from two seeded
  streams in the save (one for the market, one for events). Saved data is validated; damaged saves are discarded with a message.
- **Characters.** Every service keeper and event host has an inline-SVG portrait; synthesized effects plus an optional ambient bed.
- **Tuned by simulation.** `tools/sim` (dev tooling, not shipped) drives the real game file headlessly, 400 seeded runs per bot;
  bots see only what a player sees. On the current build:
  - **Competent bot:** median ¤420k (p10 ¤174k, p90 ¤693k), mostly Tide Baron, 4% Sovereign. A naive greedy bot: median ¤49k.
  - **Whisper test:** a bot that buys every whisper and acts on each ends ahead of the same bot without whispers on 22% of seeds
    (median −¤194k), and 65% of the whispers it acts on lose money. A careful buyer breaks even (mean +¤10k) with big wins at times.
  - **Borrowing to the limit** gains a modest +¤23k at the median. Save-scumming, split or walked orders, dump-and-buy-back and
    cornering a good before the tally gain nothing.

## Testing done
- Playwright WebKit (iPhone 13 at 390×664 with touch, 360×640, iPhone 14 Pro Max) and Chromium at 390 and 1280: full runs with
  touch taps only, a sandboxed `allow-scripts` iframe, `file://`, and corrupt or hand-edited storage. No console errors.

## Known issues
- No real iPhone was available. Double-tap zoom, rubber-banding, safe-area insets and the silent switch are handled in CSS
  and code but were only verified in emulation.
