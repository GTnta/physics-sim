param(
  [string]$Root = "",
  [string]$Data = "data/index.json"
)

$ErrorActionPreference = "Stop"

$scriptDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptDir)) {
  $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
if ([string]::IsNullOrWhiteSpace($Root)) {
  $Root = (Resolve-Path (Join-Path $scriptDir "..")).Path
}
$repoRoot = [System.IO.Path]::GetFullPath($Root)
if (-not [System.IO.Path]::IsPathRooted($Data)) {
  $Data = Join-Path $repoRoot $Data
}
$dataFull = [System.IO.Path]::GetFullPath($Data)
if (-not [System.IO.File]::Exists($dataFull)) {
  throw "Index data was not found: $dataFull"
}

$dataObject = Get-Content -LiteralPath $dataFull -Raw -Encoding UTF8 | ConvertFrom-Json
$failures = New-Object System.Collections.Generic.List[string]
$hrefs = New-Object System.Collections.Generic.List[string]
$cardCount = 0

function Test-LocalHref {
  param(
    [string]$Href,
    [string]$Label
  )
  if ([string]::IsNullOrWhiteSpace($Href)) {
    $failures.Add("${Label}: missing href") | Out-Null
    return
  }
  if ($Href -match "^[a-zA-Z][a-zA-Z0-9+.-]*:") {
    return
  }
  $cleanHref = ($Href -split "[?#]", 2)[0]
  $target = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $cleanHref))
  $rootPrefix = $repoRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  if (-not $target.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    $failures.Add("${Label}: href escapes repository ($Href)") | Out-Null
    return
  }
  if (-not [System.IO.File]::Exists($target) -and -not [System.IO.Directory]::Exists($target)) {
    $failures.Add("${Label}: target does not exist ($Href)") | Out-Null
  }
}

foreach ($category in @($dataObject.categories)) {
  if ([string]::IsNullOrWhiteSpace($category.id)) {
    $failures.Add("category is missing id") | Out-Null
  }
  if ([string]::IsNullOrWhiteSpace($category.title)) {
    $failures.Add("category is missing title") | Out-Null
  }
  foreach ($unit in @($category.units)) {
    if ([string]::IsNullOrWhiteSpace($unit.id)) {
      $failures.Add("$($category.title): unit is missing id") | Out-Null
    }
    if ([string]::IsNullOrWhiteSpace($unit.title)) {
      $failures.Add("$($category.title): unit is missing title") | Out-Null
    }
    foreach ($card in @($unit.cards)) {
      $cardCount += 1
      $label = "$($category.title) / $($unit.title) / $($card.title)"
      if ([string]::IsNullOrWhiteSpace($card.title)) {
        $failures.Add("${label}: missing title") | Out-Null
      }
      if ([string]::IsNullOrWhiteSpace($card.description)) {
        $failures.Add("${label}: missing description") | Out-Null
      }
      Test-LocalHref -Href $card.href -Label $label
      if (-not [string]::IsNullOrWhiteSpace($card.href)) {
        $hrefs.Add($card.href) | Out-Null
      }
      if ($card.icon -and $card.icon.type -eq "image") {
        Test-LocalHref -Href $card.icon.src -Label "$label icon"
      }
    }
  }
}

foreach ($link in @($dataObject.archive.links)) {
  Test-LocalHref -Href $link.href -Label "archive / $($link.text)"
}

if ($cardCount -le 0) {
  $failures.Add("index data contains no cards") | Out-Null
}

$duplicateHrefs = $hrefs | Group-Object | Where-Object { $_.Count -gt 1 }
foreach ($group in $duplicateHrefs) {
  $failures.Add("duplicate card href: $($group.Name)") | Out-Null
}

foreach ($entry in @($dataObject.logs)) {
  if ($entry.date -notmatch "^\d{4}-\d{2}-\d{2}$") {
    $failures.Add("log has invalid date: $($entry.date)") | Out-Null
  }
  if ([string]::IsNullOrWhiteSpace($entry.text)) {
    $failures.Add("log has empty text: $($entry.date)") | Out-Null
  }
}

if ($failures.Count -gt 0) {
  foreach ($failure in $failures) {
    Write-Error $failure -ErrorAction Continue
  }
  exit 1
}

Write-Host "Index data check passed: $cardCount card(s), $($dataObject.logs.Count) log item(s)."
