param(
  [string]$Root = "",
  [string]$ToolsRoot = "",
  [string]$Output = "index.html",
  [string]$Data = "data/index.json",
  [string]$Template = "tools/index-template.html"
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
if (-not [System.IO.File]::Exists($nodeExe)) {
  throw "Node.js was not found: $nodeExe"
}

$env:Path = "$nodeDir;$env:Path"
& $nodeExe `
  (Join-Path $scriptDir "build-index.js") `
  --output $Output `
  --data $Data `
  --template $Template

exit $LASTEXITCODE
