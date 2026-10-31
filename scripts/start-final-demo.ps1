param([int]$Port = 4320)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path -LiteralPath 'dist/index.js')) { throw 'Run pnpm build before starting the production demo.' }
$env:NODE_ENV = 'production'
$env:WEALTHVERSE_DEMO_MODE = 'true'
$env:WEALTHVERSE_ALLOW_DEMO_IN_PRODUCTION = 'true'
$env:WEALTHVERSE_PERSISTENCE = 'memory'
$env:INARI_LEDGER_STORE = 'memory'
$env:DATABASE_URL = ''
$env:BUILT_IN_FORGE_API_KEY = ''
$env:JWT_SECRET = [guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()
$env:INARI_IDENTITY_SECRET = [guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()
$env:PORT = [string]$Port
Write-Host "INARI synthetic demo: http://127.0.0.1:$Port (Ctrl+C to stop)"
node dist/index.js
