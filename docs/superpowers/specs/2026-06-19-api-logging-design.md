# API Logging Design

## Goal

Add a reusable API logging foundation so commercial deployments can trace failed business requests by request ID, path, action, tenant, user and role.

## Scope

This iteration covers the shared logging/request context utilities and the first high-risk merchant APIs:

- Platform order import
- Cost import
- G-code analysis
- Product growth actions
- Purchase creation and packaging purchase creation
- Production completion
- After-sale creation
- Shipment creation
- Inventory adjustment

The follow-up pass extends the same wrapper to every merchant `POST` API that uses `requireApiSession()`. Admin authentication and platform-admin APIs remain separate because they use a different session model.

Admin APIs and full observability integrations such as Sentry, OpenTelemetry and Loki are out of scope for this iteration.

## Architecture

The design adds one lightweight request context per API call. The context is created by a wrapper, enriched by `requireApiSession()` after authentication, and emitted by `logError()` when an unhandled error reaches the wrapper.

Successful responses receive an `x-request-id` header so customer support can correlate UI failures with server logs. Existing business redirects and JSON responses remain unchanged except for the extra header.

## Components

- `src/lib/logger.ts`
  - Normalizes unknown errors.
  - Creates request log context from method, path and `x-request-id`.
  - Enriches context with session fields.
  - Emits structured JSON error logs.

- `src/lib/http.ts`
  - Keeps existing `requireApiSession()` behavior.
  - Adds optional request context enrichment.
  - Exports `withApiLogging(action, handler)` for route handlers.

- API routes
  - High-risk routes were wrapped first, then all remaining merchant POST routes were covered by a static test.
  - Route business logic stays inside `handlePost()` functions.

## Error Handling

Known validation errors continue to return existing redirects or JSON errors where routes already handle them. Unknown errors are logged once by the wrapper and then re-thrown for Next.js to handle.

## Testing

Add a focused script test that verifies:

- Request context uses inbound `x-request-id` when present.
- Session enrichment records `tenantId`, `userId` and `role`.
- `withApiLogging()` writes a structured error log on failures.
- Successful responses include `x-request-id`.
