# ADR-015: Error Contract & API Response Standards

## Status
ACCEPTED

## Date
2026-06-17

## Context

The platform exposes REST APIs across three realms (customer, operator, admin) plus webhook and cron endpoints. Without a standardized error contract, each route handler invents its own error shape, status code semantics, and idempotency behavior. This has led to recurring status code debates (409 vs 422), inconsistent error responses, and fragile client-side error handling.

**Sources**: `design/07-api-design/`, `business/domain-model/invariants-catalog.md` §Idempotency Guards

---

## Decisions

### D1: Standard Error Response Shape

All API error responses use a consistent envelope:

```json
{
  "error": {
    "code": "plate_in_use",
    "message": "A bus with this license plate already exists"
  }
}
```

- `code` — machine-readable snake_case string, stable across versions. Clients switch on this.
- `message` — human-readable English string, may change without notice. For logs/debugging only.
- Optional `details` field for validation errors (array of `{ field, message }` objects).

**Rationale**: A single envelope shape means client-side error handling is consistent across all endpoints. Machine-readable `code` enables programmatic branching without parsing human-readable messages.

---

### D2: HTTP Status Code Semantics

| Status | Meaning | When to use |
|--------|---------|-------------|
| **400** | Malformed input | Request body fails Zod schema validation; missing required fields; invalid format |
| **401** | Not authenticated | No session cookie; expired JWT; invalid token |
| **403** | Not authorized | Valid session but insufficient permissions; wrong realm; operator accessing another operator's data |
| **409** | Resource conflict | Concurrent modification detected; maintenance window overlap; bus overlap with existing trip |
| **422** | Business validation failure | Valid request shape but violates a business rule: duplicate license plate, capacity reduction blocked by bookings, insufficient balance |
| **429** | Rate limited | Request exceeds rate limit threshold; response includes `Retry-After` header |

**Key distinction**: 409 = conflict with current resource state (timing/concurrency). 422 = request violates business rule regardless of timing.

**Rationale**: This mapping is sourced from the API design doc and resolves the recurring 409-vs-422 ambiguity. The rule is: if the error would go away by retrying later (a concurrent update resolved, a maintenance window ended), it's 409. If the error is inherent to the request data (duplicate plate, invalid transition), it's 422.

---

### D3: Discriminated Result for Idempotent Operations

Idempotent operations (cancel trip, check in booking, complete trip) return a **discriminated result** from the service layer, not a thrown error.

```typescript
// Service returns:
{ trip: TripDto, alreadyCancelled: boolean, cancelledBookings: number }

// Route handler always returns HTTP 200:
return NextResponse.json(result)
```

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. Discriminated result** ✅ | Service returns `{ entity, alreadyApplied: boolean }` | Route always returns 200 with the entity DTO; client gets the entity regardless of first-or-repeat call | Service function signature is more complex |
| B. Thrown sentinel error | Service throws `AlreadyCancelledError`; route catches and returns 200 | Familiar try/catch pattern | Route must fabricate the response body from the error path; loses the entity DTO that the success path returns; catch block must reconstruct what the success path would have returned |

**Choice**: Option A.

**Rationale**: When an AC specifies "idempotent cancel returns HTTP 200 with `{ trip, already_cancelled: true }`," throwing an error forces the route handler to reconstruct the full response from the error path — losing the entity DTO. Discriminated results keep the entity available in all paths. The discriminator branch should be detected inside the existing transaction (lock already held) to ensure consistent state.

---

### D4: Thin Route Handlers

Route handlers (`app/api/**/route.ts`) are thin — they validate input (Zod), call a service function (`lib/<domain>/`), and map the result to HTTP. All business logic lives in the service layer.

```
Route handler responsibilities:
  1. Parse + validate request body (Zod)
  2. Extract auth context (session, operatorId)
  3. Call service function
  4. Map result → HTTP response (status code + JSON)
  5. Map service errors → HTTP error response

Route handler does NOT:
  - Query the database directly
  - Implement business rules
  - Contain conditional logic beyond error mapping
```

**Rationale**: Thin routes make business logic independently testable (unit tests call service functions directly, no HTTP layer needed). Service functions are reusable across routes (e.g., `completeTripCore` is called by both the operator endpoint and the auto-complete cron job).

---

### D5: Cursor-Based Pagination

All list endpoints use cursor-based pagination (not offset-based).

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. Cursor-based** ✅ | `?cursor=<lastId>&limit=20` | Stable across concurrent inserts/deletes; O(1) seek via index; no "skip N rows" performance cliff | Cannot jump to page N; cursor is opaque to client |
| B. Offset-based | `?page=2&limit=20` | Familiar; can jump to any page | Skips rows on concurrent inserts; `OFFSET N` scans N rows before returning results; degrades at scale |

**Choice**: Option A.

**Rationale**: Booking and trip lists are frequently updated (new bookings, status changes). Offset pagination produces inconsistent results when rows are inserted or deleted between pages. Cursor pagination is immune to this. Performance is O(1) via indexed seek regardless of how deep into the list the client has scrolled.

---

## Consequences

### Positive

- Consistent client-side error handling across all 3 realms
- No more status code debates — clear rules for 400/409/422
- Idempotent operations safe to retry without side effects or error-path surprises
- Service layer independently testable without HTTP
- Pagination stable under concurrent writes

### Negative

- Every error code must be declared in the service's error union AND have a throwing path (see ADR-018 testing rules)
- Discriminated results add a boolean field to every idempotent service function signature
- Cursor pagination prevents "jump to page N" UX (acceptable for this domain — no use case requires it)
