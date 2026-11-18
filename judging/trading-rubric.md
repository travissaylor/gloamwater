# Turn-based trading game rubric

Score how well the game turns limited time, cash, information and cargo space into decisions the player can understand and learn from. Give each criterion a whole-number score from 0 to 100. The weights sum to 100.

| Criterion | Weight | 50 | 75 | 90 |
|---|---:|---|---|---|
| 1. Trade and cargo decisions | 15 | One readable arbitrage sequence | Several options compete on return, reserves or cargo space | At least five of six logged turns have a credible second plan, including one closing turn. A change in cash, capacity or the deadline makes a different choice preferable. |
| 2. Routes and market intelligence | 11 | District identities emerge through repeated visits | A spatial map supports route comparisons, and trend visuals are readable | The player can compare timing and risk for two competing routes and explain how reliable each price signal is. Compare three observations with arrivals, including one before buying an information upgrade. |
| 3. Economy and progression | 13 | Finance and upgrades work, with obvious defaults | Debt, cash and upgrades compete for funds and influence plans | Two investment approaches yield useful options after the opening. A check from equivalent state and time shows a suspected shortcut has meaningful costs or an effective alternative. |
| 4. Risk, consequences and recovery | 12 | Encounters affect the run, with opaque stakes or weak choices | Major choices disclose stakes and outcomes usually allow a response | Two different risks present trade-offs whose outcomes match their offers. After a material hit to trade funds, cargo, hull or time, the player can choose a plausible recovery at a meaningful cost. |
| 5. Run pacing and ending | 10 | The deadline works, with a flat middle or abrupt ending | Opening, growth and closing play differently, and the ending is interpretable | A full run has decisions specific to all three phases, no more than two consecutive nights without a meaningful choice, and a final trade or route decision shaped by the deadline. The ending explains the rank and reconciles fortune. |
| 6. Replay and adaptation | 8 | Fresh runs reshuffle prices with little change in plan | A second opening rewards a different route or purchase | By night 10 in a second run, the player adapts both an early and later plan to changed conditions and can describe another approach worth trying. |
| 7. Onboarding and decision clarity | 9 | A player learns by trial, with frequent lookups | A cold player can complete the opening trade using in-game cues | Visible cues explain the first buy, voyage and sale, an unexpected price and a relevant constraint. The player can then make independently reasoned choices without repeatedly looking up basic rules. |
| 8. Input and accessibility | 7 | Phone and desktop work with recurring friction | Core actions work by touch, mouse and keyboard, with legible text and visible focus | Touch reaches the ending at 390 px and keyboard reaches each core screen at 1280 px. Check trade, map, event and ending for visible focus, 44 px core touch targets or equally reachable alternatives, 4.5:1 normal text contrast, and reduced motion. Essential information also has a non-color cue. |
| 9. World, feedback and sound | 9 | Consistent look with generic presentation or uneven feedback | Districts are distinct, and buy, sell, voyage, encounter and ending actions give clear feedback | District art and writing make the world recognizable. The player can follow three materially different actions through their presentation without opening the log. Distinct sound cues and mute work. Repeat actions can be taken at a comfortable pace. |
| 10. Reliability and delivery | 6 | Core flow works with reproducible failures | A complete offline run works and its result survives reload. Any observed defect is noncritical. | A normal run completes without runtime errors and its results persist. Test direct-file boot, sandbox without same-origin, denied and corrupt storage, zero external requests, single file, and the 1 MB limit. Check quantities, balances and the ending calculation. |

**0** means absent or unusable. **25** means partially present with major failures. Interpolate below 90 from the demonstrated anchors and report gaps. A score of **90 or higher** requires evidence for each clause of the 90 anchor. **95** requires an additional relevant adverse check. **100** requires the quality to hold across a second independent context with no material issue found. A missed check cannot support the anchor. Judge sound-cue operation separately from listening quality. Report the limits of emulated touch.

## Who owns each observation

Trade covers composition and quantity within a turn. Routes cover information before departure. Economy covers investment and financing across nights. Replay covers changes across runs. Risk owns the match between stated stakes and the outcome. Onboarding owns whether a cold player could find and understand the rule. World owns how clearly the game shows the action that happened. Reliability owns arithmetic, persistence and runtime constraints. Score a defect under its primary criterion. A second criterion needs its own observable impact.

## Required checks

| Criterion | Brief coverage |
|---|---|
| 1–2 | At least six goods, district-specific nightly prices and shocks, readable price trends, spatial map with at least six locations, travel advances the clock |
| 3–4 | Limited and upgradable cargo, at least two upgrade types, repayable compounding debt, safe interest-bearing bank, at least eight events and one consequential risky encounter |
| 5–7 | Fixed run around thirty turns, final score breakdown and rank, in-game onboarding |
| 8–9 | Phone and desktop, touch/mouse/keyboard, deliberate visual identity, animation and action feedback, synthesized Web Audio and mute |
| 10 | Persistent high scores with storage available, viable play without storage, guarded storage access, no network, one vanilla HTML file under 1 MB, file and sandbox boot, and the accompanying design notes |

An absent or inert required feature caps its owning criterion at 50. A core action blocked at 390 px caps input at 40. A reproducible low-cost tactic that bypasses core trading decisions caps economy at 40. Record what the tactic bypasses, how to repeat it, and the comparison. Positive returns alone are expected. A reproducible normal-play inability to boot offline or finish caps reliability at 25. An external request or dependency, forbidden framework, or file over the size limit caps reliability at 40. A confirmed core blocker, hard delivery failure, or economy bypass also caps the judge's total at 89. Record the exact trigger.

## Play and reporting protocol

1. Play cold with visible controls at 390 × 844 and touch input. Record first impressions before reading source or technical results. Play to the deadline and settlement. If the ship sinks early, keep those observations and start another run or use a clearly labeled fixture for closing analysis.
2. Log two trade decisions in each phase, nights 1–10, 11–20 and 21–30. Write down the chosen plan and runner-up, the information available, and the outcome. Play a fresh second run through night 10. Record at least one check against a default strategy, using matched state or seeds where practical.
3. At 1280 px, check mouse and keyboard paths through trade, route selection, event choice and settlement. Check reload, storage and offline delivery. Source, fixtures and simulations can support technical claims and falsify balance claims. Criteria 1–7 above 75 require direct visible-interface play. Label scripted UI runs, state fixtures and simulations, including acceleration and any shared evidence.
4. Submit all ten scores independently with evidence for the anchor claimed, strongest counterevidence, test gaps and three prioritized changes. Give the night, screen or fixture for evidence at 90 and above. Record the build hash and any caps. The organizer preserves individual reports and calculates the weighted totals and arithmetic mean without rounding intermediate values.

The organizer provides the frozen build, brief, rubric and harness instructions. Judges record independent observations before seeing any other report. Keep prior panels, desired outcomes and change history outside the play packet.
