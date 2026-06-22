> **Note (2026-06-21)**: This guide covers the **FPT Cloud Docker self-hosted backup** deployment option. The primary production deployment target is **Vercel Pro + Neon + Upstash** — see ADR-020 D11 and SI-006 §1.1 for the primary stack architecture.

# Deployment Guide: FPT Cloud VPS + Cloudflare + Two Environments

> Full walkthrough from account creation to live site. Two environments (production + staging) on a single VPS behind Cloudflare DNS.

**Time estimate:** ~2-3 hours total  
**Cost estimate:** ~$130-250/month (single VPS, two stacks)  
**Prerequisites:** Vietnamese ID or business license (for FPT Cloud KYC), credit/debit card

**Related specs:** [ADR-020](../architecture-decisions/ADR-020-deployment/README.md), [SI-006](../scaffolding-infra/SI-006-deployment-config/README.md), [GL-006](../go-live/GL-006-phase1-launch-scope/README.md)

**Codebase files created for this guide:**
| File | Purpose |
|------|---------|
| `docker-compose.prod.yml` | Production Docker stack (app + pg + pgbouncer + redis + cron) |
| `docker-compose.staging.yml` | Staging Docker stack (port 3001, DB `bbvn_staging`) |
| `deploy/nginx/busmap.conf` | Nginx config template (prod + staging server blocks) |
| `deploy/crontab/crontab` | Supercronic cron jobs (11 scheduled endpoints) |
| `.env.production.example` | Production env template (real keys, stubs OFF) |
| `.env.staging.example` | Staging env template (test keys, stubs ON) |

---

## Architecture Overview

```
User → Cloudflare CDN/WAF → FPT Cloud VPS (Nginx :443)
                                 ├─ yourdomain.com     → Docker prod  stack (:3000)
                                 └─ dev.yourdomain.com → Docker staging stack (:3001)

Each Docker stack:
  app (Next.js) → pgbouncer (:6432) → postgres (:5432)
                → redis (:6379)
  cron (supercronic) → app /api/cron/*
```

---

## Phase A: Accounts & Domain (~30 min)

### A1. Create Cloudflare Account
1. Go to **https://dash.cloudflare.com/sign-up**
2. Email + password, verify email
3. Free plan is sufficient

### A2. Buy `.com` Domain on Cloudflare
1. Cloudflare dashboard → **Domain Registration** → **Register Domains**
2. Search your domain name (e.g. `busbooking.com`)
3. Add to cart → checkout (~$10/year, at-cost pricing, no markup)
4. DNS management is automatic — Cloudflare nameservers already set
5. **Save your domain name** — needed for every step below

### A3. Create FPT Cloud Account
1. Go to **https://portal.fptcloud.com** (FPT Cloud Console)
   - Alternative: **https://fptcloud.com** → click "Dung thu mien phi" or "Console"
2. Register with business email or phone
3. Complete KYC/identity verification (Vietnamese ID or business license)
4. Add payment method (Vietnamese bank card or bank transfer)
5. **Note:** FPT Cloud compute pricing requires sales quotation — contact sales via Console or hotline **1900 638 399**

---

## Phase B: Provision FPT Cloud VPS (~1-2 hours)

### B1. Create VPC (Virtual Private Cloud)
1. FPT Console → **VPC** → **Create VPC**
2. Region: **HCM** (Ho Chi Minh City) or **HN** (Hanoi) — pick closest to users
3. CIDR: `10.0.0.0/16` (default)
4. Name: `busmap-vpc`

### B2. Create Security Group
1. Console → **Security Groups** → **Create**
2. Name: `busmap-sg`
3. Inbound rules:

| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 22 | TCP | Your IP only | SSH access |
| 80 | TCP | Cloudflare IPs* | HTTP → HTTPS redirect |
| 443 | TCP | Cloudflare IPs* | HTTPS traffic |

4. Outbound: Allow all (default)

> *Cloudflare IP ranges: https://www.cloudflare.com/ips-v4 and https://www.cloudflare.com/ips-v6  
> Add ALL listed CIDR blocks as separate inbound rules for ports 80 and 443.

