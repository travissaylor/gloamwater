# Stop the headless Chrome started on a DevTools port.
# Usage: cdp-stop.ps1 -Port 9301
param([Parameter(Mandatory = $true)][int]$Port)
$procs = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match "--remote-debugging-port=$Port(\s|$)" }
foreach ($p in $procs) { try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {} }
Start-Sleep -Milliseconds 300
Write-Output "Stopped $(@($procs).Count) Chrome process(es) on port $Port."
