# Gloamwater — Thirty Nights on the Drowned Canals

**Concept.** The sea took the lower city forty years ago. You run a battered skiff, the *Little Lantern*, between
seven canal districts of a lantern-lit drowned city, trading Glowkelp, Bottled Rain, Rust Pearls, Synth Saffron,
Clockwork Eels, Ghost Chips, Dreamsilk and Moon Ink. You owe the loan broker Marrow Quill ¤6,000 at 6% a night.
You have thirty nights to get rich. Open `game/index.html` in a browser: no dependencies, no network requests.

## How to play
- **Trade.** Tap a good, or use the Buy/Sell buttons, to open the trade screen. It shows a 14-night price chart,
  your average cost, where the price sits in its normal range, and the last price you saw in every other district.
- **Sail.** Tap a district on the map (or press 1–7) to see what it sells cheap, what it pays well for, its
  services and its danger. Sailing anywhere costs one night.
- **Exploit shocks.** Bulletins announce surges and gluts. They last two nights and fade on the second.
  Green `+%` badges on the map show where your cargo last sold above what you paid.
- **Manage money.** Repay Marrow and use the Lockwater Vault (1.5% a night, theft-proof) at Lanternquay.
  There is a second vault branch at the Drowned Exchange.
- **Upgrade.** Hold racks, engines and hull repairs at Copperhook Docks. Weapons at Saint Mire (or Fogmouth, at a
  markup). A wireless set at the Drowned Exchange gives live prices everywhere. Madame Ysolde at Orchid Terraces
  sells tips about tomorrow's shocks. The Sluices does cheap patch jobs, up to 75% hull.
- **Survive.** Tidewarden patrols, the Gull Gang and Marrow's collectors can stop you mid-voyage: run, fight,
  bribe, pay, or be searched. At 0% hull you sink and lose your cash and cargo.
- **Finish.** On night 30, settle up. Score = cash + vault + half-price cargo − debt. You get a rank (seven tiers,
  from Drowned Debtor to Sovereign of Gloamwater) and a place in the Captains' Ledger, which persists in localStorage.
- **Keys.** 1–7 pick a district, Enter sails. Arrow keys pick a good, B/S trade, ←/→ change the quantity (Shift ×10),
  A buys or sells the max. 1–4 answer events, M mutes, ? opens help, Esc closes or opens the menu.

## Design decisions
- **Every district has a reputation.** Each sells some goods cheap and pays well for others, and the map card says
  which. New players get a reliable first strategy. The real money is in the two-night surges and gluts.
  Prices follow a shared trend plus local noise, so the specialties are a tendency, not a guarantee.
- **Information is a resource you buy.** Bulletins reach you if they happen where you are, 40% of the time by rumour,
  always with the wireless set, and in advance via Ysolde or Pell the lamplighter.
- **Tuned by simulation.** A 400-game bot simulation with a semi-informed greedy bot set the price spreads and the
  rank thresholds. The bot's median is around ¤130k (Lantern Broker), with a long tail into the millions.
  Players who exploit bulletins should beat it.
- **Real stakes, readable odds.** Encounter buttons show their percentages, and those change with your engine,
  weapon, hold load and enemy count. Hull damage carries over, damaged hulls leak cargo, and sinking ends the run.
  The first voyage is always safe, so new players get one night to learn.
- **No exploiting reloads.** The game autosaves after every action and at each stage of a voyage. Reloading during an
  encounter resumes that encounter instead of dodging it.
- **One file, no assets.** Art is inline SVG plus a canvas particle layer; audio is Web Audio; fonts are system fonts.
- **Layout.** Desktop shows the map, market and log side by side. Below 860px the game becomes a tabbed phone layout,
  and the map switches to a portrait arrangement of the same districts.
- **Onboarding.** A short intro, a skippable five-step guided tour (replayable from help), contextual hints on first
  visits, and a help screen.

## Testing done
- Headless Chrome screenshots of every screen at 1280×800, 1920×1080, and 390×844 inside a
  `sandbox="allow-scripts"` iframe, where localStorage is blocked and the game falls back to memory.
- Automated full 30-night games through the real UI code: about 20 fast runs, plus one real-time run with every
  animation, driven over the DevTools protocol. No script errors.
- Keyboard-only playthrough of title → intro → tour → buy → sail → event. Save, reload, continue, and
  reload-during-encounter. The high-score table survives a full browser restart.

## Known issues
- Dev hooks (`#sim`, `#auto`, `#shot=…` URL hashes) remain for automated testing; they do nothing in normal play.
- No real touch device was available. Touch was checked by layout and tap-target sizing only.
- If a reload interrupts an encounter, the encounter re-rolls (enemy boat count), so a reload can still reshuffle
  that fight. It can't skip it.