### B3. Create SSH Key
1. Console → **SSH Keys** → **Create** or **Import**
2. If you don't have one locally:
```bash
ssh-keygen -t ed25519 -C "busmap-fpt"
```
3. Upload public key (`.pub` file) to FPT Console

### B4. Provision VPS Instance
1. Console → **Cloud Server** → **Create Server**
2. Configuration:

| Setting | Value |
|---------|-------|
| Image | Ubuntu 22.04 LTS |
| Flavor | 4 vCPU / 8 GB RAM / 80 GB SSD |
| VPC | `busmap-vpc` |
| Security Group | `busmap-sg` |
| SSH Key | (the one you uploaded) |
| Name | `busmap-prod-01` |

3. Click **Create** → wait for status = **Active**
4. **Copy the Private IP** (e.g. `10.0.1.5`)

### B5. Attach Floating IP (Public IP)
1. Console → **Floating IPs** → **Create Floating IP**
2. Associate with `busmap-prod-01`
3. **Copy the Public IP** (e.g. `103.xx.xx.xx`) — this is what DNS points to

### B6. SSH Into VPS
```bash
ssh -i ~/.ssh/busmap-fpt ubuntu@103.xx.xx.xx
```
If it connects, VPS is live. Continue to Phase C.

---

## Phase C: VPS Software Setup (~30 min)

> All commands in this phase run **on the VPS** via SSH.

### C1. Update System + Install Docker
```bash
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y

# Verify
docker --version
docker compose version

# Log out and back in for group change to take effect
exit
```
SSH back in after logout.

### C2. Install Nginx
```bash
sudo apt install nginx -y
sudo systemctl enable nginx
```

### C3. Create App Directory Structure
```bash
sudo mkdir -p /opt/busmap/prod
sudo mkdir -p /opt/busmap/staging
sudo mkdir -p /opt/busmap/nginx
sudo mkdir -p /opt/busmap/ssl
sudo chown -R $USER:$USER /opt/busmap
```

---

## Phase D: Cloudflare DNS + SSL (~15 min)

### D1. Point DNS to VPS
1. Cloudflare dashboard → your domain → **DNS** → **Records**
2. Add these records (replace `103.xx.xx.xx` with your actual VPS public IP):

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `@` (root) | `103.xx.xx.xx` | Proxied (orange cloud) |
| A | `dev` | `103.xx.xx.xx` | Proxied (orange cloud) |
| CNAME | `www` | `yourdomain.com` | Proxied |

### D2. SSL — Cloudflare Origin Certificate
1. Cloudflare → **SSL/TLS** → **Overview** → set mode to **Full (Strict)**
2. Cloudflare → **SSL/TLS** → **Origin Server** → **Create Certificate**
   - Hostnames: `yourdomain.com`, `*.yourdomain.com`
   - Validity: **15 years**
   - Key type: RSA (2048)
   - Click **Create**
3. **IMPORTANT: Copy both the certificate and private key immediately.** Cloudflare will NOT show the private key again.
4. On VPS, save the certs:
```bash
# Paste the certificate content
nano /opt/busmap/ssl/origin.pem

# Paste the private key content
nano /opt/busmap/ssl/origin-key.pem

# Lock down the private key
chmod 600 /opt/busmap/ssl/origin-key.pem
```

### D3. Cloudflare Extra Settings
1. **SSL/TLS → Edge Certificates** → Enable "Always Use HTTPS"
2. **SSL/TLS → Edge Certificates** → Minimum TLS Version = **1.2**
3. **Security → Settings** → Security Level = **Medium**
4. **Speed → Optimization** → Enable Auto Minify (JS, CSS, HTML)

---

## Phase E: Nginx Config (~15 min)

> Run on VPS via SSH.

### E1. Copy Nginx Config
The template is in the repo at `deploy/nginx/busmap.conf`. Copy it to the VPS:

```bash
# From your local machine (replace placeholders first):
scp -i ~/.ssh/busmap-fpt deploy/nginx/busmap.conf ubuntu@103.xx.xx.xx:/opt/busmap/nginx/
```

Or create directly on VPS:
```bash
nano /opt/busmap/nginx/busmap.conf
```

