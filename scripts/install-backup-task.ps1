param(
  [string]$Time = "02:00",
  [string]$MirrorDirectory = "",
  [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "backup.ps1"
$workspace = Split-Path $PSScriptRoot -Parent
$arguments = "-NoProfile -ExecutionPolicy Bypass -Command `"Set-Location '$workspace'; & '$script' -RetentionDays $RetentionDays"
if ($MirrorDirectory) { $arguments += " -MirrorDirectory '$MirrorDirectory'" }
$arguments += "`""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName "PrintERP Daily Backup" -Action $action -Trigger $trigger -Settings $settings -Description "Daily PrintERP PostgreSQL backup" -Force | Out-Null
Write-Output "Scheduled task installed: PrintERP Daily Backup at $Time"
