BACKCOMPAT REVIEW — PR #17 "fix: pre-go-live BLOCKER hardening (B-02 through B-21)"
───────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/17
Base/Head: master ← fix/pre-go-live-blocker-hardening @ 99867928
Size:      +8532 / -174 across 85 files
Project license: MIT (assumed)
Generated: 2026-06-13

No backcompat findings.
(No API shape breaks, no schema breaks, no shared-lib signature changes, no risky new deps.)

Notes:
- Cat 1 (API shape): `totpDisabled` field kept in admin login response (value hardcoded false).
  New `trip_not_departed` 422 on complete endpoint is additive (new error path, no existing change).
- Cat 2 (Schema): 3 relations changed from implicit SET NULL to explicit RESTRICT. No dropped columns,
  no renamed fields, no type narrowing, no new NOT NULL without default. Migration is forward-only
  (tightening, not loosening).
- Cat 3 (Shared-lib): `isAdminTotpDisabled()` export removed — zero references remain in codebase
  (file deleted, barrel export removed, all 2 callers updated in same PR). Clean removal.
  `DeclineCharterInput.opsEmail` added as optional field — widening, not breaking.
- Cat 4 (New deps): No package.json changes. No new dependencies.
- Cat 5 (Typosquat): N/A — no new deps.
- Cat 6 (Lockfile): N/A — no package.json or lockfile changes.

SUMMARY: 0 P1 · 0 P2 · 0 P3 · pinned to 99867928
