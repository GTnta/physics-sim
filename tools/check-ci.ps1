param(
  [string]$Root = ""
)

$ErrorActionPreference = "Stop"

$scriptDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptDir)) {
  $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
if ([string]::IsNullOrWhiteSpace($Root)) {
  $Root = (Resolve-Path (Join-Path $scriptDir "..")).Path
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

Invoke-Check -Name "Encoding" -Block {
  & (Join-Path $scriptDir "check-encoding.ps1") -Root $Root
}

Invoke-Check -Name "Touch action" -Block {
  & (Join-Path $scriptDir "check-touch-action.ps1") -Root $Root
}

Invoke-Check -Name "HTML smoke" -Block {
  & (Join-Path $scriptDir "check-html-smoke.ps1") -Root $Root
}

Invoke-Check -Name "Index data" -Block {
  & (Join-Path $scriptDir "check-index-data.ps1") -Root $Root
}

Write-Host ""
Write-Host "CI checks passed."
