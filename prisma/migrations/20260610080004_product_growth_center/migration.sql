-- CreateTable
CREATE TABLE "ProductTitleVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "skuId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "platform" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "keywords" TEXT,
    "score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "riskNotes" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "remark" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductTitleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductContentAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "skuId" TEXT,
    "assetType" TEXT NOT NULL,
    "platform" TEXT,
    "purpose" TEXT,
    "sourceUrl" TEXT,
    "generatedPrompt" TEXT,
    "resultUrl" TEXT,
    "planText" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "usageStatus" TEXT NOT NULL DEFAULT 'BACKUP',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductContentAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductDetailVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "skuId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "platform" TEXT NOT NULL,
    "modules" JSONB NOT NULL,
    "aiContent" TEXT,
    "editedContent" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductDetailVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAiGenerationJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "skuId" TEXT,
    "jobType" TEXT NOT NULL,
    "platform" TEXT,
    "input" JSONB NOT NULL,
    "prompt" TEXT,
    "result" JSONB,
    "model" TEXT NOT NULL DEFAULT 'RULE_ASSISTED_V1',
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAiGenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCompetitor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "competitorUrl" TEXT NOT NULL,
    "competitorProductId" TEXT,
    "title" TEXT,
    "mainImageUrl" TEXT,
    "shopName" TEXT,
    "currentPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "originalPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "salesDisplayValue" TEXT,
    "salesEstimate" DECIMAL(14,3),
    "salesActual" DECIMAL(14,3),
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "rating" DECIMAL(4,2),
    "activityInfo" TEXT,
    "specification" TEXT,
    "dataSource" TEXT NOT NULL DEFAULT 'MANUAL',
    "rawData" JSONB,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCompetitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "originalPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "salesDisplayValue" TEXT,
    "salesEstimate" DECIMAL(14,3),
    "salesActual" DECIMAL(14,3),
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "activityInfo" TEXT,
    "title" TEXT,
    "mainImageUrl" TEXT,
    "dataSource" TEXT NOT NULL,
    "rawData" JSONB,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOpportunity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "productUrl" TEXT,
    "title" TEXT NOT NULL,
    "mainImageUrl" TEXT,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "salesDisplayValue" TEXT,
    "salesEstimate" DECIMAL(14,3),
    "salesActual" DECIMAL(14,3),
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "shopName" TEXT,
    "competitorCount" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estimatedMargin" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "demandScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "competitionScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "printDifficultyScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "afterSaleRiskScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "opportunityScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "aiRecommendation" TEXT,
    "dataSource" TEXT NOT NULL DEFAULT 'MANUAL',
    "rawData" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "convertedProductId" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductTitleVersion_tenantId_productId_idx" ON "ProductTitleVersion"("tenantId", "productId");

-- CreateIndex
CREATE INDEX "ProductContentAsset_tenantId_productId_idx" ON "ProductContentAsset"("tenantId", "productId");

-- CreateIndex
CREATE INDEX "ProductDetailVersion_tenantId_productId_idx" ON "ProductDetailVersion"("tenantId", "productId");

-- CreateIndex
CREATE INDEX "ProductAiGenerationJob_tenantId_productId_idx" ON "ProductAiGenerationJob"("tenantId", "productId");

-- CreateIndex
CREATE INDEX "ProductCompetitor_tenantId_productId_status_idx" ON "ProductCompetitor"("tenantId", "productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCompetitor_tenantId_productId_competitorUrl_key" ON "ProductCompetitor"("tenantId", "productId", "competitorUrl");

-- CreateIndex
CREATE INDEX "CompetitorSnapshot_tenantId_competitorId_collectedAt_idx" ON "CompetitorSnapshot"("tenantId", "competitorId", "collectedAt");

-- CreateIndex
CREATE INDEX "ProductOpportunity_tenantId_status_idx" ON "ProductOpportunity"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "ProductTitleVersion" ADD CONSTRAINT "ProductTitleVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductContentAsset" ADD CONSTRAINT "ProductContentAsset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDetailVersion" ADD CONSTRAINT "ProductDetailVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAiGenerationJob" ADD CONSTRAINT "ProductAiGenerationJob_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCompetitor" ADD CONSTRAINT "ProductCompetitor_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorSnapshot" ADD CONSTRAINT "CompetitorSnapshot_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "ProductCompetitor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
