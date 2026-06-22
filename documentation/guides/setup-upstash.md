# Upstash Redis — Setup Guide

Provision serverless Redis for rate limiting, OTP cooldowns, and session state. Accessed via REST API (Edge-compatible — no TCP sockets). Code integration: `lib/ratelimit/index.ts`. Env vars: `REDIS_PROVIDER`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

---

## Step 1: Create Upstash Account

1. Go to **https://console.upstash.com/login**
2. Sign up with GitHub, Google, or email
3. Verify email if using email signup

---

## Step 2: Create Redis Database

1. From Upstash console, click **"Create Database"**
2. Configure:

| Setting | Value |
|---------|-------|
| Name | `busmap-prod` |
| Type | **Regional** |
| Region | **Asia Pacific (Singapore)** |
| TLS | Enabled (default) |
| Eviction | Disabled (default — we want data to persist until TTL) |

3. Click **"Create"**

Why Regional (not Global): single-region app (Vercel `sin1` + Neon `ap-southeast-1`). Global adds latency for cross-region replication we don't need.

---

## Step 3: Copy Credentials

1. After database creation, you're on the **Details** tab
2. Find the **REST API** section
3. Copy two values:

| Credential | Example | Env Var |
|------------|---------|---------|
| REST URL | `https://apn1-xxxx.upstash.io` | `UPSTASH_REDIS_REST_URL` |
| REST Token | `AXxxYYYzzzLONGTOKEN...` | `UPSTASH_REDIS_REST_TOKEN` |

4. Keep the token safe — never commit to version control

---

## Step 4: Configure Environment Variables

### In Vercel (Production)

1. Go to Vercel → **Project Settings → Environment Variables**
2. Add:

```env
REDIS_PROVIDER="upstash"
UPSTASH_REDIS_REST_URL="https://apn1-xxxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="AXxxYYYzzzLONGTOKEN..."
```

3. Scope: **Production**

### For Local Development

Local dev uses in-memory Redis by default (no Upstash needed):

```env
# .env.local — leave REDIS_PROVIDER unset or:
REDIS_PROVIDER="memory"
```

To test with real Upstash locally:
```env
REDIS_PROVIDER="upstash"
UPSTASH_REDIS_REST_URL="https://apn1-xxxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="AXxxYYYzzzLONGTOKEN..."
```

### Redis Provider Options

The app supports 3 backends via `REDIS_PROVIDER` in `lib/ratelimit/index.ts`:

| Provider | When to Use | Connection |
|----------|------------|------------|
| `memory` (default) | Local dev, staging | In-process Map — resets on restart |
| `upstash` | **Production (Vercel)** | REST API — Edge-compatible |
| `ioredis` | Self-hosted (Docker backup) | TCP to `REDIS_URL` |

---

## Step 5: Verify

After deploying with Upstash credentials:

```bash
# 1. Check health endpoint
curl -s https://yourdomain.com/api/health | jq .
# Should show redis: "connected" or similar

# 2. Test rate limiting — send OTP 61+ times rapidly
for i in $(seq 1 62); do
  curl -s -o /dev/null -w "%{http_code} " \
    -X POST https://yourdomain.com/api/auth/otp/send \
    -H "Content-Type: application/json" \
    -d '{"phone":"+84901234567"}'
done
# Should see 429 after ~60 requests (rate limit kicks in)
```

In Upstash console → **Data Browser**:
- You should see keys like `ratelimit:*` appearing after rate-limited requests
- Keys auto-expire based on TTL (configured in `lib/ratelimit/index.ts`)

---

## Step 6: Staging Database (Optional)

For staging/preview environments:

1. Create a second database: name `busmap-staging`, same region
2. Copy its REST URL + token
3. Add to Vercel env vars with **Preview** scope

Or use `REDIS_PROVIDER="memory"` for staging (simpler, sufficient for testing).

---

## What Upstash Stores

| Feature | Key Pattern | TTL |
|---------|------------|-----|
| API rate limiting | `ratelimit:<ip>` | Sliding window (1 min) |
| OTP cooldown | `otp:cooldown:<phone>` | 60 seconds |
| OTP lockout | `otp:lockout:<phone>` | 15 minutes |
| CSRF nonce | `csrf:<nonce>` | 5 minutes |
| Refresh token jti | `jti:<token-id>` | 7 days |

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `UPSTASH_REDIS_REST_URL is required` | `REDIS_PROVIDER=upstash` set but URL missing | Add `UPSTASH_REDIS_REST_URL` env var |
| `Unauthorized` from Upstash | Wrong token | Re-copy token from Upstash dashboard |
| Rate limiting not working | `REDIS_PROVIDER` unset (defaults to `memory`) | Set `REDIS_PROVIDER="upstash"` |
| High latency on Redis calls | Database in wrong region | Ensure Singapore region matches Vercel `sin1` |

---

## Pricing

| Tier | Cost | Includes |
|------|------|----------|
| Free | $0/mo | 10K commands/day, 256 MB |
| Pay-as-you-go | $0.2/100K commands | No daily limit, 1 GB |
| Pro | $10/mo | 1M commands/day, 10 GB |

For launch traffic (~100-1000 bookings/day), pay-as-you-go is cheapest. Rate limiting alone generates ~1-5 Redis commands per request.
