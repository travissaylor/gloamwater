$ErrorActionPreference = 'Stop'
$round = Split-Path $PSScriptRoot
$packet = Join-Path $round 'packet'
$build = Get-Content (Join-Path $round 'BUILD.json') -Raw | ConvertFrom-Json
$checks = @()
foreach ($item in @(@{file='index.html';sha256=$build.sha256},@{file='RUBRIC.md';sha256=$build.rubric_sha256})) {
 $p = Join-Path $packet $item.file
 $h = (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLower()
 $checks += @{file=$item.file;expected=$item.sha256;actual=$h;pass=($h -eq $item.sha256);bytes=(Get-Item -LiteralPath $p).Length}
}
foreach ($item in $build.helper_files) {
 $h = (Get-FileHash -LiteralPath (Join-Path (Join-Path $packet 'tools') $item.file) -Algorithm SHA256).Hash.ToLower()
 $checks += @{file=('tools/'+$item.file);expected=$item.sha256;actual=$h;pass=($h -eq $item.sha256)}
}
$result = @{at=[DateTime]::UtcNow.ToString('o');checks=$checks;pass=(@($checks | Where-Object {-not $_.pass}).Count -eq 0)}
$result | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 (Join-Path $PSScriptRoot $args[0])
Write-Output ($result | ConvertTo-Json -Depth 8 -Compress)
if (-not $result.pass) {exit 1}
