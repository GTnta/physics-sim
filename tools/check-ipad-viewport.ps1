param(
  [string[]]$Path = @(
    "projectile/projectile-simulator.html",
    "projectile-variations/projectile-variation-lab.html"
  ),
  [int]$Port = 0,
  [string]$Bind = "127.0.0.1",
  [string]$BrowserPath = "",
  [int]$MinCanvasVisibleRatio = 98,
  [int]$CdpTimeoutSeconds = 20
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverProcess = $null
$browserProcess = $null
$profileDir = Join-Path $env:TEMP ("physics-sim-edge-" + $PID)
$failures = New-Object System.Collections.Generic.List[string]

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
  for ($i = 0; $i -lt 50; $i += 1) {
    $state = Invoke-PageScript -Socket $Socket -Expression "document.readyState"
    if ($state -eq "complete" -or $state -eq "interactive") { return }
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

function Configure-LongFlightIfNeeded {
  param([System.Net.WebSockets.ClientWebSocket]$Socket)
  Invoke-PageScript -Socket $Socket -Expression @"
(() => {
  const setValue = (id, value) => {
    const el = document.getElementById(id);
    if (!el) return false;
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };
  if (!document.getElementById('playButton')) return 'normal';
  setValue('angleNumber', 80);
  setValue('speedNumber', 60);
  setValue('gravityNumber', 1.6);
  setValue('launchHeightNumber', 40);
  setValue('groundHeightNumber', -5);
  return 'variation-long-flight';
})()
"@ | Out-Null
}

function Start-Animation {
  param([System.Net.WebSockets.ClientWebSocket]$Socket)
  Invoke-PageScript -Socket $Socket -Expression @"
(() => {
  const button = document.getElementById('launchButton') || document.getElementById('playButton');
  if (!button) return { ok: false, reason: 'play button not found' };
  if (!/\u4e00\u6642\u505c\u6b62/.test(button.textContent)) button.click();
  return { ok: true, text: button.textContent.trim() };
})()
"@ | Out-Null
}

function Get-Sample {
  param(
    [System.Net.WebSockets.ClientWebSocket]$Socket,
    [string]$Label
  )
  $escapedLabel = ($Label | ConvertTo-Json -Compress)
  $expression = @"
(() => {
  const label = $escapedLabel;
  const canvas = document.getElementById('simCanvas');
  if (canvas) canvas.scrollIntoView({ block: 'center', inline: 'nearest' });
  const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  const intersectW = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
  const intersectH = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
  const visibleRatio = rect.width && rect.height ? (intersectW * intersectH) / (rect.width * rect.height) : 0;
  const playButton = document.getElementById('launchButton') || document.getElementById('playButton');
  const timeSlider = document.getElementById('timeSlider');
  return {
    label,
    viewport: { width: innerWidth, height: innerHeight },
    time: timeSlider ? Number(Number(timeSlider.value).toFixed(2)) : null,
    timeMax: timeSlider ? Number(Number(timeSlider.max).toFixed(2)) : null,
    playText: playButton ? playButton.textContent.trim() : '',
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    canvasVisibleRatio: Number(visibleRatio.toFixed(3)),
    canvasRect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    }
  };
})()
"@
  return Invoke-PageScript -Socket $Socket -Expression $expression
}

function Assert-Samples {
  param(
    [string]$PagePath,
    [object[]]$Samples
  )
  $minRatio = $MinCanvasVisibleRatio / 100
  for ($i = 0; $i -lt $Samples.Count; $i += 1) {
    $sample = $Samples[$i]
    if ($sample.overflowX -gt 0) {
      $failures.Add("$PagePath / $($sample.label): horizontal overflow $($sample.overflowX)")
    }
    if ($sample.canvasVisibleRatio -lt $minRatio) {
      $failures.Add("$PagePath / $($sample.label): canvas visible ratio $($sample.canvasVisibleRatio)")
    }
    if ($sample.playText -notmatch ([string]([char]0x4E00) + [string]([char]0x6642) + [string]([char]0x505C) + [string]([char]0x6B62))) {
      $failures.Add("$PagePath / $($sample.label): animation is not playing ($($sample.playText))")
    }
  }
  for ($i = 1; $i -lt $Samples.Count; $i += 1) {
    if ($Samples[$i].time -le $Samples[$i - 1].time) {
      $failures.Add("${PagePath}: time did not advance from $($Samples[$i - 1].time) to $($Samples[$i].time)")
    }
  }
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

  $targetPaths = ConvertTo-StringList -Values $Path
  foreach ($pagePath in $targetPaths) {
    $relativeUrl = $pagePath -replace "\\", "/"
    $url = $baseUrl + $relativeUrl
    Set-Viewport -Socket $socket -Width 1024 -Height 768
    Open-Page -Socket $socket -Url $url
    Configure-LongFlightIfNeeded -Socket $socket
    Start-Animation -Socket $socket
    Start-Sleep -Milliseconds 350
    $landscapeBefore = Get-Sample -Socket $socket -Label "landscape-before"
    Set-Viewport -Socket $socket -Width 768 -Height 1024
    Start-Sleep -Milliseconds 500
    $portrait = Get-Sample -Socket $socket -Label "portrait"
    Set-Viewport -Socket $socket -Width 1024 -Height 768
    Start-Sleep -Milliseconds 500
    $landscapeAfter = Get-Sample -Socket $socket -Label "landscape-after"
    Start-Sleep -Milliseconds 350
    $landscapeLater = Get-Sample -Socket $socket -Label "landscape-later"
    $samples = @($landscapeBefore, $portrait, $landscapeAfter, $landscapeLater)
    Assert-Samples -PagePath $pagePath -Samples $samples
    Write-Host "$pagePath"
    foreach ($sample in $samples) {
      Write-Host ("  {0}: t={1}s, play={2}, visible={3}, overflowX={4}" -f $sample.label, $sample.time, $sample.playText, $sample.canvasVisibleRatio, $sample.overflowX)
    }
  }

  if ($failures.Count -gt 0) {
    foreach ($failure in $failures) {
      Write-Error $failure -ErrorAction Continue
    }
    exit 1
  }

  Write-Host "iPad viewport check passed."
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
