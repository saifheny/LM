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

# 2. Prefer cloudflared if installed, otherwise use zero-download Windows OpenSSH -> localhost.run!
$rootDir = Split-Path $PSScriptRoot -Parent
$localCf = Join-Path $rootDir "tools\cloudflared.exe"
$cfExe = $null
if (Test-Path $localCf) {
  $cfExe = $localCf
} else {
  $sysCf = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($sysCf) { $cfExe = $sysCf.Source }
}

if ($cfExe) {
  Write-Host "  [2/2] Opening FREE Cloudflare HTTPS tunnel to http://127.0.0.1:$Port ..." -ForegroundColor Green
  & $cfExe tunnel --url "http://127.0.0.1:$Port"
} else {
  Write-Host "  [2/2] Opening FREE instant HTTPS + WebSocket tunnel (localhost.run) to http://127.0.0.1:$Port ..." -ForegroundColor Green
  Write-Host "        Copy the https://*.lhr.life link below and send it to your friends!" -ForegroundColor Yellow
  Write-Host ""
  & ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R "80:127.0.0.1:$Port" nokey@localhost.run
}
