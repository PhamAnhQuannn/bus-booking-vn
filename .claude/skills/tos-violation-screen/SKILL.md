---
name: tos-violation-screen
description: Screen product against 3rd-party ToS — scraping, API rate limits, brand use, content. Outputs to `docs/inception/tos-screen-<project>.md`. Reads `/project-classify` to skip XS. For M-class data-SaaS, run in PARALLEL with `/problem-validation`, not after — ToS deal-killers should fire BEFORE customer-validation effort. Use when user says "ToS violation", "scraping legality", "API ToS", "/tos-violation-screen", or before depending on 3rd-party.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /tos-violation-screen — 3rd-Party ToS Screen

Invoke as `/tos-violation-screen`. ToS violations = ban + lawsuit. Read before building.

## Why you'd care

Building on a third-party API that bans your use case means a launch that lasts until they notice. Screening the ToS before depending on the surface is what keeps the product from a single-tweet termination.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP

## Inputs
- 3rd-party services your product uses or scrapes:
  - Social platforms (Twitter, IG, LinkedIn, Reddit, FB, TikTok)
  - Search engines (Google, Bing)
  - SaaS APIs (Stripe, OpenAI, Slack)
  - Marketplaces (Amazon, eBay)
  - Government data (USPTO, SEC EDGAR)
  - News/content (RSS, news sites)
- Whether you scrape, use official API, or both.

## Process
1. **Per 3rd-party, read ToS sections**:
   - Acceptable use
   - Rate limits
   - Data scraping (often prohibited)
   - Reverse engineering
   - Trademark / brand use
   - Resale of data
   - Cache duration
   - Display rules (must show source, no manipulation)
2. **Scraping legality landscape**:
   - hiQ vs LinkedIn (US 9th Cir, 2022): public data scraping ≠ CFAA violation
   - But ToS violation = breach of contract claim still possible
   - Robots.txt = norm but not law
   - GDPR + CCPA: user data even if public has restrictions
   - CFAA risks if circumventing technical access controls
3. **API rate limits** — does your scale exceed published limits? cost of paid tier?
4. **Brand use** — using "X" in marketing? compliance with their brand guide?
5. **Content rights** — display 3rd-party content? need license?
6. **Risk per platform**:
   - HIGH: Linkedin, Facebook, Instagram (active enforcement, IP litigation)
   - MEDIUM: Twitter/X, Reddit (post-paid-API tightening)
   - LOW: government data, RSS, openly published data
7. **Mitigation tactics**:
   - Use official paid API
   - Respect robots.txt + rate limits
   - Don't bypass auth/captcha
   - Cite source clearly
   - Have ToS opinion letter for material exposure

## Output
Write `docs/inception/tos-screen-<project>.md`:

```markdown
# ToS Violation Screen — <project>
**Date:** <YYYY-MM-DD>

## 3rd-party dependencies
| Service | Use type | ToS reviewed | Risk | Status |
|---|---|---|---|---|
| Twitter/X | API + scraping | yes (read 2026-MM-DD) | medium | use Basic API tier |
| LinkedIn | scrape company data | yes | HIGH | switch to LI Sales Nav API |
| OpenAI | API | yes | low | TOS-compliant |
| Stripe | API | yes | low | standard |
| Reddit | RSS + paid API | yes | low | within limits |
| Amazon | scrape product | yes | HIGH | switch to PA-API affiliate |
| Google Search | not used | n/a | — | — |

## Per-service findings

### LinkedIn (HIGH RISK)
- ToS forbids automated scraping
- 9th Cir hiQ ruling: public data OK CFAA-wise but ToS breach claim viable
- Active litigation history (Mantheos, Anthropic, others)
- **Decision: switch to LinkedIn Sales Navigator API official**
- Cost: $X/mo
- Backup: manual data entry where automated forbidden

### Twitter/X (MEDIUM)
- Basic API tier $100/mo gets X posts/mo
- Free tier severely limited
- Scraping: officially prohibited; technically possible; legal risk medium
- **Decision: use Basic API; cap our scale to fit**

### Amazon (HIGH)
- ASIN scraping forbidden
- Product Advertising API (PA-API) requires affiliate sales > $X/period or revoked
- Rainforest API (3rd-party) exists; their legality questionable
- **Decision: PA-API + commitment to affiliate volume**

## Rate limit check
| Service | Our peak load | Free limit | Paid tier needed | $/mo |
|---|--:|--:|---|--:|
| OpenAI | 100k tok/day | tier 1 OK | — | $20 |
| Stripe | <100 req/sec | 100/sec | — | — |
| Twitter | 1000 tweets/day | 1500/mo too low | Basic | $100 |

## Brand use compliance
- Using competitor names in comparison content: nominative fair use allowed
- Using their logos: only with permission or in factual descriptive context (per logo guide)

## Cache duration limits
- Some APIs: max 24h cache (Google PageSpeed, X)
- Document compliance per service

## Risk-mitigation summary
| Risk | Mitigation | Cost |
|---|---|--:|
| LinkedIn scraping | switch to Sales Nav API | $X/mo |
| Amazon scraping | PA-API + affiliate volume commit | revenue share |
| Brand use of incumbents | nominative fair use only | $0 |
| Rate-limit burst | exponential backoff + caching | dev time |

## Counsel engagement
- Material exposure: $50k+ revenue dependent on 3rd-party data
- Engage IP attorney for opinion letter on scraping practices: 1-time $5k

## Verdict
**TOS-COMPLIANT / RISKY (specific items) / VIOLATING (must remediate before launch)**
```

## Verification
- Each 3rd-party dep ToS-reviewed.
- Scraping decisions explicit with mitigation.
- Rate-limit math (our load vs limits).
- Brand-use compliance checked.
- Risk-mitigation budget priced.
