param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string[]]$Path,
  [int]$Port = 0,
  [string]$Bind = "127.0.0.1",
  [string]$BrowserPath = "",
  [string[]]$ViewportWidth = @("1280", "1024", "768"),
  [string[]]$ViewportHeight = @("720", "768", "1024"),
  [int]$MaxHorizontalOverflow = 8,
  [int]$CdpTimeoutSeconds = 20
)

$ErrorActionPreference = "Stop"

$repoRoot = [System.IO.Path]::GetFullPath($Root)
$serverProcess = $null
$browserProcess = $null
$profileDir = Join-Path $env:TEMP ("physics-sim-browser-smoke-" + $PID)
$failures = New-Object System.Collections.Generic.List[string]

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
  $port = $listener.LocalEndpoint.Port
  $listener.Stop()
  return $port
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
  $payload = @{ id = $id; method = $Method; params = $Params } | ConvertTo-Json -Depth 30 -Compress
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
    throw "Page script failed: $($result.exceptionDetails.text)"
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
  $Path = ConvertTo-StringList -Values $Path
  if ($Path -and $Path.Count -gt 0) {
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
  } else {
    Get-ChildItem -Path $repoRoot -Recurse -File -Filter "*.html"
  }
}

function Test-ExcludedPath {
  param([System.IO.FileInfo]$File)
  $relative = Get-RelativePathCompat -BasePath $repoRoot -TargetPath $File.FullName
  return ($relative -match "(^|[\\/])(\.git|\.edge-profile|\.agents|\.tmp|\.tmp\.drivedownload|\.tmp\.driveupload|node_modules)([\\/]|$)")
}

function Add-ErrorCollector {
  param([System.Net.WebSockets.ClientWebSocket]$Socket)
  $source = @"
(() => {
  window.__codexSmokeErrors = [];
  window.addEventListener('error', (event) => {
    window.__codexSmokeErrors.push(String(event.message || 'error'));
  });
  window.addEventListener('unhandledrejection', (event) => {
    window.__codexSmokeErrors.push(String(event.reason || 'unhandled rejection'));
  });
  const originalError = console.error;
  console.error = function(...args) {
    try {
      window.__codexSmokeErrors.push(args.map((arg) => String(arg)).join(' '));
    } catch {}
    return originalError.apply(this, args);
  };
})();
"@
  Invoke-Cdp -Socket $Socket -Method "Page.addScriptToEvaluateOnNewDocument" -Params @{ source = $source } | Out-Null
}

function Get-PageStatus {
  param([System.Net.WebSockets.ClientWebSocket]$Socket)
  return Invoke-PageScript -Socket $Socket -Expression @"
(() => {
  const main = document.querySelector('main') || document.body;
  const canvasCount = document.querySelectorAll('canvas').length;
  return {
    title: document.title || '',
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyTextLength: document.body ? document.body.innerText.length : 0,
    canvasCount,
    mainRect: (() => {
      const rect = main.getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    })(),
    errors: Array.from(window.__codexSmokeErrors || []).slice(0, 10)
  };
})()
"@
}

try {
  if ($Port -eq 0) {
    $Port = Get-FreePort
  }
  $baseUrl = "http://$Bind`:$Port/"
  if (-not (Wait-Http -Url $baseUrl -TimeoutSeconds 1)) {
    $serverScript = Join-Path $PSScriptRoot "serve.ps1"
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

  $target = Invoke-RestMethod -Method Put -Uri "http://127.0.0.1:$debugPort/json/new?about:blank"
  $socket = [System.Net.WebSockets.ClientWebSocket]::new()
  [void]$socket.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  Invoke-Cdp -Socket $socket -Method "Page.enable" | Out-Null
  Invoke-Cdp -Socket $socket -Method "Runtime.enable" | Out-Null
  Add-ErrorCollector -Socket $socket

  $targetFiles = Get-TargetFiles
  if (-not $Path -or $Path.Count -eq 0) {
    $targetFiles = $targetFiles | Where-Object { -not (Test-ExcludedPath -File $_) }
  }
  $files = $targetFiles | Sort-Object FullName -Unique
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
    Write-Host $urlPath
    foreach ($viewport in $viewports) {
      Set-Viewport -Socket $socket -Width $viewport.Width -Height $viewport.Height
      Open-Page -Socket $socket -Url $url
      Start-Sleep -Milliseconds 250
      $status = Get-PageStatus -Socket $socket
      Write-Host ("  {0}x{1}: overflowX={2}, canvas={3}, errors={4}" -f $viewport.Width, $viewport.Height, $status.overflowX, $status.canvasCount, $status.errors.Count)
      if ([string]::IsNullOrWhiteSpace($status.title)) {
        $failures.Add("$relative $($viewport.Width)x$($viewport.Height): missing title")
      }
      if ($status.bodyTextLength -le 0) {
        $failures.Add("$relative $($viewport.Width)x$($viewport.Height): empty body text")
      }
      if ($status.overflowX -gt $MaxHorizontalOverflow) {
        $failures.Add("$relative $($viewport.Width)x$($viewport.Height): horizontal overflow $($status.overflowX)")
      }
      if ($status.errors.Count -gt 0) {
        $failures.Add("$relative $($viewport.Width)x$($viewport.Height): page error(s): $($status.errors -join ' | ')")
      }
    }
  }

  if ($failures.Count -gt 0) {
    foreach ($failure in $failures) {
      Write-Error $failure -ErrorAction Continue
    }
    exit 1
  }

  Write-Host "Browser smoke check passed: $($files.Count) HTML file(s), $($viewports.Count) viewport(s)."
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
