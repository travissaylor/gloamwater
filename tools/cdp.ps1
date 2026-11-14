# Drive a headless Chrome page over the DevTools protocol.
# Usage: cdp.ps1 -Port 9301 -StepsFile steps.txt      (one step per line)
#        cdp.ps1 -Port 9301 -Step 'ui'                (one or more inline steps)
# Steps:
#   nav <url>            load a page (installs an error hook; read it with `errors`)
#   wait <ms>
#   ui                   list visible clickable things and the page's visible text
#   text                 only the page's visible text
#   click <css>          real mouse click on the first match
#   clicktext <text>     real mouse click on the visible clickable whose text matches
#   clickxy <x> <y>      real mouse click at viewport coordinates
#   key <Key>            Enter, Escape, Space, Tab, ArrowUp/Down/Left/Right, or one character
#   type <text>          type text into the focused element
#   eval <js>            evaluate an expression, print the JSON result
#   evalfile <path>      evaluate a JS file (last expression is the result)
#   shot <path.png>      screenshot the viewport
#   errors               print errors captured since the last nav
#   size <w> <h>         resize the viewport for the rest of this invocation
param(
  [Parameter(Mandatory = $true)][int]$Port,
  [string]$StepsFile,
  [string[]]$Step
)
$ErrorActionPreference = 'Stop'

$lines = @()
if ($StepsFile) { $lines += Get-Content -LiteralPath $StepsFile }
if ($Step) { foreach ($s in $Step) { $lines += ($s -split '\s*;;\s*') } }
if ($lines.Count -eq 0) { throw 'No steps given.' }

$targets = Invoke-RestMethod "http://127.0.0.1:$Port/json"
$page = @($targets | Where-Object { $_.type -eq 'page' })[0]
if (-not $page) { throw "No page target on port $Port. Start one with cdp-start.ps1." }

$ws = New-Object System.Net.WebSockets.ClientWebSocket
$ct = [Threading.CancellationToken]::None
$ws.ConnectAsync([Uri]$page.webSocketDebuggerUrl, $ct).Wait()
$script:msgId = 0

function Receive-Raw {
  $buf = New-Object byte[] 262144
  $ms = New-Object System.IO.MemoryStream
  do {
    $seg = New-Object System.ArraySegment[byte] -ArgumentList @(, $buf)
    $res = $ws.ReceiveAsync($seg, $ct).Result
    $ms.Write($buf, 0, $res.Count)
  } while (-not $res.EndOfMessage)
  [Text.Encoding]::UTF8.GetString($ms.ToArray())
}

function Send-Cdp([string]$method, $params, [switch]$AsText) {
  $script:msgId++
  $id = $script:msgId
  $msg = @{ id = $id; method = $method }
  if ($params) { $msg.params = $params }
  $payload = $msg | ConvertTo-Json -Depth 20 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
  $seg = New-Object System.ArraySegment[byte] -ArgumentList @(, $bytes)
  $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
  while ($true) {
    $reply = Receive-Raw
    if ($reply -match ('^\{"id":' + $id + '[,}]')) {
      if ($AsText) { return $reply }
      return ($reply | ConvertFrom-Json)
    }
  }
}

function Invoke-Js([string]$expr) {
  $r = Send-Cdp 'Runtime.evaluate' @{ expression = $expr; returnByValue = $true; awaitPromise = $true; userGesture = $true }
  if ($r.result.exceptionDetails) {
    $d = $r.result.exceptionDetails
    $t = $d.text
    if ($d.exception -and $d.exception.description) { $t = $d.exception.description }
    return @{ error = $t }
  }
  return @{ value = $r.result.result.value }
}

function Show-Js([string]$expr) {
  $r = Invoke-Js $expr
  if ($r.error) { Write-Output "  JS ERROR: $($r.error)"; return }
  $v = $r.value
  if ($null -eq $v) { Write-Output '  (null)'; return }
  if ($v -is [string]) { Write-Output $v; return }
  Write-Output ($v | ConvertTo-Json -Depth 8 -Compress)
}

function Js-Str([string]$s) { return ($s | ConvertTo-Json -Compress) }

function Click-At([double]$x, [double]$y) {
  Send-Cdp 'Input.dispatchMouseEvent' @{ type = 'mouseMoved'; x = $x; y = $y } | Out-Null
  Send-Cdp 'Input.dispatchMouseEvent' @{ type = 'mousePressed'; x = $x; y = $y; button = 'left'; buttons = 1; clickCount = 1 } | Out-Null
  Send-Cdp 'Input.dispatchMouseEvent' @{ type = 'mouseReleased'; x = $x; y = $y; button = 'left'; buttons = 0; clickCount = 1 } | Out-Null
}

$hook = @'
(function(){ if (window.__errs) return; window.__errs = [];
window.addEventListener('error', function(e){ window.__errs.push('error: ' + (e.message||'') + ' @' + String(e.filename||'').split('/').pop() + ':' + e.lineno); });
window.addEventListener('unhandledrejection', function(e){ window.__errs.push('rejection: ' + ((e.reason && e.reason.message) || e.reason)); });
var ce = console.error; console.error = function(){ window.__errs.push('console.error: ' + Array.prototype.map.call(arguments, String).join(' ')); return ce.apply(console, arguments); };
})();
'@

