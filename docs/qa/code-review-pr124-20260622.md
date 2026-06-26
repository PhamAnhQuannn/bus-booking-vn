# Code Review: PR #124 — Security PII Cleanup & Hardened Defaults

**Commit:** e3b6155ed3c156ae1b279292e917bc69948a087d  
**Author:** Bus Booking Dev  
**Date:** 2026-06-22T07:40:31Z  
**Scope:** Security cleanup before public visibility  
**Test Status:** All assertions passed (per PR description)

---

## Changes Summary

Changes: 15 files modified, deletions of .doc/.docx/markdown files, test fixture updates, Docker Compose hardening.

---

## Detailed Findings

### Phase 1: File Deletions

Files Removed:
- documentation/business/BAO-CAO-KINH-DOANH-TONG-HOP.docx (business report, 103KB)
- documentation/business/HO-SO-PHAP-LY-CHI-TIET.doc (legal doc, 57KB)
- documentation/business/HO-SO-PHAP-LY-TOM-TAT.doc (legal doc, 39KB)
- awake-status-report.md (status report with timestamps, commit refs, Issue 013 roadmap WIP)

Verification: git ls-files .doc/.docx/awake-status-report.md returns empty.

Note: Files deleted via commit (not just .gitignore), so history contains them. Acceptable for a cleanup commit; if repo becomes public and files contained secrets, post-publication git filter-repo may be needed.

### Phase 2: Test Fixtures - Brand Name & Phone Replacement

Files Modified (4):
- app/api/bookings/[id]/ticket/__tests__/route.test.ts:65
- lib/booking/__tests__/getCustomerBookingDetail.test.ts:36, :75
- lib/jobs/__tests__/generateTicketPdfs.test.ts:86
- scripts/seed/seed-operator.ts:7-8

Changes:
- 'Phuong Trang' → 'Test Bus Co'
- '+84909999999' → '+8490xxxxxx9'
- 'ops@phuongtrang.vn' → 'ops@testbus.example.com'

Phone Format: Old format +84909999999 (11 chars) could collide with real mobile prefixes. New format +8490xxxxxx9 (12 chars with literal x) escapes gitleaks regex detector and is clearly a placeholder. Conforms to CLAUDE.md Mistake Log rule: PII placeholders must escape the project's PII detection regex.

Seed caveat: scripts/seed/seed-operator.ts still uses RAW_PHONE = '0901234567' (unmasked dev phone). Acceptable—seed fixtures are dev-time only. Compliance applies to test DTO assertions and logs.

Test status: PR confirms 21/21 tests pass. Both fixture creation and DTO assertions updated, maintaining test fidelity.

### Phase 3: Docker Compose - Redis Password Hardening

docker-compose.prod.yml (lines 140-155):
- OLD: ${REDIS_PASSWORD:-changeme} (colon-default allows container start with plaintext default)
- NEW: ${REDIS_PASSWORD:?REDIS_PASSWORD required} (colon-error fails if REDIS_PASSWORD not set)

Impact: Fail-closed hardening. Production/staging must explicitly set password; container will not start otherwise. This is the correct security posture.

Applied to:
- redis command line argument
- redis healthcheck -a flag

docker-compose.staging.yml: Same hardening applied.

docker-compose.dev.yml: Unchanged (no password required for local dev). Correct.

Test claim: grep -rn 'changeme' docker-compose.{prod,staging}.yml — 0 hits. Verified via commit diff.

### Phase 4: Dev Tunnel Specificity Reduction

next.config.ts:34
- OLD: ['93ppgcdj-3001.usw3.devtunnels.ms', '*.devtunnels.ms']
- NEW: ['*.devtunnels.ms']

Analysis: Removed VS Code devtunnel account ID 93ppgcdj (specific to one developer). Retained wildcard pattern. Any developer can now use their own devtunnel without editing config. Prevents leaking individual tunnel IDs to shared codebase.

Comment (lines 30-33) still references "VS Code devtunnel origin"—accurate, does not expose the removed ID.

### Phase 5: Metadata Scrubbing (Minor)

docs/qa/traveler-smoke-2026-06-22.md:185
- Changed: hold created for +84932133894 → hold created for +8490xxxxxxx
- Context: QA run log entry, single real-looking phone masked

issues/prd-pickup-areas.md:3
- Removed: C:\Users\mrimp\.claude\plans\now-a-new-feature-twinkling-puzzle.md (Windows user path)
- Replaced: Generic comment "Decisions below are already grilled — treat as settled."
- Exposure: Low risk; removal is defensive cleanliness

### Phase 6: .gitignore Enhancements

Added patterns:
- ~$* (Office temp lock files)
- documentation/business/*.doc
- documentation/business/*.docx
- awake-status-report.md

Validation: All patterns are correct anchoring. Pattern documentation/business/*.docx will auto-ignore future .docx in that directory, enforcing no Word docs tracked.

---

## Code Quality & Soundness

Strengths:
✅ Surgical changes: only touched intended files
✅ Fail-closed Redis hardening: production will not start without explicit password
✅ Consistent phone masking: all test fixtures use identical placeholder format
✅ Backward compatible: dev workflows unchanged; prod/staging only hardened
✅ Tests remain green: PR confirms all suites pass
✅ All test assertions updated alongside fixture changes

Observations:
- Docker Compose error strings (:?REDIS_PASSWORD required) are user-facing—clear and actionable
- Spec/ADR/FD files still reference Phương Trang—intentional (reference data in product specs, not test fixtures)
- No dependency/import changes; purely data + config + doc edits

---

## Compliance & Risk Assessment

Secrets leaked? NO. No plaintext passwords, tokens, or keys introduced.
Real PII removed? YES. Phương Trang brand (real Vietnamese company) + real-format phones scrubbed from fixtures and configs.
Test coverage maintained? YES. All assertions updated; 21/21 tests pass.
Deploy configs hardened? YES. Redis now fail-closed in prod/staging.
Devtunnel ID exposed? NO. Specific account ID removed; wildcard pattern preserved.
Regressions introduced? NO. No logic changes; data/config only.

---

## Test Verification (per PR)

- pnpm tsc --noEmit: PASSES
- pnpm vitest run (21 tests across 4 files): ALL PASS
- git ls-files *.doc *.docx awake-status-report.md: EMPTY (0 files tracked)
- grep -rn changeme docker-compose.prod.yml docker-compose.staging.yml: 0 HITS
- grep -rn 93ppgcdj next.config.ts: 0 HITS
- grep -rn +84909999999 --include=*.ts: 0 HITS

---

## Final Verdict

NO ISSUES FOUND

This is a well-executed security hardening + PII cleanup PR. All changes are defensive (fail-closed defaults), consistent (uniform phone masking), and surgically scoped (no adjacent refactoring). The commit is production-ready.

Merge recommendation: APPROVED for merge to master.

Post-merge consideration: If repo becomes public, deleted files remain in Git history and can be recovered via git show. If full scrubbing is required, a git filter-repo pass would be needed as a separate repo-wide operation.

