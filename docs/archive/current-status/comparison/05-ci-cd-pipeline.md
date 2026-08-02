# CI/CD Pipeline — Spec vs Reality

Comparison of SI-003 requirements against current pipeline implementation. Includes KG (Known Gap) tracking.

---

## Current Pipeline — 6 Stages (Working)

| Stage | Tool | Status |
|---|---|---|
| 1. Lint + Type-check | `pnpm lint` + `pnpm tsc --noEmit` | ACTIVE (pre-commit hook + CI) |
| 2. Unit tests | `pnpm test` (Vitest, mocked DB, happy-dom) | ACTIVE |
| 3. Integration tests | `pnpm vitest:int` (real PostgreSQL 16) | ACTIVE |
| 4. E2E tests | Playwright (`mobile-390` project, real PG + Next.js build) | ACTIVE |
| 5. Data leak audit | `scripts/audit/data-leak-grep.sh` (A1-A7 checks) | ACTIVE |
| 6. Secret scanning | Gitleaks v2 (full history scan) | ACTIVE |

**ESLint enforcement (post-Issue 092b):**
- `eslint-plugin-boundaries` `entry-point`: barrel-only cross-domain imports (error severity)
- `eslint-plugin-import-x` `import/no-cycle`: no circular dependencies (error severity)
- Both gated by `pnpm lint` in CI + pre-commit hook

---

## Missing Stages — 8 NOT Built

| Stage | Spec Ref | Purpose | Severity |
|---|---|---|---|
| 7. `pnpm audit` | KG-01 | Dependency vulnerability scan at `high` level | HIGH |
| 8. Docker build | SI-003 Stage 8 | Multi-stage Next.js standalone build verification | HIGH |
| 9. Post-deploy health check | KG-05 | Verify deployment success, trigger rollback on failure | HIGH |
| 10. Greppable invariants | KG-14 | G1-G11 checks (Mistake Log lessons) | HIGH |
| 11. Migration safety | KG-10 | NOT NULL column grep, schema-parity audit | MEDIUM |
| 12. Cron manifest verification | KG-18 | Verify all 16 DS-006 cron endpoints respond | MEDIUM |
| 13. BigInt/currency lint | KG-25 | `Math.round` in money modules = zero hits | MEDIUM |
| 14. Dual cron config parity | KG-26 | `vercel.json` schedule matches `deploy/crontab` | MEDIUM |

---

## Known Gap Registry (KG-01 through KG-26)

### Go-Live Blockers (Issue 094)

| ID | Gap | Spec Ref | Status |
|---|---|---|---|
| KG-01 | Dependabot + `pnpm audit` not in CI | SI-003 Section 7 | NOT IMPLEMENTED |
| KG-02 | HTTP security headers not configured | ADR-008 D4 | NOT IMPLEMENTED |
| KG-03 | PayoutAccount bank details stored plaintext | HD-001 Layer 3 | NOT IMPLEMENTED |
| KG-04 | Branch protection rules not configured | SI-003 Section 3 | NOT CONFIGURED |
| KG-05 | Post-deploy health check + rollback undocumented | SI-003 Section 11 | NOT DOCUMENTED |
| KG-06 | Secrets rotation runbook absent | SI-003 Section 9 | NOT DOCUMENTED |

### Pipeline Gaps (Non-Blocker)

