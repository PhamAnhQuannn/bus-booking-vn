---
depends-on: [094-go-live-real-payment-keys]
type: SECURITY
wave: 9.5
spec: [S05, SYS02]
blocks: [094-go-live-real-payment-keys]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S05] — REMOVE PLAINTEXT TEMP PASSWORD STORAGE

## Context

Issue added 2026-06-11. `OperatorUser.tempPasswordPlain` stores the admin-generated temp password
in plaintext so admins can view it on the operator detail page until the operator changes their
password. This is a **dev convenience** while the email delivery pipeline is stubbed
(`NOTIFY_STUB`). Once real email delivery is wired (eSMS + email provider, part of 094 go-live),
operators receive credentials via email self-serve and the plaintext column is unnecessary.

**Must be resolved BEFORE 094 flips real keys.** Plaintext passwords in production DB = critical
security defect.

## What to do

### Option A — Remove entirely (recommended if email delivery is reliable)

1. **Drop `tempPasswordPlain` column:**
   - New migration: `ALTER TABLE "OperatorUser" DROP COLUMN "tempPasswordPlain"`
   - Remove field from `prisma/schema.prisma`

2. **Remove all write sites:**
   - `lib/admin/createOperatorAccount.ts` — remove `tempPasswordPlain: tempPassword` from create data
   - `app/api/op/auth/password/change/route.ts` — remove `tempPasswordPlain: null`
   - `app/api/op/auth/forgot-password/reset/route.ts` — remove `tempPasswordPlain: null`

3. **Remove all read sites:**
   - `lib/admin/getOperatorDetail.ts` — remove `tempPasswordPlain` from select + `loginTempPassword` from interface/return
   - `app/admin/(console)/operators/[id]/page.tsx` — remove `loginTempPassword` prop
   - `app/admin/(console)/operators/[id]/CreateAccountAction.tsx` — remove `loginTempPassword` prop + temp password display; keep username display

4. **Update UI copy:**
   - "Tài khoản nhà xe" section shows username only
   - Add note: "Thông tin đăng nhập đã được gửi qua email. Nhà xe có thể đặt lại mật khẩu tại /op/forgot-password."

5. **Update tests:**
   - `lib/admin/__tests__/getOperatorDetail.test.ts` — remove `loginTempPassword` from mock/assertions
   - `lib/admin/__tests__/createOperatorAccount.test.ts` — remove `tempPasswordPlain` from assertions

### Option B — Encrypt at rest (if admin must still view temp password)

1. Add `TEMP_PW_ENCRYPTION_KEY` env var (AES-256-GCM)
2. Encrypt before storing, decrypt on read in `getOperatorDetail`
3. Still clear on password change
4. Less ideal but acceptable if email delivery is unreliable at launch

## Acceptance criteria

- [ ] `tempPasswordPlain` column does NOT exist in production DB (Option A) OR is encrypted at rest (Option B)
- [ ] No plaintext password stored anywhere in the database
- [ ] Operator credential delivery works end-to-end via email (verify with real provider, not stub)
- [ ] Admin can still see username on operator detail page
- [ ] Admin can trigger password reset for operators who lost access
- [ ] `pnpm tsc --noEmit` + `pnpm test` green
- [ ] E2E: create operator account → operator receives email → operator sets password → operator logs in

## Grep targets (all sites to update)

```
tempPasswordPlain
loginTempPassword
login-temp-password
```

## Gate

**This issue BLOCKS 094 go-live.** Do not flip real payment/notification keys until this is resolved.
