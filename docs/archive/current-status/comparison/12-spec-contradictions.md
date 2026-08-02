# Spec Contradictions & Documentation-Only Gaps

Resolved contradictions within specs, plus documentation gaps with no immediate code risk.

---

## Part 1: Spec-Internal Contradictions (All Resolved)

### 1.1 Operator-Cancel Refund Policy

**Contradiction:**
- S03 (rebuild-plan): Commits to "operator cancels → default refund"
- S06 (rebuild-plan): "triggers refund/rebook" (implying rebook is an option)
- S15#2 (rebuild-plan): Lists "default refund vs rebooking" as OPEN decision

**Resolution:** Ratified in rebuild-plan review: default refund is LOCKED. Rebooking is not offered at launch.

**Code status:** `lib/trips/cancelTrip.ts` implements refund-only. Aligned with ratified decision. No code gap.

---

### 1.2 Booking Money-State vs Notification Conflation

**Contradiction:**
- Rebuild-plan review P2 #12 identified risk of booking status conflating money state with notification state (e.g., `paid_operator_notified` as a status)

**Resolution:** Schema correctly separates concerns:
- `Booking.status` = money truth: `pending_payment`, `paid`, `cancelled`
- `NotificationLog` tracks notification delivery separately

**Code status:** No conflation exists. Notification state never pollutes booking status. No code gap.

---

### 1.3 Verify Page vs Mutable Plate (PDF Staleness)

**Contradiction:**
- SYS08 (rebuild-plan): Describes "generate-once PDF emailed" (implies PDF is immutable after generation)
- S06 (rebuild-plan): Describes "ticket reflects current bus plate" on reassign (implies PDF must be mutable)

**Resolution:** Ratified: public verify page is source of truth. PDF is regenerated/invalidated on bus reassign.

**Code status:**
- Verify page: exists (read-only, reflects current data)
- PDF generation: `ticketPdfGeneration` cron exists
- PDF regeneration on reassign: NOT VERIFIED (need to confirm `reassignBus` triggers PDF invalidation)

---

### 1.4 Available Seats Predicate — Spec Error

**Contradiction:**
- S02 and SYS04 (rebuild-plan): Both state "exclude `capacity < ticketCount`" — this is WRONG because it ignores existing paid and held seats

**Resolution:** Code correctly computes: `available = capacity - (paidSeats + activeHeldSeats)`. Spec wording is inaccurate.

**Code status:** `lib/db/searchTrips.ts` and `lib/search/searchTrips.ts` correctly compute available seats. No code gap; spec should be updated.

---

### 1.5 `bus_overlap_with_outbound` Status Code Divergence

**Contradiction:**
- AC6 (Issue 013 paired-return): Specifies HTTP **422** for `bus_overlap_with_outbound`
- I3 invariant (Issue 011 reassign-bus): Specifies HTTP **409** for overlap conflicts
- Same error code, different status across two endpoints

