CODE REVIEW — PR #16 "feat(admin): show temp password + unmasked phone on operator detail (issue 113)" @ 2f9684dd
────────────────────────────────
Diff scope: 9 files, +78 / -29 lines

PRIORITY 1 — Block push, fix first:
  (none)

PRIORITY 2 — Fix before merge:
  [CORRECTNESS / UX] app/admin/(console)/operators/[id]/CreateAccountAction.tsx:113
    `showCreds = creds && loginTempPassword !== null` gates credential display on the
    server prop `loginTempPassword`, which is still null between `setCreds()` and
    `router.refresh()` completing. After clicking "Create", the user briefly sees the
    create form again (flash) before credentials appear. Old `if (creds)` was correct —
    `creds` from the API response already has `tempPassword`. The `loginTempPassword`
    prop is only needed for the `hasLoginAccount` branch on subsequent page visits.
    Fix: revert to `if (creds)` for credential display. Keep `loginTempPassword` for
    the `hasLoginAccount` section only.

  [TEST / COVERAGE] lib/admin/__tests__/getOperatorDetail.test.ts:38
    Mock `operatorUser.findFirst` returns `{ username }` without `tempPasswordPlain`.
    `loginTempPassword` non-null path is untested — always resolves to `null` in test.
    Fix: add test case with `tempPasswordPlain` in mock return to cover the non-null path.

  [TEST / COVERAGE] lib/admin/__tests__/createOperatorAccount.test.ts (not in diff)
    `createOperatorAccount.ts` now writes `tempPasswordPlain: tempPassword` to the
    create data, but the test file has no assertion on this field.
    Fix: assert that the Prisma create call includes `tempPasswordPlain` matching the
    generated temp password.

  [HYGIENE / MIGRATION] prisma/migrations/20260612063249_add_temp_password_plain/migration.sql
    Migration includes unrelated FK drift: 3 foreign keys dropped + re-added with
    SET NULL, plus Place.aliases DROP DEFAULT. These are Prisma drift artifacts — harmless
    but noisy. Makes rollback harder to reason about.
    Fix: acceptable as-is (Prisma drift is common), but note it in PR description.

PRIORITY 3 — Address when convenient:
  (none)

SUMMARY: 0 P1, 4 P2, 0 P3

RECOMMENDED NEXT STEPS:
  -> Fix the showCreds logic (P2 #1) — straightforward revert to `if (creds)`.
  -> Add test coverage for tempPasswordPlain paths (P2 #2 + #3).
  -> Migration drift is acceptable as-is.
