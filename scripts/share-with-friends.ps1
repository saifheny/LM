<#
.SYNOPSIS
  LM Phase 1 Zero-Cost Instant Public Link Launcher (0 EGP / $0)
  Opens a free HTTPS + WebSocket + WebRTC tunnel via Cloudflare Quick Tunnel
  so up to ~10 friends can test LM immediately from their phones!
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

# 2. Check for cloudflared (Official Free Cloudflare Tunnel — Zero account required!)
$cf = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cf) {
  Write-Host "  [!] cloudflared is not installed yet." -ForegroundColor Yellow
  Write-Host "      Install it for free in 1 command:" -ForegroundColor White
  Write-Host "      winget install --id Cloudflare.cloudflared -e" -ForegroundColor Green
  Write-Host ""
  Write-Host "      Then re-run: npm run share" -ForegroundColor Cyan
  exit 1
}

Write-Host "  [2/2] Opening FREE HTTPS + WebSocket tunnel to http://127.0.0.1:$Port ..." -ForegroundColor Green
Write-Host "        Copy the https://*.trycloudflare.com link below and send it to your friends!" -ForegroundColor Yellow
Write-Host "        (Press Ctrl+C anytime to stop public access)" -ForegroundColor DarkGray
Write-Host ""

& cloudflared tunnel --url "http://127.0.0.1:$Port"
