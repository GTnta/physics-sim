param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string[]]$Path
)

$ErrorActionPreference = "Stop"

$repoRoot = [System.IO.Path]::GetFullPath($Root)
$failures = New-Object System.Collections.Generic.List[string]

function Get-RelativePathCompat {
  param([string]$BasePath, [string]$TargetPath)
  $baseFull = [System.IO.Path]::GetFullPath($BasePath).TrimEnd([char[]]@("\", "/")) + [System.IO.Path]::DirectorySeparatorChar
  $targetFull = [System.IO.Path]::GetFullPath($TargetPath)
  $baseUri = [Uri]$baseFull
  $targetUri = [Uri]$targetFull
  return [Uri]::UnescapeDataString($baseUri.MakeRelativeUri($targetUri).ToString()).Replace("/", [System.IO.Path]::DirectorySeparatorChar)
}

function Resolve-InputPath {
  param([string]$InputPath)
  if ([System.IO.Path]::IsPathRooted($InputPath)) {
    return [System.IO.Path]::GetFullPath($InputPath)
  }
  return [System.IO.Path]::GetFullPath((Join-Path $repoRoot $InputPath))
}

if ($Path -and $Path.Count -gt 0) {
  $files = foreach ($item in $Path) {
    $resolved = Resolve-InputPath $item
    if (Test-Path -LiteralPath $resolved -PathType Leaf) {
      Get-Item -LiteralPath $resolved
    }
  }
} else {
  $files = Get-ChildItem -Path $repoRoot -Recurse -Filter "*.html" -File | Where-Object {
    $_.FullName -notmatch "[\\/]\.git[\\/]" -and $_.FullName -notmatch "[\\/]\.tmp\.driveupload[\\/]"
  }
}

$touchActionNonePattern = [regex]::new("touch-action\s*:\s*none", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
$canvasSelectorPattern = [regex]::new("(^|[\s>+~])canvas($|[\s.#:[>+~])|#[A-Za-z0-9_-]*Canvas($|[\s.#:[>+~])")

foreach ($file in $files) {
  $content = [System.IO.File]::ReadAllText($file.FullName)
  if ($content.IndexOf("touch-action", [StringComparison]::OrdinalIgnoreCase) -lt 0) { continue }
  if ($content.IndexOf("none", [StringComparison]::OrdinalIgnoreCase) -lt 0) { continue }

  foreach ($match in $touchActionNonePattern.Matches($content)) {
    $openBrace = $content.LastIndexOf("{", $match.Index)
    $closeBrace = $content.IndexOf("}", $match.Index)
    if ($openBrace -lt 0 -or $closeBrace -lt $match.Index) { continue }

    $previousCloseBrace = $content.LastIndexOf("}", $openBrace)
    $selectorStart = $previousCloseBrace + 1
    $selectorLength = $openBrace - $selectorStart
    if ($selectorLength -le 0) { continue }

    $selector = $content.Substring($selectorStart, $selectorLength)
    $matchesCanvas = $false
    foreach ($part in $selector.Split(",")) {
      if ($canvasSelectorPattern.IsMatch($part.Trim())) {
        $matchesCanvas = $true
        break
      }
    }
    if (-not $matchesCanvas) { continue }

    $before = $content.Substring(0, $match.Index)
    $lineNumber = ([regex]::Matches($before, "\r\n|\r|\n")).Count + 1
    $relative = Get-RelativePathCompat -BasePath $repoRoot -TargetPath $file.FullName
    $failures.Add("${relative}:${lineNumber} canvas-level touch-action:none blocks iPad zoom/scroll. Use pan-y pinch-zoom on the canvas and put touch-action:none only on explicit drag handles.")
  }
}

if ($failures.Count -gt 0) {
  Write-Host "Canvas touch-action check failed:"
  foreach ($failure in $failures) {
    Write-Host "  - $failure"
  }
  exit 1
}

Write-Host "Canvas touch-action check passed for $($files.Count) HTML file(s)."
