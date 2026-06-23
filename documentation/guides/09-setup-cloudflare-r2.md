# Cloudflare R2 — Object Storage Setup Guide

S3-compatible object storage for ticket PDFs, operator documents, and profile images. Code integration: `lib/storage/s3Client.ts`. Env vars: `STORAGE_STUB`, `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`.

> **Phase 1 status:** Deferred. `STORAGE_STUB="true"` — app uses HMAC-signed stub URLs against `/dev/stub-storage`. Flip to R2 when real file storage is needed (Phase 2).

---

## Step 1: Create Cloudflare Account

If you already have Cloudflare for DNS (see `setup-cloudflare-dns.md`), skip to Step 2.

1. Go to **https://dash.cloudflare.com/sign-up**
2. Sign up and verify email

---

## Step 2: Enable R2

1. In Cloudflare dashboard → left sidebar → **"R2 Object Storage"**
2. Click **"Get started"** (if first time)
3. No plan upgrade needed — R2 is pay-as-you-go on any Cloudflare plan
4. Accept R2 terms of service

---

## Step 3: Create Bucket

1. Click **"Create bucket"**
2. Configure:

| Setting | Value |
|---------|-------|
| Bucket name | `busmap-prod` |
| Location hint | **Asia Pacific** (auto-selects nearest Cloudflare edge) |

3. Click **"Create bucket"**

---

## Step 4: Generate API Token

1. Go to **R2** → **"Manage R2 API Tokens"** (or **Account → API Tokens**)
2. Click **"Create API token"**
3. Configure:

| Setting | Value |
|---------|-------|
| Token name | `busmap-prod-rw` |
| Permissions | **Object Read & Write** |
| Bucket scope | Specific bucket: `busmap-prod` |
| TTL | No expiry (or set 1 year and rotate) |

4. Click **"Create API Token"**
5. Copy three values shown:

| Credential | Env Var |
|------------|---------|
| Access Key ID | `STORAGE_ACCESS_KEY` |
| Secret Access Key | `STORAGE_SECRET_KEY` |
| Endpoint | `STORAGE_ENDPOINT` (format: `https://<account-id>.r2.cloudflarestorage.com`) |

These credentials are S3-compatible — the app uses `@aws-sdk/client-s3` to connect.

---

## Step 5: Configure CORS

For browser-based direct uploads (presigned PUT URLs):

1. Go to **R2 → busmap-prod → Settings → CORS Policy**
2. Click **"Add CORS policy"**
3. Add:

```json
[
  {
    "AllowedOrigins": ["https://YOURDOMAIN.COM"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "MaxAgeSeconds": 3600
  }
]
```

4. Save

---

## Step 6: Configure Environment Variables

### In Vercel (Production)

```env
STORAGE_STUB="false"
STORAGE_BUCKET="busmap-prod"
STORAGE_REGION="auto"
STORAGE_ENDPOINT="https://abc123def456.r2.cloudflarestorage.com"
STORAGE_ACCESS_KEY="your-access-key-id"
STORAGE_SECRET_KEY="your-secret-access-key"
```

`STORAGE_REGION="auto"` — R2 doesn't use traditional AWS regions; `auto` is the correct value.

### For Local Development

Keep storage stubbed:
```env
# .env.local
STORAGE_STUB="true"
STORAGE_STUB_SECRET="any-secret-min-16-chars"
```

---

## Step 7: Verify

```bash
# Test with AWS CLI (S3-compatible)
aws s3 ls s3://busmap-prod/ \
  --endpoint-url https://abc123def456.r2.cloudflarestorage.com \
  --region auto

# Upload test file
echo "test" > /tmp/test.txt
aws s3 cp /tmp/test.txt s3://busmap-prod/test.txt \
  --endpoint-url https://abc123def456.r2.cloudflarestorage.com \
  --region auto

# Download and verify
aws s3 cp s3://busmap-prod/test.txt /tmp/test-downloaded.txt \
  --endpoint-url https://abc123def456.r2.cloudflarestorage.com \
  --region auto
cat /tmp/test-downloaded.txt
# Expected: "test"

# Clean up
aws s3 rm s3://busmap-prod/test.txt \
  --endpoint-url https://abc123def456.r2.cloudflarestorage.com \
  --region auto
```

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `AccessDenied` | Token doesn't have bucket access | Regenerate token with correct bucket scope |
| `NoSuchBucket` | Bucket name mismatch | Verify `STORAGE_BUCKET` matches R2 dashboard |
| CORS error on upload | CORS policy missing or wrong origin | Add your domain to CORS AllowedOrigins |
| `STORAGE_STUB_SECRET is required` | `STORAGE_STUB=true` but secret missing | Set `STORAGE_STUB_SECRET` or switch to `STORAGE_STUB=false` with R2 credentials |

---

## Pricing

| Item | Free Tier | Cost Beyond |
|------|-----------|-------------|
| Storage | 10 GB/mo | $0.015/GB/mo |
| Class A ops (PUT, POST) | 1M/mo | $4.50/M |
| Class B ops (GET) | 10M/mo | $0.36/M |
| Egress | **Free** (no bandwidth charges) | Free |

R2's zero-egress pricing is the main advantage over AWS S3. For a bus booking app with ticket PDFs, free tier likely covers months of usage.
