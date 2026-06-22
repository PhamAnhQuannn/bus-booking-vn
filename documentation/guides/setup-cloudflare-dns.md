# Cloudflare DNS — Setup Guide

Point your domain to Vercel via Cloudflare DNS. Free plan sufficient for DNS + basic DDoS protection. Code integration: none (infrastructure only). Env vars: `NEXT_PUBLIC_SITE_URL`.

---

## Step 1: Create Cloudflare Account

1. Go to **https://dash.cloudflare.com/sign-up**
2. Enter email + password
3. Verify email

Free plan includes DNS, basic DDoS protection, and SSL certificate management.

---

## Step 2: Register or Transfer Domain

### Option A: Register New Domain via Cloudflare

1. In Cloudflare dashboard → **"Domain Registration"** → **"Register Domains"**
2. Search for your domain (e.g. `busmap.vn`)
3. `.vn` domains may not be available through Cloudflare — use a Vietnamese registrar:
   - **PA Vietnam** (pavietnam.vn) — most popular for `.vn` domains
   - **VNNIC** (vnnic.vn) — official `.vn` registry
   - **Inet.vn** — alternative registrar
4. `.vn` registration requires Vietnamese business license

### Option B: Use Existing Domain

If you already have a domain registered elsewhere, add it to Cloudflare in Step 3.

---

## Step 3: Add Site to Cloudflare

1. In Cloudflare dashboard → click **"Add a site"**
2. Enter your domain name (e.g. `busmap.vn`)
3. Select **Free** plan → click **"Continue"**
4. Cloudflare scans existing DNS records — review and continue
5. Cloudflare assigns two nameservers, e.g.:
   ```
   aria.ns.cloudflare.com
   brad.ns.cloudflare.com
   ```
6. **Go to your domain registrar** and change nameservers to Cloudflare's
7. Wait for propagation (usually 5-30 minutes, up to 24 hours)
8. Cloudflare dashboard shows **"Active"** when nameservers are detected

---

## Step 4: Configure DNS Records for Vercel

1. In Cloudflare → your domain → **"DNS"** tab → **"Records"**
2. Add the following records:

### Apex Domain (@)

| Type | Name | Content | Proxy | TTL |
|------|------|---------|-------|-----|
| `A` | `@` | `76.76.21.21` | **DNS only** (grey cloud) | Auto |

### WWW Subdomain

| Type | Name | Content | Proxy | TTL |
|------|------|---------|-------|-----|
| `CNAME` | `www` | `cname.vercel-dns.com` | **DNS only** (grey cloud) | Auto |

### Important: Proxy Status

**Set proxy to "DNS only" (grey cloud icon, NOT orange)**

Why: Vercel manages its own SSL certificates and CDN edge. Cloudflare proxy (orange cloud) would conflict — causes SSL handshake errors and breaks Vercel's edge routing.

If you see orange cloud icon, click it to toggle to grey (DNS only).

---

## Step 5: SSL/TLS Configuration

1. In Cloudflare → your domain → **"SSL/TLS"** tab
2. Set encryption mode to **"Full (strict)"**
3. This setting is for non-Vercel subdomains (e.g. if you add an API subdomain later)
4. Vercel handles SSL for the main domain automatically

---

## Step 6: Verify DNS Propagation

```bash
# Check A record
dig busmap.vn +short
# Expected: 76.76.21.21

# Check CNAME
dig www.busmap.vn +short
# Expected: cname.vercel-dns.com → some Vercel IP

# Check HTTPS works
curl -sI https://busmap.vn | head -5
# Expected: HTTP/2 200 (or 301 redirect to www/non-www)

# Check SSL certificate
echo | openssl s_client -connect busmap.vn:443 -servername busmap.vn 2>/dev/null | openssl x509 -noout -issuer -dates
# Expected: issuer=Let's Encrypt (Vercel auto-provisions)
```

If DNS hasn't propagated yet, wait 5-30 minutes and retry.

---

## Step 7: Configure Vercel Custom Domain

1. In Vercel → **Project Settings → Domains**
2. Add `busmap.vn` (apex domain)
3. Add `www.busmap.vn`
4. Vercel verifies DNS records — should show green checkmarks
5. SSL auto-provisions within minutes
6. Choose redirect behavior:
   - **Recommended:** `www.busmap.vn` → redirects to `busmap.vn` (apex preferred)

---

## Step 8: Update Environment Variable

In Vercel → **Project Settings → Environment Variables**:

```env
NEXT_PUBLIC_SITE_URL="https://busmap.vn"
```

This drives `metadataBase`, `robots.txt`, `sitemap.xml`, and JSON-LD structured data. No trailing slash.

---

## Optional: Staging Subdomain

For staging/preview environment:

1. Add DNS record:

| Type | Name | Content | Proxy | TTL |
|------|------|---------|-------|-----|
| `CNAME` | `dev` | `cname.vercel-dns.com` | DNS only | Auto |

2. In Vercel → add domain `dev.busmap.vn` with **Preview** scope
3. All PR preview deployments accessible at `dev.busmap.vn`

---

## Optional: Cloudflare WAF (Pro Plan)

For advanced DDoS protection and firewall rules:

1. Upgrade to **Cloudflare Pro** ($20/mo) — only if you enable orange-cloud proxy
2. **Warning:** enabling proxy requires additional Vercel configuration
3. For most launch scenarios, Vercel's built-in DDoS protection is sufficient
4. Revisit WAF after launch traffic patterns are established

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `ERR_SSL_PROTOCOL_ERROR` | Cloudflare proxy (orange cloud) conflicting with Vercel SSL | Set DNS records to "DNS only" (grey cloud) |
| `DNS_PROBE_FINISHED_NXDOMAIN` | Nameservers not updated at registrar | Update registrar nameservers to Cloudflare's; wait 24h |
| Vercel says "Invalid Configuration" | A/CNAME record wrong | Verify `A @` → `76.76.21.21` and `CNAME www` → `cname.vercel-dns.com` |
| SSL certificate pending | DNS just changed | Wait 5-10 min; Vercel auto-provisions Let's Encrypt cert |
| Mixed content warnings | Some assets loaded over HTTP | Ensure `NEXT_PUBLIC_SITE_URL` uses `https://` |
| `.vn` domain registration fails | Missing Vietnamese business docs | `.vn` requires business license; use PA Vietnam or VNNIC registrar |

---

## Pricing

| Service | Cost | Notes |
|---------|------|-------|
| Cloudflare Free | $0/mo | DNS, basic DDoS, 3 page rules |
| Cloudflare Pro | $20/mo | WAF, advanced DDoS, 20 page rules |
| `.vn` domain | ~300,000 VND/year (~$12) | Via Vietnamese registrar |
| `.com` domain | ~$10/year | Via Cloudflare Registrar (at-cost) |
