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
on Windows. It is not set up yet. Install it under `tools/` (dev tooling only; the game
itself stays one file with no dependencies) and add `node_modules` to `.gitignore`.

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
