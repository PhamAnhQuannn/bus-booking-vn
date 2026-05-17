---
name: scraper-ethics-pre
description: Pre-build scraper / automation ethics — ToS scan, robots.txt honor, rate limits, identification headers, kill switch, legal exposure (CFAA / hiQ / Van Buren / DMCA). Outputs to `docs/inception/scraper-ethics-pre-<project>.md`. For M-class data-SaaS, run in PARALLEL with `/problem-validation`, not after — ToS deal-killers should fire BEFORE customer-validation effort. Use when user says "scraper", "scraping", "crawler", "web automation", "bot", "robots.txt", "/scraper-ethics-pre", or before building any data collection from third-party sites.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /scraper-ethics-pre — Scraping Without A Policy = Lawsuit + IP Ban + Reputational Hit. Decide The Rules Before The First Request.

Scraper ethics ≠ "robots.txt and pray". Scraper ethics = explicit per-target compliance posture: ToS read, robots.txt honored, rate budgeted, identity disclosed, kill switch wired, legal exposure assessed. Build the policy before the first request; retrofitting after a cease-and-desist is too late.

## Why you'd care

CFAA and hiQ-line cases mean an aggressive scraper can be both a technical and a legal liability before the first customer. Pre-flighting ToS and robots.txt is what keeps your product from being a defendant.

## Pre-flight
Run before writing the first line of scraping / automation / crawling code. Pairs with `/scraper-ethics` (per-target), `/tos-violation-screen`, `/sanctions-screen`, `/threat-model`, `/data-residency-map`.

## Inputs
- Target sites in scope (specific list).
- Data to collect + intended use (internal / public product / resale).
- Scale (one-shot / continuous / high-volume).
- Geography of operation + targets (CFAA / GDPR / national equivalents).
- Authentication model (public anon / public-logged-in / paid account).

## Process
1. **Determine legal exposure** — CFAA + state CAA + DMCA + GDPR + national equivalents.
2. **Read ToS per target** — explicit prohibition vs silent vs allowed.
3. **Read robots.txt per target** — honor as binding even when not legally required.
4. **Pick identification stance** — disclosed UA + contact email recommended.
5. **Set rate limits** — per-target, conservative, well below capacity.
6. **Wire kill switch** — abuse complaint → stop within 1 hour.
7. **Data minimization** — collect what's needed, nothing else.
8. **PII handling** — see `/pii-inventory-pre` + lawful basis.
9. **Storage + retention** — when does scraped data delete.
10. **Per-target file** — one `/scraper-ethics-<target>.md` per scraped site.
11. **Counsel review** — for any commercial-use scraper.

## Output
Write `docs/inception/scraper-ethics-pre-<project>.md`:

