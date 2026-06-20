CREATE TABLE "PrinterPart" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "compatibleModel" TEXT,
  "unit" TEXT NOT NULL DEFAULT '个',
  "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "warningStock" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "unitCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "supplierId" TEXT,
  "remark" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "PrinterPart_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrinterPartTransaction" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "partId" TEXT NOT NULL,
  "printerId" TEXT,
  "maintenanceRecordId" TEXT,
  "type" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "unitCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "totalCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "remark" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrinterPartTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ToolAsset" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
  "purchaseAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "purchaseDate" TIMESTAMP(3) NOT NULL,
  "usefulLifeMonths" INTEGER NOT NULL DEFAULT 36,
  "monthlyDepreciation" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "assignedPrinterId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "remark" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ToolAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrinterPart_tenantId_code_key" ON "PrinterPart"("tenantId", "code");
CREATE INDEX "PrinterPart_tenantId_idx" ON "PrinterPart"("tenantId");
CREATE INDEX "PrinterPartTransaction_tenantId_occurredAt_idx" ON "PrinterPartTransaction"("tenantId", "occurredAt");
CREATE INDEX "PrinterPartTransaction_tenantId_partId_idx" ON "PrinterPartTransaction"("tenantId", "partId");
CREATE INDEX "PrinterPartTransaction_tenantId_printerId_idx" ON "PrinterPartTransaction"("tenantId", "printerId");
CREATE UNIQUE INDEX "ToolAsset_tenantId_code_key" ON "ToolAsset"("tenantId", "code");
CREATE INDEX "ToolAsset_tenantId_status_idx" ON "ToolAsset"("tenantId", "status");

ALTER TABLE "PrinterPartTransaction" ADD CONSTRAINT "PrinterPartTransaction_partId_fkey" FOREIGN KEY ("partId") REFERENCES "PrinterPart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrinterPartTransaction" ADD CONSTRAINT "PrinterPartTransaction_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrinterPartTransaction" ADD CONSTRAINT "PrinterPartTransaction_maintenanceRecordId_fkey" FOREIGN KEY ("maintenanceRecordId") REFERENCES "PrinterMaintenanceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
