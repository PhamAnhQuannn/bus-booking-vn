# BetterStack — Uptime Monitoring Setup Guide

Configure BetterStack for uptime monitoring, incident alerting, and public status page. Code integration: `app/api/health/route.ts` (health endpoint). Env vars: none (external service only).

---

## Step 1: Create BetterStack Account

1. Go to **https://betterstack.com/signup**
2. Sign up with GitHub, Google, or email
3. Verify email

Free plan includes 5 monitors with 3-minute check intervals.

---

## Step 2: Create Uptime Monitor

1. From BetterStack dashboard → **"Uptime"** → **"Monitors"**
2. Click **"Create monitor"**
3. Configure:

| Setting | Value |
|---------|-------|
| Monitor type | **HTTP(s)** |
| URL | `https://YOURDOMAIN.COM/api/health` |
| Check frequency | **Every 60 seconds** (Pro) or **Every 3 min** (Free) |
| Request method | `GET` |
| Expected status code | `200` |
| Request timeout | `10 seconds` |
| Confirmation period | **2 checks** (avoid false positives from transient errors) |
| Monitor name | `BusMap Production` |
| Regions | **Asia Pacific** (closest to sin1 Vercel) |

4. Click **"Save"**

---

## Step 3: Configure Alert Channels

1. Go to **"Integrations"** tab
2. Add at least one alert channel:

### Email (Always Set Up)

1. Click **"Email"** integration
2. Add team email addresses
3. Configure: alert on **downtime start** and **recovery**

### Slack (Recommended)

1. Click **"Slack"** integration
2. Authorize BetterStack in your Slack workspace
3. Select channel (e.g. `#alerts-prod`)
4. Configure: send message on downtime + recovery

### Phone/SMS (For Critical)

1. Click **"Phone Call"** or **"SMS"** integration
2. Add on-call phone number
3. Use for escalation (e.g. if down > 5 minutes)

---

## Step 4: Create Escalation Policy

1. Go to **"On-call"** → **"Escalation Policies"**
2. Click **"Create policy"**
3. Configure:

| Step | Wait | Action |
|------|------|--------|
| 1 | Immediate | Email team |
| 2 | 5 minutes | Slack notification |
| 3 | 15 minutes | Phone call to on-call person |

4. Assign escalation policy to the production monitor

---

## Step 5: Create Status Page (Optional)

Public status page for customers:

1. Go to **"Status Pages"** → **"Create status page"**
2. Configure:

| Setting | Value |
|---------|-------|
| Name | `BusMap Status` |
| Subdomain | `status.busmap.vn` (or `busmap.betteruptime.com`) |
| Monitors | Select `BusMap Production` |
| Theme | Match brand colors (primary: orange) |
| Show historical uptime | Yes |

3. **Custom domain** (optional):
   - Add CNAME record in Cloudflare: `status` → `statuspage.betteruptime.com`
   - Verify domain in BetterStack

---

## Step 6: Add Additional Monitors

Recommended monitoring beyond the main health check:

### API Response Time

| Setting | Value |
|---------|-------|
| URL | `https://YOURDOMAIN.COM/api/health` |
| Type | HTTP(s) |
| Alert if | Response time > 5 seconds |

### Cron Health (Sweep Holds)

| Setting | Value |
|---------|-------|
| Type | **Heartbeat** |
| Expected every | 2 minutes |
| Grace period | 5 minutes |

Add a `fetch('https://uptime.betterstack.com/api/v1/heartbeat/xxx')` call at the end of your cron handler to confirm it ran.

### SSL Certificate Expiry

| Setting | Value |
|---------|-------|
| URL | `https://YOURDOMAIN.COM` |
| Alert if | SSL expires in < 14 days |

Vercel auto-renews SSL, but monitoring catches edge cases.

---

## Step 7: Verify

1. Check monitor status in BetterStack dashboard — should show **"Up"** with green indicator
2. Test alerting:
   - Temporarily change monitor URL to a non-existent path (e.g. `/api/health-test-down`)
   - Wait for 2 check cycles (~2-6 minutes)
   - Verify alert arrives on configured channels
   - Revert URL to `/api/health`
   - Verify recovery notification arrives

---

## What `/api/health` Returns

The health endpoint checks:

```json
{
  "status": "ok",
  "timestamp": "2026-06-21T14:30:00.000Z",
  "checks": {
    "database": "connected",
    "redis": "connected"
  }
}
```

BetterStack monitors the HTTP 200 status code. If the DB or Redis is down, the endpoint returns 503, triggering the alert.

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Monitor shows "Down" immediately | URL wrong or site not deployed | Verify URL returns 200 in browser |
| False positives (flapping) | Network jitter or cold starts | Increase confirmation period to 3 checks |
| No alerts received | Alert channel not configured | Check Integrations tab; verify email/Slack connected |
| Status page shows wrong data | Wrong monitor linked | Edit status page → verify correct monitor selected |

---

## Pricing

| Plan | Cost | Monitors | Check Interval | Notes |
|------|------|----------|----------------|-------|
| Free | $0/mo | 5 | 3 minutes | Email alerts only |
| Starter | $24/mo | 20 | 30 seconds | Phone/SMS/Slack alerts |
| Business | $64/mo | 100 | 30 seconds | Custom domains, SLA reports |

Free plan sufficient for launch (1 production monitor + 1 staging). Upgrade when you need faster checks or phone escalation.
