# Vercel Pro — Setup Guide

Deploy Bus-Booking as a Next.js app on Vercel Pro (Singapore region). Code integration: `vercel.json`, `next.config.ts`. Env vars: all from `.env.production.example`.

---

## Step 1: Create Vercel Account

1. Go to **https://vercel.com/signup**
2. Sign up with GitHub (recommended — simplifies repo import)
3. Verify email address

---

## Step 2: Create Team & Upgrade to Pro

1. After login, click **"Create Team"** in the left sidebar
2. Enter team name (e.g. `busmap-vn`)
3. Click **"Upgrade to Pro"** — $20/month per member
4. Enter payment details

Pro plan required for:
- Cron jobs (11 endpoints in `vercel.json`)
- Custom domains with advanced SSL
- Longer serverless function execution (60s vs 10s)
- Team collaboration features

---

## Step 3: Import GitHub Repository

1. From Vercel dashboard, click **"Add New..." → "Project"**
2. Select **"Import Git Repository"**
3. Find and select the **Bus-Booking** repository
4. Configure build settings:

| Setting | Value |
|---------|-------|
| Framework Preset | `Next.js` (auto-detected) |
| Root Directory | `.` (default) |
| Build Command | `pnpm build` |
| Output Directory | `.next` (default) |
| Install Command | `pnpm install` |
| Node.js Version | `20.x` |

5. **Do NOT deploy yet** — skip to Step 4 to set environment variables first

---

## Step 4: Configure Function Region

1. Go to **Project Settings → Functions**
2. Set **Function Region** to **Singapore (sin1)**
3. This matches `"regions": ["sin1"]` in `vercel.json`

Why `sin1`: lowest latency to Vietnam users, same region as Neon DB (ap-southeast-1) and Upstash Redis (ap-southeast-1). Data stays within Singapore for CDTIA compliance.

---

## Step 5: Set Environment Variables

1. Go to **Project Settings → Environment Variables**
2. Add every variable from `.env.production.example` with scope **Production**
3. Critical variables (generate fresh secrets for each):

| Variable | Source | Generate |
|----------|--------|----------|
| `DATABASE_URL` | Neon dashboard (pooled) | See `setup-neon.md` |
| `DIRECT_URL` | Neon dashboard (direct) | See `setup-neon.md` |
| `REDIS_PROVIDER` | Literal | `upstash` |
| `UPSTASH_REDIS_REST_URL` | Upstash dashboard | See `setup-upstash.md` |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash dashboard | See `setup-upstash.md` |
| `JWT_SECRET` | Generate | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_OPERATOR_SECRET` | Generate | Same command, fresh value |
| `JWT_ADMIN_SECRET` | Generate | Same command, fresh value |
| `REFRESH_TOKEN_SECRET` | Generate | Same command, fresh value |
| `HOLD_SECRET` | Generate | Same command, fresh value |
| `TOTP_ENCRYPTION_KEY` | Generate | Same command, fresh value |
| `BANK_ENCRYPTION_KEY` | Generate | Same command, fresh value |
| `TICKET_SECRET` | Generate | `node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"` |
| `CRON_SECRET` | Generate | Same as TICKET_SECRET |
| `STORAGE_STUB_SECRET` | Generate | Same as TICKET_SECRET |
| `SEPAY_API_KEY` | SePay dashboard | See `setup-sepay.md` |
| `VIETQR_ACCOUNT_NUMBER` | SePay dashboard | See `setup-sepay.md` |
| `VIETQR_BANK_BIN` | Literal | `970405` (Agribank) |
| `NEXT_PUBLIC_SITE_URL` | Your domain | `https://yourdomain.com` |

4. Feature flags for launch:

| Variable | Value | Notes |
|----------|-------|-------|
| `PAYMENTS_STUB` | `false` | Real SePay payments |
| `NOTIFY_STUB` | `false` | Real eSMS (or `true` to defer SMS) |
| `STORAGE_STUB` | `true` | R2 deferred to Phase 2 |
| `VNPAY_ENABLED` | `false` | VNPay disabled (Phase 1 = bank transfer only) |
| `EINVOICE_ENABLED` | `stub` | MISA deferred to Phase 2 |
| `HOLD_SWEEPER_MODE` | `update` | Active hold expiry |
| `SEARCH_USE_BLOCKED_SEATS` | `true` | Live seat blocking |

