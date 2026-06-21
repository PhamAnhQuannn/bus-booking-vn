# HD-003: Error Handling Audit

> Status: NOT_STARTED | References: ADR-015, ADR-019, SI-003 §13, SI-005

## Purpose

Verify that all API endpoints return consistent error envelopes (ADR-015), all state machine transitions are guarded, and observability coverage enables the 2-min incident detection target (SI-006 §9.4).

## Skill Invocation

- **Primary**: `/observability-review` -- cron job health, state machine observability, error flow analysis

## Acceptance Criteria

### Error Envelope Consistency (ADR-015)

- [ ] All 4xx/5xx responses use the nested error envelope: `{ error: { code, message, details? } }`
- [ ] HTTP status codes match the canonical mapping: 400 (malformed), 401 (auth), 403 (authz), 409 (conflict/retry), 422 (validation), 429 (rate-limit)
- [ ] No raw string error responses (e.g., `NextResponse.json("error")`)
- [ ] Idempotent operations return discriminated results (`{ ok, alreadyApplied }`) not thrown sentinel errors

### State Machine Transitions (ADR-019)

- [ ] All 8 canonical state machines have `LEGAL_*_TRANSITIONS` maps (currently only 3/8; ADR-019 D2):
  - [ ] 1. Booking (`draft → held → paid → cancelled → refunded`)
  - [ ] 2. Trip (`scheduled → departed → completed → cancelled`)
  - [ ] 3. Payment (`pending → paid → failed → refunded`)
  - [ ] 4. Payout (`pending → processing → settled → failed → reversed`)
  - [ ] 5. Hold (`active → converted → expired → released`)
  - [ ] 6. OTP (`active → consumed → expired → locked`)
  - [ ] 7. OperatorUser (`pending_password_change → active → suspended`)
  - [ ] 8. Operator (`pending → active → suspended`)
- [ ] Every `status:` field update is inside `$transaction` with `SELECT FOR UPDATE`
- [ ] Every `<verb>At` timestamp write has a sibling `status:` update within 3 lines (Mistake Log Issue 014 rule)
- [ ] Greppable: `departedAt` → `status: 'departed'`, `completedAt` → `status: 'completed'`, `cancelledAt` → `status: 'cancelled'` in same `tx.update`
- [ ] Every declared error-code union variant has an actual `throw` path AND a test
- [ ] DTO status unions extended in same commit as service function changes

### Error Code Coverage

- [ ] No declared-but-never-thrown error code variants (Mistake Log Issue 013)
- [ ] Status codes match AC table verbatim per endpoint (Mistake Log Issue 011)
- [ ] `// SPEC CONFLICT:` comments present where ACs specify divergent HTTP status codes (Mistake Log Issue 013)

### Observability for Incident Detection

- [ ] Structured JSON logs on stdout (ADR-007)
- [ ] PII redaction covers all sensitive fields (`otpProof`, `tempPassword`, `accessToken`, `refreshToken`)
- [ ] Payment pipeline errors logged with `paymentId`, `bookingRef`, `provider`, `resultCode`
- [ ] Cron job responses include `{ job, status, rowsAffected, durationMs }` (DS-006 §2.3)
- [ ] Missed-cron alert path defined (ADR-007 P4)

## Verdict

**PASS** when all error envelopes are consistent, all 8 state machines have transition maps, and observability coverage supports 2-min detection.

## Cross-References

- ADR-015 -- error contract
- ADR-019 -- state machine enforcement
- ADR-007 -- observability
- SI-003 §13 -- greppable invariant enforcement
- SI-005 -- testing strategy (error code coverage rules)
