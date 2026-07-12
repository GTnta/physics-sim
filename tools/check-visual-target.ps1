param(
  [string]$Root = "",
  [Parameter(Mandatory = $true)]
  [string[]]$Path,
  [Parameter(Mandatory = $true)]
  [string[]]$Selector,
  [int]$Port = 0,
  [string]$Bind = "127.0.0.1",
  [string]$BrowserPath = "",
  [string[]]$ViewportWidth = @("1280"),
  [string[]]$ViewportHeight = @("720"),
  [string]$OutputDir = "",
  [int]$Padding = 12,
  [int]$MaxHorizontalOverflow = 0,
  [int]$MaxTargetOverflow = 1,
  [double]$MinVisibleRatio = 0.95,
  [int]$CdpTimeoutSeconds = 20,
  [switch]$AllowTargetOverflow
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
if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  $OutputDir = Join-Path $repoRoot ".tmp\visual-targets"
}
$outputFull = [System.IO.Path]::GetFullPath($OutputDir)
$serverProcess = $null
$browserProcess = $null
$socket = $null
$profileDir = Join-Path $env:TEMP ("physics-sim-visual-target-" + $PID)
$failures = New-Object System.Collections.Generic.List[string]
$results = New-Object System.Collections.Generic.List[object]

function Get-RelativePathCompat {
  param([string]$BasePath, [string]$TargetPath)
  $baseFull = [System.IO.Path]::GetFullPath($BasePath).TrimEnd([char[]]@("\", "/")) + [System.IO.Path]::DirectorySeparatorChar
  $targetFull = [System.IO.Path]::GetFullPath($TargetPath)
  $baseUri = [Uri]$baseFull
  $targetUri = [Uri]$targetFull
  return [Uri]::UnescapeDataString($baseUri.MakeRelativeUri($targetUri).ToString()).Replace("/", [System.IO.Path]::DirectorySeparatorChar)
}

function Get-FreePort {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  $listener.Start()
  $freePort = $listener.LocalEndpoint.Port
  $listener.Stop()
  return $freePort
}

function Wait-Http {
  param([string]$Url, [int]$TimeoutSeconds = 10)
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    try {
      Invoke-RestMethod -Uri $Url -TimeoutSec 2 | Out-Null
      return $true
    } catch {
      Start-Sleep -Milliseconds 200
    }
  }
  return $false
}

function Find-Browser {
  param([string]$ExplicitPath)
  if ($ExplicitPath -and [System.IO.File]::Exists($ExplicitPath)) { return $ExplicitPath }
  $candidates = @(
    (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
    (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe")
  )
  foreach ($candidate in $candidates) {
    if ($candidate -and [System.IO.File]::Exists($candidate)) { return $candidate }
  }
  throw "Microsoft Edge or Google Chrome was not found. Pass -BrowserPath explicitly."
}

function Receive-WebSocketText {
  param([System.Net.WebSockets.ClientWebSocket]$Socket)
  $buffer = New-Object byte[] 65536
  $builder = [System.Text.StringBuilder]::new()
  do {
    $segment = [ArraySegment[byte]]::new($buffer)
    $cts = [Threading.CancellationTokenSource]::new()
    $cts.CancelAfter([TimeSpan]::FromSeconds($CdpTimeoutSeconds))
    try {
      $result = $Socket.ReceiveAsync($segment, $cts.Token).GetAwaiter().GetResult()
    } catch {
      throw "Timed out while waiting for DevTools websocket response."
    } finally {
      $cts.Dispose()
    }
    if ($result.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) {
      throw "DevTools websocket closed unexpectedly."
    }
    $chunk = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count)
    [void]$builder.Append($chunk)
  } while (-not $result.EndOfMessage)
  return $builder.ToString()
}

$script:cdpId = 0
function Invoke-Cdp {
  param(
    [System.Net.WebSockets.ClientWebSocket]$Socket,
    [string]$Method,
    [hashtable]$Params = @{}
  )
  $script:cdpId += 1
  $id = $script:cdpId
  $payload = @{ id = $id; method = $Method; params = $Params } | ConvertTo-Json -Depth 40 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
  [void]$Socket.SendAsync(
    [ArraySegment[byte]]::new($bytes),
    [System.Net.WebSockets.WebSocketMessageType]::Text,
    $true,
    [Threading.CancellationToken]::None
  ).GetAwaiter().GetResult()

  while ($true) {
    try {
      $message = Receive-WebSocketText -Socket $Socket | ConvertFrom-Json
    } catch {
      throw "$Method failed while waiting for response: $($_.Exception.Message)"
    }
    if ($message.id -eq $id) {
      if ($message.error) {
        throw "$Method failed: $($message.error.message)"
      }
      return $message.result
    }
  }
}

function Invoke-PageScript {
  param(
    [System.Net.WebSockets.ClientWebSocket]$Socket,
    [string]$Expression
  )
  $result = Invoke-Cdp -Socket $Socket -Method "Runtime.evaluate" -Params @{
    expression = $Expression
    returnByValue = $true
    awaitPromise = $true
  }
  if ($result.exceptionDetails) {
    $detail = $result.exceptionDetails.text
    if ($result.exceptionDetails.exception -and $result.exceptionDetails.exception.description) {
      $detail = $result.exceptionDetails.exception.description
    } elseif ($result.exceptionDetails.exception -and $result.exceptionDetails.exception.value) {
      $detail = "$detail $($result.exceptionDetails.exception.value)"
    }
    throw "Page script failed: $detail"
  }
  return $result.result.value
}

function Set-Viewport {
  param(
    [System.Net.WebSockets.ClientWebSocket]$Socket,
    [int]$Width,
    [int]$Height
  )
  Invoke-Cdp -Socket $Socket -Method "Emulation.setDeviceMetricsOverride" -Params @{
    width = $Width
    height = $Height
    deviceScaleFactor = 1
    mobile = $false
    screenWidth = $Width
    screenHeight = $Height
  } | Out-Null
}

function Open-Page {
  param(
    [System.Net.WebSockets.ClientWebSocket]$Socket,
    [string]$Url
  )
  Invoke-Cdp -Socket $Socket -Method "Page.navigate" -Params @{ url = $Url } | Out-Null
  for ($i = 0; $i -lt 80; $i += 1) {
    $state = Invoke-PageScript -Socket $Socket -Expression "document.readyState"
    if ($state -eq "complete") { return }
    Start-Sleep -Milliseconds 100
  }
  throw "Timed out while loading $Url"
}

function Add-ErrorCollector {
  param([System.Net.WebSockets.ClientWebSocket]$Socket)
  $source = @"
(() => {
  window.__codexVisualErrors = [];
  window.addEventListener('error', (event) => {
    window.__codexVisualErrors.push(String(event.message || 'error'));
  });
  window.addEventListener('unhandledrejection', (event) => {
    window.__codexVisualErrors.push(String(event.reason || 'unhandled rejection'));
  });
  const originalError = console.error;
  console.error = function(...args) {
    try {
      window.__codexVisualErrors.push(args.map((arg) => String(arg)).join(' '));
    } catch {}
    return originalError.apply(this, args);
  };
})();
"@
  Invoke-Cdp -Socket $Socket -Method "Page.addScriptToEvaluateOnNewDocument" -Params @{ source = $source } | Out-Null
}

function New-DevToolsPage {
  param([int]$DebugPort)
  $target = Invoke-RestMethod -Method Put -Uri "http://127.0.0.1:$DebugPort/json/new?about:blank"
  $newSocket = [System.Net.WebSockets.ClientWebSocket]::new()
  [void]$newSocket.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  Invoke-Cdp -Socket $newSocket -Method "Page.enable" | Out-Null
  Invoke-Cdp -Socket $newSocket -Method "Runtime.enable" | Out-Null
  Add-ErrorCollector -Socket $newSocket
  return [pscustomobject]@{
    Socket = $newSocket
    TargetId = $target.id
  }
}

function Close-DevToolsPage {
  param(
    [object]$Page,
    [int]$DebugPort
  )
  if ($Page -and $Page.Socket) {
    try { $Page.Socket.Dispose() } catch {}
  }
  if ($Page -and $Page.TargetId) {
    try {
      Invoke-RestMethod -Uri "http://127.0.0.1:$DebugPort/json/close/$($Page.TargetId)" -TimeoutSec 2 | Out-Null
    } catch {}
  }
}

function ConvertTo-SafeName {
  param([string]$Value)
  $safe = $Value -replace "[^A-Za-z0-9._-]+", "_"
  $safe = $safe.Trim("_")
  if ([string]::IsNullOrWhiteSpace($safe)) { $safe = "target" }
  if ($safe.Length -gt 90) { $safe = $safe.Substring(0, 90) }
  return $safe
}

function ConvertTo-IntList {
  param(
    [string[]]$Values,
    [string]$Name
  )
  $items = New-Object System.Collections.Generic.List[int]
  foreach ($value in $Values) {
    foreach ($part in ([string]$value -split ",")) {
      $trimmed = $part.Trim()
      if ([string]::IsNullOrWhiteSpace($trimmed)) { continue }
      $parsed = 0
      if (-not [int]::TryParse($trimmed, [Globalization.NumberStyles]::Integer, [Globalization.CultureInfo]::InvariantCulture, [ref]$parsed)) {
        throw "Invalid ${Name}: $trimmed"
      }
      if ($parsed -lt 100 -or $parsed -gt 4000) {
        throw "Unreasonable ${Name}: $parsed"
      }
      $items.Add($parsed) | Out-Null
    }
  }
  if ($items.Count -eq 0) {
    throw "No ${Name} values were provided."
  }
  return @($items)
}

function Get-TargetFiles {
  foreach ($item in $Path) {
    $resolved = Resolve-Path -Path $item -ErrorAction Stop
    foreach ($entry in $resolved) {
      $file = Get-Item -LiteralPath $entry.Path
      if ($file.PSIsContainer) {
        Get-ChildItem -LiteralPath $file.FullName -Recurse -File -Filter "*.html"
      } elseif ($file.Extension -eq ".html") {
        $file
      }
    }
  }
}

function Save-TargetScreenshot {
  param(
    [System.Net.WebSockets.ClientWebSocket]$Socket,
    [object]$Metrics,
    [string]$FilePath
  )
  $clip = @{
    x = [Math]::Max(0, [double]$Metrics.documentRect.x - $Padding)
    y = [Math]::Max(0, [double]$Metrics.documentRect.y - $Padding)
    width = [Math]::Max(1, [double]$Metrics.documentRect.width + (2 * $Padding))
    height = [Math]::Max(1, [double]$Metrics.documentRect.height + (2 * $Padding))
    scale = 1
  }
  $capture = Invoke-Cdp -Socket $Socket -Method "Page.captureScreenshot" -Params @{
    format = "png"
    captureBeyondViewport = $true
    clip = $clip
  }
  [System.IO.File]::WriteAllBytes($FilePath, [Convert]::FromBase64String($capture.data))
}

function Get-SelectorMetrics {
  param(
    [System.Net.WebSockets.ClientWebSocket]$Socket,
    [string]$CssSelector
  )
  $escapedSelector = $CssSelector | ConvertTo-Json -Compress
  return Invoke-PageScript -Socket $Socket -Expression @"
(() => {
  const selector = $escapedSelector;
  const target = document.querySelector(selector);
  if (!target) {
    return {
      found: false,
      selector,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      errors: Array.from(window.__codexVisualErrors || []).slice(0, 10)
    };
  }
  target.scrollIntoView({ block: 'center', inline: 'center' });
  const rect = target.getBoundingClientRect();
  const intersectW = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
  const intersectH = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
  const visibleRatio = rect.width && rect.height ? (intersectW * intersectH) / (rect.width * rect.height) : 0;
  const targetOverflowX = target.scrollWidth - target.clientWidth;
  const targetOverflowY = target.scrollHeight - target.clientHeight;
  const descendants = Array.from(target.querySelectorAll('*')).filter((el) => {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return el.scrollWidth - el.clientWidth > 1 || el.scrollHeight - el.clientHeight > 1;
  }).slice(0, 12).map((el) => ({
    tag: el.tagName.toLowerCase(),
    id: el.id || '',
    className: String(el.className || '').slice(0, 80),
    overflowX: el.scrollWidth - el.clientWidth,
    overflowY: el.scrollHeight - el.clientHeight,
    text: (el.textContent || '').trim().slice(0, 60)
  }));
  return {
    found: true,
    selector,
    title: document.title || '',
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    viewport: { width: innerWidth, height: innerHeight },
    visibleRatio: Number(visibleRatio.toFixed(3)),
    viewportRect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      right: Math.round(rect.right),
      bottom: Math.round(rect.bottom)
    },
    documentRect: {
      x: Math.max(0, rect.x + scrollX),
      y: Math.max(0, rect.y + scrollY),
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height)
    },
    targetOverflowX,
    targetOverflowY,
    descendantOverflowing: descendants,
    text: (target.innerText || target.textContent || '').trim().slice(0, 200),
    errors: Array.from(window.__codexVisualErrors || []).slice(0, 10)
  };
})()
"@
}

