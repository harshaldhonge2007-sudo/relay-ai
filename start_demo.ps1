# ==============================================================================
# RELAY AI — Standalone Hackathon Demo Launcher (Windows PowerShell)
# Runs 100% locally on Windows without Docker or external databases!
# Usage:
#   .\start_demo.ps1
#   .\start_demo.ps1 -Reset
# ==============================================================================

param (
    [switch]$Reset = $false,
    [int]$Port = 8000,
    [int]$WebPort = 5173,
    [switch]$NoBrowser = $false
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Starting RELAY AI Hackathon Demo Environment" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check Python
try {
    $pythonVer = python --version 2>&1
    Write-Host "✓ Python: $pythonVer" -ForegroundColor Green
} catch {
    Write-Host "Error: Python is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

# 2. Check Node
try {
    $nodeVer = node --version 2>&1
    Write-Host "✓ Node.js: $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "Error: Node.js is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

# 3. Port conflict check
function Test-PortOccupied([int]$testPort) {
    $connection = Test-NetConnection -ComputerName "127.0.0.1" -Port $testPort -WarningAction SilentlyContinue
    return $connection.TcpTestSucceeded
}

if (Test-PortOccupied -testPort $Port) {
    Write-Host ""
    Write-Host "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" -ForegroundColor Red
    Write-Host "ERROR: Backend port $Port is already in use by another process!" -ForegroundColor Red
    Write-Host "To resolve:" -ForegroundColor Yellow
    Write-Host "  - Terminate the conflicting process: Get-Process -Id (Get-NetTCPConnection -LocalPort $Port).OwningProcess | Stop-Process" -ForegroundColor Yellow
    Write-Host "  - Or run with a different port: .\start_demo.ps1 -Port <port>" -ForegroundColor Yellow
    Write-Host "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" -ForegroundColor Red
    exit 1
}

if (Test-PortOccupied -testPort $WebPort) {
    Write-Host ""
    Write-Host "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" -ForegroundColor Red
    Write-Host "ERROR: Frontend port $WebPort is already in use by another process!" -ForegroundColor Red
    Write-Host "To resolve:" -ForegroundColor Yellow
    Write-Host "  - Terminate the conflicting process: Get-Process -Id (Get-NetTCPConnection -LocalPort $WebPort).OwningProcess | Stop-Process" -ForegroundColor Yellow
    Write-Host "  - Or run with a different port: .\start_demo.ps1 -WebPort <port>" -ForegroundColor Yellow
    Write-Host "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" -ForegroundColor Red
    exit 1
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ApiDir = Join-Path $ScriptDir "api"
$WebDir = Join-Path $ScriptDir "web"

# Ensure frontend dependencies are installed
if (-not (Test-Path (Join-Path $WebDir "node_modules"))) {
    Write-Host "First time setup: installing frontend dependencies (npm install)..." -ForegroundColor Yellow
    Push-Location $WebDir
    npm install
    Pop-Location
}

$env:RELAY_DEMO_MODE = "1"
$env:PORT = "$Port"
$env:VITE_API_URL = "http://127.0.0.1:$Port"

# Start Backend API
Write-Host "Starting Backend API on http://127.0.0.1:$Port ..." -ForegroundColor Cyan
$apiProcess = Start-Process -FilePath "python" -ArgumentList "-m uvicorn mock_server:app --host 127.0.0.1 --port $Port" -WorkingDirectory $ApiDir -PassThru

Start-Sleep -Seconds 2

if ($Reset) {
    Write-Host "Resetting demo dataset to clean initial state..." -ForegroundColor Yellow
    try {
        Invoke-RestMethod -Uri "http://127.0.0.1:$Port/demo/seed" -Method Post | Out-Null
        Write-Host "Dataset reset complete." -ForegroundColor Green
    } catch {
        Write-Host "Warning: Reset request failed: $_" -ForegroundColor DarkYellow
    }
}

# Start Frontend UI
Write-Host "Starting Frontend Web UI on http://localhost:$WebPort ..." -ForegroundColor Cyan
$webProcess = Start-Process -FilePath "npm" -ArgumentList "run dev -- --port $WebPort" -WorkingDirectory $WebDir -PassThru

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "RELAY AI IS RUNNING!" -ForegroundColor Green
Write-Host "Open: http://localhost:$WebPort in your browser" -ForegroundColor Green
Write-Host "API Docs: http://127.0.0.1:$Port/docs" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Demo Roles: Elena (Lead), Jordan (Successor), Alex (Contractor)" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop both servers." -ForegroundColor Yellow

if (-not $NoBrowser) {
    Start-Process "http://localhost:$WebPort"
}

try {
    while ($true) {
        Start-Sleep -Seconds 1
        if ($apiProcess.HasExited) {
            Write-Host "Backend process terminated." -ForegroundColor Red
            break
        }
        if ($webProcess.HasExited) {
            Write-Host "Frontend process terminated." -ForegroundColor Red
            break
        }
    }
} finally {
    Write-Host "`nStopping RELAY AI servers..." -ForegroundColor Yellow
    if ($apiProcess -and -not $apiProcess.HasExited) { Stop-Process -Id $apiProcess.Id -Force }
    if ($webProcess -and -not $webProcess.HasExited) { Stop-Process -Id $webProcess.Id -Force }
    Write-Host "Servers stopped." -ForegroundColor Green
}