**Before using the config, replace ALL occurrences of:**
- `YOURDOMAIN.COM` → your actual domain (e.g. `busbooking.com`)

The config contains three server blocks:
1. **Production** (port 443) — `yourdomain.com` + `www` → proxy to `:3000`
2. **Staging** (port 443) — `dev.yourdomain.com` → proxy to `:3001`
3. **HTTP redirect** (port 80) — all domains → 301 to HTTPS

Key security features already configured:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `/api/cron/*` restricted to `127.0.0.1` + Docker network only
- `/_next/static/` served with 1-year immutable cache

### E2. Activate Config
```bash
sudo ln -sf /opt/busmap/nginx/busmap.conf /etc/nginx/sites-enabled/busmap.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
# Must output: "syntax is ok" and "test is successful"
sudo systemctl reload nginx
```

---

## Phase F: Deploy Docker Stacks (~20 min)

### F1. Generate Secrets
On your local machine, generate all required secrets:
```bash
# Run this for each secret you need
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Required secrets (each must be unique):
- `POSTGRES_PASSWORD` (production)
- `POSTGRES_PASSWORD` (staging — different value)
- `REDIS_PASSWORD` (production)
- `REDIS_PASSWORD` (staging — different value)
- `JWT_SECRET`
- `JWT_OPERATOR_SECRET`
- `JWT_ADMIN_SECRET`
- `REFRESH_TOKEN_SECRET`
- `HOLD_SECRET`
- `CRON_SECRET`
- `TOTP_ENCRYPTION_KEY` (64 hex chars)
- `BANK_ENCRYPTION_KEY` (64 hex chars)
- `STORAGE_STUB_SECRET`

### F2. Prepare Env Files
1. Copy `.env.production.example` → `.env.production` — fill in ALL `CHANGE-ME` values
2. Copy `.env.staging.example` → `.env.staging` — fill in all `replace-with-*` values
3. Set `NEXT_PUBLIC_SITE_URL` to your actual domains

### F3. Copy Files to VPS
```bash
# Production
scp -i ~/.ssh/busmap-fpt docker-compose.prod.yml ubuntu@103.xx.xx.xx:/opt/busmap/prod/docker-compose.yml
scp -i ~/.ssh/busmap-fpt .env.production ubuntu@103.xx.xx.xx:/opt/busmap/prod/.env
scp -ri ~/.ssh/busmap-fpt deploy/ ubuntu@103.xx.xx.xx:/opt/busmap/prod/deploy/

# Staging
scp -i ~/.ssh/busmap-fpt docker-compose.staging.yml ubuntu@103.xx.xx.xx:/opt/busmap/staging/docker-compose.yml
scp -i ~/.ssh/busmap-fpt .env.staging ubuntu@103.xx.xx.xx:/opt/busmap/staging/.env
scp -ri ~/.ssh/busmap-fpt deploy/ ubuntu@103.xx.xx.xx:/opt/busmap/staging/deploy/
```

### F4. Build + Push Docker Image

**Option A: Build locally and push to GHCR**
```bash
# Build
docker build -t ghcr.io/YOUR_ORG/busmap:latest .

# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Push
docker push ghcr.io/YOUR_ORG/busmap:latest
```

**Option B: Build directly on VPS**
```bash
# On VPS — clone repo and build
cd /opt/busmap/prod
git clone https://github.com/YOUR_ORG/busmap.git src
cd src
docker build -t busmap:latest .
```

### F5. Start Production Stack
```bash
# On VPS
cd /opt/busmap/prod

# Login to GHCR if using Option A
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Pull image (Option A only)
docker compose pull

# Run database migrations first
docker compose run --rm app pnpm prisma migrate deploy

# Seed database (first time only)
docker compose run --rm app pnpm prisma db seed

# Start all services
docker compose up -d

# Check status
docker compose ps
```

### F6. Start Staging Stack
```bash
cd /opt/busmap/staging
docker compose pull
docker compose run --rm app pnpm prisma migrate deploy
docker compose run --rm app pnpm prisma db seed
docker compose up -d
docker compose ps
```

### F7. Verify
```bash
# On VPS — check all containers are healthy
docker compose -f /opt/busmap/prod/docker-compose.yml ps
docker compose -f /opt/busmap/staging/docker-compose.yml ps

