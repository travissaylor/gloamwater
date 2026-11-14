# Gloamwater — Thirty Nights on the Drowned Canals

**Concept.** The sea took the lower city forty years ago. You run a battered skiff, the *Little Lantern*, between seven
canal districts of a lantern-lit drowned city, trading Glowkelp, Bottled Rain, Rust Pearls, Synth Saffron, Clockwork Eels,
Ghost Chips, Dreamsilk and Moon Ink. You owe the loan broker Marrow Quill ¤6,000 at 6% a night, and you have thirty nights
to get rich. Open `game/index.html` in a browser. It has no dependencies and makes no network requests.

## How to play
- **Trade.** Tap a good to open the trade sheet: buy or sell, quantity, the total, and a 14-night chart.
  - Each row compares tonight's price with that good's usual price across the city: **green** is cheap (a buy), **amber** is dear (a sale).
  - A tag names a district where the good recently sold for more. "Best known" names the biggest margin you have seen.
- **Market depth.** Dealers trade only a few units at the posted price. Past that, each extra unit costs more (or fetches
  less), and the price takes a night or two to recover. The trade sheet says how many are left at the posted price. Big money
  has to spread across goods and ports.
- **Sail.** On the Map, tap a district to see what it sells cheap, what it pays well for, its services, its danger and any
  news, then tap **Sail**. Every voyage costs one night. Tap during a voyage to skip the animation.
- **Shocks.** Surges and gluts last two nights and fade on the second. You hear about them if they are where you are, by
  rumour (40%), always with the wireless set, or a night early from Madame Ysolde or Pell the lamplighter.
- **Money.** Repay Marrow at Lanternquay. The Lockwater Vault (1.5% a night, theft-proof) has branches at Lanternquay and the Drowned Exchange.
- **Upgrades.** Copperhook Docks sells hold racks, engines and repairs. Saint Mire sells weapons, as does Fogmouth at a markup.
  The Drowned Exchange sells a wireless set (live prices everywhere). The Sluices do cheap patches up to 75% hull.
- **Survive.** Tidewardens, the Gull Gang and Marrow's collectors stop you mid-voyage: run, fight, bribe, pay, or be
  searched. Every option shows its odds or price. An empty purse is no escape: they take cargo or hull instead. At 0% hull you sink.
- **Finish.** On night 30, settle up. Score = cash + vault + cargo at half its sale value − debt. Seven ranks lead up to Sovereign
  of Gloamwater (¤1M), and the Captains' Ledger is saved in localStorage.
- **Phone.** The bottom bar holds Market, Map, Harbor, Log and More (menu, help, sound). Tap any HUD figure for an explanation.
  **Keyboard.** 1–7 pick a district, Enter sails, arrows pick a good, B/S trade, ←/→ set quantity, M mutes, ? opens help, Esc opens the menu.

## Design decisions
- **Phone first.** Every action sits in the lower half at 44px or more. Sheets pin their main button (Confirm, Sail, Settle up).
  The map redraws in portrait to fill the screen. Toasts dock above the bottom bar, take no taps, and wait while a sheet is open.
  Body text is 16px and text contrast is at least 4.5:1. Audio unlocks on the first tap, as iOS requires.
- **Rumours are not certainties.** The market queues tomorrow's shocks a night ahead, and each one's fate is fixed then.
  It lands in full, lands weak, or **turns**: everyone heard, everyone acted, and the opposite happened.
  - A whisper only reveals what is already queued; it never creates or changes a shock.
  - Ysolde sells one whisper a night. Her fee is ¤300 plus 1.5% of your purse, vault and cargo.
  - Before you pay, she says how sure she is (sure, fairly sure, a guess), and the card gives the odds. Acting on one is a bet.
- **Market depth bounds the late game.** Prices respond to order size, so returns stop compounding without limit. Pricing
  integrates the curve, so no split, round trip or walk of the price makes money, and the final tally uses the depth-aware
  sale value, so hoarding cargo cannot inflate the score.
- **No reload tricks.** The game saves after every action. It commits every outcome (fight, gamble, toll, whisper) before
  showing it, and saves an encounter's state each round, so a reload resumes the same fight. Saved data is fully validated;
  a damaged save is discarded with a message instead of crashing.
- **Tuned by simulation.** `tools/sim` (dev tooling, not shipped) drives the real game file headlessly (400 seeded runs per policy). Bots see only what a
  player sees. Results on the current build:
  - **Competent bot:** median ¤566k (p10 ¤354k, p90 ¤794k). Net worth grows 2.5× from night 18 to night 30.
    A naive greedy bot gets a median of ¤90k.
  - **Whisper acceptance test:** a bot that buys every whisper and acts on each one ends ahead of the same bot without
    whispers on 22.5% of seeds (median −¤144k), and 43% of the whispers it acts on lose money.
  - **Careful whisper buyer:** acts only on sure or likely rumours and ends level with the bot that never buys
    (ahead on 43% of seeds, mean +¤5k), with a median of +¤47k per whisper it acts on; 10% of those lose.
  - **Exploit hunts that gained nothing:** save-scumming, splitting or walking orders, dumping and buying back, and cornering a good before the tally.
## Testing done
- Playwright WebKit (iPhone 13 at 390×664 with touch, 360×640, iPhone 14 Pro Max) and Chromium at 390 and 1280: full runs with
  touch taps only, a sandboxed `allow-scripts` iframe, `file://`, and corrupt or hand-edited storage. No console errors.

## Known issues
- No real iPhone was available. Double-tap zoom, rubber-banding, safe-area insets and the silent switch are handled in CSS
  and code but were only verified in emulation.
