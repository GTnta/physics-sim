param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$Bind = "127.0.0.1",
  [int]$Port = 8766,
  [switch]$StrictPort
)

$ErrorActionPreference = "Stop"

function Get-MimeType {
  param([string]$Path)
  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { "text/html; charset=utf-8"; break }
    ".css"  { "text/css; charset=utf-8"; break }
    ".js"   { "text/javascript; charset=utf-8"; break }
    ".mjs"  { "text/javascript; charset=utf-8"; break }
    ".json" { "application/json; charset=utf-8"; break }
    ".svg"  { "image/svg+xml; charset=utf-8"; break }
    ".png"  { "image/png"; break }
    ".jpg"  { "image/jpeg"; break }
    ".jpeg" { "image/jpeg"; break }
    ".webp" { "image/webp"; break }
    ".gif"  { "image/gif"; break }
    ".ico"  { "image/x-icon"; break }
    default { "application/octet-stream" }
  }
}

function Write-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$StatusText,
    [byte[]]$Body,
    [string]$ContentType = "text/plain; charset=utf-8"
  )

  $headerText = @(
    "HTTP/1.1 $StatusCode $StatusText"
    "Content-Type: $ContentType"
    "Content-Length: $($Body.Length)"
    "Cache-Control: no-store"
    "Connection: close"
    ""
    ""
  ) -join "`r`n"

  $header = [System.Text.Encoding]::ASCII.GetBytes($headerText)
  $Stream.Write($header, 0, $header.Length)
  if ($Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
}

function Resolve-RequestPath {
  param([string]$RequestTarget, [string]$RootPath)

  $pathOnly = $RequestTarget.Split("?")[0].Split("#")[0]
  if ([string]::IsNullOrWhiteSpace($pathOnly) -or $pathOnly -eq "/") {
    $pathOnly = "/index.html"
  }

  $decoded = [System.Uri]::UnescapeDataString($pathOnly).Replace("/", [System.IO.Path]::DirectorySeparatorChar)
  $relative = $decoded.TrimStart([System.IO.Path]::DirectorySeparatorChar)
  $candidate = [System.IO.Path]::GetFullPath((Join-Path $RootPath $relative))
  $rootFull = [System.IO.Path]::GetFullPath($RootPath).TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

  if (-not $candidate.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }
  if ([System.IO.Directory]::Exists($candidate)) {
    return Join-Path $candidate "index.html"
  }
  return $candidate
}

function New-Listener {
  param([string]$BindAddress, [int]$StartPort, [switch]$Strict)

  $address = [System.Net.IPAddress]::Parse($BindAddress)
  $lastPort = if ($Strict) { $StartPort } else { $StartPort + 20 }

  for ($candidatePort = $StartPort; $candidatePort -le $lastPort; $candidatePort += 1) {
    try {
      $listener = [System.Net.Sockets.TcpListener]::new($address, $candidatePort)
      $listener.Start()
      return [pscustomobject]@{ Listener = $listener; Port = $candidatePort }
    } catch {
      if ($candidatePort -eq $lastPort) { throw }
    }
  }
}

$rootFullPath = [System.IO.Path]::GetFullPath($Root)
if (-not [System.IO.Directory]::Exists($rootFullPath)) {
  throw "Root directory does not exist: $rootFullPath"
}

$binding = New-Listener -BindAddress $Bind -StartPort $Port -Strict:$StrictPort
$listener = $binding.Listener
$actualPort = $binding.Port

Write-Host "Serving $rootFullPath"
Write-Host "URL: http://$Bind`:$actualPort/"
Write-Host "Press Ctrl+C to stop."

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $client.ReceiveTimeout = 1500
      $client.SendTimeout = 5000
      $stream = $client.GetStream()
      $stream.ReadTimeout = 1500
      $stream.WriteTimeout = 5000
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 8192, $true)
      $requestLine = $reader.ReadLine()
      do {
        $headerLine = $reader.ReadLine()
      } while ($null -ne $headerLine -and $headerLine.Length -gt 0)

      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Bad request")
        Write-Response -Stream $stream -StatusCode 400 -StatusText "Bad Request" -Body $body
        continue
      }

      $parts = $requestLine -split "\s+"
      $method = $parts[0]
      $target = $parts[1]
      if ($method -notin @("GET", "HEAD")) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Method not allowed")
        Write-Response -Stream $stream -StatusCode 405 -StatusText "Method Not Allowed" -Body $body
        continue
      }

      $filePath = Resolve-RequestPath -RequestTarget $target -RootPath $rootFullPath
      if ($null -eq $filePath -or -not [System.IO.File]::Exists($filePath)) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Not found")
        Write-Response -Stream $stream -StatusCode 404 -StatusText "Not Found" -Body $body
        continue
      }

      $bytes = if ($method -eq "HEAD") { [byte[]]::new(0) } else { [System.IO.File]::ReadAllBytes($filePath) }
      Write-Response -Stream $stream -StatusCode 200 -StatusText "OK" -Body $bytes -ContentType (Get-MimeType -Path $filePath)
    } catch {
      try {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Internal server error")
        Write-Response -Stream $stream -StatusCode 500 -StatusText "Internal Server Error" -Body $body
      } catch {
        # The client may already have gone away.
      }
    } finally {
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
