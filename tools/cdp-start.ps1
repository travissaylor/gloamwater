# Start a headless Chrome with a fresh profile and a DevTools port, optionally loading a URL.
# Usage: cdp-start.ps1 -Port 9301 -Url file:///C:/path/index.html [-Width 1280 -Height 800]
param(
  [Parameter(Mandatory = $true)][int]$Port,
  [string]$Url,
  [int]$Width = 1280,
  [int]$Height = 800
)
$ErrorActionPreference = 'Stop'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$profileDir = Join-Path $env:TEMP "cdp-profile-$Port"

# Stop anything already on this port, then start clean.
& (Join-Path $PSScriptRoot 'cdp-stop.ps1') -Port $Port | Out-Null
if (Test-Path -LiteralPath $profileDir) { Remove-Item -Recurse -Force -LiteralPath $profileDir -ErrorAction SilentlyContinue }

$chromeArgs = @(
  '--headless=new', "--remote-debugging-port=$Port", '--remote-allow-origins=*',
  "--user-data-dir=`"$profileDir`"", "--window-size=$Width,$Height", '--force-device-scale-factor=1',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio',
  '--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files', 'about:blank'
)
Start-Process -FilePath $chrome -ArgumentList $chromeArgs -WindowStyle Hidden | Out-Null

$up = $false
for ($i = 0; $i -lt 50; $i++) {
  Start-Sleep -Milliseconds 200
  try { Invoke-RestMethod "http://127.0.0.1:$Port/json/version" -TimeoutSec 2 | Out-Null; $up = $true; break } catch {}
}
if (-not $up) { throw "Chrome did not open DevTools port $Port." }
Set-Content -LiteralPath (Join-Path $env:TEMP "cdp-size-$Port.txt") -Value "$Width $Height" -Encoding ascii
Write-Output "Chrome up on port $Port (${Width}x${Height})."
if ($Url) { & (Join-Path $PSScriptRoot 'cdp.ps1') -Port $Port -Step "nav $Url", 'eval innerWidth + "x" + innerHeight + " " + document.title' }
