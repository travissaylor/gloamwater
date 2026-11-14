# Keyboard completion evidence

`final-candidate/report.json` is the integrated gate: both file loads match
`fe83fdc0a961c85f0de6407a9c2a715ed1b8dee02054172f09346d3255e16767`.
It completes 30 nights, all seven ports, settlement and ledger reload using native
keyboard inputs. It records 3,972 Tab/Shift+Tab presses and 216 native clicks, with
zero pointer events, modal focus escapes, game errors or network requests.

`report.json` preserves the first driver failure. Its focus-search algorithm
oscillated around Chromium's implicit scroll-container focus stop; it is not a
confirmed game failure. `attempt-2/report.json` preserves the corrected successful
run on the previous build. Its ledger reload encountered an in-progress UI edit;
the two different navigation hashes are retained. The final gate used unchanged
source throughout and required no retry or helper edit.

All runs accelerate animations and request reduced motion. This is desktop
Chromium coverage, not screen-reader, physical iPhone or audible-quality proof.
