# Economy simulator

`sim.js` loads a game build into headless Chromium and plays full 30-night runs with the game's
own code: real `sailTo()` and `stayNight()` nights, so encounters, squalls, arrival events,
parcels, interest and the end tally all run exactly as in play. Nothing in `game/index.html` is
needed for it: the simulator drives the page from outside.

It targets the round-2 build: market depth (`depthOf`, `S.press`, `quoteBuy`/`quoteSell`),
whispers with `conf` and a hidden `fate`, canals (`EDGES`, `nextHop`, `nightsTo`), staying the
night, trading charters, confirm cards on purchases, cargo-scaled encounters (`ENC`), the debt
deadline (`debtHunted`) and the game's own seeded dice (`S.rngM`, `S.rngE`). The run header's
`Adapter features` line says what it found; older builds mostly still load (no canals: every
district is one night away; no `ENC`: the encounter solver uses the round-2 constants).

## Run it

From `tools/sim/` with Node on the PATH (see `tools/README.md`):

```sh
node sim.js                                   # every policy, 400 runs each, against ../../game/index.html
node sim.js --game path/to/index.html --runs 400 --seed 1 --workers 12 --out results/run.json
node sim.js --policies informed,whisper-spam --runs 200
node sim.js --policies informed,whisper-spam --opt feeShare=0.25      # policy options
node sim.js --policies informed,whisper-spam --set depthScale=0.6      # game data changes, for sweeps
node analyze.js results/run.json --out results/run-summary.json        # acceptance, shape, ranks, encounters
node analyze.js results/run.json --ranks 0,40000,250000,400000,600000,800000   # try a set of rank thresholds
node analyze.js results/run.json --enc informed,fight-farm             # per-option encounter tables
```

| Flag | Default | Meaning |
|---|---|---|
| `--game` | `../../game/index.html` | Build to test. |
| `--policies`, `-p` | all | Comma list of files in `policies/` (without `.js`). `informed` always runs first, for pairing. |
| `--runs`, `-n` | 400 | Runs per policy. |
| `--seed` | 1 | Run *i* uses seed `seed*100000+i`. Same seed list for every policy. |
| `--workers`, `-j` | cores-2, max 8 | Parallel browser pages. 12 on this laptop gives about 6.5 runs/s. |
| `--out` | none | Writes the JSON (summary plus every run) and a `.txt` copy of the table. |
| `--opt k=v` | | Passed to policies as `mem.opts` (`--opt noCrn=1` turns off the event reseeding below). |
| `--set k=v` | | Changes game data in the page before any run (see below). Dotted keys nest; `a/b/c` is an array. |
| `--label` | | Free text printed in the header. |
| `--quiet`, `-q` | | No progress line. |

### Data changes for sweeps (`--set`, `SIM.mutate` in `adapter.js`)

| Key | Example | Effect |
|---|---|---|
| `depthScale` | `--set depthScale=0.6` | Multiplies every `GOODS[i].depth` `[n,d]`. |
| `conf.<level>` | `--set conf.sure=.7/.2/.1` | Replaces `CONF[level].odds` (full, weak, turn). The bots read the new odds too, as a player reads them off the card. |
| `spike`, `crash` | `--set spike=1.6/2.4` | Full-strength shock range. Replaces `genPendingInner` with a copy that draws the same numbers in the same order, so a seed's market is unchanged apart from the size. |
| `holdScale` | `--set holdScale=0.6` | Multiplies the capacity of hold tiers 1–5. |
| `holdMaxTier` | `--set holdMaxTier=3` | Removes the tiers above it. |
| `enc.*` | `--set enc.toll.purse=0.15` | Any field of the `ENC` encounter table. The solver reads the same table. |

`rumorCost`, `charterCost` and `RANKS` are `const` and cannot be changed from outside;
`analyze.js --ranks` re-scores a run under other thresholds instead.

Output: final-fortune percentiles from the game's own `tally()` and `rankFor()`, rank
distribution, sink rate, mean and median net worth on nights 5, 10, 15, 18, 20, 25 and 30, the
night-30/night-18 ratio, the largest single sale, routes (one-night hops, two-night trips, stays),
charters, encounters (count and realised cost), the choices taken, and, against `informed` on the
same seeds, the share of seeds where each policy ends higher and the median difference. The
whisper bots add whisper accounting by confidence, type and how they acted; the exploit hunters
add their own lines. `analyze.js` turns the JSON into Markdown tables, encounter tables by option,
paired comparisons, and suggested rank thresholds.

## Reproducibility

The game draws all of its dice from two seeded streams kept in the save: `S.rngM` (the market:
prices, stock, rumours and their fates) and `S.rngE` (events, fights, gambles). `newState()` seeds
both from `Math.random`, and `sim.js` seeds `Math.random` per run, so a run is reproducible from
its seed. The game promises the same market for the same seed whatever the captain does; the run
header's `Reproducibility` line checks it (game seeds and the night-30 market stream compared
across every policy on every seed).

