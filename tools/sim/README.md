# Economy simulator

`sim.js` loads a game build into headless Chromium and plays full 30-night runs with the game's
own code: real `sailTo()` voyages, so encounters, squalls, arrival events, parcels, interest and
the end tally all run exactly as in play. Nothing in `game/index.html` is needed for it: the
simulator drives the page from outside.

It targets the market-depth build (`depth`, `S.press`, `quoteBuy`/`quoteSell`, whispers with
`conf` and a hidden `fate`). It still loads the bake-off build: the depth helpers fall back to
flat prices and whispers have no confidence there. The run header's `Adapter features` line says
which build it found.

## Run it

From `tools/sim/` with Node on the PATH (see `tools/README.md`):

```sh
node sim.js                                   # every policy, 400 runs each, against ../../game/index.html
node sim.js --game path/to/index.html --runs 400 --seed 1 --workers 12 --out results/run.json
node sim.js --policies informed,whisper-spam --runs 200
node sim.js --policies informed,whisper-spam --opt feeShare=0.25      # policy options
node sim.js --policies informed,whisper-spam --set depthScale=0.6      # game data changes, for sweeps
node analyze.js results/run.json --out results/run-summary.json        # acceptance, shape, rank thresholds
```

| Flag | Default | Meaning |
|---|---|---|
| `--game` | `../../game/index.html` | Build to test. |
| `--policies`, `-p` | all | Comma list of files in `policies/` (without `.js`). `informed` always runs first, for pairing. |
| `--runs`, `-n` | 400 | Runs per policy. |
| `--seed` | 1 | Run *i* uses seed `seed*100000+i`. Same seed list for every policy. |
| `--workers`, `-j` | cores-2, max 8 | Parallel browser pages. 12 on this laptop gives about 9 runs/s. |
| `--out` | none | Writes the JSON (summary plus every run) and a `.txt` copy of the table. |
| `--opt k=v` | | Passed to policies as `mem.opts`. |
| `--set k=v` | | Changes game data in the page before any run (see below). Dotted keys nest; `a/b/c` is an array. |
| `--label` | | Free text printed in the header. |
| `--quiet`, `-q` | | No progress line. |

### Data changes for sweeps (`--set`, `SIM.mutate` in `adapter.js`)

| Key | Example | Effect |
|---|---|---|
| `depthScale` | `--set depthScale=0.6` | Multiplies every `GOODS[i].depth` `[n,d]`. |
| `conf.<level>` | `--set conf.sure=.7/.2/.1` | Replaces `CONF[level].odds` (full, weak, turn). The bots read the new odds too, as a player reads them off the card. |
| `spike`, `crash` | `--set spike=1.6/2.4` | Full-strength shock range. Replaces `genPending` with a copy that draws the same numbers in the same order, so a seed's market is unchanged apart from the size. |
| `holdScale` | `--set holdScale=0.6` | Multiplies the capacity of hold tiers 1–5. |
| `holdMaxTier` | `--set holdMaxTier=3` | Removes the tiers above it. |

`rumorCost` is a `const` arrow function and cannot be changed from outside.

Output: final-fortune percentiles from the game's own `tally()` and `rankFor()`, rank
distribution, sink rate, mean and median net worth on nights 5, 10, 15, 18, 20, 25 and 30, the
night-30/night-18 ratio, the largest single sale, the choices taken, and, against `informed` on
the same seeds, the share of seeds where each policy ends higher and the median difference. The
whisper bots add whisper accounting by confidence and type; the exploit hunters add their own
lines. `analyze.js` turns the JSON into Markdown tables and suggests rank thresholds.

## Reproducibility

`Math.random` is replaced before the game loads with seeded streams:

- **market**: `stepMarket()` (prices, stock, rumours queued in `genPending`, and the fate each
  rumour lands with in `landEvent`). Whispers now only reveal queued rumours, so every policy
  sees exactly the same market on the same night of the same seed.
- **world**: everything else (encounters, events, which rumour a whisper reveals), reseeded from
  (seed, night, phase) each night, so one policy's extra draw does not shift every later roll.
- **visual**: `fly`, `FX`, `sparkSVG`, `buildMap`. Rendering never moves a game draw.

Same seed and same build give the same numbers at any worker count.

## What the bots may know

`adapter.js` exposes only what a player can see or remember. Policies must not read `S` for
decisions (`api.state()` is for after-the-fact accounting).

