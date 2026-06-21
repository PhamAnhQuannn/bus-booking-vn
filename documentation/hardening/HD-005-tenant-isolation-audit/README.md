# HD-005: Tenant Isolation Audit

> Status: NOT_STARTED | References: ADR-004, ADR-008 D8, SI-001 §5

## Purpose

Verify that multi-tenant isolation is enforced at the application layer via `withOperatorScope` guards, and that no operator can access another operator's data through any API path.

## Skill Invocation

- **Primary**: Grep-based coverage audit of `withOperatorScope` usage
- **Supplementary**: `/security-review` -- cross-tenant access path analysis

## Acceptance Criteria

### Scope Guard Coverage (ADR-004, ADR-008 D8)

- [ ] Every `/api/op/*` query that reads operator-scoped data passes through `withOperatorScope`
- [ ] Every `/api/op/*` mutation that writes operator-scoped data includes `operatorId` in the `where` clause
- [ ] No `operatorId` sourced from request body in operator routes (greppable invariant G1)
- [ ] `operatorId` derived exclusively from the authenticated session/JWT

### Data Access Paths

- [ ] Buses: `Bus.findMany` scoped to `operatorId`
- [ ] Routes: `Route.findMany` scoped to `operatorId`
- [ ] Trips: `Trip.findMany` scoped to `operatorId` (via route or direct)
- [ ] Bookings: `Booking.findMany` scoped to `operatorId`
- [ ] Staff: `OperatorUser.findMany` scoped to `operatorId`
- [ ] Payouts: `Payout.findMany` scoped to `operatorId`
- [ ] Revenue reports: filtered to authenticated operator's data only

### Cross-Tenant Negative Tests (All 6 Entity Pairs)

- [ ] Integration test: Operator A cannot read Operator B's **buses** (GET `/api/op/buses`)
- [ ] Integration test: Operator A cannot read Operator B's **routes** (GET `/api/op/routes`)
- [ ] Integration test: Operator A cannot read Operator B's **trips** (GET `/api/op/trips`)
- [ ] Integration test: Operator A cannot read Operator B's **bookings** (GET `/api/op/bookings`)
- [ ] Integration test: Operator A cannot read Operator B's **payouts** (GET `/api/op/payouts`)
- [ ] Integration test: Operator A cannot read Operator B's **staff** (GET `/api/op/staff`)
- [ ] Integration test: Operator A cannot reassign a bus to another operator's trip
- [ ] Integration test: Operator A cannot create a trip on another operator's route
- [ ] E2E test: Operator console pages show only authenticated operator's data

### Admin Override Path & Realm Separation

- [ ] Admin routes (`/api/admin/*`) have separate auth middleware (admin JWT, not operator JWT)
- [ ] Admin can view cross-operator data (intentional; different auth tier)
- [ ] No operator JWT can access admin endpoints
- [ ] No admin JWT accepted at `/api/op/*` endpoints (realm isolation)
- [ ] No customer JWT accepted at `/api/op/*` or `/api/admin/*` endpoints
- [ ] Refresh token endpoint validates realm claim — token from realm A cannot mint access token for realm B

### ESLint Enforcement (ADR-008 D8)

- [ ] `eslint-plugin-boundaries` prevents `lib/operator/` from importing `lib/admin/` internals
- [ ] Cross-domain imports between operator and admin domains use barrels only

## Automated Enforcement

Partially automatable:
1. `grep -rn "body.*operatorId" app/api/op/` must return zero (G1)
2. `grep -rn "withOperatorScope" lib/ app/` -- verify coverage of all operator query paths
3. Integration tests for cross-tenant isolation (manual + CI-run)

## Verdict

**PASS** when:
- G1 grep returns zero
- `withOperatorScope` covers all operator query paths
- Cross-tenant negative tests pass in integration suite

## Cross-References

- ADR-004 -- multi-tenancy architecture
- ADR-008 D8 -- tenant isolation lint enforcement
- SI-001 §5 -- multi-tenancy model
- SI-003 §13.2 -- greppable invariant G1
