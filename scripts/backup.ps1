param(
  [string]$OutputDirectory = ".\backups",
  [string]$MirrorDirectory = "",
  [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"
$resolvedOutput = if ([System.IO.Path]::IsPathRooted($OutputDirectory)) { [System.IO.Path]::GetFullPath($OutputDirectory) } else { [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputDirectory)) }
New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$fileName = "printerp-$stamp.dump"
$output = Join-Path $resolvedOutput $fileName
$containerFile = "/tmp/$fileName"
$containerId = (docker compose ps -q postgres).Trim()
if (-not $containerId) { throw "PostgreSQL container is not running" }

docker compose exec -T postgres sh -lc "pg_dump -U `${POSTGRES_USER:-printerp} -d `${POSTGRES_DB:-printerp} -Fc -f '$containerFile'"
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed" }
docker cp "${containerId}:${containerFile}" $output
if ($LASTEXITCODE -ne 0) { throw "docker cp failed" }
docker compose exec -T postgres rm -f $containerFile
if (-not (Test-Path -LiteralPath $output) -or (Get-Item -LiteralPath $output).Length -lt 1024) { throw "Backup file is missing or unexpectedly small" }
if ($MirrorDirectory) {
  $resolvedMirror = if ([System.IO.Path]::IsPathRooted($MirrorDirectory)) { [System.IO.Path]::GetFullPath($MirrorDirectory) } else { [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $MirrorDirectory)) }
  New-Item -ItemType Directory -Force -Path $resolvedMirror | Out-Null
  Copy-Item -LiteralPath $output -Destination (Join-Path $resolvedMirror $fileName)
}
if ($RetentionDays -gt 0) {
  $cutoff = (Get-Date).AddDays(-$RetentionDays)
  Get-ChildItem -LiteralPath $resolvedOutput -Filter "printerp-*.dump" -File | Where-Object { $_.LastWriteTime -lt $cutoff } | ForEach-Object {
    if ([System.IO.Path]::GetFullPath($_.FullName).StartsWith($resolvedOutput, [System.StringComparison]::OrdinalIgnoreCase)) { Remove-Item -LiteralPath $_.FullName -Force }
  }
}
Write-Output "Backup created: $output"
