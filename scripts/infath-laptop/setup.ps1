# Mazad Radar — Infath collector for a Windows laptop in Saudi Arabia.
# Infath (infath.gov.sa) only answers Saudi networks, so this laptop collects it into the same database.
#
# Run from PowerShell (no admin needed):
#   irm https://raw.githubusercontent.com/aiclaude9999/Riyadh-Land-Auctions-/ccr-684fffdf-bi3tdz/scripts/infath-laptop/setup.ps1 | iex
# Running it again updates the code and keeps your saved database link.

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Repo   = 'aiclaude9999/Riyadh-Land-Auctions-'
$Branch = 'ccr-684fffdf-bi3tdz'
$Dir    = Join-Path $env:LOCALAPPDATA 'MazadRadarInfath'
$Task   = 'MazadRadar-Infath'

function Say($msg, $color = 'Cyan') { Write-Host "`n>> $msg" -ForegroundColor $color }
function Refresh-Path { $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') }

Say 'Mazad Radar - setting up the Infath collector on this laptop' 'Green'

# 1) Node.js
Refresh-Path
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Say 'Node.js is not installed - installing it with winget...'
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements | Out-Host
    Refresh-Path
  }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Say 'Could not install Node.js automatically. Install the LTS version from https://nodejs.org, then run this command again.' 'Red'
    return
  }
}
Say ("Node.js " + (node -v))

# 2) Stop a collector run that may still be using the files (otherwise Windows locks the Prisma engine)
Stop-ScheduledTask -TaskName $Task -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='cmd.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like '*MazadRadarInfath*' -or $_.CommandLine -like '*scripts?collect.ts*' -or $_.ExecutablePath -like '*MazadRadarInfath*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

# Download the latest code (keeps .env and logs)
Say 'Downloading the latest code...'
New-Item -ItemType Directory -Force -Path $Dir | Out-Null
$zip = Join-Path $env:TEMP 'mazad-radar.zip'
$tmp = Join-Path $env:TEMP 'mazad-radar-src'
Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/$Repo/archive/refs/heads/$Branch.zip" -OutFile $zip
if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
Expand-Archive -Path $zip -DestinationPath $tmp -Force
$src = Get-ChildItem $tmp | Select-Object -First 1
Get-ChildItem $Dir -Force | Where-Object { $_.Name -notin @('.env', 'logs', 'node_modules') } | Remove-Item -Recurse -Force
Copy-Item -Path (Join-Path $src.FullName '*') -Destination $Dir -Recurse -Force
Remove-Item -Recurse -Force $tmp, $zip

# 3) Database link (asked once, stored only on this laptop)
$envFile = Join-Path $Dir '.env'
if (-not (Test-Path $envFile) -or -not (Select-String -Path $envFile -Pattern '^DATABASE_URL=' -Quiet)) {
  # Visible input (pasting into a hidden prompt is unreliable in Windows PowerShell 5.1).
  # An empty answer falls back to the clipboard.
  Say 'Paste your Neon database link (right-click), then press Enter. If you only copied it, just press Enter:' 'Yellow'
  $url = Read-Host 'DATABASE_URL'
  if (-not $url) { try { $url = (Get-Clipboard -Raw) } catch { } }
  if ($url) { $url = $url.Trim().Trim('"').Trim("'") }
  if ($url -notmatch '^postgres(ql)?://\S+$') {
    Say 'That is not a link starting with postgresql:// - run the command again.' 'Red'
    return
  }
  try { Set-Clipboard -Value ' ' } catch { }   # clear the clipboard
  Clear-Host
  Say 'Database link saved on this laptop.' 'Green'
  Set-Content -Path $envFile -Value "DATABASE_URL=$url" -Encoding ASCII
}

# 4) Install packages
Say 'Installing packages (about 2 minutes)...'
Push-Location $Dir
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1'
npm.cmd ci --no-audit --no-fund --loglevel=error | Out-Host
if ($LASTEXITCODE -ne 0) { Pop-Location; Say 'Installing packages failed (see the messages above).' 'Red'; return }
npx.cmd prisma generate | Out-Null
Pop-Location

# 5) First run now
Say 'Test run: collecting Infath auctions now (can take up to 15 minutes, nothing shows until it ends)...'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Dir 'scripts\infath-laptop\run-infath.ps1') -Show

# 6) Schedule: every 2 hours + at logon; runs missed runs when the laptop wakes up
$action   = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + (Join-Path $Dir 'scripts\infath-laptop\run-infath.ps1') + '"')
$every2h  = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Hours 2) -RepetitionDuration (New-TimeSpan -Days 3650)
$atLogon  = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $Task -Action $action -Trigger @($every2h, $atLogon) -Settings $settings -Description 'Mazad Radar: collect Infath auctions every 2 hours' -Force | Out-Null

Say "Done! Infath auctions will be collected every 2 hours while this laptop is on and online." 'Green'
Say "Logs: $Dir\logs   |   To stop: Unregister-ScheduledTask -TaskName $Task" 'Gray'
