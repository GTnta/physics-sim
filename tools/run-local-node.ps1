param(
  [string]$Root = "",
  [string]$ToolsRoot = "",
  [string]$Evaluate = "",
  [string]$Script = "",
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ArgumentList
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
$playwrightNodeModules = Join-Path $toolsFull "playwright\node_modules"

if (-not [System.IO.File]::Exists($nodeExe)) {
  throw "Node.js was not found: $nodeExe"
}
if (-not [System.IO.Directory]::Exists($playwrightNodeModules)) {
  throw "Playwright node_modules was not found: $playwrightNodeModules"
}

$env:Path = "$nodeDir;$env:Path"
$env:NODE_PATH = $playwrightNodeModules

if (-not [string]::IsNullOrWhiteSpace($Evaluate)) {
  & $nodeExe -e $Evaluate @ArgumentList
  exit $LASTEXITCODE
}

if (-not [string]::IsNullOrWhiteSpace($Script)) {
  & $nodeExe $Script @ArgumentList
  exit $LASTEXITCODE
}

if (-not $ArgumentList -or $ArgumentList.Count -eq 0) {
  & $nodeExe -v
  exit $LASTEXITCODE
}

& $nodeExe @ArgumentList
exit $LASTEXITCODE
