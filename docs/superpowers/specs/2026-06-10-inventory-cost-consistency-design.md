# Inventory and Cost Consistency Design

## Goal

Build a reliable data-consistency foundation so inventory balances can be reconciled from immutable ledger entries, stock cannot be oversold by concurrent requests, and order cost changes remain traceable.

## Scope

This first batch covers:

- A transaction-aware inventory domain service.
- Atomic stock-out operations with negative-stock protection.
- Inventory balance-to-ledger reconciliation.
- Opening-balance ledger repair for existing non-zero balances.
- Append-only imported cost records.
- Initial order cost component records.
- Migration of the highest-risk stock-out paths: shipment, after-sale resend, barcode scan, and manual adjustment.

This batch does not add the missing user-input fields for returned products or replacement parts. `RETURN_IN` and `RESEND_PART` business workflows will be implemented as a separate follow-up because they require product decisions about returned-item condition and part selection.

## Architecture

### Inventory Domain Service

`src/lib/inventory.ts` will expose transaction-aware functions that accept a Prisma transaction client rather than opening their own transaction:

- `increaseInventory`: creates or updates an inventory item and appends a positive ledger entry.
- `decreaseInventory`: atomically decrements stock only when available stock is sufficient, then appends a negative ledger entry.
- `setInventoryByAdjustment`: applies a signed adjustment and appends the corresponding ledger entry.

The service owns balance mutation and ledger creation. API routes still own business records, audit logs, and surrounding transactions.

Stock-out routes will run with Prisma `Serializable` isolation. The service will use a conditional `updateMany` predicate so concurrent requests cannot both consume the same available quantity.

### Reconciliation

`src/lib/inventory-reconciliation.ts` will compare each live `InventoryItem.quantity` with the sum of its `InventoryTransaction.quantity` entries. Zero-balance items without ledger entries are considered reconciled.

A repair script will append one `MANUAL_ADJUST` opening-balance transaction for each non-zero mismatch. It will never rewrite or delete existing transactions. The source type and source ID will make repeated repair runs idempotent.

Seed data will create opening-balance transactions for all seeded non-zero inventory items.

### Cost Traceability

Imported shipping and advertising costs will become append-only. Each import creates a new `CostRecord`; prior imported values remain unchanged. The latest order cost field remains the current effective amount.

Manual order creation will write one `CostRecord` for every non-zero initial cost component:

- Product cost
- Shipping cost
- Packaging cost
- Platform fee
- Payment fee
- Advertising cost

The order fields remain the current profit snapshot, while cost records provide the traceable source history.

## Data Flow

For a stock-out:

1. The API route starts a serializable transaction.
2. Business records and stock requirements are loaded.
3. `decreaseInventory` performs a conditional decrement.
4. If no row is updated, the transaction fails with an insufficient-stock error.
5. The service appends an immutable negative ledger entry.
6. The route writes business records, cost records, and audit logs.
7. The transaction commits as one unit.

For reconciliation:

1. Load live inventory items.
2. Aggregate ledger quantities by inventory item.
3. Report differences.
4. The repair command appends only missing opening-balance deltas.
5. Re-run reconciliation and require zero mismatches.

## Error Handling

- Reject zero or negative stock-out quantities.
- Reject stock-out when available quantity, defined as `quantity - lockedQuantity`, is insufficient.
- Throw before creating a ledger entry if the balance mutation fails.
- Ensure any later error rolls back both the balance mutation and ledger entry.
- Treat duplicate opening-balance repair identifiers as already repaired.

## Testing

Tests will follow red-green-refactor:

- Unit-style script for inventory change input validation and reconciliation calculations.
- Database integration script proving a stock decrement creates exactly one matching ledger entry and refuses insufficient stock.
- Integration coverage for append-only cost imports.
- Integration coverage for initial manual-order cost records.
- Existing after-sales and business-invariant tests remain part of regression verification.
- Final verification includes TypeScript checks through `npm run build`.

## Migration Strategy

The first migration targets routes with the greatest risk of negative inventory or incomplete audit behavior:

- Shipments
- After-sale resend
- Barcode scan
- Manual inventory adjustment

Purchase and production paths already write matching ledger entries in a transaction and will be migrated in a later batch after the new service has proven stable.

## Constraints

- No destructive rewriting of historical ledger data.
- No schema migration is required for this batch.
- Existing API forms and redirects remain compatible.
- Current dirty workspace changes are preserved.
- The workspace currently has no accessible Git repository metadata, so design and implementation cannot be committed from this session.
