> ← [Previous](../04-networking/) | [Index](../README.md) | [Next →](../06-data-model/)

## 5. Capacity Estimation

Capacity estimation answers: "How much compute, storage, and bandwidth do we need?" This prevents over-provisioning (wasting money) and under-provisioning (site goes down).

### 5.1 Current Traffic Profile

| Metric | Value | Derived From |
|--------|-------|--------------|
| Bookings/day | ~200 | Current business volume |
| Operators | ~100 | Registered bus companies |
| Trips listed/day | ~500 | ~5 trips per operator |
| Search queries/day | ~5,000 | ~25x booking rate (browse-to-book ratio) |
| Peak QPS (queries/second) | ~2 | 5,000 queries concentrated in 8 peak hours ÷ 3,600 |
| Concurrent users (peak) | ~50 | Estimated from QPS × avg session duration |

**Verdict**: This is tiny. A single serverless function handles it without breaking a sweat.

### 5.2 Database Size Projection (1 year)

| Table | Rows/year | Avg row size | Total |
|-------|-----------|-------------|-------|
| Booking | 73,000 (200/day × 365) | ~500 bytes | ~35 MB |
| Trip | 182,500 (500/day × 365) | ~300 bytes | ~52 MB |
| LedgerEntry | 219,000 (3 per booking) | ~200 bytes | ~42 MB |
| Payment | 73,000 | ~400 bytes | ~28 MB |
| Hold | 146,000 (2 per booking avg) | ~200 bytes | ~28 MB |
| NotificationLog | 146,000 (2 per booking: SMS + email) | ~500 bytes | ~70 MB |
| Customer | 50,000 (unique travelers) | ~300 bytes | ~15 MB |
| **Total** | | | **~270 MB** |

**Verdict**: Fits in a single small PostgreSQL instance with room for 10x growth. No partitioning needed for years.

### 5.3 Storage (S3)

| Asset | Count/year | Avg size | Total |
|-------|-----------|----------|-------|
| Ticket PDFs | 73,000 | ~100 KB | ~7 GB |
| KYB documents | 500 (operator applications) | ~2 MB | ~1 GB |
| **Total** | | | **~8 GB/year** |

**Verdict**: Negligible. S3 free tier covers the first year.

### 5.4 Bandwidth

| Traffic type | Estimate |
|-------------|----------|
| Page loads (HTML + JS + CSS) | ~5,000/day × ~500 KB = ~2.5 GB/day |
| API calls (JSON) | ~10,000/day × ~5 KB = ~50 MB/day |
| PDF downloads | ~200/day × ~100 KB = ~20 MB/day |
| **Daily total** | **~2.6 GB/day** |
| **Monthly total** | **~78 GB/month** |

**Verdict**: Well within Vercel free/pro tier limits. CDN handles static assets.

### 5.5 Growth Triggers — When to Scale What

| Trigger | Action | Status |
|---------|--------|--------|
| > 1,000 bookings/day | Add PostgreSQL read replica for search queries | Planned |
| > 50 concurrent DB connections | Tune PgBouncer pool size | **Done** — PgBouncer deployed (pool 30, max client 200) |
| > 10,000 search queries/day | Add Redis cache for hot route results (short TTL) | **Ready** — Redis deployed (rate-limit + OTP JTI); route cache not yet wired |
| > 50,000 bookings/day | Consider dedicated search index (Elasticsearch/Meilisearch) | Planned |
| > 500 PDF generates/hour | Add dedicated PDF render workers | Planned |
| Database > 50 GB | Partition Booking/LedgerEntry/NotificationLog by time | Planned |

### 5.6 Monthly Cost Projection

System design includes economics. Over-engineering costs real money.

