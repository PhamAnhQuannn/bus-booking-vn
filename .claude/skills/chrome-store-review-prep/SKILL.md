---
name: chrome-store-review-prep
description: Browser-extension store review prep — Chrome Web Store, Edge Add-ons, Firefox AMO, Safari Extension Gallery. Manifest V3 audit, permissions justification, screenshot kit, privacy policy, single-purpose statement, takedown response. Reads `/project-classify` + GTM docs. Writes `docs/release/chrome-store-review-<project>.md`. Use when user says "Chrome Web Store", "extension review", "MV3", "permissions justification", "AMO", "Edge add-on", "Safari extension", "/chrome-store-review-prep", or before submitting any browser extension.
output_size:
  XS: skip
  S: 1h
  M: 1h
  L: 1h
  XL: skip
---

# /chrome-store-review-prep — Browser Extension Store Review Pre-flight

## Why you'd care

Chrome Web Store, AMO, and Edge each have separate review queues — a single missed permission justification or MV3 manifest mistake puts you on a multi-week loop in all of them. Pre-flight catches the predictable rejections so launch day isn't "we'll resubmit and try again Friday."

Invoke as `/chrome-store-review-prep`. Required before first submission to any extension store, and again on any permission change.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP (no extension at XS)
   - XL → SKIP (mature companies have a dedicated submission lead)
2. Read `docs/gtm/launch-channel-plan-<project>.md` if present (to align store launch with broader GTM).
3. Read `manifest.json` (or `manifest.firefox.json`, `manifest.safari.json` variants).
4. Confirm a hosted privacy policy URL exists.

## Inputs
- Target stores (Chrome, Edge, Firefox, Safari — pick the subset).
- Extension purpose in one sentence (the "single purpose" test).
- Permissions requested (`host_permissions`, `permissions`, `optional_permissions`).
- Remote-code policy: does the extension `eval`, load JS from a CDN, or use a remote `<script>`? (MV3 forbids remote code execution.)
- Data the extension collects + where it's sent.
- Account model (anonymous, login required, BYO API key).
- Screenshot/promo assets you have.

## Process
1. **Single-purpose audit (Chrome §C2)** — write the one-sentence purpose. If the description requires "and also…", split the extension or drop the secondary feature. Chrome rejects multi-purpose extensions.
2. **Permission minimization** — for every permission, write a one-line user-visible justification. Common gotchas:
   - `<all_urls>` / `*://*/*` → reject-magnet. Switch to `activeTab` + `host_permissions` for specific origins. If you truly need all-URLs, justify via DOM-modification use case.
   - `tabs` is rarely needed; `activeTab` covers most flows.
   - `storage` → trivial to justify ("save user prefs").
   - `scripting` (MV3) replaces `tabs.executeScript`.
   - `webRequest` blocking → MV3 forbids; use `declarativeNetRequest`.
   - `cookies` → must justify per-domain.
   - `nativeMessaging` → high scrutiny; explain native host.
3. **Manifest V3 compliance** (Chrome dropped MV2 June 2024 for consumer extensions):
   - `manifest_version: 3`
   - Background = `service_worker`, not `background.page`
   - No remote code (`eval`, `new Function`, remote `import()`)
   - CSP defaults to `script-src 'self'`
   - Action API: `action` not `browser_action` / `page_action`
4. **Privacy disclosures (Chrome data-use form)**:
   - Personally identifiable info? (name, email, address)
   - Health info?
   - Financial info?
   - Authentication info? (passwords, tokens)
   - Personal communications? (email body, chat)
   - Location?
   - Web history?
   - User activity?
   - Website content?
   - Each checked box requires: purpose + whether sold + whether transferred to 3rd party.
   - **Limited Use** certification: data not sold, not used for ads, not transferred except for primary feature / legal / sale of company.
5. **Privacy policy URL** — must be live, must reference the extension by name, must describe each data category from step 4. Generic site policy → reject.
6. **Asset checklist per store** (sizes differ — check before designing):
   - Chrome: 128px icon, 440×280 small promo, 920×680 marquee (optional), 1280×800 or 640×400 screenshots (1–5).
   - Edge: 300×300 logo, 1366×768 or 640×480 screenshots.
   - Firefox AMO: 64×64 icon, 1280×800 screenshots, no promo tiles.
   - Safari: managed via App Store Connect; needs macOS app wrapper.
7. **Listing copy**:
   - Title ≤ 45 chars (Chrome)
   - Summary ≤ 132 chars
   - Description: 16,000 char max; first 2 lines are the hook.
   - Avoid keyword stuffing (Chrome §B3 — explicit reject reason).
8. **Pricing/payments** — Chrome killed paid extensions (Dec 2020); use BYO subscription via Stripe/Paddle inside the extension. Disclose in listing.
9. **Takedown / appeal kit** — pre-draft:
   - Appeal email template (one rejection round average; 2nd appeal often final).
   - Rollback build (prior approved version tagged in git).
   - Comms template for users if pulled.
10. **Review-time expectation**:
    - Chrome: 1–10 business days; permissions-heavy = up to 6 weeks.
    - Edge: 1–7 days.
    - Firefox AMO: hours–days (most automated); manual review if minified.
    - Safari: App Store review SLA (24–48h typical).
11. **Cross-store parity** — single manifest with build-time variants (e.g., `web-ext` for Firefox, `crx` for Chrome). Decide if you ship same version everywhere or stagger.

