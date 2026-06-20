ALTER TABLE "Printer"
ADD COLUMN "maintenanceIntervalDays" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN "maintenanceIntervalHours" DECIMAL(12,2) NOT NULL DEFAULT 500,
ADD COLUMN "lastMaintenanceAt" TIMESTAMP(3),
ADD COLUMN "nextMaintenanceAt" TIMESTAMP(3),
ADD COLUMN "lastMaintenanceHours" DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE TABLE "PrinterMaintenanceRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "printerId" TEXT NOT NULL,
    "maintenanceType" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "runtimeHoursAtService" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "operatorName" TEXT,
    "details" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrinterMaintenanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrinterMaintenanceRecord_tenantId_performedAt_idx" ON "PrinterMaintenanceRecord"("tenantId", "performedAt");
CREATE INDEX "PrinterMaintenanceRecord_tenantId_printerId_idx" ON "PrinterMaintenanceRecord"("tenantId", "printerId");

ALTER TABLE "PrinterMaintenanceRecord"
ADD CONSTRAINT "PrinterMaintenanceRecord_printerId_fkey"
FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
