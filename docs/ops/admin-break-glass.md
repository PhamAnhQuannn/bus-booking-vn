# Admin Break-Glass & Bootstrap (Issue 057)

Procedures for standing up the platform-admin realm and recovering it when the
normal in-app paths are unavailable. All actions here are SECURITY-CRITICAL and
audit-logged to `AdminAuditLog`.

## 1. Sealed bootstrap credential

The first `SUPER_ADMIN` is the genesis credential — there is **no in-app way** to
create it (every admin-creating route requires an authenticated super-admin). It
is minted only from the sealed bootstrap CLI, which reads two out-of-band env
vars:

- `ADMIN_BOOTSTRAP_EMAIL`
- `ADMIN_BOOTSTRAP_PASSWORD`

These live ONLY in the sealed production env (`.env.production`, or the secret
manager that renders it). They are set out-of-band by whoever holds prod-secret
access, and **rotated/removed after first login** — once the super-admin has
logged in and enrolled TOTP, the bootstrap password is no longer needed and
leaving it in env is a standing risk.

## 2. Bootstrap procedure

```
ADMIN_BOOTSTRAP_EMAIL=ops@example.com ADMIN_BOOTSTRAP_PASSWORD=… \
  pnpm admin:bootstrap-super-admin
```

- Creates one `AdminUser` with `role=SUPER_ADMIN, status=ACTIVE`, audit action
  `bootstrap-super-admin`.
- **Idempotent**: if ANY `SUPER_ADMIN` already exists, the CLI prints
  "Super-admin already exists — no change" and exits 0 without minting a
  duplicate. Safe to re-run.
- After it succeeds: log in, enroll TOTP (Issue 055), then rotate/clear
  `ADMIN_BOOTSTRAP_PASSWORD`.

## 3. Normal lost-TOTP recovery (preferred)

When an admin loses their TOTP authenticator and **another** super-admin exists:

1. The other super-admin logs in (TOTP-verified) and completes step-up.
2. They `POST /api/admin/admins/<targetAdminId>/reset-totp`.
3. The target's `totpSecret`/`totpEnabledAt` are cleared; on the target's next
   login they hit the enrollment-required path and re-enroll a fresh
   authenticator.

Guard: **no self-reset** — an admin cannot reset their OWN TOTP via the web route
(returns 422). This forces recovery through a second super-admin so a single
compromised session cannot drop its own second factor.

## 4. Break-glass CLI (no other super-admin)

For the dead-end case: the ONLY super-admin lost their TOTP, so step 3 is
impossible (no second super-admin to perform the reset). Use the sealed CLI:

```
pnpm admin:reset-admin-totp --email=admin@example.com --confirm
```

- Resets the target admin's TOTP by email; audit action `reset-admin-totp`,
  actor `cli:break-glass`.
- Authorized NOT by an authenticated super-admin session but by **access to the
  sealed prod env** itself (`--env-file=.env.production`). Whoever can run it is,
  by definition, the break-glass authority.
- Dry-run by default — prints the target and exits non-zero unless `--confirm` is
  passed.

**Who may run it:** only personnel with prod-secret access (the same set who can
set the bootstrap credential). Every break-glass use should be announced in the
ops channel and reviewed in `AdminAuditLog` after the fact.
