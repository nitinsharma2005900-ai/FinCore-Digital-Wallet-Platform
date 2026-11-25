$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
wsl -d Ubuntu -u root -- service docker start
if ($LASTEXITCODE -ne 0) { throw 'Docker daemon startup failed in Ubuntu WSL' }
$keepAlive = Start-Process -FilePath wsl.exe -ArgumentList @('-d','Ubuntu','-u','root','--','docker','events','--filter','type=container') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path (Get-Location) '.runtime/docker-events.log') -RedirectStandardError (Join-Path (Get-Location) '.runtime/docker-events-error.log')
Set-Content -LiteralPath .runtime/docker-events.pid -Value $keepAlive.Id
Write-Host 'Docker event monitor keeps the WSL instance active; logs remain in ignored .runtime.'
