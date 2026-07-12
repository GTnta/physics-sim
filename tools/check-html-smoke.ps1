param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string[]]$Path,
  [string[]]$ExcludeDirectory = @(".git", ".edge-profile", ".agents", ".tmp.drivedownload", ".tmp.driveupload", "node_modules")
)

$ErrorActionPreference = "Stop"

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

function Get-TargetFiles {
  if ($Path -and $Path.Count -gt 0) {
    foreach ($item in $Path) {
      $resolved = Resolve-Path -Path $item -ErrorAction Stop
      foreach ($entry in $resolved) {
        $file = Get-Item -LiteralPath $entry.Path
        if ($file.PSIsContainer) {
          Get-ChildItem -LiteralPath $file.FullName -Recurse -File -Filter "*.html" |
            Where-Object { -not (Test-ExcludedPath -File $_) }
        } elseif ($file.Extension -eq ".html") {
          $file
        }
      }
    }
  } else {
    Get-ChildItem -Path $rootFullPath -Recurse -File -Filter "*.html" |
      Where-Object { -not (Test-ExcludedPath -File $_) }
  }
}

function Get-Ids {
  param([string]$Text)
  $matches = [regex]::Matches($Text, "\sid\s*=\s*[""']([^""']+)[""']", "IgnoreCase")
  foreach ($match in $matches) {
    $match.Groups[1].Value
  }
}

$files = Get-TargetFiles | Sort-Object FullName -Unique
foreach ($file in $files) {
  $relative = Get-RelativePathCompat -BasePath $rootFullPath -TargetPath $file.FullName
  $text = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)

  if ($text -notmatch "(?is)^\s*<!doctype\s+html") {
    $warnings.Add("$relative : <!DOCTYPE html> was not found near the top")
  }
  if ($text -notmatch "(?is)<html\b") {
    $errors.Add("$relative : <html> was not found")
  }
  if ($text -notmatch "(?is)</html\s*>") {
    $errors.Add("$relative : </html> was not found")
  }
  if ($text -notmatch "(?is)<meta\s+name\s*=\s*[""']viewport[""']") {
    $warnings.Add("$relative : viewport meta was not found")
  }
  if ($text -notmatch "(?is)<title\b[^>]*>.+?</title\s*>") {
    $warnings.Add("$relative : title was not found")
  }
  if ($text -notmatch "(?is)<canvas\b") {
    $warnings.Add("$relative : canvas was not found")
  }

  $duplicateIds = Get-Ids -Text $text |
    Group-Object |
    Where-Object { $_.Count -gt 1 } |
    ForEach-Object { "$($_.Name) ($($_.Count))" }
  if ($duplicateIds.Count -gt 0) {
    $errors.Add("$relative : duplicate id(s): $($duplicateIds -join ', ')")
  }

  $scriptOpenCount = ([regex]::Matches($text, "<script\b", "IgnoreCase")).Count
  $scriptCloseCount = ([regex]::Matches($text, "</script\s*>", "IgnoreCase")).Count
  if ($scriptOpenCount -ne $scriptCloseCount) {
    $errors.Add("$relative : script tag count mismatch ($scriptOpenCount / $scriptCloseCount)")
  }
}

foreach ($warning in $warnings) {
  Write-Warning $warning
}

if ($errors.Count -gt 0) {
  foreach ($errorMessage in $errors) {
    Write-Error $errorMessage -ErrorAction Continue
  }
  Write-Host "HTML smoke check failed: $($errors.Count) error(s), $($warnings.Count) warning(s)."
  exit 1
}

Write-Host "HTML smoke check passed: $($files.Count) file(s), $($warnings.Count) warning(s)."
