# Tenant and Role Security Design

## Goal

Prevent account takeover, privilege escalation, stale-role page access, and cross-tenant relationship injection while preserving the current merchant workflow.

## Scope

This batch covers:

- Employee creation and editing role boundaries.
- Existing-account invitation behavior.
- Shared page and API role policy.
- Real-time page role enforcement after role changes.
- Cross-tenant validation for user-supplied relationship IDs.
- Restricting the financial dashboard to owner, manager, and finance roles.
- Automated regression tests for confirmed attack paths.

An independent platform administrator application and PostgreSQL row-level security are intentionally deferred to a later batch.

## Authorization Policy

Role access rules will live in `src/lib/permissions.ts`.

- API and page authorization will use the same prefix-to-role policy.
- `OWNER` may create and update employees, including managers.
- `MANAGER` may create and update ordinary operational employees only.
- Neither merchant role may assign `OWNER` or `PLATFORM_ADMIN` through employee APIs.
- `PLATFORM_ADMIN` is never assignable from merchant APIs.
- Financial dashboard access is limited to `OWNER`, `MANAGER`, and `FINANCE`.

## Employee Identity Safety

Employee creation will no longer update an existing global user's password or name.

- A new email creates a user and tenant membership.
- An existing email may be linked to the current tenant without changing global credentials.
- Existing membership updates remain limited by the actor's role.
- Managers cannot elevate themselves or another member to owner or platform administrator.

## Page Authorization

Middleware cannot query Prisma reliably, so it will only validate the signed session token and presence of authentication.

Sensitive page authorization will be enforced inside the server-rendered application layout using `getSession()`, which reloads the current membership role from the database. The layout will redirect unauthorized paths before rendering page data.

This makes role changes effective immediately for page reads and API writes.

## Tenant Relationship Validation

Every user-supplied relationship ID in the confirmed vulnerable paths will be validated before creation or update:

- Order `shopId`
- Material `defaultSupplierId`
- Printer part `supplierId`
- Tool asset `assignedPrinterId`
- Packaging purchase `supplierId`

The validation query must include `tenantId` and `deletedAt: null` where supported. Invalid or foreign IDs fail before the business record is written.

## Testing

The existing boundary audit script becomes a strict regression test:

- Manager cannot reset another user's password.
- Manager cannot create an owner or platform administrator membership.
- Cross-tenant shop assignment does not create an order.
- A downgraded finance employee cannot render profit reports.

Existing isolation, session invalidation, content permission, and data management safety tests remain required.

## Constraints

- No schema migration is required.
- Existing employee login credentials remain global because `User.email` is globally unique.
- Existing users can still be linked to another tenant, but credentials are never overwritten by the inviting tenant.
- Merchant APIs cannot manage `PLATFORM_ADMIN`.
