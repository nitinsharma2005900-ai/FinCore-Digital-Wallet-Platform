$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
python scripts/bootstrap-tools.py
if ($LASTEXITCODE -ne 0) { throw 'Portable tool installation failed' }
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'npm dependency installation failed' }
if (!(Test-Path .venv/Scripts/python.exe)) { python -m venv .venv }
.venv/Scripts/python.exe -m pip install -r services/financial-analytics/requirements.txt
node scripts/setup-local.mjs
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed
if ($LASTEXITCODE -ne 0) { throw 'Database setup failed' }
Write-Host 'Setup complete. Run .\scripts\Start.ps1'
