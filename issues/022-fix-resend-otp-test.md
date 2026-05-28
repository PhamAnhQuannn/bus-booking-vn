---
priority: should
source: code-review
fingerprint: test-resend-otp-cooldown
severity: P2
---

## Parent PRD

`issues/prd.md` (fix-issue derived from a PR #2 code-review finding — no parent slice)

## What to build

Fix: the new resend-OTP behavior has no automated test. Surfaced by /code-review in
test/coverage at `app/auth/register/page.tsx:46-71` (`sendOtp` + `handleResend` + the
`resendIn` cooldown `useEffect`).

Add a test for the resend path: cooldown disables the button, a `rate_limited` response
seeds `retryAfter` into `resendIn`, the button re-enables when the countdown reaches 0.
Mirror the existing auth e2e approach (drive via URL/DOM, not synthetic keystrokes on the
base-ui Input — see the Issue 002 Mistake Log entry).

## Acceptance criteria

- [ ] Test asserts the resend button is disabled while `resendIn > 0` and re-enabled at 0.
- [ ] Test asserts a `{ error: 'rate_limited', retryAfter }` response sets the cooldown from
      `retryAfter` (and the fallback `?? 30` path when `retryAfter` is absent).
- [ ] Test asserts a successful resend resets the cooldown to 30.
- [ ] /code-review no longer emits fingerprint `test-resend-otp-cooldown`.

## Blocked by

None - can start immediately.