try {
  New-Item -ItemType Directory -Path $outputFull -Force | Out-Null
  if ($Port -eq 0) {
    $Port = Get-FreePort
  }
  $baseUrl = "http://$Bind`:$Port/"
  if (-not (Wait-Http -Url $baseUrl -TimeoutSeconds 1)) {
    $serverScript = Join-Path $scriptDir "serve.ps1"
    $serverProcess = Start-Process -FilePath "powershell.exe" -ArgumentList @(
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-File", $serverScript,
      "-Root", $repoRoot,
      "-Bind", $Bind,
      "-Port", $Port,
      "-StrictPort"
    ) -WindowStyle Hidden -PassThru
    if (-not (Wait-Http -Url $baseUrl -TimeoutSeconds 10)) {
      throw "Local static server did not start at $baseUrl"
    }
  }

  $debugPort = Get-FreePort
  $browserExe = Find-Browser -ExplicitPath $BrowserPath
  New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
  $browserProcess = Start-Process -FilePath $browserExe -ArgumentList @(
    "--headless=new",
    "--remote-debugging-port=$debugPort",
    "--user-data-dir=$profileDir",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank"
  ) -WindowStyle Hidden -PassThru

  $versionUrl = "http://127.0.0.1:$debugPort/json/version"
  if (-not (Wait-Http -Url $versionUrl -TimeoutSeconds 10)) {
    throw "Browser DevTools endpoint did not start."
  }

  $files = Get-TargetFiles | Sort-Object FullName -Unique
  $viewportWidths = ConvertTo-IntList -Values $ViewportWidth -Name "ViewportWidth"
  $viewportHeights = ConvertTo-IntList -Values $ViewportHeight -Name "ViewportHeight"
  $viewports = @()
  for ($i = 0; $i -lt $viewportWidths.Count; $i += 1) {
    $height = $viewportHeights[[Math]::Min($i, $viewportHeights.Count - 1)]
    $viewports += [pscustomobject]@{ Width = $viewportWidths[$i]; Height = $height }
  }

  foreach ($file in $files) {
    $relative = Get-RelativePathCompat -BasePath $repoRoot -TargetPath $file.FullName
    $urlPath = $relative -replace "\\", "/"
    $url = $baseUrl + $urlPath
    $pathSlug = ConvertTo-SafeName -Value $urlPath
    foreach ($viewport in $viewports) {
      $page = $null
      try {
        $page = New-DevToolsPage -DebugPort $debugPort
        $socket = $page.Socket
        Set-Viewport -Socket $socket -Width $viewport.Width -Height $viewport.Height
        Open-Page -Socket $socket -Url $url
        Start-Sleep -Milliseconds 250
        foreach ($cssSelector in $Selector) {
          $metrics = Get-SelectorMetrics -Socket $socket -CssSelector $cssSelector
          Start-Sleep -Milliseconds 150
          $selectorSlug = ConvertTo-SafeName -Value $cssSelector
          $imageName = "{0}-{1}-{2}x{3}.png" -f $pathSlug, $selectorSlug, $viewport.Width, $viewport.Height
          $imagePath = Join-Path $outputFull $imageName
          $status = "missing"
          if ($metrics.found) {
            Save-TargetScreenshot -Socket $socket -Metrics $metrics -FilePath $imagePath
            $status = "ok"
          }
          Write-Host ("{0} {1} {2}x{3}: {4}, visible={5}, overflowX={6}, targetOverflowX={7}, image={8}" -f $urlPath, $cssSelector, $viewport.Width, $viewport.Height, $status, $metrics.visibleRatio, $metrics.overflowX, $metrics.targetOverflowX, $imagePath)

          $result = [pscustomobject]@{
            path = $urlPath
            selector = $cssSelector
            viewport = "{0}x{1}" -f $viewport.Width, $viewport.Height
            found = [bool]$metrics.found
            visibleRatio = $metrics.visibleRatio
            overflowX = $metrics.overflowX
            targetOverflowX = $metrics.targetOverflowX
            targetOverflowY = $metrics.targetOverflowY
            screenshot = if ($metrics.found) { $imagePath } else { "" }
            errors = $metrics.errors
            descendantOverflowing = $metrics.descendantOverflowing
          }
          $results.Add($result) | Out-Null

          $prefix = "$urlPath $cssSelector $($viewport.Width)x$($viewport.Height)"
          if (-not $metrics.found) {
            $failures.Add("${prefix}: selector not found")
            continue
          }
          if ($metrics.overflowX -gt $MaxHorizontalOverflow) {
            $failures.Add("${prefix}: page horizontal overflow $($metrics.overflowX)")
          }
          if ($metrics.visibleRatio -lt $MinVisibleRatio) {
            $failures.Add("${prefix}: visible ratio $($metrics.visibleRatio)")
          }
          if ($metrics.errors.Count -gt 0) {
            $failures.Add("${prefix}: page error(s): $($metrics.errors -join ' | ')")
          }
          if (-not $AllowTargetOverflow) {
            if ($metrics.targetOverflowX -gt $MaxTargetOverflow -or $metrics.targetOverflowY -gt $MaxTargetOverflow) {
              $failures.Add("${prefix}: target overflow x=$($metrics.targetOverflowX) y=$($metrics.targetOverflowY)")
            }
            if ($metrics.descendantOverflowing.Count -gt 0) {
              $failures.Add("${prefix}: descendant overflow count $($metrics.descendantOverflowing.Count)")
            }
          }
        }
      } finally {
        Close-DevToolsPage -Page $page -DebugPort $debugPort
        $socket = $null
      }
    }
  }

  $summaryPath = Join-Path $outputFull "summary.json"
  $results | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $summaryPath -Encoding UTF8
  Write-Host "Summary: $summaryPath"

  if ($failures.Count -gt 0) {
    foreach ($failure in $failures) {
      Write-Error $failure -ErrorAction Continue
    }
    exit 1
  }

  Write-Host "Visual target check passed: $($results.Count) target viewport sample(s)."
} finally {
  if ($socket) {
    try { $socket.Dispose() } catch {}
  }
  if ($browserProcess -and -not $browserProcess.HasExited) {
    Stop-Process -Id $browserProcess.Id -Force -ErrorAction SilentlyContinue
  }
  if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
  }
  if ([System.IO.Directory]::Exists($profileDir)) {
    Remove-Item -LiteralPath $profileDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}
