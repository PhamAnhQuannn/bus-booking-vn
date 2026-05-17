---
name: consent-cookie-ux
description: Cookie + tracking consent UX. GDPR/ePrivacy/CCPA banner, granular per-purpose toggles, consent log, withdraw flow, regional variants, no-dark-patterns floor. Outputs `docs/design/consent.md` with banner spec + preference center + consent record schema + a11y. Use when user says "cookie banner", "consent banner", "GDPR consent", "tracking consent", "CMP", "cookie wall", "/consent-cookie-ux", or before launching to EU/UK/EEA/CA users.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 3h
  XL: 4h
---

# Consent Cookie UX

## Why you'd care

The cookie banner is the first compliance surface a regulator clicks through, and the average dark-pattern banner is a six-figure fine waiting on a single complaint. Designing equal-prominence reject + per-purpose toggles + a real consent log up front is the only way "we'll fix it later" doesn't become an enforcement action.

Consent UI is the first compliance surface a regulator sees. Equal-prominence reject, no pre-checked non-essential, no cookie-wall, granular per-purpose. Cookie banner is the visible 5%; the consent log + withdraw flow + record schema is the load-bearing 95%.

## When This Skill Applies

Activate when:
- User says "cookie banner", "consent banner", "GDPR consent", "tracking consent", "CMP", "cookie wall", "/consent-cookie-ux"
- Launch / soft-launch to EU / UK / EEA / California / Brazil users
- Adding new third-party tracker (analytics, ads, session replay, support widget)
- Regulator complaint or DPA guidance update
- Audit existing banner for dark-pattern drift

## Prerequisites

- Cookie inventory (every cookie + purpose + processor + retention).
- Legal basis decision per purpose (consent / legitimate interest / contract / legal obligation).
- Regional jurisdiction map (EU/UK/CH/EEA/CA/BR/other).
- Existing CMP decision (build vs OneTrust / Cookiebot / Iubenda / Didomi / Osano).
- `docs/design/analytics-events.md` (consent state must gate event firing).
- `docs/design/gdpr-rights.md` if exists (consent withdraw connects to it).

## Steps

1. **Inventory cookies + trackers.** First-party + third-party; per cookie: name, purpose, processor, lifetime, legal basis.
2. **Group by purpose.** Strictly necessary / functional / analytics / advertising / personalisation. Strictly-necessary never gated by consent.
3. **Region detection.** IP / Accept-Language / explicit selector. Apply region-specific rules.
4. **Banner pattern.** First-visit interstitial OR bottom banner; equal-prominence Accept and Reject; no Accept-only.
5. **Preference center.** Granular per-purpose toggles; per-vendor disclosure; one click to save.
6. **Consent record.** Persist: user_id (or anon id), timestamp, purposes accepted, banner version, region, IP-hash.
7. **Withdraw flow.** "Cookie settings" footer link; same UX surface re-opens; immediate effect.
8. **Pre-consent gating.** Block all non-essential tags until consent. No silent fire-then-honor.
9. **A11y.** Banner is a dialog; focus trapped; first focus on heading; reject equally reachable.
10. **Anti-pattern audit.** No pre-checked non-essential; no nested-3-clicks-to-reject; no scroll-as-consent; no cookie-wall.
11. **Write** `docs/design/consent.md`.
12. **Auto-chain.** Withdraw → `/gdpr-rights-ux`. Tag firing → `/analytics-spec`. Banner state → `/state-pattern-catalog`.

## Output Format — `docs/design/consent.md`

