# Setup Guides

> **Phase 1 Quick Reference:** Only these 6 guides are needed for launch:
> `01-setup-github.md` → `02-setup-neon.md` → `03-setup-upstash.md` → `04-setup-vercel.md` → `05-setup-cloudflare-dns.md` → `06-setup-sepay.md`
>
> eSMS (`esms-registration-guide.md`) is required for operator OTP + booking confirmation SMS.

## Phase 1 — Required for Launch

| Guide | Purpose |
|-------|---------|
| [01-setup-github.md](01-setup-github.md) | Branch protection, CI checks, Dependabot |
| [02-setup-neon.md](02-setup-neon.md) | PostgreSQL 16 (ap-southeast-1, pooled + direct URLs) |
| [03-setup-upstash.md](03-setup-upstash.md) | Redis for rate limiting, OTP cooldowns, CSRF nonces |
| [04-setup-vercel.md](04-setup-vercel.md) | Next.js hosting (sin1), env vars, 11 cron endpoints |
| [05-setup-cloudflare-dns.md](05-setup-cloudflare-dns.md) | DNS (grey cloud, not orange), SSL, `.vn` domain notes |
| [06-setup-sepay.md](06-setup-sepay.md) | VietQR bank transfer webhook (Phase 1 primary payment) |
| [esms-registration-guide.md](esms-registration-guide.md) | SMS: operator OTP + booking confirmation to passengers |

## Phase 2+ — Deferred (Stubbed or Disabled)

| Guide | Purpose | Activates When |
|-------|---------|----------------|
| [07-setup-sentry.md](07-setup-sentry.md) | Error tracking (account only, SDK not installed) | > 1,000 monthly bookings |
| [08-setup-betterstack.md](08-setup-betterstack.md) | Uptime monitoring + status page | > 1,000 monthly bookings |
| [09-setup-cloudflare-r2.md](09-setup-cloudflare-r2.md) | Object storage for ticket PDFs, documents | `STORAGE_STUB=false` |
| [10-setup-resend.md](10-setup-resend.md) | Transactional email (customer OTP, confirmations) | Customer auth 410 gate lifted |
| [11-setup-misa.md](11-setup-misa.md) | E-invoice (Decree 123/2020) | ERC obtained + tax registration |
| [12-setup-momo.md](12-setup-momo.md) | MoMo e-wallet payment | Multi-payment Phase 2 |
| [13-setup-vnpay.md](13-setup-vnpay.md) | VNPay domestic card/ATM | Multi-payment Phase 2 |

## Supplementary

| Guide | Purpose |
|-------|---------|
| [cdtia-data-residency-guide.md](cdtia-data-residency-guide.md) | Vietnam PDPL 2025 compliance, CDTIA filing for Singapore-hosted services |
| [deployment-fpt-cloud-setup.md](deployment-fpt-cloud-setup.md) | FPT Cloud VPS + Docker backup deployment (alternative to Vercel) |

## Cross-References

- Phase 1 launch scope: `documentation/go-live/GL-006-phase1-launch-scope/README.md`
- Full launch checklist: `documentation/go-live/GL-001-launch-checklist/README.md`
- Phase 2 triggers: GL-006 lines 167-179
