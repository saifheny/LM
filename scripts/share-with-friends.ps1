<#
.SYNOPSIS
  LM Phase 1 Zero-Cost Instant Public Link Launcher (0 EGP / $0)
  Opens a free HTTPS + WebSocket + WebRTC tunnel instantly so friends can test LM on their phones!
  Uses Cloudflare Tunnel if installed, or Windows built-in OpenSSH (localhost.run) with ZERO downloads!
#>

$ErrorActionPreference = "Stop"
$Port = if ($env:PORT) { $env:PORT } else { "4000" }

Write-Host ""
Write-Host "  ======================================================" -ForegroundColor Cyan
Write-Host "   LM Phase 1 Free Public Launcher (0 EGP / 0 USD)" -ForegroundColor White
Write-Host "  ======================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verify LM server is running locally (start automatically if not!)
$healthOk = $false
try {
  $resp = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 2
  if ($resp.ok) { $healthOk = $true }
} catch {}

if (-not $healthOk) {
  Write-Host "  [1/2] Starting LM server locally on port $Port..." -ForegroundColor Yellow
  Start-Process -FilePath "npm" -ArgumentList "start" -WorkingDirectory (Split-Path $PSScriptRoot -Parent) -WindowStyle Minimized
  Start-Sleep -Seconds 3
}

# 2. Prefer official Cloudflare Quick Tunnel (zero bandwidth throttling, free HTTPS + WebSockets)
$rootDir = Split-Path $PSScriptRoot -Parent
$candidates = @(
  (Join-Path $rootDir "tools\cloudflared.exe"),
  "C:\Program Files (x86)\cloudflared\cloudflared.exe",
  "C:\Program Files\cloudflared\cloudflared.exe",
  "$env:LOCALAPPDATA\Microsoft\WinGet\Links\cloudflared.exe"
)
$cfExe = $null
foreach ($c in $candidates) {
  if (Test-Path $c) { $cfExe = $c; break }
}
if (-not $cfExe) {
  $sysCf = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($sysCf) { $cfExe = $sysCf.Source }
}

if (-not $cfExe) {
  Write-Host "  [2/3] Installing portable Cloudflare Tunnel (tools\cloudflared.exe, ~19 MB)..." -ForegroundColor Yellow
  New-Item -ItemType Directory -Force -Path (Join-Path $rootDir "tools") | Out-Null
  $msiPath = Join-Path $rootDir "tools\cloudflared.msi"
  $extractDir = Join-Path $rootDir "tools\cf_extract"
  & curl.exe -L --fail --progress-bar -o $msiPath "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi"
  New-Item -ItemType Directory -Force -Path $extractDir | Out-Null
  Start-Process -FilePath "msiexec.exe" -ArgumentList "/a `"$msiPath`" /qn TARGETDIR=`"$extractDir`"" -Wait -NoNewWindow
  $extracted = Get-ChildItem -Path $extractDir -Recurse -Filter "cloudflared.exe" | Select-Object -First 1
  if ($extracted) {
    Copy-Item $extracted.FullName -Destination (Join-Path $rootDir "tools\cloudflared.exe") -Force
    $cfExe = Join-Path $rootDir "tools\cloudflared.exe"
  }
  Remove-Item $msiPath -Force -ErrorAction SilentlyContinue
  Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
}

if ($cfExe) {
  Write-Host "  [READY] Opening FREE unthrottled Cloudflare HTTPS + WebSocket tunnel to http://127.0.0.1:$Port ..." -ForegroundColor Green
  Write-Host "          Copy the https://*.trycloudflare.com link below and send it to your friends!" -ForegroundColor Yellow
  Write-Host ""
  & $cfExe tunnel --url "http://127.0.0.1:$Port" --protocol http2 --no-autoupdate
} else {
  Write-Host "  [FALLBACK] Opening Pinggy HTTPS tunnel to http://127.0.0.1:$Port ..." -ForegroundColor Yellow
  & ssh -p 443 -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R "0:127.0.0.1:$Port" a.pinggy.io
}
