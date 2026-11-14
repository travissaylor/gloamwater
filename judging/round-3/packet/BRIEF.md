# Trader Bake-off: the brief

Four models each build the same game from this brief, one per git worktree, in parallel.
A panel of judges then plays and scores every entry. You are one of the builders.

## What to build

An **original, single-player, turn-based trading game** in the classic
"buy low, sell high, move between districts, beat the clock" genre, given a
**modern, visual, interactive** treatment. Think of a 1980s text-mode trading
game's loop, rebuilt as something a player today would enjoy looking at and touching.

**It must be your own game.** Invent your own title, setting, goods, locations,
characters, and event writing. Do not reuse the name, places, characters, item
list, or text of any existing game. The theme is yours to choose (street-level
contraband, sci-fi smuggling, a fantasy black market, anything) as long as it is
original and commits to a clear art direction.

## Required gameplay

1. **Clock**: a fixed number of days or turns (around 30). Travelling costs a day.
2. **Map**: at least 6 locations to travel between, shown as a real visual map, not a list.
3. **Market**: at least 6 goods whose prices differ by location and shift every day,
   with occasional spikes and crashes the player can exploit.
4. **Inventory**: limited carrying capacity that can be upgraded.
5. **Debt**: the player starts owing a lender money at compounding interest and can repay it.
6. **Banking**: somewhere to stash cash safely, with interest.
7. **Random events**: at least 8 distinct ones, including at least one encounter where
   the player makes a risky choice (fight, flee, bribe, or similar) with real stakes.
8. **Progression**: at least 2 kinds of upgrade or purchase beyond trade goods.
9. **Ending**: a final score screen with a breakdown, a rating or rank, and a
   high-score table that survives a page reload.
10. **Onboarding**: a first-time player can work out how to play without reading docs.

## Required presentation

- Looks and feels like a modern game: deliberate visual identity, animation, and
  feedback on every action (buying, selling, travelling, events, winning, losing).
- Price information the player can read at a glance (trends, sparklines, or charts).
- Sound: synthesized with the Web Audio API (no audio files), with a mute toggle.
- Works with mouse, touch, and keyboard.
- Responsive: playable at 390px wide (phone) and at 1280px+ (desktop).

## Technical constraints (hard)

- Deliver **one self-contained file: `game/index.html`**. All CSS, JS, and art inline.
- **Vanilla HTML, CSS, and JavaScript only.** No frameworks, no build step, no npm.
  Node is not installed on this machine.
- **No network requests at all**: no CDNs, web fonts, remote images, or analytics.
  Use system fonts, inline SVG, canvas, CSS, and generated audio.
- Must run by opening the file directly (`file://`) and inside a sandboxed `<iframe>`.
- Wrap every `localStorage` access in `try/catch`; the game must still run when
  storage is unavailable.
- Keep `game/index.html` under 1 MB.

## Also deliver

- `NOTES.md` at the repo root (under 60 lines): the game's title and concept, how to
  play, the design decisions you made and why, and any known issues.

## Working rules

- Work only inside your own worktree, on its branch. Commit your work there. Do not push.
- Make your own design decisions. Do not ask questions; pick the option a good
  game designer would pick and note it in `NOTES.md`.
- Test before you finish. Google Chrome is installed at
  `C:\Program Files\Google\Chrome\Application\chrome.exe` and supports
  `--headless --screenshot`. Play through a full game start to finish if you can,
  and fix what you find.
- This is one pass. Polish as far as your own judgment says is worth it, then stop.

## How entries are judged

A panel of three judges plays each entry blind and scores it on game design,
visual and interaction design, and technical quality. Completeness against the
required lists above is the baseline, not the ceiling.