## Output
Write `docs/release/chrome-store-review-<project>.md`:

```markdown
# Browser Extension Store Review Prep — <project>
**Date:** <YYYY-MM-DD>
**Extension version:** <semver>
**Target stores:** Chrome | Edge | Firefox AMO | Safari

## Single purpose statement
> <one sentence — the user-facing job this extension does>

Pass test: rewrite without "and"? ☐ yes ☐ no

## Manifest V3 audit
| Check | Status | Note |
|---|:--:|---|
| `manifest_version: 3` | ☐ | |
| `background.service_worker` (no `background.page`) | ☐ | |
| No `eval` / `new Function` / remote import | ☐ | grep src/ |
| `action` (not `browser_action`) | ☐ | |
| `declarativeNetRequest` (no blocking `webRequest`) | ☐ | |
| CSP = `script-src 'self'; object-src 'self'` | ☐ | |
| Web-accessible resources scoped | ☐ | |

## Permission justification table
| Permission | Why we need it | User-facing wording |
|---|---|---|
| `activeTab` | Read DOM on user-invoked click | "Acts only on the tab you click." |
| `storage` | Save your preferences | "Saves your settings locally." |
| `scripting` | Inject helper UI | "Adds the toolbar to the page." |
| `https://api.example.com/*` | Sync to our backend | "Syncs your data with example.com." |
| `<all_urls>` | <only if justified> | <user-facing reason> |

(Remove any row that doesn't survive justification — every permission costs review time.)

## Data-use disclosure (Chrome data form)
| Category | Collect? | Purpose | Sold? | Transferred? |
|---|:--:|---|:--:|:--:|
| PII (name, email) | ☐ | account | no | no |
| Auth info | ☐ | login | no | no |
| Web history | ☐ | <only if justified> | no | no |
| User activity (clicks) | ☐ | analytics | no | no |
| Website content | ☐ | core feature | no | no |
| Location | ☐ | | no | no |
| Financial | ☐ | | no | no |
| Health | ☐ | | no | no |
| Personal comms | ☐ | | no | no |

**Limited Use certification:** ☐ yes (data not sold, not used for ads, not transferred except for primary feature / legal / acquisition).

## Privacy policy
- URL: <https://...>
- Live and reachable: ☐
- Names the extension: ☐
- Covers every checked data category: ☐
- Last updated within 12 months: ☐

## Asset kit
| Asset | Size | Status |
|---|---|:--:|
| Icon 128px (Chrome/Edge) | 128×128 PNG | ☐ |
| Icon 64px (Firefox) | 64×64 PNG | ☐ |
| Small promo tile (Chrome) | 440×280 | ☐ |
| Marquee (Chrome, optional) | 1400×560 | ☐ |
| Screenshots (1–5) | 1280×800 | ☐ |
| Preview video (optional) | YouTube unlisted | ☐ |

## Listing copy
- Title (≤45 chars): <…>
- Summary (≤132 chars): <…>
- Description first 2 lines (the hook): <…>
- Keyword-stuffing scan: ☐ pass

## Cross-store deltas
| Store | Manifest variant | Notable diff |
|---|---|---|
| Chrome | manifest.json | base MV3 |
| Edge | same | accept Chrome MV3 as-is |
| Firefox AMO | manifest.firefox.json | `browser_specific_settings.gecko.id` required; MV3 mostly supported, no service-worker (uses event pages) |
| Safari | Xcode-wrapped | needs Apple Dev account ($99/yr); separate review |

## Review-time forecast
| Store | Expected SLA | Permissions-heavy? |
|---|---|:--:|
| Chrome | 1–10 business days | ☐ if yes → up to 6 wk |
| Edge | 1–7 days | |
| Firefox AMO | hours–days | manual if minified |
| Safari | 24–48h after build | |

## Rejection / takedown response kit
- Appeal email template: `docs/release/extension-appeal-template.md`
- Last-known-good build: tag `v<…>-approved`
- User comms if pulled: `docs/release/extension-takedown-comms.md`
- Mirror channels if pulled (self-host `.crx` for enterprise? Firefox-only? website install?): <decision>

## Anti-patterns (auto-reject)
- `<all_urls>` with no justification beyond "to work"
- Description that lists every keyword competitors use
- Bundling unrelated features ("password manager + dark mode + crypto wallet")
- Remote-hosted JS pulled via `<script src="https://cdn.…">`
- Affiliate-link injection without disclosure (Chrome §C7)
- Re-skinned open-source extension without meaningful diff (Chrome §B5)
- Privacy policy that's just the homepage with no extension mention

## Risk if skip
- 1st submission rejected → 1–6 week delay
- "Suspicious permissions" review queue can take 4–8 weeks
- Repeated rejects flag the developer account; future submissions slow
- Surprise removal post-launch with no rollback build = users on broken version for days
- Data-use form mismatch with actual behavior = Chrome Trust & Safety strike

## Decision
- Ready to submit? ☐ yes / ☐ no
- If no, next action: <…>
- If yes, submission date: <YYYY-MM-DD>
```

## Verification
- Single-purpose statement passes the "no `and`" rewrite test.
- Every permission has a user-facing justification.
- MV3 audit table all ✓ (or explicit waivers for Firefox event-page diff).
- Data-use disclosure matches code reality (grep for `fetch`, `XMLHttpRequest`).
- Privacy policy URL live and named.
- Asset kit complete for every target store.
- Rollback build tagged in git.
