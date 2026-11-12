# Mazad Radar - one-time, READ-ONLY sample of Infath's public auctions data (auctions.infath.gov.sa).
#   irm https://raw.githubusercontent.com/aiclaude9999/Riyadh-Land-Auctions-/ccr-684fffdf-bi3tdz/scripts/infath-laptop/sample-infath-platform.ps1 | iex
# Downloads a few public JSON answers (no login, no passwords, nothing is changed) into
# Desktop\infath-sample, so the collector can be built on the real field names.

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$out = Join-Path ([Environment]::GetFolderPath('Desktop')) 'infath-sample'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$api = 'https://api.infath.gov.sa/auctions-platform/v1/auctions/api/v1'
$headers = @{ 'Accept' = 'application/json'; 'Accept-Language' = 'ar'; 'x-platform-id' = 'web' }
$log = Join-Path $out 'log.txt'
Set-Content -Path $log -Value "Infath platform sample $(Get-Date -Format s)" -Encoding UTF8
$realEstate = '11111111-1111-1111-1111-111111111111'

function Save($path, $name) {
  $file = Join-Path $out $name
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri ($api + $path) -Headers $headers -OutFile $file -PassThru -TimeoutSec 60
    Add-Content $log ("OK   {0} {1} -> {2} ({3} bytes)" -f $r.StatusCode, $path, $name, (Get-Item $file).Length) -Encoding UTF8
    return (Get-Content $file -Raw -Encoding UTF8)
  } catch {
    Add-Content $log ("FAIL {0} : {1}" -f $path, $_.Exception.Message) -Encoding UTF8
    return $null
  }
  finally { Start-Sleep -Milliseconds 500 }
}

Write-Host "`n>> Downloading samples from Infath's auctions platform..." -ForegroundColor Cyan
$list = Save "/auction-items?pageIndex=1&pageSize=20&categoryId=$realEstate&statusIds=2,3" '01-list-real-estate.json'
$null = Save "/auction-items?pageIndex=2&pageSize=20&categoryId=$realEstate&statusIds=2,3" '02-list-page2.json'
$null = Save '/auction-items/status-summary' '03-status-summary.json'
$null = Save "/lookups/categories?parentId=$realEstate" '04-real-estate-subcategories.json'
$null = Save '/lookups/regions' '05-regions.json'
$null = Save '/lookups/cities' '06-cities.json'

# first item's details (its id is the first GUID in the list answer)
if ($list) {
  $ids = [regex]::Matches($list, '"id"\s*:\s*"([0-9a-fA-F\-]{36})"') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique -First 2
  $n = 0
  foreach ($id in $ids) {
    $n++
    $null = Save "/auction-items/$id" ("1$n-item.json")
    $null = Save "/auction-items/$id/media" ("1$n-item-media.json")
    $null = Save "/auction-items/$id/documents" ("1$n-item-documents.json")
    $null = Save "/auction-items/$id/project" ("1$n-item-project.json")
    $null = Save "/auction-items/$id/project/assets?pageIndex=1&pageSize=20" ("1$n-item-project-assets.json")
  }
}

Write-Host "`n>> Done. Send Claude all the files in this folder:" -ForegroundColor Green
Write-Host "   $out" -ForegroundColor Green
Start-Process explorer.exe $out
