param(
  [Parameter(Mandatory = $true)][string]$BackupFile,
  [string]$TargetDatabase = "printerp",
  [string]$Confirmation = ""
)

$ErrorActionPreference = "Stop"
$resolvedBackup = if ([System.IO.Path]::IsPathRooted($BackupFile)) { [System.IO.Path]::GetFullPath($BackupFile) } else { [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $BackupFile)) }
if (-not (Test-Path -LiteralPath $resolvedBackup)) { throw "Backup file not found: $resolvedBackup" }
if ($TargetDatabase -eq "printerp" -and $Confirmation -ne "RESTORE printerp") {
  throw 'Restoring the live printerp database requires -Confirmation "RESTORE printerp"'
}
if ($TargetDatabase -notmatch '^[a-zA-Z0-9_]+$') { throw "Invalid target database name" }

$containerId = (docker compose ps -q postgres).Trim()
if (-not $containerId) { throw "PostgreSQL container is not running" }
$containerFile = "/tmp/printerp-restore-$([Guid]::NewGuid().ToString('N')).dump"
docker cp $resolvedBackup "${containerId}:${containerFile}"
if ($LASTEXITCODE -ne 0) { throw "docker cp failed" }
docker compose exec -T postgres sh -lc "pg_restore -U `${POSTGRES_USER:-printerp} -d '$TargetDatabase' --clean --if-exists --no-owner '$containerFile'"
$restoreExit = $LASTEXITCODE
docker compose exec -T postgres rm -f $containerFile
if ($restoreExit -ne 0) { throw "pg_restore failed" }
Write-Output "Backup restored to database: $TargetDatabase"
