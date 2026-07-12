param(
  [string]$Root = "",
  [string]$ToolsRoot = ""
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
if ([string]::IsNullOrWhiteSpace($ToolsRoot)) {
  $ToolsRoot = Join-Path (Split-Path -Parent $repoRoot) ".local-tools"
}
$toolsFull = [System.IO.Path]::GetFullPath($ToolsRoot)
$nodeDir = Join-Path $toolsFull "node-v24.18.0-win-x64"
$nodeExe = Join-Path $nodeDir "node.exe"
$npmCmd = Join-Path $nodeDir "npm.cmd"
$npxCmd = Join-Path $nodeDir "npx.cmd"
$playwrightDir = Join-Path $toolsFull "playwright"
$playwrightModule = Join-Path $playwrightDir "node_modules\playwright"

if (-not [System.IO.File]::Exists($nodeExe)) {
  throw "Node.js was not found: $nodeExe"
}
if (-not [System.IO.File]::Exists($npmCmd)) {
  throw "npm was not found: $npmCmd"
}
if (-not [System.IO.File]::Exists($npxCmd)) {
  throw "npx was not found: $npxCmd"
}
if (-not [System.IO.Directory]::Exists($playwrightModule)) {
  throw "Playwright was not found: $playwrightModule"
}

$env:Path = "$nodeDir;$env:Path"
Push-Location $playwrightDir
try {
  $nodeVersion = & $nodeExe -v
  $npmVersion = & $npmCmd -v
  $playwrightVersion = & $npxCmd playwright --version
} finally {
  Pop-Location
}

Write-Host "Local tools are available."
Write-Host "Tools root: $toolsFull"
Write-Host "Node: $nodeVersion"
Write-Host "npm: $npmVersion"
Write-Host "Playwright: $playwrightVersion"
