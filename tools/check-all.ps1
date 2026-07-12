param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string[]]$HtmlPath,
  [string[]]$ViewportPath = @(
    "projectile/projectile-simulator.html",
    "projectile-variations/projectile-variation-lab.html"
  ),
  [switch]$SkipViewport
)

$ErrorActionPreference = "Stop"

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

function Invoke-Check {
  param(
    [string]$Name,
    [scriptblock]$Block
  )
  Write-Host ""
  Write-Host "== $Name =="
  & $Block
  $success = $?
  $exitCode = $LASTEXITCODE
  if (-not $success -or ($null -ne $exitCode -and $exitCode -ne 0)) {
    throw "$Name failed with exit code $exitCode"
  }
}

$HtmlPath = ConvertTo-StringList -Values $HtmlPath
$ViewportPath = ConvertTo-StringList -Values $ViewportPath

Invoke-Check -Name "Encoding" -Block {
  & (Join-Path $PSScriptRoot "check-encoding.ps1") -Root $Root
}

Invoke-Check -Name "Touch action" -Block {
  if ($HtmlPath -and $HtmlPath.Count -gt 0) {
    & (Join-Path $PSScriptRoot "check-touch-action.ps1") -Root $Root -Path $HtmlPath
  } else {
    & (Join-Path $PSScriptRoot "check-touch-action.ps1") -Root $Root
  }
}

Invoke-Check -Name "HTML smoke" -Block {
  if ($HtmlPath -and $HtmlPath.Count -gt 0) {
    & (Join-Path $PSScriptRoot "check-html-smoke.ps1") -Root $Root -Path $HtmlPath
  } else {
    & (Join-Path $PSScriptRoot "check-html-smoke.ps1") -Root $Root
  }
}

if (-not $SkipViewport) {
  Invoke-Check -Name "iPad viewport" -Block {
    & (Join-Path $PSScriptRoot "check-ipad-viewport.ps1") -Path $ViewportPath
  }
}

Write-Host ""
Write-Host "All checks passed."
