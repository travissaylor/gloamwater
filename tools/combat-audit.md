# Leave combat balance unchanged

Always fighting failed often, including with the best weapon. Avoiding combat remained viable. This bounded audit does not support adding ammunition or changing return fire.

One comparison ran 40 paired seeds, `100000..100039`, with three browser workers. The loaded game SHA-256 was `48fd8d91e592335eb0bd54eb9408f136b1db9d6dc2f97707979bbc03fbfeb1f5`; all three response bodies matched it. No balance settings, prototype flags or game-source changes were used.

## Always fighting is a costly policy

| Policy | Median fortune | Mean fortune | Sunk | First encounter choice: fight |
|---|---:|---:|---:|---:|
| Informed, conditional choices | ¤605,876 | ¤613,737 | 0/40 | 103/203, 50.7% |
| Rush weapons, always fight | ¤187,174 | ¤281,929 | 18/40 | 160/160, 100% |
| Same informed trader, never fight | ¤657,185 | ¤606,119 | 0/40 | 0/220 |

The always-fight policy finished higher than informed on 7/40 seeds. Its paired median deficit was ¤311,443 and mean deficit ¤331,808. It spent an average ¤25,670 on weapons; 33/40 captains bought at least one.

The deaths were not confined to unarmed captains. Twelve of those 33 weapon buyers sank. Of 28 captains who bought the top weapon, eight sank. All 18 sinkings happened in combat. Weapon investment improves the odds; it does not remove the need to assess hull, boats and cargo exposure.

The informed policy chose fight first in about half its encounters. Its other first choices were 22 attempts to run, 46 payments, 24 bribes and eight searches. It won 60 encounters and escaped 15. Winning fights often under an expert policy is different from fighting being the correct action in every state.

## Never fighting remains competitive

The no-fight trader retained informed's trading, routing, banking, repairs and other service rules. At encounters it selected the lowest expected-cost enabled nonfight option. The solver also excluded fighting from future continuation, so a failed escape did not assume it could fight later. It used public card prices, stated odds, owned resources and the existing learned damage model.

The no-fight trader's paired median difference against informed was −¤6,318 and mean difference −¤7,618, about 1.2% of informed's mean fortune. It finished higher on 15/40 seeds and reached the end without sinking in all 40. Its larger raw median fortune is not evidence that never fighting dominates: paired seed differences point to near parity with a small average cost.

## Repairs do not erase combat risk

| Policy | Actual repair spend per run | Combat hull damage per run | Damage at full yard rate | Mean final hull |
|---|---:|---:|---:|---:|
| Informed | ¤1,749 | 76.5 points | ¤2,678 | 56.3% |
| Always fight | ¤1,979 | 112.7 points | ¤3,945 | 32.0% |
| Never fight | ¤693 | 32.5 points | ¤1,137 | 66.0% |

Actual repair bills include storms and other damage. The proxy prices observed combat damage at ¤35 per hull point; cheaper patches and unhealed damage explain why it differs from spending. Early sinkings also shorten exposure.

The always-fight policy took enough loot to make its immediate encounter resource accounting slightly positive on average. That accounting does not price the remaining trading nights lost after sinking. Its poor whole-run results and 45% sinking rate show why loot minus cheap repairs is an incomplete balance test.

## Confidence and verification

This is one 40-seed diagnostic, not an exhaustive search over combat policies. The weapon-rush policy also detours to Saint Mire and commits capital early, so its entire fortune deficit cannot be attributed to combat choice alone. The no-fight route planner retains informed's general encounter-risk forecasts; it is a viable comparator, not a claim of optimal nonviolent play. Zero observed sinkings in 40 runs does not establish zero risk.

No runtime or run errors occurred. All 6,696 numerical checks passed. Initial RNG streams matched across policies, and the night-30 market stream matched wherever multiple policies reached night 30.

Evidence: `tools/sim/results/combat-audit.json.gz` holds every run; `combat-audit-summary.md` and `combat-audit-summary.json.gz` hold the extracted statistics. `combat-inputs.json.gz` records the simulator and policy source hashes. The archives preserve the original JSON bytes. The only new behavior is a simulator comparison policy and spending observations. No game fix is warranted by this audit.
