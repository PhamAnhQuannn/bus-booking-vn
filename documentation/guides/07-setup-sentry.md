# Sentry — Error Tracking Setup Guide

Configure Sentry for real-time error monitoring and alerting. Code integration: not yet installed (`@sentry/nextjs` SDK deferred). This guide covers account setup and DSN provisioning. Env vars: `SENTRY_DSN` (planned), `SENTRY_AUTH_TOKEN` (for source maps, planned).

> **Note:** Sentry SDK (`@sentry/nextjs`) is not yet installed in the codebase. This guide covers vendor-side account setup only. SDK integration will be added in a future hardening pass (HD-001/GL-002 scope).

---

## Step 1: Create Sentry Account

1. Go to **https://sentry.io/signup/**
2. Sign up with GitHub (recommended — enables release tracking) or email
3. Verify email

---

## Step 2: Create Organization

1. After login, create organization:

| Field | Value |
|-------|-------|
| Organization Name | `busmap` (or your team name) |
| Plan | **Developer** (free, 5K events/mo) or **Team** ($26/mo, 50K events/mo) |

2. Developer plan sufficient for launch; upgrade when traffic grows

---

## Step 3: Create Project

1. Click **"Create Project"** in Sentry dashboard
2. Configure:

| Setting | Value |
|---------|-------|
| Platform | **Next.js** |
| Project Name | `busmap-prod` |
| Alert Frequency | **Alert me on every new issue** (default) |
| Team | Assign to your team |

3. Sentry shows a setup wizard — **skip it** (SDK not installed yet)
4. Note the **DSN** from project settings

---

## Step 4: Copy DSN

1. Go to **Settings → Projects → busmap-prod → Client Keys (DSN)**
2. Copy the DSN — format:
   ```
   https://abc123def456@o123456.ingest.us.sentry.io/789012
   ```
3. This is the only credential needed for basic error reporting

---

## Step 5: Configure Alert Rules

1. Go to **Alerts → Create Alert Rule**
2. Recommended rules for launch:

### Rule 1: High-Volume Error Spike

| Setting | Value |
|---------|-------|
| Condition | Number of events in 1 hour > 50 |
| Action | Send email to team |
| Name | `Error spike alert` |

### Rule 2: New Issue (First Seen)

| Setting | Value |
|---------|-------|
| Condition | A new issue is created |
| Filter | `level:error` (skip warnings) |
| Action | Send email to team |
| Name | `New error alert` |

### Rule 3: Unhandled Exception

| Setting | Value |
|---------|-------|
| Condition | `handled:no` tag |
| Action | Send email to team (urgent) |
| Name | `Unhandled exception alert` |

---

## Step 6: Configure Environment Variables (Future)

When SDK is integrated, add to Vercel:

```env
# Vercel → Project Settings → Environment Variables → Production
SENTRY_DSN="https://abc123@o123456.ingest.us.sentry.io/789012"

# For source map uploads during build (optional, improves stack traces)
SENTRY_AUTH_TOKEN="sntrys_your-auth-token-here"
SENTRY_ORG="busmap"
SENTRY_PROJECT="busmap-prod"
```

Generate `SENTRY_AUTH_TOKEN`:
1. Go to **Settings → Auth Tokens → Create New Token**
2. Scopes: `project:releases`, `org:read`
3. Copy token

---

## Step 7: PII Scrubbing

Bus-Booking handles phone numbers, customer names, and bank details. Configure Sentry to redact PII:

1. Go to **Settings → Projects → busmap-prod → Security & Privacy**
2. Enable **"Scrub Data"** (default ON)
3. Add custom scrub rules:

| Field | Pattern | Action |
|-------|---------|--------|
| Phone numbers | `\+84\d{9,10}` | Replace with `[phone]` |
| Bank account | `\d{10,16}` in `accountNumber` fields | Replace with `[bank_account]` |
| OTP codes | `\d{6}` in `otp`/`code` fields | Replace with `[otp]` |

4. Under **"IP Address"** → select **"Remove IP addresses"**
5. Save

---

## Step 8: Verify Setup

DSN validation (no SDK needed):

```bash
# Send a test event via curl
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"Test event from setup guide","level":"info"}' \
  "https://o123456.ingest.us.sentry.io/api/789012/store/?sentry_key=abc123&sentry_version=7"

# Check Sentry dashboard → Issues tab → should show "Test event from setup guide"
```

---

## SDK Integration (Future)

When ready to add the SDK:

```bash
pnpm add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

The wizard creates:
- `sentry.client.config.ts` — browser error capture
- `sentry.server.config.ts` — server error capture
- `sentry.edge.config.ts` — Edge middleware capture
- `instrumentation.ts` — server-side initialization hook

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| No events in dashboard | DSN not set or SDK not installed | Verify DSN env var; install SDK when ready |
| Events missing stack traces | Source maps not uploaded | Set `SENTRY_AUTH_TOKEN` for build-time upload |
| Too many events (quota exceeded) | Noisy errors or bot traffic | Add rate-limit sampling in `sentry.client.config.ts` |
| PII leaked in event | Scrub rules not configured | Set up custom scrub rules in Step 7 |

---

## Pricing

| Plan | Cost | Events/mo | Notes |
|------|------|-----------|-------|
| Developer | $0/mo | 5,000 | 1 user, 30-day retention |
| Team | $26/mo | 50,000 | Unlimited users, 90-day retention |
| Business | $80/mo | 100,000 | Cross-project queries, 90-day retention |

Developer plan sufficient for soft launch. Upgrade to Team when daily active users exceed ~500.