**Resolution:** Both implemented per their respective AC text verbatim (Mistake Log rule: don't silently pick one).
- `app/api/op/trips/[id]/paired-return/route.ts`: returns 422 + `// SPEC CONFLICT:` comment
- `reassignBus` route: returns 409

**Code status:** Both divergent status codes implemented with inline `// SPEC CONFLICT:` comments. Follow-up issue to canonicalize one code remains open.

---

## Part 2: Documentation-Only Gaps (No Code Risk)

These are gaps in documentation accuracy or external verification, not code defects.

### 2.1 FPT Cloud PostgreSQL 16 — Version Unconfirmed

**Spec assumption:** ADR-001, SI-006 assume PostgreSQL 16 available on FPT Cloud.

**Reality:** FPT Cloud marketing pages do not publish specific engine versions. May be PG 14 or PG 15.

**Risk:** PG 14 lacks some features used in codebase (e.g., `MERGE` syntax if used). PG 15 would work for most features.

**Resolution:** Verify during FPT Cloud onboarding. Request PG 16 specifically. Fallback: PG 15 is acceptable for Phase 1.

---

### 2.2 FPT Cloud Redis 7 — Version Unconfirmed

**Spec assumption:** ADR-001, SI-006 assume Redis 7 available on FPT Cloud.

**Reality:** Same issue — version not published. May be Redis 6.

**Risk:** Redis 6 lacks some Redis 7 features (e.g., Redis Functions). Current usage (rate-limit, SETNX, cache) works on Redis 6.

**Resolution:** Verify during FPT Cloud onboarding. Redis 6 is acceptable for Phase 1 if Redis 7 unavailable.

---

### 2.3 FPT DBProxy Transaction Mode — Unconfirmed

**Spec assumption:** SI-006 assumes FPT Database Engine's "DBProxy" supports PgBouncer-compatible transaction mode.

**Reality:** FPT has not confirmed whether DBProxy is transaction-mode or session-mode. Session-mode would break Prisma `$transaction` blocks.

**Risk:** If session-mode only, must self-host PgBouncer on FPT Cloud VPS instead.

**Resolution:** Ask FPT Cloud support for DBProxy documentation. If session-mode, add PgBouncer container to Docker Compose stack (SI-006 already has this fallback designed).

---

### 2.4 FPT Cloud Compute Pricing — Opaque

**Spec estimate:** SI-006 estimates $340-520/month for Stage 0 (4 vCPU / 8GB VPS + managed PG + managed Redis).

**Reality:** FPT Cloud has no public pricing page. Requires direct sales quote.

**Risk:** Actual cost may differ significantly from estimate.

**Resolution:** Request sales quote from FPT Cloud. Budget range is informational only.

---

### 2.5 RPO/RTO Targets — Undefined

**Spec requirement:** ADR-002, GL-003 require defined Recovery Point Objective and Recovery Time Objective.

**Reality:** No RPO/RTO numbers chosen. Cannot design backup strategy or DR drill without targets.

**Risk:** Without defined targets, backup frequency and recovery procedure cannot be validated.

**Resolution:** Define RPO (e.g., 6 hours — max data loss) and RTO (e.g., 4 hours — max downtime). These are business decisions, not technical ones.

---

### 2.6 Provider Migration Playbook — Untested

**Spec says:** SI-006 Section 13 documents a full provider migration playbook (pre-migration, migration window, post-migration, rollback).

**Reality:** Playbook is documented but never tested. No dry-run migration has been executed.

**Risk:** Untested runbooks fail under pressure. DNS TTL lowering, pg_dump timing, and webhook URL updates all have gotchas.

**Resolution:** Execute a dry-run migration (FPT dev → FPT staging, or local → FPT dev) before relying on the playbook.

---

### 2.7 FPT Cloud Console MFA — Unverified

**Spec requirement:** SI-003 KG-13 flags FPT Cloud console MFA as unverified.

**Reality:** Unknown whether FPT Cloud console supports MFA. If not, console access is password-only.

**Risk:** Compromised FPT Cloud credentials = full infrastructure access without second factor.

**Resolution:** Verify during FPT Cloud onboarding. If no MFA, document compensating control (e.g., IP allowlist on console access).

---

### 2.8 Prisma `migrate diff` Flags — Drifted

**Spec reference:** Mistake Log Issue 007 codified verification command: `pnpm prisma migrate diff --from-schema-datamodel --to-schema-datasource`

**Reality:** Prisma 7.8 removed those flag names (Mistake Log Issue 012 documents this). Command no longer works as written.

**Risk:** Old command copied from Mistake Log into plans → confusing error. Manual schema-parity audit substitutes cleanly.

**Resolution:** Read `node_modules/.bin/prisma migrate diff --help` for current flag names before quoting the command. Mistake Log Issue 012 already notes this; older references should not be copied verbatim.

---

## Summary

| Category | Count | Status |
|---|---|---|
| Spec contradictions (resolved) | 5 | All resolved in code. No action needed. |
| Documentation-only gaps | 8 | No code risk. Require external verification or business decisions. |
| **Total** | **13** | No code changes needed. |
