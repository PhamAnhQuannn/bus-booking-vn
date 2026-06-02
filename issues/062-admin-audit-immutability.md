---
depends-on: []
type: FIX
wave: 3
spec: [SYS13, S10]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS13] / [S10]

## What to build

Enforce **`AdminAuditLog` append-only at the DB level**. Today it's a plain table
(`schema:501-511`, migration `20260520000000`); immutability is convention-only. Spec
[SYS13]: revoke UPDATE/DELETE for the app role (or a trigger that RAISEs) — append-only is
enforced, not assumed.

- Migration: `REVOKE UPDATE, DELETE ON "AdminAuditLog" FROM <app_role>` (or a
  `BEFORE UPDATE/DELETE` trigger that raises). Same approach as the `LedgerEntry`
  immutability (issue 047) — share the pattern.
- Extend the audit-log write coverage: every admin privileged action (approve/reject,
  suspend, fee change, refund-out, chargeback, flag toggle, invite/revoke) writes a
  who/what/when row. (Wave 3 tabs call it; this issue guarantees the immutability + the
  exhaustive write-site coverage.)
- Confirm phone/PII redaction on audit payloads (existing precedent).

## Acceptance criteria

- [ ] UPDATE/DELETE on `AdminAuditLog` fails at the DB level (integration test expects the
      error).
- [ ] All Wave-3 privileged actions write an audit row (who/what/when).
- [ ] PII redaction applied to audit payloads.
- [ ] Migration declared (SQL; no DSL model change needed for REVOKE/trigger).

## Blocked by

- none (pairs with issue 047 immutability pattern)

## User stories addressed

- [SYS13]/[S10] audit log append-only (DB-enforced), every privileged action, exportable.
