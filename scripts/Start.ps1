$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
node scripts/setup-local.mjs
if ($LASTEXITCODE -ne 0) { throw 'Supporting services failed' }
node scripts/start-local.mjs
