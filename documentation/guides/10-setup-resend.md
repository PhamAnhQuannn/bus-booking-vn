# Resend — Transactional Email Setup Guide

Configure Resend for booking confirmations, ticket delivery, OTP codes, and operator notifications via email. Code integration: `lib/notification/email.ts`. Env vars: `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`.

---

## GO-LIVE for lenxevn.com — email as the customer channel (2026-07-24)

The email code is fully wired and now **independent of SMS**: setting `EMAIL_PROVIDER="resend"` sends real email regardless of `NOTIFY_STUB`. Keep `NOTIFY_STUB="true"` so SMS stays off (no eSMS credentials needed). Booking outcomes go to the customer's **email** (`buyerEmail`, required at booking); an internal alert on every unmatched bank transfer goes to `hotro@lenxevn.com`.

**What YOU do (I can't — needs your Resend account + DNS):**

1. **Create a Resend account** → https://resend.com/signup → get an API key later.
2. **Add & verify the domain** `lenxevn.com` in Resend → Domains → Add Domain. Resend shows DKIM/SPF/return-path records. Add them in **Cloudflare DNS** for lenxevn.com (all **DNS only** / grey cloud), then click **Verify** (5–60 min to propagate). Details in Step 2 below.
3. **Create a Sending API key** (Sending access only) scoped to `lenxevn.com`.
4. **Set production env** (Vercel):
   ```env
   EMAIL_PROVIDER="resend"
   RESEND_API_KEY="re_xxxxxxxxxxxx"
   EMAIL_FROM="noreply@lenxevn.com"
   NOTIFY_STUB="true"        # keep SMS off; email is independent
   ```
   Boot guard: if `EMAIL_PROVIDER=resend` and `RESEND_API_KEY` is missing, the app refuses to start (env validation).
5. **Verify a mailbox exists** for `hotro@lenxevn.com` (the support + ops-alert inbox the customer copy points to). The hotline in the copy is a placeholder `1900 xxxx` — replace it in `lib/notification/esms.ts` (`SUPPORT_HOTLINE`) once you have a real line.

**Blast radius:** turning on `EMAIL_PROVIDER=resend` activates **all** email templates (operator approvals, charter, ticket-ready), not just booking confirmations. That is intended, but expect those to start sending too.

**CDTIA:** Resend is US-based — sending customer names/emails is a cross-border transfer; ensure it is covered (see `cdtia-data-residency-guide.md`).

**Local test before DNS is ready:** keep `EMAIL_PROVIDER` unset (stub) and use `scripts/dev/simulate-sepay-webhook.ts` — it produces the `NotificationLog` rows (channel `email`, recipient = buyerEmail / hotro@lenxevn.com) without sending. Once DNS verifies, set `EMAIL_PROVIDER=resend` + a real key locally and repeat to see a real email land.

---


> **Phase 1 status:** Deferred — customer auth is 410-gated, so no customer OTP emails are sent. `EMAIL_PROVIDER="stub"` logs email only. Guest booking does not require email delivery.
>
> **Phase 2 (customer auth):** **Immediately required** when the 410 gate is lifted. Customer OTP login/register uses email (commit `686ec85`). Set `EMAIL_PROVIDER="resend"` and provision API key before enabling customer authentication.

> **CDTIA note:** Resend is a US-based service. Sending transactional email through Resend constitutes cross-border data transfer (email addresses, customer names). CDTIA filing covers this — see `cdtia-data-residency-guide.md`.

---

## Step 1: Create Resend Account

1. Go to **https://resend.com/signup**
2. Sign up with GitHub or email
3. Verify email address

---

## Step 2: Add and Verify Domain

1. From Resend dashboard → **"Domains"** → **"Add Domain"**
2. Enter your domain: `busmap.vn` (or your domain)
3. Resend shows DNS records to add:

| Type | Name | Value | Purpose |
|------|------|-------|---------|
| `TXT` | `resend._domainkey` | `p=MIGfMA0GCSq...` | DKIM signing |
| `TXT` | `@` | `v=spf1 include:resend.com ~all` | SPF authorization |
| `CNAME` | `rp._domainkey` | `rp._domainkey.resend.com` | Return-path DKIM |

4. Add these records in **Cloudflare DNS** (see `setup-cloudflare-dns.md`):
   - Go to Cloudflare → your domain → DNS → Add records
   - All records should be **DNS only** (grey cloud)
5. Return to Resend → click **"Verify"**
6. Verification takes 5-60 minutes (DNS propagation)

---

## Step 3: Generate API Key

1. Go to **"API Keys"** → **"Create API Key"**
2. Configure:

| Setting | Value |
|---------|-------|
| Name | `busmap-prod` |
| Permissions | **Sending access** (not full access) |
| Domain | `busmap.vn` |

3. Copy the API key — shown once only
4. Format: `re_xxxxxxxxxxxx`

---

## Step 4: Configure Environment Variables

### In Vercel (Production) — When Ready to Activate

```env
EMAIL_PROVIDER="resend"
RESEND_API_KEY="re_xxxxxxxxxxxx"
EMAIL_FROM="noreply@busmap.vn"
```

### For Local Development

Keep email stubbed:
```env
# .env.local — no Resend vars needed
# EMAIL_PROVIDER defaults to "stub" when not set
```

---

## Step 5: Test Email Delivery

### From Resend Dashboard

1. Go to **"Emails"** → **"Send Test Email"**
2. Send to your personal email
3. Verify delivery + check spam folder

### From Application (After SDK Integration)

```bash
# Trigger a booking confirmation (with a test booking)
# Email should arrive at the customer's email address
```

---

## Step 6: Configure Sender Identity

For Vietnamese customers, sender details matter for trust:

| Setting | Value |
|---------|-------|
| From name | `BusMap` (or your brand) |
| From email | `noreply@busmap.vn` |
| Reply-to | `support@busmap.vn` (optional) |

---

## Email Templates

| Template | Trigger | Content |
|----------|---------|---------|
| OTP code | Customer login/register, password reset | 6-digit OTP code + expiry |
| Booking confirmation | After payment confirmed | Route, date, seat, QR ticket |
| Ticket delivery | After PDF generated | Attached ticket PDF |
| Departure reminder | 2h before departure | Trip details, boarding info |
| Payout notification | After T+3 settlement | Operator payout amount |
| Password reset | Operator requests reset | Temp password link |

Full template list in `lib/notification/email.ts` (`SUBJECTS` map includes: `otpCode`, `customerBookingPaid`, `operatorNewBooking`, `bookingReminder24h`, `ticketReady`, charter lifecycle templates, and more).

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `RESEND_API_KEY is required` | `EMAIL_PROVIDER="resend"` but key missing | Set API key or keep `EMAIL_PROVIDER="stub"` |
| Emails going to spam | Domain not verified or no DKIM | Complete domain verification (Step 2) |
| `Domain not verified` error | DNS records not propagated | Wait 60 min; check Cloudflare DNS records match Resend requirements |
| Bounce rate high | Sending to invalid addresses | Implement email validation at registration |

---

## Pricing

| Plan | Cost | Emails/mo | Notes |
|------|------|-----------|-------|
| Free | $0/mo | 3,000 | 1 domain, 100/day limit |
| Pro | $20/mo | 50,000 | Unlimited domains, dedicated IP |
| Enterprise | Custom | Custom | Custom sending limits |

Free plan covers early launch. Pro when daily bookings exceed ~30 (booking confirmation + ticket + reminder = ~3 emails per booking).