> **Phase 2 vars (not needed at launch):** `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM` — required when customer authentication via email OTP is enabled. See `10-setup-resend.md`.

5. **NEVER set in production:**
   - `OTP_PEEK_ENABLED` — must be absent or `false`
   - `ADMIN_TOTP_DISABLED` — must be absent or `false`

---

## Step 6: Deploy

1. Go to **Deployments** tab → click **"Redeploy"** (or push to `master`)
2. Watch build logs — should complete in ~2-3 minutes
3. Check deployment URL: `https://your-project.vercel.app`

---

## Step 7: Verify Cron Jobs

Vercel auto-detects cron schedules from `vercel.json`. Verify:

1. Go to **Project Settings → Cron Jobs**
2. Confirm all 11 endpoints are listed:

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `/api/cron/sweep-holds` | Every minute | Expire stale seat holds |
| `/api/cron/generate-trips` | 1:00 AM daily | Auto-generate next-day trips |
| `/api/cron/close-sales` | Every minute | Close sales before departure |
| `/api/cron/complete-trips` | Every 5 min | Auto-complete past trips |
| `/api/cron/send-reminders` | Every 15 min | Departure reminders |
| `/api/cron/process-payouts` | Every hour | T+3 operator payouts |
| `/api/cron/dispatch-notifications` | Every minute | SMS/email queue drain |
| `/api/cron/generate-ticket-pdfs` | Every 2 min | Async ticket PDF gen |
| `/api/cron/charter-expiry` | Every hour | Charter booking expiry |
| `/api/cron/retention` | 3:00 AM daily | PII data retention sweep |
| `/api/cron/reconcile-payments` | Every 15 min | Payment reconciliation |

3. Crons use `CRON_SECRET` as Bearer token — Vercel injects this automatically

> **Note:** Vercel Cron is the Phase 1 mechanism. The Supercronic sidecar referenced in GL-006 applied only to the FPT Cloud Docker backup deployment path, which was dropped on 2026-07-10 (deployment is Vercel-only).

---

## Step 8: Add Custom Domain

1. Go to **Project Settings → Domains**
2. Click **"Add Domain"**
3. Enter your domain (e.g. `busmap.vn`)
4. Vercel shows DNS records to configure:
   - `CNAME` record: `cname.vercel-dns.com`
   - Or `A` record: `76.76.21.21`
5. Configure these in Cloudflare — see `setup-cloudflare-dns.md`
6. Add `www.busmap.vn` as well → Vercel auto-redirects to apex
7. SSL certificate auto-provisions once DNS propagates (~1-5 min)

---

## Step 9: Verify Deployment

```bash
# Health check
curl -s https://yourdomain.com/api/health | jq .

# Expected: { "status": "ok", ... }

# Check cron auth works (should 401 without secret)
curl -s -o /dev/null -w "%{http_code}" https://yourdomain.com/api/cron/sweep-holds
# Expected: 401
```

---

## Step 10: Staging Environment (Vercel Preview)

Every PR branch auto-deploys to a preview URL. To configure staging env vars:

1. Go to **Project Settings → Environment Variables**
2. Add staging values with scope **Preview**
3. Use separate Neon branch + staging secrets (see `.env.staging.example`)
4. Preview deployments accessible at `https://bus-booking-<hash>.vercel.app`

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Build fails with "missing env" | Zod `superRefine` validates production vars at build time | Add ALL required vars from `.env.production.example` |
| Cron 401 | `CRON_SECRET` mismatch | Verify `CRON_SECRET` env var matches what Vercel injects |
| 500 on all pages | `DATABASE_URL` wrong or Neon unreachable | Check connection string, ensure `?sslmode=require` |
| Functions timeout | Region mismatch (DB in SG, function in US) | Set Function Region to `sin1` |
| `ESMS_*` vars missing | `NOTIFY_STUB=false` requires all 3 eSMS vars | Set eSMS vars or keep `NOTIFY_STUB=true` |

---

## Pricing

| Item | Cost | Notes |
|------|------|-------|
| Vercel Pro | $20/mo per member | Required for cron + long functions |
| Bandwidth | 1 TB included | Sufficient for launch |
| Serverless | 1000 GB-hrs included | ~33K invocations/day |
| Edge Middleware | Included | Runs `proxy.ts` |