$finder = @'
(function(){
  function vis(el){ var r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return null;
    if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return null;
    var cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return null;
    return r; }
  function label(el){ var t = (el.getAttribute('aria-label') || '') ; var txt = (el.innerText || el.textContent || '').replace(/\s+/g,' ').trim();
    if (!txt) txt = el.value || el.getAttribute('title') || el.getAttribute('data-id') || el.getAttribute('data-loc') || el.getAttribute('data-action') || '';
    if (t && txt && t !== txt) return (txt + ' [' + t + ']').slice(0, 90); return (txt || t).slice(0, 90); }
  var out = [], seen = new Set(), all = document.querySelectorAll('*');
  for (var i = 0; i < all.length; i++) { var el = all[i];
    var tag = el.tagName.toLowerCase();
    var inter = /^(button|a|input|select|textarea|summary)$/.test(tag) || el.getAttribute('role') === 'button' || el.hasAttribute('onclick') || el.hasAttribute('tabindex');
    if (!inter) { var cs = getComputedStyle(el); if (cs.cursor === 'pointer' && !(el.parentElement && getComputedStyle(el.parentElement).cursor === 'pointer')) inter = true; }
    if (!inter) continue;
    var skip = false; seen.forEach(function(s){ if (s.contains(el) && /^(button|a)$/.test(s.tagName.toLowerCase())) skip = true; }); if (skip) continue;
    var r = vis(el); if (!r) continue;
    var cx = r.left + r.width/2, cy = r.top + r.height/2;
    var top = document.elementFromPoint(Math.min(Math.max(cx,0),innerWidth-1), Math.min(Math.max(cy,0),innerHeight-1));
    var covered = !(top && (el.contains(top) || top.contains(el)));
    seen.add(el);
    out.push({ el: el, tag: tag, id: el.id || '', cls: (typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '').split(/\s+/).slice(0,3).join('.'),
      text: label(el), x: Math.round(cx), y: Math.round(cy), w: Math.round(r.width), h: Math.round(r.height), disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true', covered: covered });
  }
  return out;
})
'@

# Headless Chrome will not open a window narrower than 500px, and a viewport override
# ends when the connection closes, so re-apply the size chosen at cdp-start every time.
$sizeFile = Join-Path $env:TEMP "cdp-size-$Port.txt"
if (Test-Path -LiteralPath $sizeFile) {
  $wh = (Get-Content -LiteralPath $sizeFile -Raw).Trim() -split '\s+'
  Send-Cdp 'Emulation.setDeviceMetricsOverride' @{ width = [int]$wh[0]; height = [int]$wh[1]; deviceScaleFactor = 1; mobile = $false } | Out-Null
}

foreach ($line in $lines) {
  $line = $line.Trim()
  if (-not $line -or $line.StartsWith('#')) { continue }
  $parts = $line -split '\s+', 2
  $cmd = $parts[0].ToLower()
  $arg = ''
  if ($parts.Count -gt 1) { $arg = $parts[1] }
  Write-Output "> $line"
  switch ($cmd) {
    'nav' {
      Send-Cdp 'Page.enable' $null | Out-Null
      Send-Cdp 'Page.addScriptToEvaluateOnNewDocument' @{ source = $hook } | Out-Null
      Send-Cdp 'Page.navigate' @{ url = $arg } | Out-Null
      $ok = $false
      for ($i = 0; $i -lt 50; $i++) {
        Start-Sleep -Milliseconds 200
        $r = Invoke-Js 'document.readyState'
        if ($r.value -eq 'complete') { $ok = $true; break }
      }
      Invoke-Js $hook | Out-Null
      if (-not $ok) { Write-Output '  (page did not reach readyState complete in 10s)' }
    }
    'wait' { Start-Sleep -Milliseconds ([int]$arg) }
    'size' {
      $wh = $arg -split '\s+'
      Send-Cdp 'Emulation.setDeviceMetricsOverride' @{ width = [int]$wh[0]; height = [int]$wh[1]; deviceScaleFactor = 1; mobile = $false } | Out-Null
    }
    'eval' { Show-Js $arg }
    'evalfile' { Show-Js (Get-Content -LiteralPath $arg -Raw) }
    'errors' { Show-Js 'JSON.stringify(window.__errs || ["(no hook installed; use nav)"])' }
    'text' { Show-Js '(document.body.innerText || "").replace(/\n{2,}/g, "\n").slice(0, 4000)' }
    'ui' {
      Show-Js ("(function(){ var a = $finder(); var vis = a.filter(function(o){return !o.covered;}); var lines = vis.map(function(o){ return '[' + o.x + ',' + o.y + '] ' + o.tag + (o.id ? '#' + o.id : '') + (o.cls ? '.' + o.cls : '') + (o.disabled ? ' (disabled)' : '') + ' ""' + o.text + '""'; });" +
        " var cv = Array.prototype.map.call(document.querySelectorAll('canvas'), function(c){ var r = c.getBoundingClientRect(); return 'canvas ' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); });" +
        " return 'viewport ' + innerWidth + 'x' + innerHeight + ', scrollY ' + Math.round(scrollY) + ' of ' + (document.documentElement.scrollHeight - innerHeight) + '\nCLICKABLE (' + vis.length + ' visible, ' + (a.length - vis.length) + ' covered):\n' + lines.join('\n') + (cv.length ? '\n' + cv.join('\n') : '') + '\nTEXT:\n' + (document.body.innerText || '').replace(/\n{2,}/g, '\n').slice(0, 2500); })()")
    }
    'click' {
      $r = Invoke-Js ("(function(){ var el = document.querySelector(" + (Js-Str $arg) + "); if (!el) return null; el.scrollIntoView({block:'center', inline:'center'}); var r = el.getBoundingClientRect(); return [r.left + r.width/2, r.top + r.height/2]; })()")
      if ($r.error) { Write-Output "  JS ERROR: $($r.error)" }
      elseif ($null -eq $r.value) { Write-Output '  NOT FOUND' }
      else { Start-Sleep -Milliseconds 60; Click-At $r.value[0] $r.value[1]; Start-Sleep -Milliseconds 120 }
    }
    'clicktext' {
      $r = Invoke-Js ("(function(){ var q = " + (Js-Str $arg) + ".toLowerCase(); var a = $finder().filter(function(o){ return !o.covered && !o.disabled && o.text.toLowerCase().indexOf(q) >= 0; }); if (!a.length) return null;" +
        " a.sort(function(p, r){ return p.text.length - r.text.length; }); var o = a[0]; o.el.scrollIntoView({block:'center', inline:'center'}); var b = o.el.getBoundingClientRect(); return [b.left + b.width/2, b.top + b.height/2, o.text]; })()")
      if ($r.error) { Write-Output "  JS ERROR: $($r.error)" }
      elseif ($null -eq $r.value) { Write-Output '  NOT FOUND (no visible, enabled clickable with that text)' }
      else { Start-Sleep -Milliseconds 60; Click-At $r.value[0] $r.value[1]; Write-Output "  clicked ""$($r.value[2])"""; Start-Sleep -Milliseconds 120 }
    }
    'clickxy' {
      $xy = $arg -split '\s+'
      Click-At ([double]$xy[0]) ([double]$xy[1]); Start-Sleep -Milliseconds 120
    }
    'key' {
      $map = @{ 'Enter' = @(13, 'Enter', "`r"); 'Escape' = @(27, 'Escape', ''); 'Space' = @(32, 'Space', ' '); 'Tab' = @(9, 'Tab', '');
        'ArrowUp' = @(38, 'ArrowUp', ''); 'ArrowDown' = @(40, 'ArrowDown', ''); 'ArrowLeft' = @(37, 'ArrowLeft', ''); 'ArrowRight' = @(39, 'ArrowRight', ''); 'Backspace' = @(8, 'Backspace', '') }
      if ($map.ContainsKey($arg)) {
        $m = $map[$arg]; $keyName = $arg; if ($arg -eq 'Space') { $keyName = ' ' }
        $down = @{ type = 'keyDown'; key = $keyName; code = $m[1]; windowsVirtualKeyCode = $m[0]; nativeVirtualKeyCode = $m[0] }
        if ($m[2]) { $down.text = $m[2] }
        Send-Cdp 'Input.dispatchKeyEvent' $down | Out-Null
        Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyUp'; key = $keyName; code = $m[1]; windowsVirtualKeyCode = $m[0]; nativeVirtualKeyCode = $m[0] } | Out-Null
      } else {
        $ch = $arg.Substring(0, 1); $vk = [int][char]($ch.ToUpper())
        $code = 'Key' + $ch.ToUpper(); if ($ch -match '\d') { $code = 'Digit' + $ch }
        Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyDown'; key = $ch; code = $code; text = $ch; windowsVirtualKeyCode = $vk; nativeVirtualKeyCode = $vk } | Out-Null
        Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyUp'; key = $ch; code = $code; windowsVirtualKeyCode = $vk; nativeVirtualKeyCode = $vk } | Out-Null
      }
      Start-Sleep -Milliseconds 120
    }
    'type' { Send-Cdp 'Input.insertText' @{ text = $arg } | Out-Null }
    'shot' {
      $shotReply = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' } -AsText
      if ($shotReply -match '"data":"([^"]+)"') {
        $dir = Split-Path -Parent $arg
        if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
        [IO.File]::WriteAllBytes($arg, [Convert]::FromBase64String($Matches[1]))
        Write-Output "  saved $arg"
      } else { Write-Output '  screenshot failed' }
    }
    default { Write-Output "  unknown step: $cmd" }
  }
}
try { $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, 'done', $ct).Wait(2000) | Out-Null } catch {}
