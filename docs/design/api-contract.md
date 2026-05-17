# API Contract: Issue 001 — Customer Trip Search

Last updated: 2026-05-17
Protocol: REST — Next.js 15 App Router Route Handler
Base URL: /api
Versioning: path-implicit v1 (`/api/...`); v2 will be `/api/v2/...`
Scope: Issue 001 only — read-only trip search slice.

---

## Conventions

- All response bodies JSON, `Content-Type: application/json; charset=UTF-8`.
- Auth: **none required** for this endpoint. No `Authorization` header consumed.
- Timestamps: ISO 8601 strings in UTC (`Z` suffix) in all responses.
- IDs: cuid strings.
- Currency: VND in minor integer units (1 unit = 1 VND; no decimals).
- Timezone interpretation: date-only params (`YYYY-MM-DD`) are interpreted as Asia/Ho_Chi_Minh (UTC+7).
- All strings are UTF-8; Vietnamese diacritics accepted wherever `string` is stated.

---

## Error Envelope

All non-2xx responses from this endpoint use **one of two shapes**:

### Zod validation failure (400)
```json
{
  "error": "Validation failed",
  "issues": [ /* ZodIssue[] — verbatim from z.safeParse */ ]
}
```

### All other errors (429, 500)
```json
{
  "error": "<human-readable message — no stack trace, no internal detail>"
}
```

`requestId` is **not** included in v0; add in v1.x when distributed tracing is wired.

---

## Rate-Limit Headers

Every response from `GET /api/trips` carries:

| Header | Example value | Meaning |
|---|---|---|
| `X-RateLimit-Limit` | `60` | Max requests per window |
| `X-RateLimit-Remaining` | `59` | Requests remaining in current window |
| `X-RateLimit-Reset` | `1747490460` | Unix epoch when window resets |
| `Retry-After` | `42` | **Only on 429.** Seconds until retry is safe. |

Implementation: Upstash Ratelimit, sliding-window 60 req / 60 s keyed on client IP.

---

## Endpoints

### GET /api/trips

Search for available trips. Customer-facing, unauthenticated.

- **Method:** GET
- **Path:** `/api/trips`
- **Auth:** none
- **Idempotency:** N/A (read)
- **Rate-limit:** 60 req / 60 s / IP (Upstash sliding window)
- **Side effects:** none (read-only)

> **Naming note:** No `/api/trips/search` sub-path in v0. The resource *is* the collection; filtering is done via query params on the collection route. Downstream consumers must not rely on a `/search` suffix.

#### Query Parameters

| Name | Type | Required | Default | Validation |
|---|---|---|---|---|
| `origin` | string | optional | — | 1–50 chars after trim; no regex constraint |
| `destination` | string | optional | — | 1–50 chars after trim; no regex constraint |
| `date` | string | optional | — | Must match `YYYY-MM-DD`; interpreted as Asia/Ho_Chi_Minh start-of-day; must not be in the past (server-side clock) |
| `ticketCount` | integer string | optional | `"1"` | Coerced to int; range 1–10 inclusive |

**Aliases explicitly rejected:**
- `from` / `to` — **not** accepted; will not be silently ignored (Zod `strict` strips unknowns, or they are ignored — either way, do not document or rely on them).
- No pagination cursor (`cursor`, `page`, `limit`) in v0 — response is always the full matching list.

**All parameters are optional.** Omitting all params returns all bookable trips (useful for the "Try nearby dates" empty-state call). Callers should pass at minimum `origin + destination + date` for a meaningful search.

#### Filtering Logic (server-enforced, non-negotiable for downstream)

A trip is **excluded** from results if any of the following are true:

| Exclusion rule | Source |
|---|---|
| `trip.status = 'cancelled'` | Trip cancelled by operator |
| `trip.salesClosed = true` | Operator manually closed sales |
| `trip.bus` has an active `BusMaintenance` window overlapping `trip.departureAt` | Bus in maintenance |
| `availableSeats < ticketCount` (where `availableSeats = bus.capacity − blockedSeats − activeHolds − paidBookings`) | Sold out / insufficient seats |

#### Sort Order

Results are sorted by `departureAt ASC`, stable (ties broken by `trip.id ASC` for determinism across pages if pagination is added later).

#### Response 200 OK