| Service | Provider | ~200 bookings/day | ~2,000 bookings/day |
|---------|----------|-------------------|---------------------|
| Hosting | Vercel Pro | $20/mo | $20/mo (same plan; serverless auto-scales) |
| Database | Neon / Supabase (managed PG) | $0–25/mo (free tier or starter) | $50–100/mo (Pro + read replica) |
| Redis | Upstash | $0/mo (free tier: 10K cmds/day) | $10–30/mo (Pro) |
| Object Storage | S3 / Cloudflare R2 | $0/mo (free tier covers ~8 GB/yr) | $1–5/mo |
| SMS | eSMS.vn | ~$15/mo (200 SMS/day × ~₫500/msg) | ~$150/mo |
| Email | Resend / SES | $0/mo (free tier) | $20/mo |
| Error tracking | Sentry | $0/mo (free tier) | $26/mo (Team) |
| Domain + DNS | Cloudflare | ~$1/mo | ~$1/mo |
| **Monthly total** | | **~$35–60/mo** | **~$280–350/mo** |

**Revenue context**: At 200 bookings/day × 450,000₫ average × 6% platform fee = ~₫5.4M/day (~$220/day) in platform revenue. Infrastructure is < 1% of revenue even at the higher scale.

**Self-hosted alternative** (`docker-compose.prod.yml` on a VPS):

| Service | Provider | ~200 bookings/day | ~2,000 bookings/day |
|---------|----------|-------------------|---------------------|
| VPS (app + PgBouncer + PG + Redis) | DigitalOcean / Hetzner | $12–24/mo (2–4 GB RAM) | $48–96/mo (8–16 GB RAM) |
| SMS | eSMS.vn | ~$15/mo | ~$150/mo |
| Email | Resend | $0/mo (free tier) | $20/mo |
| Object Storage | S3 / Cloudflare R2 | $0/mo | $1–5/mo |
| Domain + DNS | Cloudflare | ~$1/mo | ~$1/mo |
| **Monthly total** | | **~$28–40/mo** | **~$220–270/mo** |

> **Trade-off**: Both deployment paths now exist. **Vercel** (managed serverless) is the default for zero-ops: auto-scaling, preview deploys, edge middleware, no server management. **Docker Compose on a VPS** is available for cost-sensitive or data-residency-constrained deployments (Vietnam law may require in-country hosting for certain data classes). The managed path costs ~2–3x more at scale but saves an entire ops hire (~$1,500–2,000/mo in Vietnam). The self-hosted path requires managing OS updates, TLS certificates, backups, and monitoring. At ~200 bookings/day, either path works; at ~5,000+/day, the VPS path is significantly cheaper but demands ops maturity.

### 5.7 How to Estimate — Back-of-Envelope Technique

Capacity estimation is a core system design skill. Here's the methodology:

**Step 1: Start from the business metric** — bookings/day (not "requests per second"). Everything derives from this.

**Step 2: Apply common ratios**

| Ratio | Our value | Why |
|-------|-----------|-----|
| Browse-to-book | 25:1 | 25 search queries per completed booking (most people browse before buying) |
| Peak-to-average | ~5x | Rush hours (7–9 AM, 5–7 PM) concentrate traffic; midnight is near-zero |
| Read-to-write | ~50:1 | Searches (reads) vastly outnumber bookings (writes) |
| Holds-to-booking | ~2:1 | Some holds expire (payment abandoned); ~2 holds per completed booking |

**Step 3: Derive infrastructure numbers**

```
200 bookings/day
  → 5,000 searches/day (25:1 browse ratio)
  → 5,000 ÷ (8 peak hours × 3,600 seconds) ≈ 0.17 QPS average
  → 0.17 × 5 (peak multiplier) ≈ 1 QPS peak
```

**Step 4: Sanity check** — ask "does this number make sense?"
- Does 1 QPS exceed serverless capacity? No — Vercel handles thousands.
- Does 73,000 rows/year exceed PostgreSQL capacity? No — PG handles billions.
- Does 270 MB/year fill the disk? No — smallest managed DB is 10+ GB.

**Common mistakes**:
- Estimating QPS first (top-down) instead of from business volume (bottom-up)
- Using peak numbers for storage (peak applies to compute; storage is cumulative)
- Forgetting that 90% of traffic is reads (searchable, cacheable) not writes
