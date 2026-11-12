# Mazad Radar - one-time, READ-ONLY check of what Infath publishes (run on the laptop in KSA).
#   irm https://raw.githubusercontent.com/aiclaude9999/Riyadh-Land-Auctions-/ccr-684fffdf-bi3tdz/scripts/infath-laptop/check-infath.ps1 | iex
# It only downloads public pages with normal requests (no login, no passwords, nothing is changed)
# and writes a folder "infath-check" on the Desktop: report.txt + the saved pages.
# 1) infath.gov.sa auction list (ongoing / upcoming): how page 2, 3... are linked
# 2) auctions.infath.gov.sa (Infath's own platform): robots.txt, the page, and the data addresses its scripts use

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$out = Join-Path ([Environment]::GetFolderPath('Desktop')) 'infath-check'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$report = Join-Path $out 'report.txt'
Set-Content -Path $report -Value "Infath check $(Get-Date -Format s)" -Encoding UTF8
function W($s) { Add-Content -Path $report -Value $s -Encoding UTF8 }
function Get-Page($url, $name) {
  $file = Join-Path $out $name
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $file -PassThru -TimeoutSec 60
    W ("OK   {0} {1} -> {2} ({3} bytes)" -f $r.StatusCode, $url, $name, (Get-Item $file).Length)
    return (Get-Content $file -Raw -Encoding UTF8)
  } catch {
    W ("FAIL {0} : {1}" -f $url, $_.Exception.Message)
    return $null
  }
}
function Uniq($items, $max) { $items | Where-Object { $_ } | Sort-Object -Unique | Select-Object -First $max }

Write-Host "`n>> Checking infath.gov.sa auction lists..." -ForegroundColor Cyan
W "`n===== 1) infath.gov.sa auction list ====="
foreach ($tab in @('ongoing', 'upcoming')) {
  $html = Get-Page "https://infath.gov.sa/ar/auctions/?tab=$tab" "infath-$tab.html"
  if (-not $html) { continue }
  $ids = Uniq ([regex]::Matches($html, 'AuctionId=(\d+)') | ForEach-Object { $_.Groups[1].Value }) 500
  W ("[{0}] auctions on page 1: {1}" -f $tab, @($ids).Count)
  $links = Uniq ([regex]::Matches($html, 'href="([^"]+)"') | ForEach-Object { $_.Groups[1].Value } |
    Where-Object { $_ -match '(?i)page|pagenumber|pageindex|p=\d' }) 40
  W ("[{0}] page links:" -f $tab)
  $links | ForEach-Object { W ("   " + $_) }
  $pg = [regex]::Match($html, '(?s)class="[^"]*pagination[^"]*".{0,3000}')
  if ($pg.Success) { W ("[{0}] pagination html: " -f $tab); W ($pg.Value.Substring(0, [Math]::Min(1500, $pg.Value.Length)) -replace '\s+', ' ') }
}

Write-Host ">> Checking auctions.infath.gov.sa..." -ForegroundColor Cyan
W "`n===== 2) auctions.infath.gov.sa ====="
$base = 'https://auctions.infath.gov.sa'
$robots = Get-Page "$base/robots.txt" 'platform-robots.txt'
if ($robots) { W '--- robots.txt ---'; W $robots; W '------------------' }
$homeHtml = Get-Page "$base/home" 'platform-home.html'
if ($homeHtml) {
  W ("title: " + ([regex]::Match($homeHtml, '<title>([^<]*)</title>').Groups[1].Value))
  $scripts = Uniq ([regex]::Matches($homeHtml, '<script[^>]+src="([^"]+)"') | ForEach-Object { $_.Groups[1].Value }) 20
  W ("scripts: " + @($scripts).Count)
  $found = @()
  $i = 0
  foreach ($s in $scripts) {
    $i++
    $u = if ($s -match '^https?://') { $s } elseif ($s.StartsWith('/')) { $base + $s } else { "$base/$s" }
    $js = Get-Page $u ("platform-script-$i.js")
    if (-not $js) { continue }
    $found += [regex]::Matches($js, 'https?://[A-Za-z0-9.\-]+(?:/[A-Za-z0-9_\-./{}]*)?') | ForEach-Object { $_.Value }
    $found += [regex]::Matches($js, '["''`](/?(?:api|graphql|v\d)[A-Za-z0-9_\-./{}]*)["''`]') | ForEach-Object { $_.Groups[1].Value }
  }
  # the app loads its pages in small parts ("chunk-XXXX.js"); the data addresses are inside them.
  # Save them all in ONE file (platform-chunks.js) so it can be sent in one go.
  $mainText = ''
  Get-ChildItem $out -Filter 'platform-script-*.js' | ForEach-Object { $mainText += (Get-Content $_.FullName -Raw -Encoding UTF8) }
  $chunks = Uniq ([regex]::Matches($mainText, 'chunk-[A-Za-z0-9]+\.js') | ForEach-Object { $_.Value }) 300
  W ("chunks: " + @($chunks).Count)
  $sb = New-Object System.Text.StringBuilder
  $tmp = Join-Path $out 'tmp-chunk.js'
  foreach ($c in $chunks) {
    try {
      Invoke-WebRequest -UseBasicParsing -Uri "$base/$c" -OutFile $tmp -TimeoutSec 60
      [void]$sb.AppendLine("/* ===== $c ===== */")
      [void]$sb.AppendLine((Get-Content $tmp -Raw -Encoding UTF8))
    } catch { W ("FAIL $c : " + $_.Exception.Message) }
    Start-Sleep -Milliseconds 200
  }
  Remove-Item $tmp -ErrorAction SilentlyContinue
  [IO.File]::WriteAllText((Join-Path $out 'platform-chunks.js'), $sb.ToString(), (New-Object Text.UTF8Encoding $false))
  W ("platform-chunks.js: {0} bytes" -f $sb.Length)
  $null = Get-Page "$base/sitemap.xml" 'platform-sitemap.xml'
  W "--- addresses found in the scripts (data/API candidates) ---"
  Uniq ($found | Where-Object { $_ -notmatch '(?i)\.(png|jpe?g|svg|gif|woff2?|ttf|css)$|w3\.org|schema\.org|googleapis|gstatic|facebook|twitter|instagram|youtube|linkedin|apple\.com|google\.com/maps' }) 200 |
    ForEach-Object { W ("   " + $_) }
}

W "`nDone."
Write-Host "`n>> Done. Send these to Claude:" -ForegroundColor Green
Write-Host "   $report" -ForegroundColor Green
Write-Host "   $(Join-Path $out 'platform-chunks.js')" -ForegroundColor Green
Write-Host "   $(Join-Path $out 'platform-sitemap.xml')" -ForegroundColor Green
Start-Process explorer.exe $out
