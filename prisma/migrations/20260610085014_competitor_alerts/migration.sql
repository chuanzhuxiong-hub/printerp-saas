-- CreateTable
CREATE TABLE "CompetitorAlert" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "previousValue" TEXT,
    "currentValue" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNREAD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "CompetitorAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompetitorAlert_tenantId_status_createdAt_idx" ON "CompetitorAlert"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CompetitorAlert_tenantId_productId_createdAt_idx" ON "CompetitorAlert"("tenantId", "productId", "createdAt");

-- AddForeignKey
ALTER TABLE "CompetitorAlert" ADD CONSTRAINT "CompetitorAlert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorAlert" ADD CONSTRAINT "CompetitorAlert_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "ProductCompetitor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
