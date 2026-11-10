# Collect Infath into the Mazad Radar database (run by the scheduled task "MazadRadar-Infath").
param([switch]$Show)
$Dir = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $Dir
$logs = Join-Path $Dir 'logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$log = Join-Path $logs ("infath-" + (Get-Date -Format 'yyyy-MM-dd') + ".log")

# environment: database link from .env + Saudi-only mode
Get-Content (Join-Path $Dir '.env') | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)=(.*)$') { [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process') }
}
$env:SAUDI_NETWORK = '1'
$env:LOG_LEVEL = 'warn'
$env:LOG_PRETTY = '0'
$env:INGEST_CONCURRENCY = '6'
$env:DATABASE_POOL = '10'

"===== $(Get-Date -Format 's') =====" | Out-File -Append -Encoding utf8 $log
$out = & npx.cmd tsx scripts/collect.ts 2>&1
$out | Out-File -Append -Encoding utf8 $log
if ($Show) { $out | Out-Host }

# keep two weeks of logs
Get-ChildItem $logs -Filter 'infath-*.log' | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } | Remove-Item -Force
