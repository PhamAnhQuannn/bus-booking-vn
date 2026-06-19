> ← [Previous](../03b-accessibility/) | [Index](../README.md) | [Next →](../05-capacity/)

## 4. Networking & Traffic Flow

This section explains how a user's request travels from their browser to the server and back, and the infrastructure layers involved.

### 4.1 DNS — Domain Name System

**What it is**: DNS is the internet's phone book. When a user types `busbooking.vn` in their browser, DNS translates that human-readable name into an IP address (like `104.21.56.123`) that computers use to find each other.

**How it works for us**:
1. User types `busbooking.vn` → browser asks a DNS resolver "what's the IP?"
2. DNS responds with the IP of our hosting provider (Vercel's edge network)
3. Browser connects to that IP

**DNS records we configure**:
- `A` record: points `busbooking.vn` → hosting IP
- `CNAME` record: points `www.busbooking.vn` → `busbooking.vn`
- `MX` record: email routing (for transactional emails)
- `TXT` record: domain verification (for email sender authentication, SPF/DKIM)

### 4.2 CDN — Content Delivery Network

**What it is**: A CDN is a network of servers spread across many locations (called "edge nodes" or "PoPs — Points of Presence"). Instead of every user hitting your origin server in one location, the CDN serves cached copies of static content (images, CSS, JavaScript files) from the nearest edge node.

**Why it matters**:
- A user in Ho Chi Minh City gets static assets from a nearby edge node (~5ms) instead of a server in the US (~200ms).
- Reduces load on the origin server — static assets never hit your application code.

**What gets CDN-cached**:
- Static assets: JavaScript bundles, CSS, images, fonts
- Ticket PDFs (served via signed S3 URLs through CDN)
- NOT cached: API responses (dynamic, per-user), search results, payment pages

**Stage 0**: Vercel's built-in CDN handles this automatically.
**Stage 1**: Add CloudFront or similar in front of S3 for ticket PDFs at scale.

### 4.3 SSL/TLS — Secure Connection

**What it is**: SSL (Secure Sockets Layer) / TLS (Transport Layer Security) encrypts all traffic between the user's browser and the server. The padlock icon in the browser means TLS is active. Without it, passwords, payment data, and personal info travel as plain text — readable by anyone on the network.

**How it works for us**:
- Vercel auto-provisions TLS certificates (via Let's Encrypt)
- All HTTP traffic redirected to HTTPS (enforced)
- TLS terminates at the edge (Vercel's network handles the encryption/decryption)

### 4.4 Request Lifecycle — Full Round Trip

Here is what happens when a customer searches for a trip:

```
User's Browser (Ho Chi Minh City)
  │
  ├─ 1. DNS lookup: busbooking.vn → 104.21.56.123
  │
  ├─ 2. TLS handshake (encrypted connection established)
  │
  ├─ 3. HTTP GET /search?from=hanoi&to=hcm&date=2026-07-01&seats=2
  │
  ▼
Vercel Edge Network (nearest PoP)
  │
  ├─ 4. Edge middleware runs (proxy.ts):
  │     - Rate-limit check (Redis) → allow or 429 Too Many Requests
  │     - Auth check (if needed) → verify JWT
  │
  ├─ 5. Request routed to serverless function
  │
  ▼
Next.js Server (serverless function)
  │
  ├─ 6. RSC (React Server Component) renders search page:
  │     - Calls lib/search/searchTrips() in-process (NOT a self-fetch)
  │     - searchTrips() queries PostgreSQL via Prisma through PgBouncer
  │     - SQL: indexed query on (origin, dest, date, status) with
  │       available-seats computation
  │
  ├─ 7. Returns rendered HTML + streaming RSC payload
  │
  ▼
Back to User's Browser
  │
  ├─ 8. Browser renders the page
  ├─ 9. React hydrates (makes the page interactive)
  └─ 10. Total time: ~150-300ms
```

### 4.5 Connection Pooling — PgBouncer

**The problem**: In a serverless environment, each request may spin up a new function instance. Each instance opens a new database connection. PostgreSQL has a hard limit (~100 concurrent connections by default). Under a traffic spike, 100+ simultaneous serverless functions exhaust the connection pool → database rejects new connections → site goes down.

**The solution**: **PgBouncer** sits between the application and PostgreSQL as a connection pooler. It maintains a pool of 30 real database connections and multiplexes hundreds of application requests across them.

```
Serverless Function 1 ─┐
Serverless Function 2 ─┤──→ PgBouncer (30 real connections) ──→ PostgreSQL
Serverless Function 3 ─┤
...                     │
Serverless Function 200─┘
```

**Critical from day 1** — not a later optimization. Without it, the first traffic spike kills the database.

**Deployed configuration** (`docker-compose.prod.yml`):
- Image: `edoburu/pgbouncer:1.22.1`
- Pool mode: `transaction` (connections returned after each transaction, not after session close — maximizes sharing)
- Backend pool size: 30 real PostgreSQL connections (`PGBOUNCER_DEFAULT_POOL_SIZE`)
- Max client connections: 200 (`MAX_CLIENT_CONN`)
- Auth: `scram-sha-256` (salted password hashes)
- App-side pool: Each serverless instance opens at most 5 connections to PgBouncer (configurable via `DATABASE_POOL_MAX`). PgBouncer multiplexes these across the 30 real backend connections.
- Prisma migrations bypass PgBouncer via `DIRECT_URL` (transaction mode is incompatible with prepared statements and `CREATE INDEX CONCURRENTLY`). Configured in `prisma.config.ts`.
