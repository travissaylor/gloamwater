# Combat policy comparison

Loaded game SHA-256: `48fd8d91e592335eb0bd54eb9408f136b1db9d6dc2f97707979bbc03fbfeb1f5`. 40 paired seeds per policy, 3 workers.
One diagnostic comparison; no balance settings or prototype flags.

| Policy | Median fortune | Mean fortune | Sunk | First choice fight | Mean repair spend | Mean weapon spend | Weapon buyers |
|---|---:|---:|---:|---:|---:|---:|---:|
| informed | ¤605,876 | ¤613,737 | 0/40 | 50.7% | ¤1,749 | ¤0 | 0.0% |
| fight-farm | ¤187,174 | ¤281,929 | 18/40 | 100.0% | ¤1,979 | ¤25,670 | 82.5% |
| informed-nofight | ¤657,185 | ¤606,119 | 0/40 | 0.0% | ¤693 | ¤0 | 0.0% |

| Policy | Mean combat hull lost | Repair proxy at ¤35/point | Mean hull actually repaired | Mean final hull | Encounter cost per run |
|---|---:|---:|---:|---:|---:|
| informed | 76.5 | ¤2,678 | 53.5 | 56.3 | ¤71,618 |
| fight-farm | 112.7 | ¤3,945 | 58.9 | 32.0 | −¤4,452 |
| informed-nofight | 32.5 | ¤1,137 | 20.6 | 66.0 | ¤89,666 |

Repair proxy prices observed combat damage at the full yard rate. Actual repairs also cover storms and other damage; cheaper patches and unhealed damage make those amounts differ. Early sinkings shorten exposure. Encounter costs value direct resources and damage; they do not price the remaining voyages lost after sinking.

First choices, by encounter. Volley counts are separate.

| Policy | Fight | Run | Pay | Bribe | Yield | Won | Escaped | Sunk in encounter |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| informed | 103 | 22 | 46 | 24 | 8 | 60 | 15 | 0 |
| fight-farm | 160 | 0 | 0 | 0 | 0 | 142 | 0 | 18 |
| informed-nofight | 0 | 67 | 92 | 49 | 12 | 0 | 48 | 0 |

Encounter outcome keys reflect the existing simulator card classifier; detailed records remain in the JSON.

Reported page errors: 0. Runs with errors: 0.
Worker response-body SHA matches: 3/3.
Numerical invariant checks: 6696.
RNG seed mismatches: 0; night-30 market mismatches: 0.
