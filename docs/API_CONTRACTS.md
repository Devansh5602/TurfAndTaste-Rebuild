# API contracts

## Base

- Health: `GET /health`
- Versioned namespace: `/api/v1`
- JSON only
- Every response includes `data`, `error`, and `meta.requestId`
- The `x-request-id` header is echoed or generated

## Success

```json
{
  "data": { "status": "ok", "service": "turf-and-taste-api", "timestamp": "2026-10-03T00:00:00.000Z" },
  "error": null,
  "meta": { "requestId": "..." }
}
```

## Failure

```json
{
  "data": null,
  "error": { "code": "NOT_FOUND", "message": "The requested resource does not exist." },
  "meta": { "requestId": "..." }
}
```

Codes used in Phase 0: `NOT_FOUND`, `VALIDATION_ERROR`, `INTERNAL_ERROR`.

Validation messages stay generic. Schema internals are not returned to clients.

## Rules for later routes

- Validate inputs with Zod from `@turf-and-taste/schemas`.
- Keep OpenAPI in `apps/api/openapi/openapi.yaml` aligned with the route.
- Generate client types when the first business resource is added. Until then, the health client parses `healthResponseSchema`.
- Booking and payment routes must recompute price on the server.
- Do not accept a client-supplied total as the amount to charge.
- Idempotency keys are required for payment and booking creation when those routes are built.

## CORS

`WEB_ORIGIN` is the allowed browser origin. Missing `Origin` headers are allowed for native clients. Arbitrary origins are rejected.

## Rate limit

300 requests per minute per IP on the API process, excluding `/health`. Auth and payment routes will get stricter limits when they exist.
