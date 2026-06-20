INSERT INTO "InventoryItem" (
    "id", "tenantId", "category", "refId", "name", "quantity", "lockedQuantity",
    "warningStock", "unitCost", "createdBy", "updatedBy", "createdAt", "updatedAt"
)
SELECT
    'part_' || md5(p."tenantId" || ':' || p."id"),
    p."tenantId",
    'PART'::"InventoryCategory",
    p."id",
    p."name",
    p."quantity",
    0,
    p."warningStock",
    p."unitCost",
    p."createdBy",
    p."updatedBy",
    p."createdAt",
    p."updatedAt"
FROM "PrinterPart" p
WHERE p."deletedAt" IS NULL
ON CONFLICT ("tenantId", "category", "refId") DO UPDATE SET
    "name" = EXCLUDED."name",
    "quantity" = EXCLUDED."quantity",
    "warningStock" = EXCLUDED."warningStock",
    "unitCost" = EXCLUDED."unitCost",
    "updatedAt" = EXCLUDED."updatedAt";