For paired comparisons the adapter also reseeds `S.rngE` from (seed, night) right before the
voyage-event roll and the arrival-event roll (`rollVoyageEvent`, `rollArrivalEvent`), so one
policy's extra draw (a fight round, an eel bet) does not shift every later roll. A reload restores
`S.rngE` from the save, exactly as the game does. Rendering uses `Math.random` and no longer
touches game dice, so the old market/world/visual stream juggling is gone; a separate `policy`
stream serves `api.rand()`.

Same seed and same build give the same numbers at any worker count.

## What the bots may know

`adapter.js` exposes only what a player can see or remember. Policies must not read `S` for
decisions (`api.state()` is for after-the-fact accounting).

| Allowed | Source |
|---|---|
| Prices seen, with their age | `api.seen`, `api.rawSeen` (the posted price with the captain's own pressure taken out). Here every night; everywhere with the wireless set. |
| Own price pressure and depth | `api.pressure`, `api.pressAfter`, `api.depth`. Only the captain's trades move prices, and the trade sheet shows how many units go at the posted price. |
| Bulletins heard | `api.knownEffects()`: told type, what landed (the text says weak or turned), and the *expected* size for that kind. Never the exact multiplier. |
| Rumours told | `api.leakedPending()`: type, district, good, `conf`. Never `fate`, `m`, or unleaked rumours. `api.whisperHint()` is the Salon card's "she sounds sure" line. |
| Stock elsewhere | `api.stocked(gid, did)`: only if seen tonight; otherwise `null`. |
| Canals | `api.adjacent`, `api.nightsTo`, `api.nextHop`, `api.neighbours`: drawn on the map. |
| Charters | `api.charterCost`, `api.hasCharter`, and `api.hypoCharter(did, fn)`, which prices a plan as if a charter were bought (the Harbor card says what it does: twice as deep). |
| Debt deadline | `api.debtHunted()`, `api.huntRule`: Marrow's toast on night 8 and the lender card. |
| Encounters | The card's stated odds and costs (`SIM.cardInfo`); `api.encounterChance` and `api.encExpect`, the solver's price of a typical encounter on a canal. |

The informed planner also uses the `stepMarket` model (`SIM.model`), encounter chances and the
encounter damage ranges (not on the card): a seasoned player's sense of how prices drift, which
canals are rough and how hard the patrols hit.

## Policies

Each file in `policies/` registers `{ night(api, mem), choose?(card, api, mem), init?, finish? }`.
`night` runs once per night in port and returns the next district: one canal away for one night,
further for a two-night trip (the runner calls `sailTo`, which stops at the game's waypoint, and
the policy plans again there), or its own district (or `'stay'`) to stay the night. It returns
nothing on the last night. `choose` answers modals; returning nothing falls back to the default
rule. Files that start with `_` are shared code, loaded first in name order.

| Policy | What it does |
|---|---|
| `informed` | A competent captain (`_common.js`). Depth-aware order sizing with the game's quotes, odds-weighted rumours, splits held cargo between selling here and carrying on. **Route-aware**: scores every district one canal away (one night), every other district (two nights via the waypoint, prices two nights out, risk on both canals, minus 0.6x a running average of a night's value), and staying the night (tonight's sales and buys still weigh on tomorrow's price here). **Charters**: at each port it can nearly afford one, prices tonight's best plan with and without a charter there; buys when the average uplift x (1 + expected visits left) is at least 1.25x the cost and the purse left after tonight's basket covers it. **Vault**: at Lanternquay or the Drowned Exchange it takes everything out, trades, and banks all but a working purse (1.1x a typical basket plus a bribe); a vault port earns a route bonus of 4% of the idle purse. **Debt**: clears it once the purse is 1.5x the debt, or from night 8 (and near 12,000) once it covers it. Hold tiers while the hold fills, an engine and the wireless set early. |
| `informed-adj`, `informed-nostay`, `informed-nocharter`, `informed-novault` | `informed` without two-night trips, staying, charters, or the vault. Paired against informed, each prices that option. |
| `greedy` | Port of the bake-off `botTurn()`, limited to districts one canal away. A naive player. |
| `whisper-spam` | `informed`, plus a trip to Orchid Terraces whenever it can afford the fee, a whisper every visit, and action on every actionable whisper at face value: spike, buy here and sail to it (two nights if needed); crash, sail there and buy on arrival; about the Terraces itself, stay the night. |
| `whisper-smart` | `informed` that buys a whisper only at or passing the Terraces, when the fee is at most 4% of net worth and the Salon card does not say "only a guess", and uses only `sure`/`likely` whispers about goods worth ¤1,000+, weighted by the card's odds. |
| `stay-whisper` | `whisper-smart` that also uses rumours about the port it stands in for any good, and camps at the Terraces (stays for another whisper) when staying scores within 5% of the best plan. |
| `charter-rush` | Buys a charter wherever it stands as soon as the purse covers one (to three nights from the end). Otherwise `informed` without its charter rule. |
| `fight-farm` | Buys the next weapon whenever the purse covers it (steering to Saint Mire), and fights every encounter. |
| `fight` | Always fights, buys the next weapon with ¤500 to spare, steers toward dangerous districts. |
| `purse-floor` | Keeps the purse near zero: banks everything at a vault, elsewhere spends the rest on more cargo (minEdge 0.97). |
| `vault` | Withdraws at a vault before trading, deposits all but enough for the next hold tier. |
| `borrow-max` | Borrows to the credit limit on night 1 (and at Lanternquay to night 10), holds the debt until cash is 3x debt or the last six nights. `--opt cap=12000` borrows only to that amount (a lower credit limit). |
| `borrow-smart` | Borrows to the limit on night 1, clears it at Lanternquay as soon as it can from night 7 on. |
| `eel` | `informed`, and always takes Grandmother Wick's big offering. |
| `scum` | Fights everything, takes the big eel offering, and reloads the save when the eel turns black or the skiff sinks. `scum-control` is the same without reloads. |
| `roundtrip` | Exploit hunter: in every port, trades and undoes every good five ways (one order, split buys, split sells, buy-1/sell-1 twenty times, walk), then plays `informed`. |
| `dumpback` | Exploit hunter: dumps all cargo in every port, then steers back to ports it pressed down. |
| `corner` | Exploit hunter: on the final night, buys up its main good to inflate the tally, then sells everything. |

