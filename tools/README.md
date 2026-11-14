# Browser tooling

Two ways to drive the game in a real browser on this machine.

## Node is installed

`node` and `npm` are installed through mise. If `node` is not found, the shell has a stale
PATH. Prepend mise and its shims:

```powershell
$env:Path = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\jdx.mise_Microsoft.Winget.Source_8wekyb3d8bbwe\mise\bin;$env:LOCALAPPDATA\mise\shims;$env:Path"
```

For phone work, Playwright is the better tool: it emulates touch, device pixel ratio and
real device profiles, and its WebKit build is the closest thing to iPhone Safari available
on Windows. It is installed in `tools/node_modules` (dev tooling only; the game itself
stays one file with no dependencies). If it is missing, run `npm install` in `tools/`, then
`npx playwright install webkit chromium`. See [the phone harness](#the-phone-harness-playwright-real-touch) below.

## The PowerShell harness (works now, no install)

Three scripts keep one headless Chrome alive per port, so the game keeps its state between
calls. Run them with the PowerShell tool, called directly with `&`.

```powershell
$T = 'C:\Users\travi\projects\trader-bakeoff\tools'

# start a browser on a port and load the game (fresh profile, empty storage)
& "$T\cdp-start.ps1" -Port 9311 -Url 'file:///C:/Users/travi/projects/trader-bakeoff/game/index.html'
# phone size: add  -Width 390 -Height 844   (use a different port)

# run steps against it (inline, separated by ' ;; ', or one per line in a file via -StepsFile)
& "$T\cdp.ps1" -Port 9311 -Step 'ui ;; shot C:\Users\travi\projects\trader-bakeoff\judging\round-1\start.png ;; errors'

# stop it when done
& "$T\cdp-stop.ps1" -Port 9311
```

| Step | What it does |
|---|---|
| `ui` | Lists visible, uncovered clickable elements as `[x,y] tag#id.class "text"`, any canvases, then the page's visible text. |
| `text` | Visible text only. |
| `shot <path.png>` | Screenshot of the viewport. Read the PNG to look at it. |
| `click <css selector>` | Real mouse click on the first match (scrolls it into view). |
| `clicktext <text>` | Real mouse click on the visible, enabled clickable whose text contains this (case-insensitive; shortest match wins). |
| `clickxy <x> <y>` | Real mouse click at viewport coordinates (for canvas or SVG maps). |
| `key <Key>` | `Enter`, `Escape`, `Space`, `Tab`, arrow keys, `Backspace`, or one character. |
| `type <text>` | Types into the focused input. |
| `eval <js>` | Evaluates one expression in the page and prints the result as JSON. |
| `evalfile <path.js>` | Evaluates a JS file (wrap it in an IIFE that returns a value; promises are awaited). |
| `wait <ms>` | Sleeps. Use after actions that animate. |
| `nav <url>` | Loads a URL in the same browser (same storage). Use it to test persistence. |
| `errors` | Uncaught errors, unhandled rejections and `console.error` calls since the last `nav`. |
| `size <w> <h>` | Resizes the viewport for the rest of that one call. |

Limits of this harness:

- **Mouse events only, no touch.** It cannot prove touch behaviour. Use Playwright for that.
- **Chrome, not Safari.**
- **Muted.** Judge audio by reading the Web Audio code and checking that an `AudioContext`
  starts without errors, and say that is how it was judged.
- Give each agent its own ports. Stop every browser you start.
- Sandboxed iframe test: write a wrapper page containing
  `<iframe sandbox="allow-scripts" src="file:///.../game/index.html" style="width:100%;height:95vh;border:0"></iframe>`,
  `nav` to it, `shot`, and click inside it with `clickxy`.

## The phone harness (Playwright, real touch)

`tools/phone/` has the same one-step-at-a-time shape as the PowerShell harness, but drives
Playwright WebKit (the closest engine to iPhone Safari on Windows) with touch and a mobile
viewport. Use it for every phone judgement. Run it from Git Bash or PowerShell with `node`
on the PATH (see above). Each port holds one long-lived browser and page, so game state
survives between calls.

```bash
cd C:/Users/travi/projects/trader-bakeoff
GAME=file:///C:/Users/travi/projects/trader-bakeoff/game/index.html

# start (detaches itself and returns when ready)
node tools/phone/start.js --port 9411 --device "iPhone 13" --url "$GAME"          # 390x664, Safari toolbars accounted for
node tools/phone/start.js --port 9412 --size 360x640 --url "$GAME"                # custom portrait size, touch + mobile on
node tools/phone/start.js --port 9413 --device "iPhone 14 Pro Max" --url "$GAME"  # 430x740
node tools/phone/start.js --port 9414 --size 390x664 --browser chromium --url "$GAME"

# run steps (inline with ' ;; ', or one per line in a file, # for comments)
node tools/phone/step.js --port 9411 --step "tap #t-new ;; wait 800 ;; shot C:/tmp/intro.png ;; ui"
node tools/phone/step.js --port 9411 --steps-file my-steps.txt

# stop
node tools/phone/stop.js --port 9411
```

`--device` takes any Playwright device name (`iPhone 13`, `iPhone 14 Pro Max`, `iPhone SE`,
`Pixel 7`, ...). `--size WxH` uses the iPhone 13 profile (iPhone user agent, dpr 3) with your
viewport; with `--browser chromium` it uses the Pixel 7 profile. `--headed` shows the window.
Screenshots are saved in CSS pixels (390 wide); add `--shot-scale device` at start for full
resolution. The server log is `%TEMP%\phone-harness-<port>.log`.

| Step | What it does |
|---|---|
| `ui` | Visible, uncovered interactive elements as `[x,y wxh] tag#id.class "text"` (centre and size), flagged `SMALL<44`, `GAP <8px to …`, `CLIPPED-X`, `PART-OFFSCREEN`; then covered ones (and what covers them), ones scrolled off screen, and the visible text. |
| `audit` | Numbers for a phone review: targets under 44x44, targets under 8px apart, text under 15px (SVG text at rendered size), text contrast under 4.5:1, inputs under 16px, elements past the viewport edge, truncated text, `touch-action` and `user-select` on targets, overscroll settings, scroll areas. |
| `covers <selector>` | For each visible match (default `.toast`), what text or controls sit underneath it. Use it on toasts, sheets and cards. |
| `text` | Visible text only. |
| `shot <path>` / `fullshot <path>` | Viewport / full-page screenshot. Read the PNG to look at it. |
| `tap <selector>` | Real touch tap (touchscreen) on the centre of the first visible match. Reports what the finger actually landed on, and `!! COVERED` if that was something else (a toast, the nav). If the target is clipped inside a nested scroller it scrolls that container first and says so. |
| `taptext <text>` | Touch tap on the visible, enabled clickable whose text contains this (case-insensitive; uncovered first, then shortest). |
| `tapxy <x> <y>` | Touch tap at viewport coordinates (canvas, SVG map, iframes). |
| `swipe <x1> <y1> <x2> <y2> [ms]` | Touch drag. Chromium: native touch events (real scrolling and sliders). WebKit: Playwright has no touch-move API, so it fires synthetic pointer events and applies the default action (sets a range input, or scrolls the scroller under the start point) and says so. |
| `type <text>` / `key <Key>` | Keyboard into the focused element. |
| `eval <js>` / `evalfile <path>` | Evaluate in the page (promises awaited) and print JSON. Game globals like `S`, `busy`, `view` are reachable. |
| `wait <ms>` | Sleep. |
| `waitfor <js> [timeoutMs]` | Poll until the expression is truthy and print how long it took. Good for timing: `taptext Sail here ;; waitfor !busy && view==='market'`. |
| `nav <url>` | Load a URL in the same context (storage kept). Resets `errors`. |
| `frame <n\|url-part\|main>` | Point `ui`, `text`, `eval`, `tap`, `taptext` at a child frame. `ui` then prints page coordinates you can pass to `tapxy`. |
| `errors` | `pageerror`, `console.error` and dialogs since the last `nav`. |
| `rotate` | Swap width and height (portrait/landscape). Real Safari landscape toolbars differ. |
| `size <w> <h>` | Set the viewport. |
| `audio` | Every `AudioContext` the page made: state at creation and now, every `resume()` call with the event it ran inside and its result, the last touch/pointer/click events, and how many sounds started while running vs suspended. |
| `info` | Browser, device, viewport, dpr. |

Sandboxed iframe test: write a wrapper page containing
`<iframe sandbox="allow-scripts" src="file:///C:/.../game/index.html" style="width:100%;height:95vh;border:0"></iframe>`,
then `nav` to it, `frame index.html`, `ui` (coordinates are page coordinates), and tap with
`tap`, `taptext` or `tapxy`. Use `frame main` to go back.

Things to know:

- **Taps are real touch.** A tap fires `pointerdown(touch) → touchstart → pointerup → touchend
  → mousedown → click`, as on a phone. Hover never fires.
- **Animations run slowly in headless WebKit on Windows**: `requestAnimationFrame` runs at
  about 4 per second, so wait about 1000ms after opening a sheet or card before `shot`, `ui`
  or `audit`, or you capture it mid-fade. Time animations in Chromium (`--browser chromium`,
  normal 60 fps); a voyage that takes 3.4s there takes longer in WebKit.
- **No Web Audio in Playwright's Windows WebKit.** The harness installs a stand-in
  `AudioContext` that applies the strict iOS rule (starts suspended; `resume()` only works
  inside a `touchend`, touch `pointerup`, `click` or `keydown` handler) and counts the sounds
  started in each state. `audio` says when the stand-in is active. It models the policy; it
  cannot play sound or prove iOS quirks such as the ring/silent switch. In Chromium the real
  `AudioContext` is reported.
- WebKit here is not iOS: no safe-area insets (`env()` is 0), no collapsing toolbar, no
  double-tap zoom, no long-press callout, no on-screen keyboard. Judge those from CSS and say so.
- `tap` scrolls a target that is off screen into view without waiting for animations; it
  reports a target clipped inside a card or sheet, because a player has to scroll to find it.
