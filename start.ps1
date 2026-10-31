# ==============================================================================
# INARI Unified Startup Script
# Starts INARI-main Backend (Port 8000) and React Vite Frontend (Port 3000)
# ==============================================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "                STARTING INARI PLATFORM                    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$RootDir = $PSScriptRoot

# 1. Start INARI-main Real Backend (Port 8000)
Write-Host "[1/2] Starting INARI-main Backend on port 8000..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$RootDir\INARI-main\INARI-main`" && npx tsx server/_core/index.ts"

# 2. Start React + Vite Frontend (Port 3000)
Write-Host "[2/2] Starting React Vite Frontend on port 3000..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$RootDir\inari-frontend`" && npm run dev"

Start-Sleep -Seconds 3

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "             INARI SERVICES ARE READY!                     " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "-> Main Web Application: http://localhost:3000" -ForegroundColor White
Write-Host "-> Dashboard:            http://localhost:3000/dashboard" -ForegroundColor White
Write-Host "-> INARI-main Health:    http://localhost:8000/api/health" -ForegroundColor White
Write-Host "-> INARI-main tRPC API:  http://localhost:8000/api/trpc" -ForegroundColor White
Write-Host "==========================================================`n" -ForegroundColor Green