| Allowed | Source |
|---|---|
| Prices seen, with their age | `api.seen`, `api.rawSeen` (the posted price with the captain's own pressure taken out). Here every night; everywhere with the wireless set. |
| Own price pressure and depth | `api.pressure`, `api.pressAfter`, `api.depth`. Only the captain's trades move prices, and the trade sheet shows how many units go at the posted price. |
| Bulletins heard | `api.knownEffects()`: told type, what landed (the text says weak or turned), and the *expected* size for that kind. Never the exact multiplier. |
| Rumours told | `api.leakedPending()`: type, district, good, `conf`. Never `fate`, `m`, or unleaked rumours. |
| Stock elsewhere | `api.stocked(gid, did)`: only if seen tonight; otherwise `null`. |

The informed planner also uses the `stepMarket` model (`SIM.model`) and `encounterChance()`, a
seasoned player's sense of how prices drift and which canals are rough.

## Policies

Each file in `policies/` registers `{ night(api, mem), choose?(card, api, mem), init?, finish? }`.
`night` runs once per night in port and returns the next district (or nothing on the last
night). `choose` answers modals; returning nothing falls back to the default rule. Files that
start with `_` are shared code, loaded first in name order.

| Policy | What it does |
|---|---|
| `greedy` | Port of the bake-off `botTurn()`: sell above cost, repay at Lanternquay when cash > 1.3× debt or after night 24, buy hold at Copperhook, repair, buy `maxBuy` of the best estimated arbitrage. Not depth-aware on resale: a naive player. |
| `informed` | A competent captain (see `_common.js`). Depth-aware: sizes orders with the game's quotes so each chunk's expected resale at the destination, integrated over that port's price curve after its pressure eases, clears the chunk's exact cost by 5%; spreads purse and hold across goods; splits held cargo between selling here and carrying on. Weighs rumours by the card's odds. Buys hold tiers while the hold has been filling, a motor and the wireless set early, clears debt when comfortable. |
| `whisper-spam` | `informed`, plus a trip to Orchid Terraces whenever it can afford the fee, a whisper every visit (bought before selling, when the purse is smallest), and action on every actionable whisper at face value: spike, buy the good here and sail into it; crash, sail there and buy on arrival if the real price makes it worth reselling. |
| `whisper-smart` | `informed` that buys a whisper only at or passing Orchid Terraces (its plan within 5% of the best), when the fee is at most 4% of net worth, and uses only `sure`/`likely` whispers about goods worth ¤1,000+, weighted by the card's odds. |
| `eel` | `informed`, and always takes Grandmother Wick's big offering. |
| `borrow-max` | Borrows to the credit limit on night 1 (and again at Lanternquay to night 10), holds the debt until cash is 3× debt or the last six nights. |
| `fight` | Always fights, buys the next weapon whenever affordable, steers toward dangerous districts. |
| `vault` | Withdraws at a vault before trading, deposits what is left after buying (keeping enough for the next hold tier). |
| `scum` | Fights everything, takes the big eel offering, and reloads the save when the eel turns black or the skiff sinks. Logs what each reload found. `opts.noReload=1` turns reloading off. |
| `scum-control` | `scum` without reloads, for the paired comparison. |
| `roundtrip` | Exploit hunter: in every port, for every good, trades and undoes it five ways (one order; split buys; split sells; buy-1/sell-1 twenty times; buy, half-sell, re-buy, sell). Then plays `informed`. |
| `dumpback` | Exploit hunter: dumps all cargo in every port, then steers back to ports it pressed down so the planner buys the goods back cheap. |
| `corner` | Exploit hunter: on the final night, records the tally, buys up its main good to inflate the price, records the tally again, then sells everything. Otherwise `informed`. |

**Default event rule** (`SIM.defaultChoose` in `adapter.js`):

| Event | Rule |
|---|---|
| Patrol | Bribe if the bribe costs no more than half the cargo's value here plus parcel rewards (what yielding loses). Yield if that is under ¤400. Otherwise run, or fight if the fight odds beat the run odds by 10 points. At 30% hull or below, bribe or yield. |
| Gulls | Pay a toll of ¤800 or less (with an empty purse, a third of the cargo's value), or any toll at 30% hull or below. Otherwise run or fight, by the same odds test. |
| Collectors | Pay (it comes off the debt; with a short purse they take cargo too). |
| Squall | Push through above 35% hull, otherwise shelter. |
| Crate | Take it above 20% hull. |
| Racks | Buy them if cash is at least 3× the price, up to night 25. |
| Eel | Walk on. |
| Courier | Take the parcel if it fits. |

## Updating the adapter when the game changes

All game knowledge lives in `adapter.js`. Policies use `SIM.api` and `SIM.model` only.

1. **Market depth.** `depthOf(did,gid)` gives `{n,d}`; the adapter mirrors `pressF`/`pressInt`
   (`api.sellCurve`, `api.buyCurve`) so the planner can price a sale at another port from an
   estimated price and that port's pressure. `api.quoteBuy`/`quoteSell` call the game's quotes
   here. If the curve changes shape, change `pressF_`/`pressInt_` to match; if pressure eases at
   a different rate, change `SIM.model.pressDecay`.
2. **Trades.** `api.buy`/`api.sell` call `coreBuy(gid,q)` (returns `{q,total}`; the old build
   returned a number, both are handled) and `coreSell(gid,q)` (`{q,profit,total}`), and measure
   the cash change. `api.sell` records the largest single sale.
3. **Whispers.** `api.whisper()` calls `serviceAction('rumor')` and returns `{fee, type, d, g,
   conf}` for the rumour it leaked. `whisperAvailable()` mirrors the Salon button (fee, one a
   night via `S.whisperDay`, `whisperable()` not empty, not the last night). Shock sizes live in
   `SIM.shock` (kept in step with `--set spike/crash`); `SIM.model.rumourExpect(type, conf)`
   weighs them by `CONF[conf].odds`, and `landedExpect(told, kind)` sizes a landed bulletin.
4. **Modals.** `cardInfo()` classifies a card by its `art` key and parses costs and odds from
   choice labels. New or renamed events need a line in `SIM.defaultChoose`.
5. **Services and upgrades.** `upgradeCost`, `nextTierCost` and `upgrade` read `HOLD_TIERS`,
   `MOTORS`, `ARMS`, `WIRELESS_COST`, `YARD_RATE` and `GUTTER_RATE`, and call
   `serviceAction(kind, btn)`. Amount prompts are answered by stubbing `askAmount`.
6. **Price model.** `SIM.model` holds the planner's assumptions about `stepMarket` (AR
   coefficients, stock odds). Update it if the price process changes.
7. **Save-scumming.** `api.reload()` reads the save under `KEY_SAVE`, and the runner resumes it
   with `runTrip(true)`, as `startGame` does. It returns `null` when there is no save (the game
   deletes it on sinking) and logs how much cash and hull a reload gave back.
8. **Removed hooks.** `AUTO` and the dev hooks are gone; the runner sets `AUTO` only if the build
   still has it.