```markdown
# Scraper Ethics Pre-flight — <project>
**Owner:** founder / eng lead / legal
**Date:** <YYYY-MM-DD>
**Targets in scope:** <list>
**Counsel:** <name + contact, or "TBD before launch">

## Why this exists pre-build
- One bad scrape = cease-and-desist + IP ban + reputational hit + possible CFAA exposure
- Aggregator businesses (price comparison, listings, social monitoring) live or die on scraper ethics
- Most platforms now use bot-detection (Cloudflare, Akamai, DataDome, PerimeterX) — sloppy scraping = blocked instantly
- "Public data" ≠ "legal to scrape" — ToS + DMCA + computer-fraud laws layer on
- Courts are unsettled (hiQ v. LinkedIn back-and-forth) — operate conservatively
- The CFAA "authorization" line moved in 2021 (Van Buren) — narrower scope but state CAA laws vary

## Legal landscape (US-centric, jurisdiction varies)

### CFAA (Computer Fraud and Abuse Act) — federal
- Bans accessing computer "without authorization" or "exceeding authorized access"
- **Van Buren v. US (2021):** SCOTUS narrowed "exceeds authorized access" to mean accessing files/folders you can't access at all, not misusing files you can access
- **hiQ v. LinkedIn (2022, 9th Cir.):** scraping public data likely NOT CFAA, but LinkedIn won on contract/ToS grounds later
- **Meta v. Bright Data (2024):** Meta lost on CFAA, lost on contract for logged-out scraping — but court did NOT bless all scraping
- Civil + criminal penalties

### Computer Misuse Act (UK) / similar (EU national laws)
- Often broader than CFAA
- Honor ToS-as-prohibition more strictly in EU

### DMCA §1201 — circumvention
- Bypassing technical protection (auth, CAPTCHA, paywall) → DMCA violation
- Even if data is public-ish, breaking through anti-bot = legal risk

### Copyright
- Facts NOT copyrightable; expression IS
- Compilations may be copyrightable (database rights in EU)
- Database Directive (EU) — sui generis right for "substantial investment" databases

### State computer-access laws
- CA, NY, MA, FL, etc. — varying; some criminalize ToS violations
- California Penal Code §502 — broader than CFAA

### GDPR / CCPA / state privacy
- Scraping personal data triggers GDPR controller obligations
- Lawful basis required (legitimate interest most common, balancing test)
- Right to object + delete still applies
- CCPA: scraped PII is "personal information" subject to CCPA if applicable

### Trespass to chattels (common-law tort)
- eBay v. Bidder's Edge (2000) — chattels theory revived for scraping
- Requires actual harm to target's servers — high-rate scraping = exposure

### Contract / ToS
- "Click-wrap" ToS (account creation) = enforceable
- "Browse-wrap" (no acceptance step) = harder to enforce but increasingly upheld
- Even logged-out scraping may be ToS-bound depending on jurisdiction + presentation

**Our jurisdiction(s):** <list>
**Our worst-case exposure:** <CFAA risk / ToS breach / GDPR / DMCA / state CAA>

## Per-target classification

| Tier | Description | Action |
|------|-------------|--------|
| **Tier 0 — official API** | Target provides documented API | Use API only. No scraping. |
| **Tier 1 — scrape allowed** | Public data + permissive ToS + robots.txt allows | Proceed with standard hygiene |
| **Tier 2 — scrape ambiguous** | Public data + silent ToS + robots.txt allows | Proceed with extra hygiene + counsel review |
| **Tier 3 — scrape prohibited (silent)** | Public data + ToS prohibits OR robots.txt disallows | Skip unless legal greenlight |
| **Tier 4 — scrape behind auth** | Logged-in / paid account / behind technical protection | Skip. DMCA + ToS + CFAA stack. |

**Our target inventory:**

| Target | Tier | API? | ToS prohibits? | robots.txt allows? | Decision |
|--------|------|------|----------------|--------------------|----------|
| Example: Yelp | Tier 3 | Yes (limited) | Yes | Disallow /biz/* | Skip; use API |
| Example: Hacker News | Tier 1 | Yes (Firebase API) | No | Allow | API preferred; scraping OK at low rate |
| Example: Reddit | Tier 0 | Yes (paid) | Strict on scraping post-2023 | Restrictive | API only |

## Identification stance

**Always disclose identity:**

```
User-Agent: <project-name>/<version> (+https://<project>.com/bot; <ops-email>)
From: <ops-email>
```

- Custom UA string with project name + version + contact URL + email
- `From:` header with operator email
- Optional: dedicated subdomain like `bot.<project>.com` with abuse policy page
- Static IP block (rotate within block) — easier for targets to whitelist or block cleanly
- DO NOT spoof browser UAs in production — adversarial signal that loses you the legal "good faith" argument

## robots.txt policy

- **Fetch robots.txt before any crawl** of a host
- Cache for max 24 hr
- Honor `Disallow:` directives even when not legally required (good-faith record)
- Honor `Crawl-delay:` (often Bing/Yandex spec; most use it as default)
- Honor `Sitemap:` — use it instead of crawling
- Treat 401/403/404 on robots.txt as "no rules" but log it
- Honor `noindex` / `nofollow` for any indexing use

## Rate limiting

**Defaults (conservative):**
- 1 request per 2-5 seconds per target host (0.2-0.5 RPS)
- Hard cap: 30 requests per minute per host
- Honor `Retry-After:` headers
- Exponential back-off on 429 / 503 (1s, 2s, 4s, 8s, 16s, max 60s)
- After 3 consecutive 429/503 → pause that target for 1 hour
- Respect crawl-delay from robots.txt if larger than our default

**Concurrency:** 1 request in-flight per target host. Parallelize across hosts, NEVER within a host.

**Off-peak preference:** schedule large pulls during target's local 2-6 AM where feasible.

## Caching + revisit policy

- Cache aggressively — never refetch unchanged content
- Honor `Last-Modified` / `ETag` (conditional requests)
- Min revisit interval per resource: 24 hr default, 1 hr for highly dynamic (news / pricing), 7 days for static
- Use feeds (RSS / Atom / sitemaps) where available — lighter than crawling

## Anti-bot protection — DO NOT defeat

If target has CAPTCHA, JS challenges, behavioral signals → that's an explicit "no":
- Don't solve CAPTCHA programmatically (2Captcha / Anti-Captcha use is adversarial)
- Don't use headless-browser stealth mode (puppeteer-stealth, undetected-chromedriver) for production scraping
- Don't rotate residential proxies to evade rate limits
- These = DMCA §1201 + bad-faith record

Acceptable: standard datacenter IP from cloud provider, with disclosed UA, respectful rate.

## Kill switch

**Trigger conditions:**
- Abuse complaint received → stop within 1 hour
- 429/503 storm beyond back-off threshold → auto-pause that target
- Target sends cease-and-desist → stop within same business day
- robots.txt now disallows previously-allowed path → stop that path within 24 hr
- ToS now explicitly prohibits → escalate to counsel + pause

**Implementation:**
- Kill switch config in code: `SCRAPER_ENABLED_TARGETS=<list>`
- Removing a target from list halts within 1 deployment cycle (< 1 hr)
- Manual override: ops can disable any target via dashboard / config
- Emergency: drop the queue + cancel inflight

**Abuse contact:** `abuse@<project>.com` monitored 24/5 minimum, 24/7 ideal.

## Data minimization

- Collect ONLY what your use case needs
- Do NOT exfiltrate entire pages "in case"
- Strip irrelevant fields server-side before storage
- If aggregating: store derived data, not raw source content

## PII handling

If target data includes PII (names, emails, profiles):
- Run `/pii-inventory-pre` for this dataset
- Lawful basis (likely legitimate interest with balancing test)
- Right-to-delete plumbing (users on target may not know you have their data)
- Honor data subject requests
- Retention limits + automated purge

**Do NOT scrape:**
- Children's data (under 16 EU / under 13 US)
- Sensitive categories (health, sexual orientation, religion, political opinion, race) without explicit basis
- Login-walled content (privacy reasonable expectation higher)
- Combined / re-identifying datasets without DPIA

## Storage + retention

- Where stored: <region — affects GDPR/data-residency>
- Encryption at rest
- Access control (least privilege)
- Retention: <N days/months>
- Deletion on source-deletion: when source removes data, we delete within X days
- Backups: same retention as primary

## Audit trail

Log per request:
- Timestamp
- Target host + URL
- Response code
- Bytes transferred
- UA used
- Internal job ID

Retain logs: 90 days minimum. Useful for proving good-faith if challenged.

## Commercial use considerations

If scraped data feeds a commercial product:
- ToS exposure higher
- Database rights (EU) more likely to trigger
- Counsel review mandatory
- Consider licensing relationship with target instead

## Reselling scraped data

**Don't.** Unless:
- Data is genuinely public + factual (no expression)
- Target ToS does not prohibit
- Counsel reviewed + greenlit
- Repackaging adds substantial value (analysis, aggregation, derived metrics)

Plain redistribution of scraped content = high-risk business model.

## API-first decision tree

For every target:
1. Does target offer an API? → use it. Stop.
2. Does target offer a paid data feed / partnership? → consider buying.
3. Does target offer a sitemap / RSS / feed? → use it.
4. Only after 1-3 are no → consider scraping under this policy.

## Operations cadence

- **Monthly:** review ToS + robots.txt for each target (changes happen)
- **Per-target rate audit:** is our rate causing any 429s? tune down if yes.
- **Quarterly:** legal review of target list + scope changes
- **Yearly:** counsel re-review of overall policy

## Anti-patterns
- ❌ Fake browser UA pretending to be Chrome
- ❌ Residential proxy rotation to bypass rate limits
- ❌ CAPTCHA-solving services
- ❌ Ignoring robots.txt because "it's not legally binding"
- ❌ Scraping then arguing about ToS later
- ❌ One scraper for "everything" — per-target policy required
- ❌ No kill switch — abuse complaint can't be addressed
- ❌ No abuse@ email
- ❌ Storing raw HTML forever
- ❌ Scraping personal data without lawful basis assessment
- ❌ Reselling raw scraped content
- ❌ Scaling first, asking counsel later
- ❌ Treating "we scraped it from public web" as a privacy defense

## Per-target file

For each target, create `docs/compliance/scraper-<target>.md`:
- Target name + URL + contact
- API alternative reviewed (Y/N + why not)
- ToS link + last review date + relevant clauses
- robots.txt last fetched date + allowed paths
- Rate limit set
- Data collected (field list)
- Lawful basis (if PII)
- Retention period
- Kill switch condition checks
- Counsel sign-off (if Tier 2+)

## Pre-build checklist
- [ ] Legal landscape understood for jurisdiction(s)
- [ ] Target inventory with tier classification
- [ ] API-first review for every target
- [ ] Identification stance defined (disclosed UA)
- [ ] Rate limit defaults set
- [ ] Caching + revisit policy
- [ ] Kill switch wired
- [ ] Abuse contact monitored
- [ ] Data minimization rules
- [ ] PII handling if relevant
- [ ] Storage + retention defined
- [ ] Audit logging built
- [ ] Counsel review for Tier 2+ targets
- [ ] Per-target file per scraped site

## Anti-patterns flagged
- ❌ No per-target review
- ❌ Spoofed UA
- ❌ No kill switch
- ❌ No counsel review for commercial use
- ❌ Ignoring robots.txt
- ❌ Bypassing technical protection
- ❌ Scraping logged-in content
- ❌ Storing raw content indefinitely
- ❌ No abuse contact

## Next
- Per-target file → `/scraper-ethics`
- ToS pre-screen → `/tos-violation-screen`
- PII inventory → `/pii-inventory-pre`
- Privacy policy → `/privacy-policy-pre`
- Lawful basis → `/lawful-basis-mapping`
- Threat model → `/threat-model-pre`
```

## Verification
- Legal landscape mapped for jurisdiction.
- Target inventory + tier classification.
- API-first decision applied per target.
- Identification stance disclosed.
- Rate limits conservative + back-off wired.
- Kill switch + abuse contact live.
- Data minimization + PII handling.
- Counsel review for Tier 2+.
- Per-target file pattern adopted.
