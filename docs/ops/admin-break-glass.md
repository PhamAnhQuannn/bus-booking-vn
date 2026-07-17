# Admin break-glass runbook

Authorization + procedure for the sealed admin CLIs. These are the only ways to
mint or recover the platform admin realm when the web console cannot serve the
request (no admin exists yet, or the sole SUPER_ADMIN is locked out).

## Who is authorized

Authority is **possession of the production environment**, not an admin session.
Whoever can run a command with `--env-file` pointing at the production secrets
(`DATABASE_URL`/`DIRECT_URL`, `ADMIN_BOOTSTRAP_*`) is the break-glass authority —
today that is the platform owner. Treat these commands as the highest-privilege
operation in the system.

- Run only with explicit intent and, once the team is >1 person, a second
  person's sign-off recorded out-of-band (chat/ticket).
- Every run is written to `AdminAuditLog` (`actor='cli:bootstrap'` /
  `actor='cli:break-glass'`) — review it after any break-glass event.

## Connection requirement

Run against the **direct** connection string (`DIRECT_URL`), never the pooled
(`DATABASE_URL`) URL. `bootstrapSuperAdmin` uses an interactive Prisma
`$transaction`, which the pooled PgBouncer endpoint breaks. The CLIs' own
`_client.ts` reads `DATABASE_URL`, so point that variable at the direct URL for
the run (e.g. an env file whose `DATABASE_URL` is the direct string).

## 1. Genesis admin — `scripts/admin/bootstrapSuperAdmin.ts`

Mints the FIRST SUPER_ADMIN from `ADMIN_BOOTSTRAP_EMAIL` + `ADMIN_BOOTSTRAP_PASSWORD`.

```
ADMIN_BOOTSTRAP_EMAIL=… ADMIN_BOOTSTRAP_PASSWORD=… \
  pnpm tsx --env-file=<prod-direct-env> scripts/admin/bootstrapSuperAdmin.ts
```

- **Idempotent:** if any SUPER_ADMIN already exists it is a no-op (`created:false`) —
  it will NOT rotate an existing password.
- Creates the admin with **TOTP disabled**. The admin enrolls TOTP on first login
  via `/admin/enroll-totp` (the login page routes there automatically on
  `TOTP_ENROLLMENT_REQUIRED`).
- Rotate/remove `ADMIN_BOOTSTRAP_PASSWORD` from the environment after first login.

## 2. Lost-TOTP recovery — `scripts/admin/resetAdminTotpBreakGlass.ts`

For the dead-end the web route cannot serve: the only SUPER_ADMIN lost their
authenticator, so no other super-admin can reset it via `/admin` (the web route
enforces actor-is-super-admin + no-self-reset).

```
pnpm tsx --env-file=<prod-direct-env> scripts/admin/resetAdminTotpBreakGlass.ts \
  --email=admin@example.com --confirm
```

- **Dry-run by default:** without `--confirm` it prints the target and exits
  non-zero with no DB change.
- Clears the target's TOTP secret; the target re-enrolls at `/admin/enroll-totp`
  on next login.
- Audit-logged as `actor='cli:break-glass'`.

## Notes

- There is currently **no admin password-change flow** (self-service or CLI). If
  a bootstrap password is suspected leaked, rotating it requires a direct DB
  update of `AdminUser.passwordHash` until the password-rotation path (P2) ships.
- Admin login attempts (success/failure) are recorded in `AdminAuditLog` — check
  it if a compromise is suspected.
