param([switch]$WorkerOnly)
Set-Location (Split-Path $PSScriptRoot -Parent)
$serviceNames = if ($WorkerOnly) { @('worker') } else { @('web','api','analytics','worker','redis','mailpit') }
foreach ($name in $serviceNames) {
 $pidFile = Join-Path '.runtime' ($name+'.pid')
 if (Test-Path $pidFile) {
  $ownedPid = [int](Get-Content $pidFile)
  $ownedProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$ownedPid" -ErrorAction SilentlyContinue
  if ($ownedProcess) {
   $isProjectProcess = $ownedProcess.CommandLine -match 'FinCore|apps[/\\](api|worker)[/\\]src[/\\]'
   if (!$isProjectProcess) { throw "Refusing to stop unrelated process $ownedPid from stale $pidFile" }
   & taskkill.exe /PID $ownedPid /T /F | Out-Null
  }
  Remove-Item -LiteralPath $pidFile
 }
}
if (!$WorkerOnly) { & .tools/pgsql/bin/pg_ctl.exe stop -D .runtime/postgres -m fast }
