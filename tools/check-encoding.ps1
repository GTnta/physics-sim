param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string[]]$Include = @("*.html", "*.md", "*.css", "*.js", "*.mjs", "*.json", "*.svg"),
  [string[]]$ExcludeDirectory = @(".git", ".edge-profile", ".agents", ".tmp.drivedownload", ".tmp.driveupload", "node_modules")
)

$ErrorActionPreference = "Stop"

$utf8Strict = [System.Text.UTF8Encoding]::new($false, $true)
$rootFullPath = [System.IO.Path]::GetFullPath($Root)
$errors = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

function Get-RelativePathCompat {
  param([string]$BasePath, [string]$TargetPath)
  $baseFull = [System.IO.Path]::GetFullPath($BasePath).TrimEnd([char[]]@("\", "/")) + [System.IO.Path]::DirectorySeparatorChar
  $targetFull = [System.IO.Path]::GetFullPath($TargetPath)
  $baseUri = [Uri]$baseFull
  $targetUri = [Uri]$targetFull
  return [Uri]::UnescapeDataString($baseUri.MakeRelativeUri($targetUri).ToString()).Replace("/", [System.IO.Path]::DirectorySeparatorChar)
}

function Test-ExcludedPath {
  param([System.IO.FileInfo]$File)
  $relative = Get-RelativePathCompat -BasePath $rootFullPath -TargetPath $File.FullName
  $parts = $relative -split "[\\/]"
  foreach ($part in $parts) {
    if ($ExcludeDirectory -contains $part) { return $true }
  }
  return $false
}

function Get-TextFileCandidates {
  $all = New-Object System.Collections.Generic.List[System.IO.FileInfo]
  foreach ($pattern in $Include) {
    Get-ChildItem -Path $rootFullPath -Recurse -File -Filter $pattern -ErrorAction SilentlyContinue |
      Where-Object { -not (Test-ExcludedPath -File $_) } |
      ForEach-Object { $all.Add($_) }
  }
  $all | Sort-Object FullName -Unique
}

$files = Get-TextFileCandidates
foreach ($file in $files) {
  $relative = Get-RelativePathCompat -BasePath $rootFullPath -TargetPath $file.FullName
  $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
  try {
    $text = $utf8Strict.GetString($bytes)
  } catch {
    $errors.Add("$relative : cannot be decoded as strict UTF-8")
    continue
  }

  if ($text.Contains([char]0xFFFD)) {
    $errors.Add("$relative : contains replacement character U+FFFD")
  }

  $mojibakeMarkers = @(0x7E3A, 0x8B41, 0x8373, 0x8B1A, 0x7E67, 0x9AF1, 0x86FB)
  foreach ($marker in $mojibakeMarkers) {
    if ($text.Contains([char]$marker)) {
      $warnings.Add("$relative : possible mojibake marker detected")
      break
    }
  }

  if ($file.Extension.ToLowerInvariant() -eq ".html" -and $text -notmatch "(?is)<meta\s+charset\s*=\s*[""']?utf-?8") {
    $warnings.Add("$relative : missing <meta charset=""UTF-8"">")
  }
}

foreach ($warning in $warnings) {
  Write-Warning $warning
}

if ($errors.Count -gt 0) {
  foreach ($errorMessage in $errors) {
    Write-Error $errorMessage -ErrorAction Continue
  }
  Write-Host "Encoding check failed: $($errors.Count) error(s), $($warnings.Count) warning(s)."
  exit 1
}

Write-Host "Encoding check passed: $($files.Count) file(s), $($warnings.Count) warning(s)."
