# 07 -- Secrets Rotation Runbook

## Status: DONE

## What changed

Created comprehensive secrets rotation runbook at `documentation/go-live/GL-006-phase1-launch-scope/secrets-rotation-runbook.md` covering:

- 10 secret categories with rotation procedures
- Rotation schedule (90-day critical, 180-day high)
- Pre/post checks and rollback for each category
- Emergency breach response protocol
- Secret generation commands

## Categories covered

1. JWT signing secrets (3 realms)
2. Refresh token secret
3. Encryption keys (TOTP + Bank)
4. Hold cookie secret
5. Cron secret
6. Database password
7. Redis password (ioredis + Upstash)
8. Payment gateway secrets (MoMo + VNPay)
9. SMS provider secrets (eSMS)
10. Emergency rotation (breach response)

## Verification

Documentation-only item — no code changes, no tests needed.