# From your local machine — check HTTPS
curl -I https://yourdomain.com/api/health
# Expect: HTTP/2 200

curl -I https://dev.yourdomain.com/api/health
# Expect: HTTP/2 200

# Verify security headers
curl -I https://yourdomain.com 2>&1 | grep -E "x-frame|x-content-type|referrer"
# Expect:
# x-frame-options: DENY
# x-content-type-options: nosniff
# referrer-policy: strict-origin-when-cross-origin

# Verify cron endpoints blocked externally
curl -I https://yourdomain.com/api/cron/sweep-holds
# Expect: 403 Forbidden
```

---

## Phase G: Post-Deploy Checklist

- [ ] `https://yourdomain.com` loads with valid SSL (green lock)
- [ ] `https://dev.yourdomain.com` loads with valid SSL (green lock)
- [ ] `/api/health` returns 200 on both domains
- [ ] Cloudflare dashboard → Analytics shows proxied traffic
- [ ] Security headers present in response (X-Frame-Options, X-Content-Type-Options)
- [ ] `/api/cron/*` returns 403 from external requests
- [ ] SSH works only from your IP
- [ ] Docker containers all show "healthy" status
- [ ] Cron sidecar running (`docker logs` shows cron output)
- [ ] Admin login works at `/admin/login`
- [ ] Operator login works at `/op/login`

---

## What NOT To Do Yet

| Item | Blocker |
|------|---------|
| Real SePay/MoMo/VNPay keys | Issue 094 go-live gate |
| Real eSMS SMS keys | Issue 094 go-live gate |
| Real S3/FPT Object Storage | Wave-9 adapter |
| Production user data | Staging uses seed/test data only |
| Remove `ADMIN_TOTP_DISABLED` | Must enable TOTP before real admin access |
| Remove `OTP_PEEK_ENABLED` | Must disable OTP peek before production |

---

## Troubleshooting

### Nginx won't start
```bash
sudo nginx -t    # shows exact error + line number
sudo journalctl -u nginx --no-pager -n 50
```

### Docker containers crash-looping
```bash
docker compose logs app --tail 100
docker compose logs postgres --tail 50
```

### SSL certificate errors
- Verify Cloudflare SSL mode is **Full (Strict)**, not just "Full"
- Verify origin cert files exist: `ls -la /opt/busmap/ssl/`
- Verify cert matches domain: `openssl x509 -in /opt/busmap/ssl/origin.pem -text -noout | grep CN`

### Can't connect to VPS
- Check FPT Console → Security Group → your IP in SSH rule
- Check Floating IP is associated with the instance
- Try: `ssh -vvv -i ~/.ssh/busmap-fpt ubuntu@103.xx.xx.xx`

### Database migration fails
```bash
# Check direct PG connection (bypass pgbouncer)
docker compose exec postgres psql -U bbvn -d bbvn_prod -c "SELECT 1"

# Run migrations with verbose output
docker compose run --rm -e DEBUG="prisma:*" app pnpm prisma migrate deploy
```

---

## Updating the Application

### Deploy new version
```bash
# On local: build and push new image
docker build -t ghcr.io/YOUR_ORG/busmap:latest .
docker push ghcr.io/YOUR_ORG/busmap:latest

# On VPS: pull and restart
cd /opt/busmap/prod
docker compose pull
docker compose run --rm app pnpm prisma migrate deploy  # if schema changed
docker compose up -d
```

### Rollback
```bash
# On VPS
cd /opt/busmap/prod
docker compose down
# Re-tag previous image or use specific tag
docker compose up -d
```

---

## Cost Estimate (Phase 1 — single VPS, two stacks)

| Item | Monthly |
|------|---------|
| FPT Cloud VPS (4 vCPU, 8GB RAM) | ~$40-80 |
| FPT Managed PostgreSQL 16 | ~$60-120 |
| FPT Redis 7 | ~$30-50 |
| Cloudflare (free tier) | $0 |
| Domain (.com/year) | ~$0.83 |
| **Total** | **~$130-250/mo** |

> Exact FPT pricing requires sales quotation. Contact via Console or hotline **1900 638 399**.
