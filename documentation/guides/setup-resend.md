# Resend — Transactional Email Setup Guide

Configure Resend for booking confirmations, ticket delivery, and operator notifications via email. Code integration: `lib/notification/emailClient.ts` (planned). Env vars: `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`.

> **Phase 1 status:** Deferred. `EMAIL_PROVIDER="stub"` — email notifications logged only. Activate when email delivery is needed (Phase 2).

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

## Email Templates (Planned)

| Template | Trigger | Content |
|----------|---------|---------|
| Booking confirmation | After payment confirmed | Route, date, seat, QR ticket |
| Ticket delivery | After PDF generated | Attached ticket PDF |
| Departure reminder | 2h before departure | Trip details, boarding info |
| Payout notification | After T+3 settlement | Operator payout amount |
| Password reset | Operator requests reset | Temp password link |

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
