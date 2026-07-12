param(
  [string]$Root = "",
  [string]$Config = "",
  [string[]]$Name,
  [string[]]$Path,
  [switch]$List
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
if ([string]::IsNullOrWhiteSpace($Config)) {
  $Config = Join-Path $scriptDir "visual-targets.json"
}
if (-not [System.IO.Path]::IsPathRooted($Config)) {
  $Config = Join-Path $repoRoot $Config
}
$configFull = [System.IO.Path]::GetFullPath($Config)
if (-not [System.IO.File]::Exists($configFull)) {
  throw "Visual target config was not found: $configFull"
}

function ConvertTo-StringList {
  param([string[]]$Values)
  $items = New-Object System.Collections.Generic.List[string]
  foreach ($value in $Values) {
    foreach ($part in ([string]$value -split ",")) {
      $trimmed = $part.Trim()
      if (-not [string]::IsNullOrWhiteSpace($trimmed)) {
        $items.Add($trimmed) | Out-Null
      }
    }
  }
  return @($items)
}

function Get-TargetArrayValue {
  param(
    [object]$Target,
    [string]$PropertyName,
    [string[]]$DefaultValue
  )
  if ($Target.PSObject.Properties.Name -contains $PropertyName -and $null -ne $Target.$PropertyName) {
    return @($Target.$PropertyName | ForEach-Object { [string]$_ })
  }
  return $DefaultValue
}

$configData = Get-Content -LiteralPath $configFull -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not ($configData.PSObject.Properties.Name -contains "targets")) {
  throw "Visual target config must contain a targets array."
}

$nameFilters = ConvertTo-StringList -Values $Name
$pathFilters = ConvertTo-StringList -Values $Path
$targets = @($configData.targets)

if ($nameFilters.Count -gt 0) {
  $targets = @($targets | Where-Object { $nameFilters -contains $_.name })
}
if ($pathFilters.Count -gt 0) {
  $targets = @($targets | Where-Object { $pathFilters -contains $_.path })
}

if ($List) {
  foreach ($target in $targets) {
    Write-Host ("{0}`t{1}`t{2}" -f $target.name, $target.path, $target.selector)
  }
  return
}

if ($targets.Count -eq 0) {
  throw "No visual targets matched the requested filters."
}

$checker = Join-Path $scriptDir "check-visual-target.ps1"
if (-not [System.IO.File]::Exists($checker)) {
  throw "Visual target checker was not found: $checker"
}

$failures = New-Object System.Collections.Generic.List[string]

foreach ($target in $targets) {
  if ([string]::IsNullOrWhiteSpace($target.name)) {
    throw "A visual target is missing name."
  }
  if ([string]::IsNullOrWhiteSpace($target.path)) {
    throw "Visual target '$($target.name)' is missing path."
  }
  if ([string]::IsNullOrWhiteSpace($target.selector)) {
    throw "Visual target '$($target.name)' is missing selector."
  }

  $viewportWidth = Get-TargetArrayValue -Target $target -PropertyName "viewportWidth" -DefaultValue @("1280")
  $viewportHeight = Get-TargetArrayValue -Target $target -PropertyName "viewportHeight" -DefaultValue @("720")
  Write-Host ""
  Write-Host ("== {0} ==" -f $target.name)

  $arguments = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $checker,
    "-Root", $repoRoot,
    "-Path", $target.path,
    "-Selector", $target.selector,
    "-ViewportWidth", ($viewportWidth -join ","),
    "-ViewportHeight", ($viewportHeight -join ",")
  )

  & powershell.exe @arguments
  if ($LASTEXITCODE -ne 0) {
    $failures.Add($target.name) | Out-Null
  }
}

if ($failures.Count -gt 0) {
  throw "Visual target profile check failed: $($failures -join ', ')"
}

Write-Host ""
Write-Host "Visual target profile check passed: $($targets.Count) target(s)."
