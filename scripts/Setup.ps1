$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
python scripts/bootstrap-tools.py
if ($LASTEXITCODE -ne 0) { throw 'Portable tool installation failed' }
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'npm dependency installation failed' }
if (!(Test-Path .venv/Scripts/python.exe)) { python -m venv .venv }
.venv/Scripts/python.exe -m pip install -r services/financial-analytics/requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed' }
node scripts/setup-local.mjs
if ($LASTEXITCODE -ne 0) { throw 'Local service configuration failed' }
npm.cmd run db:generate
if ($LASTEXITCODE -ne 0) { throw 'Prisma client generation failed; stop the running API/worker before regenerating on Windows' }
npm.cmd run db:migrate
if ($LASTEXITCODE -ne 0) { throw 'Database migration failed' }
npm.cmd run db:seed
if ($LASTEXITCODE -ne 0) { throw 'Database setup failed' }
Write-Host 'Setup complete. Run .\scripts\Start.ps1'