```markdown
---
last-updated: YYYY-MM-DD
status: draft | reviewed | implemented
cmp: build (server-side cookie + IndexedDB cache) | OneTrust | Cookiebot | …
regions-covered: EU, UK, EEA (Norway/Iceland/Liechtenstein), CH, CA (CCPA/CPRA), BR (LGPD)
legal-basis-source: docs/legal/legal-basis-matrix.md
---

# Consent — Cookies & Trackers

## Cookie Inventory

| Cookie | Type | Purpose | Processor | Lifetime | Legal basis |
|--------|------|---------|-----------|----------|-------------|
| `sid` | first-party | session auth | self | session | Strictly necessary |
| `csrf` | first-party | CSRF protection | self | session | Strictly necessary |
| `lang` | first-party | locale preference | self | 1 yr | Functional (consent EU) |
| `_ga` / `_ga_*` | third-party | analytics | Google Analytics 4 | 2 yr | Consent |
| `fbp` | third-party | ad attribution | Meta Pixel | 90 d | Consent |
| `intercom-session` | third-party | support chat | Intercom | session | Functional (consent EU) |
| `hjSession*` | third-party | session replay | Hotjar | session-30 m | Consent |

## Purpose Groups

| Group | Description | Toggle default | Withdrawable |
|-------|-------------|----------------|--------------|
| Strictly necessary | Auth, CSRF, load balancing | always on, no toggle | n/a |
| Functional | Locale, font preference, support chat | OFF until consent | yes |
| Analytics | GA4, product analytics, error tracking with PII | OFF until consent | yes |
| Advertising | Meta Pixel, Google Ads, retargeting | OFF until consent | yes |
| Personalisation | Recommendation, A/B test assignment | OFF until consent | yes |

**Anti-pattern:** "Functional" toggle pre-checked — forbidden under EDPB 03/2022.

## Banner Pattern

### EU / UK / EEA / CH

- First-visit overlay banner, bottom-anchored, ~25% viewport height.
- Title: "We use cookies".
- Body: 2-3 sentences explaining purposes; link to `/cookie-policy`.
- Three buttons, **equal visual weight**:
  - "Reject all" (left)
  - "Customise" (centre)
  - "Accept all" (right)
- No "X" close. No outside-click dismiss. Inactivity ≠ consent.
- Until response: only strictly-necessary load.

### California (CCPA/CPRA)

- "Do Not Sell or Share My Personal Information" link in footer.
- No banner needed unless we sell/share — currently not selling, so footer link → preference centre with toggle.
- Limit-Use of Sensitive PI toggle when applicable.

### Brazil (LGPD)

- Banner same shape as EU; rejection equal prominence.
- Disclose DPO contact in policy.

### Outside regulated regions

- No banner; analytics opt-out link in footer (good practice).

## Preference Centre

Triggered by:
- "Customise" on banner.
- "Cookie settings" footer link (always visible).
- `/preferences/cookies` URL.

Layout:
- Each purpose group as collapsible row with toggle (off by default).
- Expand row → list of vendors / cookies + retention + link to vendor policy.
- Bottom bar sticky: "Save preferences" (primary), "Reject all" (secondary), "Accept all" (secondary).
- Closing without saving = no change applied.

## Consent Record Schema

```json
{
  "consent_id": "uuid v4",
  "user_id": "string|null (null pre-auth)",
  "anon_id": "string (always)",
  "ts": "ISO 8601",
  "banner_version": "semver",
  "policy_version": "semver",
  "region": "EU|UK|US-CA|BR|…",
  "ip_hash": "sha256(ip + per-day-salt) — never raw IP",
  "user_agent": "string",
  "purposes": {
    "functional": true|false,
    "analytics": true|false,
    "advertising": true|false,
    "personalisation": true|false
  },
  "method": "accept_all|reject_all|customise|withdraw",
  "prior_consent_id": "uuid|null"
}
```

Persist server-side; retain ≥6 years (GDPR default audit retention).

## Withdraw Flow

- Footer link "Cookie settings" always visible.
- Re-opens preference centre with current state pre-loaded.
- Save → new consent record (method: `withdraw`); previous record retained.
- Effect immediate: tag manager re-evaluates within next page load + revoked tags cleared client-side (e.g., `_ga` cookie deleted).
- Server-side: subsequent events from this anon_id rejected if purpose toggled off.

## Pre-consent Gating

Tag manager rule:
- Strictly-necessary fires unconditionally.
- All other tags: gated on `consent.<purpose> === true` for current anon_id.
- No "fire then honor" — never load Pixel before consent record exists.
- Server-side: inbound event with no consent record → reject + log (not error; expected pre-consent traffic).

## Region Detection

- IP geolocation (MaxMind / Cloudflare) primary.
- Accept-Language fallback.
- User can override via "Country" selector in footer.
- Default to STRICTEST regime if detection ambiguous (EU defaults).

## A11y

- Banner: `role="dialog" aria-modal="true" aria-labelledby="consent-title"`.
- Focus trapped within banner; first focus on title (announced by screen reader).
- Reject and Accept buttons receive Tab in DOM order matching visual order.
- Esc key: does NOT close banner (would be silent rejection / could imply dismissal). Esc is no-op until choice made.
- Preference centre: each toggle has visible label + `aria-checked` + reachable by Tab + togglable by Space.
- Sufficient contrast (WCAG 2.2 AA 4.5:1 for body).
- No motion on banner appearance if `prefers-reduced-motion`.

## Anti-Patterns (forbidden)

- Pre-checked non-essential consent toggles.
- Accept button visually dominant over Reject (different colour, size, position weight).
- "Manage" or "Customise" as the only alternative to Accept (forces extra clicks for reject).
- Cookie-wall ("accept or leave") without alternative access (illegal in EU per EDPB 03/2022).
- Scroll = consent.
- Continued browsing = consent.
- Consent expiry that silently re-fires tags before re-prompt.
- "Legitimate interest" toggle hidden behind a sub-tab when same purpose offered as consent.
- Banner re-prompt on every page load until accept (nag pattern).
- Nested 3+ clicks to find Reject.
- Different banner per region without disclosing.

## Re-prompt Cadence

- After 12 months from last record (GDPR ICO guidance).
- After material change to purposes / vendors (banner_version bump).
- After cookie deletion (no record found).
- Never on every visit.

## CMP / Build Decision

| Aspect | Build | Buy (OneTrust/Cookiebot/Iubenda) |
|--------|-------|----------------------------------|
| Cookie scan | manual inventory | automated weekly |
| Consent log | self-host (own DB) | vendor-hosted (export available) |
| Multi-region rules | code | config |
| Cost | dev time | $50–$500/mo |
| Audit trail | own | vendor warrants |

Pick build if cookie set is small + stable + dev capacity exists. Buy if vendor count >20 OR multi-region OR no compliance lead.

## Analytics Events (consent UX itself)

| Event | When | Props |
|-------|------|-------|
| `consent.banner_shown` | banner first paint | region, banner_version |
| `consent.choice_made` | submit | method, purposes_accepted |
| `consent.preference_opened` | preference centre opened | source (banner / footer / URL) |
| `consent.withdrawn` | toggle off after prior on | purpose |
| `consent.record_created` | server persists | consent_id |

These events themselves fall under analytics → ironically need consent. Solution: record server-side under "legitimate interest — compliance audit" basis; do NOT use product analytics SDK.

## Out of Scope

- Marketing email consent (separate `email-preferences` skill).
- Push notification permission (separate `push-permission-ux`).
- B2B contract-based processing (no consent UI needed; covered in DPA).

## Open Questions

- Geo-IP provider (MaxMind vs Cloudflare native)? Defer to infra.
- Server-side consent caching duration to reduce cookie reads? Default 5 min.
- Mobile native: SDK-vendor SDK consent (App Tracking Transparency) — separate `mobile-consent` skill?
```

## Boundaries

- **Reject equally prominent as Accept.** Same colour weight, size, click cost.
- **Strictly-necessary never gated.** Everything else off by default.
- **No silent consent.** Scroll, swipe, continued browsing — none count.
- **Withdraw must be as easy as grant.** One footer link, same surface.
- **Consent record retained ≥6 years.** Audit-grade.
- **No code beyond CMP vendor + tag manager rule shape.**

## Re-run Behavior

- Read existing first; surface diff (new vendor, new purpose, banner version bump).
- Bump `last-updated` and `banner_version`.
- Re-run when adding tracker, expanding to new region, regulator guidance change.

## Auto-chain

- Withdraw / DSAR connection → `/gdpr-rights-ux`.
- Tag firing rules → `/analytics-spec`.
- Banner / preference-centre state → `/state-pattern-catalog`.
- Footer link placement → `/nav-pattern-pick`.
- Account deletion entry point → `/account-deletion-ux`.

## Example Trigger

User: "design our cookie consent for the EU launch"
→ Inventory cookies, group purposes, pick banner pattern, spec preference centre + consent record + withdraw + a11y, write `docs/design/consent.md`.