**Default event rule** (`SIM.defaultChoose` in `adapter.js`):

| Event | Rule |
|---|---|
| Patrol, gulls, collectors | The cheapest option in expectation, by `SIM.encSolve`: dynamic programming over boats x hull, using the card's run and fight odds (the formulas behind them for other boat counts), the bribe, toll or collection on the card, mean damage per round, the 12% seizure on a failed run, loot on a win (strongbox, gang cargo; collectors add 10% to the debt instead), what yielding or paying in kind takes, hull at the yard rate, and a terminal penalty for a battered hull (the chance the next voyage sinks the skiff with everything aboard). Collections count only the quarter Marrow's men keep; the rest comes off the debt. |
| Squall | Push through above 25% hull (it costs 6–16), otherwise shelter. |
| Crate | Take it above 20% hull. |
| Racks | Buy them if cash is at least 3x the price, up to night 25. |
| Eel | Walk on. |
| Courier | Take the parcel if it fits. |
| Confirm card | Yes, for a purchase the policy asked for (`api.upgrade`, `api.buyCharter`); no otherwise. |

Each encounter is logged (`run.enc`): kind, boats, the choices made, how it ended, purse, hull,
cargo and debt change, and the solver's expected cost of its first choice. Realised cost =
purse lost + hull lost x ¤35 + cargo lost (at what it would have fetched) + parcels lost − debt
paid off − loot goods (at 60% of usual price).

## Updating the adapter when the game changes

All game knowledge lives in `adapter.js`. Policies use `SIM.api`, `SIM.lib` and `SIM.model` only.

1. **Market depth.** `depthOf(did,gid)` gives `{n,d}` (a charter doubles it); the adapter mirrors
   `pressF`/`pressInt` (`api.sellCurve`, `api.buyCurve`). If the curve changes, change
   `pressF_`/`pressInt_`; if pressure eases at a different rate, `SIM.model.pressDecay`.
2. **Trades.** `api.buy`/`api.sell` call `coreBuy`/`coreSell` and measure the cash change.
3. **Canals and nights.** `api.adjacent`/`nightsTo`/`nextHop` call the game's; the runner calls
   `sailTo(dest)` (which stops at the waypoint) or `stayNight()`.
4. **Whispers.** `api.whisper()` calls `serviceAction('rumor')`. `whisperAvailable()` mirrors the
   Salon button. Shock sizes live in `SIM.shock`; `SIM.model.rumourExpect` weighs them by the odds.
5. **Modals.** `cardInfo()` classifies a card by its `art` key (`ART_ALIAS` maps portrait art such
   as `fenna`, `wick` back to the event) or `confirm:true`, and parses costs and odds from choice
   labels. New or renamed events need a line in `SIM.defaultChoose`.
6. **Encounters.** `SIM.encSolve` mirrors `fightLoop` (`fleeChance`, `fightChance`, damage
   `rint(5,10)+boats*rint(2,4)` on a failed run and `rint(4,8)+boats*rint(2,4)` on return fire,
   loot in `winValue`). It reads `ENC` live; change the damage tables if `fightLoop` changes.
7. **Services, upgrades, charters.** Purchases go through `serviceAction(kind, btn)` and answer
   the confirm card. Amount prompts are answered by stubbing `askAmount`.
8. **Dice.** The runner reseeds `S.rngE` around `rollVoyageEvent` and `rollArrivalEvent`. If the
   game renames those or moves its dice, update `wrapRoll` calls.
9. **Save-scumming.** `api.reload()` reads the save under `KEY_SAVE`, and the runner resumes it
   with `runTrip(true)`. It returns `null` when there is no save.
