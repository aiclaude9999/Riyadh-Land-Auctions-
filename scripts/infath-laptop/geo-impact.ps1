# READ-ONLY: count plots wrongly shown in Riyadh city (pin elsewhere). Changes nothing.
$Dir = Join-Path $env:LOCALAPPDATA 'MazadRadarInfath'
Set-Location $Dir
Get-Content (Join-Path $Dir '.env') | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)=(.*)$') { [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process') }
}
$env:NODE_NO_WARNINGS = '1'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }
$base = 'https://raw.githubusercontent.com/aiclaude9999/Riyadh-Land-Auctions-/ccr-684fffdf-bi3tdz'
foreach ($f in 'scripts/geo-impact.ts', 'src/lib/geo.ts') {
  Invoke-WebRequest -UseBasicParsing "$base/$f" -OutFile (Join-Path $Dir ($f -replace '/', '\'))
}
& cmd.exe /c "npx.cmd tsx scripts/geo-impact.ts 2>&1"
