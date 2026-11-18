# Count plots whose stored location (Riyadh city / region) is wrong. Read-only unless run with:  -Fix
param([switch]$Fix)
$Dir = Join-Path $env:LOCALAPPDATA 'MazadRadarInfath'
Set-Location $Dir
Get-Content (Join-Path $Dir '.env') | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)=(.*)$') { [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process') }
}
$env:NODE_NO_WARNINGS = '1'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }
$base = 'https://raw.githubusercontent.com/aiclaude9999/Riyadh-Land-Auctions-/ccr-684fffdf-bi3tdz'
foreach ($f in 'scripts/geo-impact.ts', 'src/lib/geo.ts', 'src/lib/ingest.ts', 'src/connectors/infath.ts') {
  Invoke-WebRequest -UseBasicParsing -Headers @{ "Cache-Control" = "no-cache" } "$base/${f}?t=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())" -OutFile (Join-Path $Dir ($f -replace '/', '\'))
}
$arg = if ($Fix) { '--fix' } else { '' }
& cmd.exe /c "npx.cmd tsx scripts/geo-impact.ts $arg 2>&1"
