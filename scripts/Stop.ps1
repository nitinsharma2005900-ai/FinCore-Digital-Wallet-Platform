Set-Location (Split-Path $PSScriptRoot -Parent)
foreach ($name in @('web','api','analytics','redis','mailpit')) {
 $pidFile = Join-Path '.runtime' ($name+'.pid')
 if (Test-Path $pidFile) { Stop-Process -Id ([int](Get-Content $pidFile)) -ErrorAction SilentlyContinue; Remove-Item -LiteralPath $pidFile }
}
& .tools/pgsql/bin/pg_ctl.exe stop -D .runtime/postgres -m fast