| ID | Gap | Spec Ref | Status |
|---|---|---|---|
| KG-09 | Cron dual-config parity check | DS-006 Section 4.3 | NOT AUTOMATED |
| KG-10 | Migration safety CI automation | ADR-017 | NOT AUTOMATED |
| KG-11 | Performance / load testing | SI-003 Section 12 | DEFERRED |
| KG-12 | Container security scan (Trivy/Grype) | SI-003 Section 5 | DEFERRED |
| KG-13 | FPT Cloud console MFA | SI-006 Section 10 | UNVERIFIED |
| KG-14 | Greppable invariant CI (G1-G11) | SI-003 Section 13 | NOT AUTOMATED |
| KG-15 | Hardening gate stage (HD audits) | SI-003 Section 14 | NOT DEFINED |
| KG-16 | Go-live gate stage (GL checklists) | SI-003 Section 14 | NOT DEFINED |
| KG-17 | State machine transition completeness | SI-003 Section 13 | 3/8 models have maps |
| KG-18 | Cron job manifest verification | DS-006 Section 4 | NOT AUTOMATED |
| KG-19 | `after()` misuse detection | SI-003 Section 13 | NOT AUTOMATED |
| KG-20 | Client barrel import guard (A3) | Issue 092b | PARTIALLY AUTOMATED |
| KG-21 | Dependency license audit (GPL risk) | SI-003 Section 7 | NOT IMPLEMENTED |
| KG-22 | SBOM generation | SI-003 Section 5 | DEFERRED |
| KG-23 | Migration dry-run against shadow DB | ADR-017 | NOT IMPLEMENTED |
| KG-24 | PII redaction coverage check | SI-003 Section 13 | NOT AUTOMATED |
| KG-25 | BigInt/currency math lint | Mistake Log Issue 016 | NOT AUTOMATED |
| KG-26 | Dual cron config drift check | DS-006 Section 4 | NOT AUTOMATED |

---

## Data Leak Audit (A1-A7) — ACTIVE

| Check | Target | Status |
|---|---|---|
| A1 | `tempPasswordPlain` scope (dev-only) | ACTIVE |
| A2 | `accessToken` not in API responses | ACTIVE |
| A3 | `'use client'` components not importing server barrels | ACTIVE (critical, Issue 092b) |
| A4 | `sameSite=lax` baseline on cookies | ACTIVE |
| A5 | `Referrer-Policy` existence | ACTIVE (WARN only) |
| A6 | No `devtunnels` reference in production code | ACTIVE (WARN only) |
| A7 | `OTP_PEEK` scope (dev-only) | ACTIVE |

---

## Greppable Invariants (G1-G11) — NOT AUTOMATED

| Check | Target | Derived From |
|---|---|---|
| G1 | No `operatorId` from request body in `/api/op/*` routes | HD-012 mass assignment |
| G2 | No server-component self-fetch (`localhost`/`NEXT_PUBLIC_BASE_URL`) | Mistake Log Issue 002/003 |
| G3 | No JSON payload cron predicates (`payload->` in cron routes) | Mistake Log Issue 014 |
| G4 | No `Math.round` in money modules (`lib/payouts/`, `lib/ledger/`) | Mistake Log Issue 016 |
| G5 | No `Date.now()` in RSC render bodies (`app/**/page.tsx`) | Mistake Log Issue 016 |
| G6 | No `'use client'` barrel imports (overlap with A3) | Issue 092b, operator-smoke |
| G7 | PII redaction coverage (otpProof, tempPassword in redact list) | Mistake Log Issue 007 |
| G8 | Mock method parity (findUnique vs findFirst alignment) | Mistake Log Issue 008 |
| G9 | Cron dual-config parity (vercel.json matches deploy/crontab) | SI-006 Section 4.3 |
| G10 | Hex mock validity (Buffer.from hex = 64 chars for SHA-256) | Mistake Log Issue 010 |
| G11 | `findFirst` for soft-delete models (not `findUnique`) | Mistake Log Issue 008 |

**Gap:** All 11 checks are manually verifiable but not CI-gated. Target: `pnpm run invariants` command running all checks, zero violations = green.

---

## Code-Review-Only Invariants (Not Automatable)

These are enforced by human review, not grep:
- Timestamp-status pairing: every `<verb>At` write + sibling `status:` within 3 lines (Mistake Log Issue 014)
- Error code throw coverage: every union variant must have `throw` + test (Mistake Log Issue 013)
- Transaction + `SELECT FOR UPDATE` serialization for read-then-write (Mistake Log Issue 011)
- Concurrent-write integration test in same commit as lock code (Mistake Log Issue 011)
- Discriminated result for idempotent operations (Mistake Log Issue 013)
- Status codes match AC table verbatim (Mistake Log Issue 011)
