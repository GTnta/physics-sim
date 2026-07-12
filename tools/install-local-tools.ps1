param(
  [string]$Root = "",
  [string]$ToolsRoot = "",
  [string]$NodeVersion = "v24.18.0",
  [string]$PlaywrightPackage = "playwright@1.61.1"
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
$downloads = Join-Path $toolsFull "downloads"

if ($NodeVersion -notmatch "^v\d+\.\d+\.\d+$") {
  throw "Invalid NodeVersion: $NodeVersion"
}

$nodeName = "node-$NodeVersion-win-x64"
$nodeZip = Join-Path $downloads "$nodeName.zip"
$nodeDir = Join-Path $toolsFull $nodeName
$nodeExe = Join-Path $nodeDir "node.exe"
$npmCmd = Join-Path $nodeDir "npm.cmd"
$nodeUrl = "https://nodejs.org/dist/$NodeVersion/$nodeName.zip"
$shasumsUrl = "https://nodejs.org/dist/$NodeVersion/SHASUMS256.txt"
$shasumsPath = Join-Path $downloads "SHASUMS256-$NodeVersion.txt"
$playwrightDir = Join-Path $toolsFull "playwright"

New-Item -ItemType Directory -Path $downloads -Force | Out-Null

if (-not [System.IO.File]::Exists($nodeZip)) {
  Write-Host "Downloading $nodeUrl"
  Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeZip
}

Write-Host "Downloading $shasumsUrl"
Invoke-WebRequest -Uri $shasumsUrl -OutFile $shasumsPath

$actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $nodeZip).Hash.ToLowerInvariant()
$expectedLine = Get-Content -LiteralPath $shasumsPath | Where-Object { $_ -match [regex]::Escape("$nodeName.zip") } | Select-Object -First 1
if (-not $expectedLine) {
  throw "Could not find checksum for $nodeName.zip"
}
$expectedHash = ($expectedLine -split "\s+")[0].ToLowerInvariant()
if ($actualHash -ne $expectedHash) {
  throw "Node.js checksum mismatch. expected=$expectedHash actual=$actualHash"
}
Write-Host "Node.js checksum verified."

if (-not [System.IO.File]::Exists($nodeExe)) {
  Write-Host "Extracting $nodeZip"
  Expand-Archive -LiteralPath $nodeZip -DestinationPath $toolsFull -Force
}

if (-not [System.IO.File]::Exists($nodeExe)) {
  throw "Node.js was not installed: $nodeExe"
}
if (-not [System.IO.File]::Exists($npmCmd)) {
  throw "npm was not installed: $npmCmd"
}

New-Item -ItemType Directory -Path $playwrightDir -Force | Out-Null
Push-Location $playwrightDir
try {
  if (-not [System.IO.File]::Exists((Join-Path $playwrightDir "package.json"))) {
    & $npmCmd init -y | Out-Null
  }
  & $npmCmd install $PlaywrightPackage --no-audit --no-fund
} finally {
  Pop-Location
}

& (Join-Path $scriptDir "check-local-tools.ps1") -Root $repoRoot -ToolsRoot $toolsFull
