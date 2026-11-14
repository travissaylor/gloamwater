# Focused economy simulation

Game SHA-256: `4c48105525c8793fceec89759bb61b438f92d3676e2844d397817f282c4eb357`. 80 seeds per policy.
This diagnostic sample is not proof across all seeds.

| Policy | Median fortune | Mean fortune | Mean hold tier | Sunk |
|---|---:|---:|---:|---:|
| informed | ¤605,876 | ¤605,222 | 1.43 | 0.0% |
| greedy | ¤54,889 | ¤80,948 | 1.68 | 0.0% |
| whisper-spam | ¤314,772 | ¤332,967 | 0.07 | 0.0% |
| roundtrip | ¤605,773 | ¤605,049 | 1.43 | 0.0% |
| whisper-smart | ¤612,984 | ¤633,671 | 1.41 | 0.0% |

Whisper spam beats informed on 13/80 paired seeds (16.3%). 65.5% of 438 acted whispers lose money, including the fee.

Careful whisper use: 168 bought, 41 acted on; mean attributed whisper profit per run ¤23,526 including fees. Whole-run paired mean difference versus informed ¤28,449, median difference −¤4,822; higher on 36.3% of seeds. Attributed whisper profit does not allocate every shared patch or bribe cost. Whole-run comparisons include actual costs and also reflect changed routes and decisions.

Round trips: 23,735 probes; 0 profitable; best cash change ¤0.

Late-game gross sale proceeds, nights 18–30. These are revenue shares, not profit shares.

| Good | Share |
|---|---:|
| silk | 37.7% |
| ink | 25.8% |
| chips | 14.8% |
| eels | 11.6% |
| saffron | 6.8% |
| pearl | 2.6% |
| rain | 0.6% |
| kelp | 0.2% |

Late-game route shares, nights 18–29.

| Route | Share |
|---|---:|
| de ↔ ot | 34.6% |
| lq ↔ ot | 17.5% |
| de ↔ lq | 13.0% |
| lq ↔ sl | 6.5% |
| de ↔ sl | 6.5% |
| ot stay | 4.8% |
| de stay | 4.1% |
| ch ↔ lq | 4.0% |
| lq stay | 3.6% |
| ot ↔ sm | 2.1% |
| ch ↔ sl | 0.8% |
| ch stay | 0.6% |
| fm ↔ lq | 0.5% |
| ch ↔ fm | 0.5% |
| lq ↔ sm | 0.5% |
| sl stay | 0.3% |
| fm ↔ sm | 0.1% |

Informed charters: 76.3% buy at least one, 1.14 per run.
Informed N30/N18: ratio of medians 3.10×; median per-run ratio 3.25×.
Informed hold tiers 3–5: 1/80 runs.
Reported page errors: 0. Runs with reported errors: 0.
Non-finite final net scores: 0.
RNG seed mismatches: 0; night-30 market mismatches: 0.

Worker response-body SHA matches: 3/3.
Numerical invariant checks across all runs: 23576.

New event decisions, actual counts over all runs per policy.

| Policy | Gull chase | Gull pay | Leak patch | Leak jettison |
|---|---:|---:|---:|---:|
| informed | 69 | 9 | 57 | 54 |
| greedy | 48 | 21 | 34 | 81 |
| whisper-spam | 55 | 14 | 62 | 76 |
| roundtrip | 69 | 9 | 57 | 54 |
| whisper-smart | 71 | 8 | 58 | 51 |
