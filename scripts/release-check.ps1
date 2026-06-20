$ErrorActionPreference = "Stop"
$commands = @(
  "npm.cmd run build",
  "npm.cmd run test:readiness",
  "npm.cmd run test:smoke",
  "npm.cmd run test:invariants",
  "npm.cmd run test:order-import",
  "npm.cmd run test:cost-import",
  "npm.cmd run test:cost-import:integration",
  "npm.cmd run test:gcode",
  "npm.cmd run test:gcode:integration",
  "npm.cmd run test:printer-maintenance",
  "npm.cmd run test:printer-maintenance:integration",
  "npm.cmd run test:inventory-analysis",
  "npm.cmd run test:barcode",
  "npm.cmd run test:commercial",
  "npm.cmd run test:spreadsheet",
  "npm.cmd run test:help",
  "npm.cmd run test:weight",
  "npm.cmd run test:purchase-weight:integration",
  "npm.cmd run test:business-date",
  "npm.cmd run test:purchase-date:integration",
  "npm.cmd run test:purchase-edit-cancel:integration",
  "npm.cmd run test:data-management:safety",
  "npm.cmd run test:data-reset",
  "npm.cmd run test:parts-tools:integration",
  "npm.cmd run test:after-sales-inventory:integration",
  "npm.cmd run test:product-model:integration",
  "npm.cmd run test:product-growth:integration",
  "npm.cmd run test:competitor-monitoring:integration",
  "npm.cmd run test:content-review-bulk:integration",
  "npm.cmd run test:content-review:permission",
  "npm.cmd run test:session-invalidation",
  "npm.cmd run test:login-rate-limit",
  "npm.cmd run test:security-isolation",
  "npm.cmd run test:security-audit",
  "npm.cmd run test:performance"
)
foreach ($command in $commands) {
  Write-Output "Running: $command"
  Invoke-Expression $command
  if ($LASTEXITCODE -ne 0) { throw "Release check failed: $command" }
}
& "$PSScriptRoot\backup-restore-test.ps1"
Write-Output "PrintERP commercial release acceptance passed"