```json
{
  "trips": [
    {
      "id": "string (cuid)",
      "departureAt": "string (ISO 8601 UTC, e.g. '2026-05-18T07:00:00.000Z')",
      "estimatedDurationMinutes": "number (integer, > 0)",
      "basePrice": "number (integer, VND, > 0)",
      "availableSeats": "number (integer, >= 0)",
      "route": {
        "originCity": "string",
        "destinationCity": "string"
      },
      "operator": {
        "legalName": "string",
        "brandColor": "string | null  (hex color, e.g. '#E53935', or null)"
      },
      "bus": {
        "capacity": "number (integer, > 0)"
      }
    }
  ]
}
```

**Field-level notes:**

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `trips` | array | no | Empty array `[]` when no results — never `null` |
| `trips[].id` | string (cuid) | no | Stable identifier; used by issue 002 to initiate a hold |
| `trips[].departureAt` | string (ISO 8601 UTC) | no | Always UTC `Z` suffix in response; client renders in local/VN tz |
| `trips[].estimatedDurationMinutes` | number (int) | no | From `Route.durationMinutes`; never 0 |
| `trips[].basePrice` | number (int) | no | From `Trip.price`; VND integer; never 0 |
| `trips[].availableSeats` | number (int) | no | Derived: `bus.capacity − blockedSeats − activeHolds − paidBookings`; always >= 0; never negative (filtered out before reaching response) |
| `trips[].route.originCity` | string | no | From `Route.origin` free-text; displayed verbatim |
| `trips[].route.destinationCity` | string | no | From `Route.destination` free-text; displayed verbatim |
| `trips[].operator.legalName` | string | no | From `Operator.legalName` |
| `trips[].operator.brandColor` | string \| null | **yes** | Hex string if set by operator, otherwise `null`; client handles null gracefully |
| `trips[].bus.capacity` | number (int) | no | Total physical seats on the bus; always > 0 |

**Customer DTO whitelist (Prisma `select`):**
The following fields are explicitly NOT returned to the customer (server enforces via Prisma select — not filtered client-side):

- `trip.status` (operator-internal)
- `trip.salesClosed` (operator-internal)
- `trip.blockedSeats` (operator-internal)
- `trip.cancelledReason`
- `trip.busId`, `trip.routeId`, `trip.operatorId` (raw FKs)
- `operator.contactPhone`, `operator.notificationPhone`
- `operator.id`
- `bus.licensePlate`, `bus.type`, `bus.operatorId`, `bus.deactivatedAt`
- Any `Hold` or `Booking` counts (only the derived `availableSeats` integer)

#### Response 400 Bad Request

Returned when Zod schema parse fails on any query param.

```json
{
  "error": "Validation failed",
  "issues": [
    {
      "code": "too_small",
      "minimum": 1,
      "type": "string",
      "inclusive": true,
      "message": "origin must be at least 1 character",
      "path": ["origin"]
    }
  ]
}
```

`issues` is a verbatim `ZodIssue[]` array. Callers must not rely on specific issue shapes beyond `path` and `message` for display.

#### Response 429 Too Many Requests

Returned when Upstash rate limit is exceeded.

```json
{
  "error": "Too many requests. Please slow down."
}
```

Response also carries `Retry-After: <seconds>` header.

#### Response 500 Internal Server Error

Returned on any unhandled exception. No stack trace, no Prisma error detail, no internal path is ever included.

```json
{
  "error": "An unexpected error occurred. Please try again."
}
```

---

## Caching Headers

`GET /api/trips` responses carry:

```
Cache-Control: public, max-age=15, s-maxage=30, stale-while-revalidate=60
```

Rationale:
- `max-age=15` — browser/CDN serves stale for 15 s; seat counts drift by seconds anyway.
- `s-maxage=30` — CDN edge caches for 30 s; reduces Postgres load on popular route queries.
- `stale-while-revalidate=60` — CDN revalidates in background while serving stale; avoids thundering herd.
- No `Vary` header required (no auth header consumed, no cookies affect the response).
- **On 400/429/500:** `Cache-Control: no-store` (errors are not cached).

---

## Out of Scope for Issue 001

The following are explicitly **not** part of this contract and must not be implemented or relied upon by downstream consumers for this issue:

| Out-of-scope item | Future issue |
|---|---|
| `POST /api/trips` | n/a (operator creates trips via `/api/op/trips`) |
| `PATCH /api/trips/:id` | n/a |
| `DELETE /api/trips/:id` | n/a |
| `POST /api/holds` | Issue 002 |
| `POST /api/bookings/initiate` | Issue 002 |
| `/api/op/*` operator endpoints | Issues 010–018 |
| `/api/auth/*` auth endpoints | Issue 007 |
| Pagination (`cursor`, `page`, `limit`) | Deferred post-v0 |
| `from` / `to` query param aliases | Never — use `origin` / `destination` |
| `Authorization` header or session cookie consumed | Not in 001 |
| Response field `trip.status` exposed to customer | Never (whitelist) |

---

## OpenAPI-Ready Summary (copy-paste block)

```yaml
# Paste into openapi.yaml under paths:
/api/trips:
  get:
    summary: Search available trips
    operationId: searchTrips
    tags: [trips]
    security: []
    parameters:
      - name: origin
        in: query
        required: false
        schema:
          type: string
          minLength: 1
          maxLength: 50
      - name: destination
        in: query
        required: false
        schema:
          type: string
          minLength: 1
          maxLength: 50
      - name: date
        in: query
        required: false
        schema:
          type: string
          format: date
          description: YYYY-MM-DD, interpreted as Asia/Ho_Chi_Minh start-of-day
      - name: ticketCount
        in: query
        required: false
        schema:
          type: integer
          minimum: 1
          maximum: 10
          default: 1
    responses:
      '200':
        description: Matching trips, sorted by departureAt ASC
        headers:
          X-RateLimit-Limit:
            schema: { type: integer }
          X-RateLimit-Remaining:
            schema: { type: integer }
          X-RateLimit-Reset:
            schema: { type: integer, description: Unix epoch }
          Cache-Control:
            schema: { type: string }
        content:
          application/json:
            schema:
              type: object
              required: [trips]
              properties:
                trips:
                  type: array
                  items:
                    type: object
                    required:
                      - id
                      - departureAt
                      - estimatedDurationMinutes
                      - basePrice
                      - availableSeats
                      - route
                      - operator
                      - bus
                    properties:
                      id:
                        type: string
                        description: cuid
                      departureAt:
                        type: string
                        format: date-time
                        description: ISO 8601 UTC
                      estimatedDurationMinutes:
                        type: integer
                        minimum: 1
                      basePrice:
                        type: integer
                        minimum: 1
                        description: VND, integer minor units (1 unit = 1 VND)
                      availableSeats:
                        type: integer
                        minimum: 0
                        description: Derived = bus.capacity - blockedSeats - activeHolds - paidBookings
                      route:
                        type: object
                        required: [originCity, destinationCity]
                        properties:
                          originCity:
                            type: string
                          destinationCity:
                            type: string
                      operator:
                        type: object
                        required: [legalName, brandColor]
                        properties:
                          legalName:
                            type: string
                          brandColor:
                            type: string
                            nullable: true
                            description: Hex color string or null
                      bus:
                        type: object
                        required: [capacity]
                        properties:
                          capacity:
                            type: integer
                            minimum: 1
      '400':
        description: Zod validation failure
        content:
          application/json:
            schema:
              type: object
              required: [error, issues]
              properties:
                error:
                  type: string
                  example: Validation failed
                issues:
                  type: array
                  items:
                    type: object
                    description: ZodIssue
      '429':
        description: Rate limit exceeded
        headers:
          Retry-After:
            schema: { type: integer, description: Seconds until retry is safe }
        content:
          application/json:
            schema:
              type: object
              required: [error]
              properties:
                error:
                  type: string
                  example: Too many requests. Please slow down.
      '500':
        description: Internal server error
        content:
          application/json:
            schema:
              type: object
              required: [error]
              properties:
                error:
                  type: string
                  example: An unexpected error occurred. Please try again.
```

---

## Auto-chain Recommendations

- `/edge-case-enum` — enumerate edge cases on `availableSeats` derivation race and `date` timezone boundary.
- `/threat-model` — not triggered by this endpoint (no PII, no money, no auth); re-trigger when `POST /api/holds` is contracted in issue 002.
