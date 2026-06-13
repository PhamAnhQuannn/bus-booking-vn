CODE REVIEW — PR #15 "fix(admin): link operator names + show full phone on approvals page" @ 5f49572f
────────────────────────────────
Diff scope: 2 files, +6 / -7 lines

PRIORITY 1 — Block push, fix first:
  [CORRECTNESS / TEST] lib/admin/__tests__/getApprovalQueue.test.ts:30-56
    Test "masks the contact phone..." asserts redacted output (`+xxxxxxx4567`) and
    `not.toContain('90123')`. Code now returns raw phone — both assertions will FAIL.
    Test description also references masking which is no longer accurate.
    Fix: update test name to "returns full contact phone", assert
    `expect(op.contactPhone).toBe('+84901234567')`, remove the `not.toContain` guard.

PRIORITY 2 — Fix before merge:
  (none)

PRIORITY 3 — Address when convenient:
  (none)

NOTES:
  - Link target `/admin/operators/[id]` route exists — verified.
  - SUPER_ADMIN role gate at page.tsx:42 guards PII exposure — phone unmasking is
    intentional and authz-gated. No security finding.
  - `redactPhone` still used by other admin modules (getOperatorDetail, searchUsers,
    listAllOperators, etc.) — import removal here doesn't orphan the function.

SUMMARY: 1 P1, 0 P2, 0 P3

RECOMMENDED NEXT STEPS:
  → Fix test assertion in getApprovalQueue.test.ts before merge.
