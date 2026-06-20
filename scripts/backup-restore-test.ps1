param([string]$OutputDirectory = ".\backups")

$ErrorActionPreference = "Stop"
$database = "printerp_restore_test_$([Guid]::NewGuid().ToString('N').Substring(0, 12))"
$backup = $null
try {
  $backupOutput = & "$PSScriptRoot\backup.ps1" -OutputDirectory $OutputDirectory
  $backupLine = $backupOutput | Where-Object { $_ -like "Backup created:*" } | Select-Object -Last 1
  if (-not $backupLine) { throw "Backup script did not return a backup path" }
  $backup = $backupLine.Substring("Backup created:".Length).Trim()
  docker compose exec -T postgres createdb -U printerp $database
  if ($LASTEXITCODE -ne 0) { throw "Could not create restore-test database" }
  & "$PSScriptRoot\restore.ps1" -BackupFile $backup -TargetDatabase $database
  $tableCount = (docker compose exec -T postgres psql -U printerp -d $database -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';").Trim()
  $migrationCount = (docker compose exec -T postgres psql -U printerp -d $database -Atc 'SELECT count(*) FROM "_prisma_migrations";').Trim()
  if ([int]$tableCount -lt 20 -or [int]$migrationCount -lt 1) { throw "Restored database verification failed" }
  Write-Output "Backup restore drill passed: $tableCount public tables, $migrationCount migrations"
} finally {
  docker compose exec -T postgres dropdb -U printerp --if-exists $database | Out-Null
}
