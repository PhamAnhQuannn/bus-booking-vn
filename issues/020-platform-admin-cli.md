---
depends-on: [010-operator-auth-force-pwd-change]
type: AFK
---

## Parent PRD

`issues/prd.md`

## What to build

Platform-admin CLI scripts for V1 operator provisioning. No web UI (deferred to V1.x per PRD § Out of Scope). Scripts are run by the platform team against the production DB via a secure jumpbox.

- `pnpm admin:create-operator` — interactive CLI: prompts for operator legal name, contact email, contact phone, notification phone, brand color (optional). Creates `Operator` row + bootstrap `OperatorUser` with role `admin`, `requiresPasswordChange = true`, generates a temp password, and dispatches it via NotificationModule (`operatorAdminTempPassword` template) to the contact phone.
- `pnpm admin:disable-operator <operatorId>` — sets `Operator.disabledAt = now()`. All operator users blocked from login; ongoing trips remain visible but `salesOpen` is forced false; in-flight bookings honored.
- `pnpm admin:reset-operator-admin-password <operatorUserId>` — regenerates temp password, resends SMS, sets `requiresPasswordChange = true`, revokes refresh tokens. Recovery path when an operator-admin loses their phone.
- `pnpm admin:list-operators` — prints `id | name | contactPhone | disabledAt | createdAt` table for quick audit.
- Scripts live under `scripts/admin/` and are excluded from the Next.js build. They load env from `.env.production` and require an explicit `--confirm` flag for any write op to prevent fat-finger accidents.
- Each invocation appends a structured line to `AdminAuditLog` table (`actor`, `action`, `target`, `timestamp`, `argsRedacted`). Argument redaction strips phone numbers to last 4 digits.

## Acceptance criteria

- [ ] `create-operator` produces a working operator-admin who can log in with the SMS'd temp password and is immediately forced through S10's password-change flow.
- [ ] `disable-operator` blocks login for all users under that operator; assert via integration test that a paid customer's existing booking remains visible and unaffected.
- [ ] `reset-operator-admin-password` invalidates the old refresh token; the user must use the new temp password.
- [ ] Write operations without `--confirm` print the proposed change and exit non-zero without mutating DB.
- [ ] Every successful write op writes one row to `AdminAuditLog` with phone redaction verified.
- [ ] CLI scripts do not import any Next.js runtime; assert by running them in a node-only container without the Next.js bundle.

## Blocked by

- Blocked by `issues/010-operator-auth-force-pwd-change.md`

## User stories addressed

- User story 70
