---
name: release-notes
description: Audience-targeted release notes generated from /commit-split groupings + /feature-flag-rollout flip events. Categorize user-visible / bug / perf / security / breaking, redact internal, format per channel (CHANGELOG / blog / in-app / email). Use when user says "release notes", "changelog", "what shipped", "release announcement", "/release-notes", or when `/feature-flag-rollout` / `/ota-update` / `/api-versioning` chains here.
output_size:
  XS: skip
  S: 45m
  M: 1.5h
  L: 2.5h
  XL: 4h
---

# /release-notes — Audience-Targeted Release Notes

## Why you'd care

Three failure modes hide inside any release that ships without written notes:

- **Customers learn from breakage** — the feature flag flipped to 100%, the dashboard re-skinned, and the integrator's brittle Selenium test failed in CI overnight. Customer files support ticket; CS finds out about the release from the ticket.
- **One blob for all audiences** — the marketing blog repurposes the engineering changelog and includes "renamed internal worker queue from `email-q` to `notification-q`" alongside the headline feature. Now customers think the queue rename is a feature.
- **Security CVE leaks before patch universal** — release notes published the morning the patch shipped say "fixed XSS in profile page". 12% of self-hosted customers haven't pulled the update. They learn about the bug + the fix simultaneously, from the same paragraph.

One generation pass, fed by `/commit-split` groupings and `/feature-flag-rollout` flip events, categorizes by audience, redacts the internal slice, formats per channel, and publishes only after the deploy is health-gated stable. Pairs tight with `/api-versioning` (deprecation announcements) and `/sunset-plan` (feature-removed announcements).

Invoke as `/release-notes`. Run after deploy stable + before announcement.

## When This Skill Applies

Triggers (user phrases):
- "release notes", "changelog", "what shipped", "release announcement", "publish notes"
- "/release-notes"
- "weekly release", "version bump", "ship list"

Auto-invoke (chained FROM):
- **`/feature-flag-rollout`** — when a flag reaches 100% (full rollout) the feature graduates from "shipping" to "shipped", needs a notes entry on the release-day channel.
- **`/ota-update`** — mobile OTA bundle ships → release notes generated for app store + in-app modal channels.
- **`/api-versioning`** — every deprecation announcement OR sunset day = release-notes entry on the deprecation channel.
- **`/deploy-health-gate`** — when health-gate confirms stability post-deploy, releases the gating hold on notes publish.

## Pre-flight

1. **`/commit-split` has run for the window.** Release notes are categorized from commit groupings. If commit-split hasn't run → invoke it first; do NOT roll your own grouping by reading raw `git log` (categorization quality plummets).
2. **Feature-flag-rollout docs exist for any flag flipped during window.** Cross-ref `/feature-flag-rollout` output for flag→ramp-event mapping. Partial-rollout features (50% only) get different copy than fully-rolled features.
3. **Deploy has actually shipped (or is locked in for ship date).** Notes published before deploy = customers try the feature, get 404; notes published after deploy stable = trust intact.
4. **Health-gate confirmed (if applicable).** `/deploy-health-gate` `STABLE` verdict releases the publish hold for notes. Notes can be DRAFT before gate passes; PUBLISH only after.
5. **Redaction allowlist available.** What's NOT publishable? Internal codenames (project "phoenix" still works internally — public name is "Smart Routing"), customer-specific incident details, security CVE specifics until patch universal.
6. **Channel list defined.** Which channels publish? `CHANGELOG.md` (always), blog (sometimes), in-app modal (user-visible features), customer email (major releases), dashboard banner (deprecations / breaking).

## Inputs

- **Release slug** — `2026-05-14` OR `v3.7.0` OR `pricing-revamp`.
- **Release date** — ISO-8601; the date notes apply to.
- **Build SHA** — git sha of the deploy.
- **Audience channels** — list from `[changelog, blog, in-app-modal, customer-email, dashboard-banner, app-store-listing]`.
- **Redaction allowlist** — `internal_codenames: ["phoenix", "operation-monolith"]`, `customer_names_redacted: true`, `security_cve_embargo: ["CVE-2026-XXXX"]`.
- **Flag events** — list of `<flag-slug>:<event>` (e.g. `pricing-v2:rolled-100`, `dark-mode:rolled-50`).
- **Deprecation events** — list from `/api-versioning` for any cuts in window.

## Process

1. **Pull commit groups from `/commit-split` output.** Read `docs/release/commit-split-<slug>.md` (or equivalent). Each group has a domain (auth / billing / search / etc.), a one-line summary, and a list of SHAs.

2. **Pull flag-flip events from `/feature-flag-rollout` docs.** For each `docs/release/feature-flag-rollout-*.md` updated in window, extract:
   - Flag slug
   - Ramp event (`launched-1`, `rolled-50`, `rolled-100`, `killed`)
   - User-facing copy from the doc's "customer-comms" block (if pre-written)
   - Affected user cohort (% of audience)

3. **Categorize** into 7 buckets:

   | Bucket | Definition | Audience | Default channels |
   |---|---|---|---|
   | **User-visible feature** | New capability users see/use | All customers | blog, in-app, email (major), changelog |
   | **Bug fix** | Defect remediation | Customers who hit it | changelog; in-app (if visible was broken) |
   | **Performance** | Latency / throughput / cost win, user-perceptible | Customers who care | changelog; blog (only headline wins) |
   | **Security** | CVE fix / hardening | All customers; security listserv | changelog (post-embargo); security advisory channel |
   | **Dev-facing** | API / SDK / integration | Developers | changelog; dev-blog; deprecation channel |
   | **Breaking change** | Subtractive or semantic shift | Affected integrators | dashboard banner + email + changelog |
   | **Internal-only** | Refactor / infra / dev tooling | None | Internal-only doc; NOT in any external channel |

   Rule: every commit group belongs to exactly one bucket. Default to internal-only when in doubt (safer to under-publish than leak).

4. **Redact secrets / internal codenames / customer-specific details / unreleased security info.** Pass over each entry:
   - Internal codename → public name (look up in allowlist; missing mapping → flag for human review)
   - Customer name → "an enterprise customer" or omit entirely
   - Security CVE specifics → defer until 30d post-patch OR until patch universal (whichever first); meanwhile generic "hardened authentication flow"
   - Stack trace / file path / SHA in user-facing copy → strip (these belong in engineering changelog, not customer-facing)

5. **Per-channel format pass.** Same content, different shapes:

   | Channel | Format | Length | Tone |
   |---|---|---|---|
   | `CHANGELOG.md` | Keep-A-Changelog convention (Added / Changed / Deprecated / Removed / Fixed / Security) | All entries | Terse |
   | Blog post | Narrative, 1–3 headline features expanded, screenshots/GIFs | 600–1200 words | Marketing voice |
   | In-app modal | 1 headline + 3 bullets + 1 CTA | < 80 words | Friendly |
   | Customer email | Subject (< 50 chars) + body (1 hero + 3 bullets + CTA) | < 200 words | Customer-success voice |
   | Dashboard banner | One sentence + dismiss + link | < 30 words | Action-oriented |
   | App-store listing | Per-platform character limits (iOS 4000 / Android 500) | Platform max | App-store voice |
   | Dev-blog / dev-changelog | Code samples, link to migration guide | 200–600 words | Technical, code-first |

6. **Surface flagged-feature partial rollouts.** Features at < 100% get caveated copy:
   - "Available to 50% of Pro plan users this week. Rolling to all by <date>."
   - "Experimental — enable in Settings → Labs."
   - "Beta — feedback welcome at <link>."

   These features SHOULD appear in notes (early-adopter excitement, beta-feedback recruitment) but explicit cohort labeling avoids "where's this feature?" support tickets from the other 50%.

7. **Cross-link to migration guide if `/api-versioning` deprecation event in window.** Breaking-change entries in customer-email + dashboard-banner channels MUST link to:
   - `docs/api/migration-v<N>-to-v<N+1>.md`
   - Deprecation date + sunset date
   - Window length remaining
   - Header response example (`Sunset:` / `Deprecation:`)

8. **Approval + publish checklist per channel.** Each channel has its own gate before publish:

   | Channel | Approver | Gate |
   |---|---|---|
   | CHANGELOG.md | Eng lead | Deploy SHA matches; commit-split source linked |
   | Blog | Marketing + DevRel | Screenshots ready; SEO meta filled |
   | In-app modal | Product + DevRel | Targeting cohort confirmed; dismiss persistence wired |
   | Customer email | CS + Marketing | Subject A/B tested if > 10k recipients; unsubscribe footer present |
   | Dashboard banner | Product | Audience filter (don't show v2 banner to v2-already-on customers) |
   | App-store listing | Mobile lead | Per-platform proof, character limits met |
   | Security advisory | Security lead | Embargo cleared; CVE-ID assigned |

   Publish flow: DRAFT → REVIEWED → APPROVED → PUBLISHED. Track per-channel timestamps in frontmatter.

## Output Format

Write `docs/release/release-notes-<release-slug>.md`:

```markdown
---
release_slug: <slug>
release_date: <YYYY-MM-DD>
build_sha: <sha>
audience_channels: [changelog, blog, in-app-modal, customer-email, dashboard-banner]
flag_events:
  - pricing-v2: rolled-100
  - dark-mode: rolled-50
breaking_changes:
  - api-v1-charges-card-id (sunset 2027-11-14)
security_advisories: [<CVE-2026-XXXX | null>]
deprecations:
  - /v1/charges card_id field (see api-versioning doc)
status: draft | reviewed | approved | published
published_to:
  changelog: <ISO-8601 | null>
  blog: <ISO-8601 | null>
  in_app: <ISO-8601 | null>
  customer_email: <ISO-8601 | null>
  dashboard_banner: <ISO-8601 | null>
companion_docs:
  commit_split: <link>
  feature_flag_rollout: <link(s)>
  api_versioning: <link if breaking>
  deploy_health_gate: <link>
---

# Release — <slug> · <release-date>

## Per-channel publish status
| Channel | Status | Published at | Approver |
|---|---|---|---|
| CHANGELOG | <draft / approved / published> | <ts> | <name> |
| Blog | ... | ... | ... |
| In-app modal | ... | ... | ... |
| Customer email | ... | ... | ... |
| Dashboard banner | ... | ... | ... |

---

## 1. CHANGELOG.md (Keep-A-Changelog)

\`\`\`markdown
## [<version>] - <release-date>

### Added
- Smart Routing: automatic carrier selection for shipments (rolled to 100% of Pro plan)
- Dark mode (in beta — enable in Settings → Appearance; 50% rollout)

### Changed
- Charge endpoint: `payment_method_id` replaces `card_id` (v1 deprecated, sunset 2027-11-14 — see migration guide)
- Search ranking now considers click-through (15% relevance lift on top queries)

### Deprecated
- `POST /v1/charges` with `card_id` field — use `payment_method_id`. v1 sunsets 2027-11-14.

### Fixed
- Invoices PDF rendering on Safari 16 (regression from last release)
- CSV export truncating at 65k rows on large exports

### Security
- Hardened authentication flow (no customer action required)

### Removed (internal)
- (none customer-visible)
\`\`\`

---

## 2. Blog post

**Title:** Smart Routing arrives — and three other shipping upgrades

**Hero:** [screenshot of Smart Routing dashboard]

**Body:**
This week we shipped Smart Routing — automatic carrier selection that picks the cheapest viable option per shipment based on your customer's zip, package weight, and SLA. Pro plan customers see it on the Shipments page starting today.

Three more upgrades in this release:
- Dark mode is rolling out to 50% of accounts (enable it under Settings → Appearance; full availability next week).
- Search relevance got a 15% lift on top queries (we now weight click-through).
- The Charges API moves to `payment_method_id` — `card_id` is deprecated. If you integrate against the API, [read the migration guide](<link>); your existing integrations continue working until 2027-11-14.

[CTA: View shipping settings →]

---

## 3. In-app modal

**Headline:** New: Smart Routing
**Body:** We pick the cheapest carrier per shipment, automatically. Pro plan, on by default.
**CTA:** See it in Shipments
**Targeting:** Pro plan customers; suppress for accounts with Smart Routing already enabled

---

## 4. Customer email

**Subject:** Smart Routing is live — your shipping bill just got cheaper

**Body:**
Hi <first_name>,

Two updates this week worth your time:

1. **Smart Routing** picks the cheapest carrier per shipment, automatically. Pro plan, no setup. → [See it](<link>)
2. **Charges API change** — if you have a custom integration, the `card_id` field is being replaced with `payment_method_id`. Your existing code keeps working until November 2027. → [Migration guide](<link>)

Questions? Hit reply.

— <CS rep name>

---

## 5. Dashboard banner

**Copy:** "API v1 deprecates Nov 2027 — view migration guide"
**Audience:** Account admins on integrations using v1 in last 30d
**CTA:** Migration guide → · Dismiss
**Persistence:** 30 days; resurfaces if API key still v1-only at 6mo before sunset

---

## 6. Source material
- Commit split: <link>
- Feature flag rollouts: <link 1>, <link 2>
- API versioning doc (deprecation): <link>
- Deploy health gate: <link>

## 7. Open questions / followups
- [ ] Schedule app-store update for mobile (Android needs 500-char copy)
- [ ] Security advisory drafting deferred to 30d post-patch
```

## Audience-channel matrix

Default category → channel mapping (overridable per release):

| Category | CHANGELOG | Blog | In-app | Email | Dashboard banner | App-store | Dev-blog |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| User-visible feature | ✓ | ✓ (headline) | ✓ | ✓ (major) | – | ✓ (mobile) | – |
| Bug fix | ✓ | – | ✓ (visible-only) | – | – | – | – |
| Performance | ✓ | ✓ (headline only) | – | – | – | – | – |
| Security | ✓ (post-embargo) | – | – | – | – | – | ✓ (CVE detail) |
| Dev-facing | ✓ | – | – | – | – | – | ✓ |
| Breaking change | ✓ | ✓ | – | ✓ | ✓ | – | ✓ |
| Internal-only | – | – | – | – | – | – | – |

## Multi-vertical worked examples

### SaaS weekly release — small mixed-tier customer base, no app store
- **Window**: 1 week of merges; ~15 commits across 4 domains.
- **Channels active**: CHANGELOG + in-app modal + dashboard banner (no blog post for weekly).
- **Flag events**: 2 features hit 100%, 1 still at 25% (early-adopter labeled).
- **Output**: 1 CHANGELOG entry, 1 in-app modal copy, dashboard banner for the deprecation.
- **No security advisory**: nothing in CVE bucket this week.

### Mobile app store release with `/ota-update`
- **Window**: bundle 4.3.2 → 4.4.0 (server features) + OTA 4.4.0 → 4.4.1 (JS bundle).
- **Channels active**: app-store listing (per-platform copy) + in-app modal + CHANGELOG.
- **Per-platform**: iOS 4000-char copy with marketing emphasis; Android 500-char terser.
- **OTA caveat**: in-app modal shipped via OTA pre-bundles; older binary still works but skips new headline feature.
- **Output**: 2 app-store entries (iOS / Android) + 1 in-app modal + CHANGELOG.

### B2B enterprise with security CVE
- **Window**: 2 weeks of merges; 1 critical CVE patched.
- **Channels active**: CHANGELOG (CVE delayed 30d) + customer email (security advisory channel) + status page.
- **Embargo**: blog post + dashboard banner held until patch universal across self-hosted customers; CHANGELOG entry redacted to "hardened authentication" until embargo cleared.
- **Approvals**: security lead reviewed CVE wording; enterprise CS sent advisory to affected accounts manually before public CHANGELOG entry shipped.
- **Output**: 1 redacted CHANGELOG entry + 1 security advisory email + 1 status page entry + scheduled 30d-later CHANGELOG amendment with full CVE detail.

## Boundaries

- **Not the same as `/commit-split`.** That groups commits into semantic units. This consumes the groupings and renders them by audience.
- **Not the same as `/feature-flag-rollout`.** That manages the ramp + kill-switch. This announces the resulting state to customers.
- **Not the same as `/customer-incident-comms`.** Incident comms = something broke + we're fixing. Release notes = something shipped + here's what changed.
- **Does not author marketing positioning.** Renders technical changes into customer-readable copy; marketing team owns brand voice / positioning for blog + email.
- **Does not handle security disclosures end-to-end.** Coordinates with security lead on CVE embargo; security advisory authoring lives in a dedicated security-disclosure runbook.
- **Does not publish.** Generates DRAFT content per channel; publish requires per-channel approver (matrix in process step 8).

## Re-run Behavior

- One file per release slug. Re-running on same slug overwrites if status = `draft`; locks if status = `approved` (writes amendment with `supersedes:` frontmatter for follow-up corrections).
- Post-publish amendment: new file `release-notes-<slug>-amendment-<date>.md` with `amends: <original-slug>` field. Useful for: security advisory cleared embargo → CHANGELOG amended with CVE detail.
- Per-channel publish timestamps are append-only; revoke a publish = write amendment, not edit-in-place.
- Cumulative log: `docs/release/release-lineage.md` one-line per release with slug + date + headline + channels published.

## Auto-chain

- **Fires (downstream):**
  - `/transactional-email` — for customer-email channel; release-notes provides the body, transactional-email handles send.
  - `/devdocs-gen` — updates public changelog page on docs site.
  - `/sunset-plan` — if release REMOVES a feature, the sunset announcement is a release-notes entry on the deprecation channel.
- **Reads (upstream):**
  - `/commit-split` — primary source material (commit groupings).
  - `/feature-flag-rollout` — flag flip events + customer-facing copy from per-flag docs.
  - `/migration-author` notes — breaking-change DB migration paired with API change.
  - `/api-versioning` — deprecation events sourced from per-project versioning doc.
  - `/deploy-health-gate` — release stable verdict gates the publish step.
- **Pairs with:**
  - `/dead-code-scan` — pre-flight: confirm any flag-cleanup deletions are reflected in CHANGELOG "Removed (internal)" section.
  - `/post-mortem` — if a release causes incident, post-mortem reference appended to next release notes (rare; usually separate doc).

## Verification

1. `docs/release/release-notes-<slug>.md` exists with frontmatter populated.
2. Source material section links to `/commit-split` output (no rolling your own grouping).
3. At least one channel section (CHANGELOG always) present.
4. Each channel section has copy in the channel's expected format (no blog-length text in dashboard-banner section).
5. Redaction allowlist verified — no internal codenames, no customer names, no embargoed CVE specifics leaked.
6. Per-channel publish status table present, even if all DRAFT.
7. Approver names assigned per channel (not "TBD").
8. Breaking-change rows (if any) link to `/api-versioning` migration guide.
9. Partial-rollout features explicitly labeled with cohort (% or "beta" / "experimental").
10. Cross-references in `## Auto-chain` resolve to existing skill files.

## Example Trigger

User: "we shipped Smart Routing + dark mode + a charges API change this week — write the release notes"

→ `/release-notes` runs:
- Pull commit groups from `docs/release/commit-split-2026-05-14.md`: 4 groups (smart-routing / dark-mode / charges-api / misc-fixes)
- Pull flag events from `docs/release/feature-flag-rollout-smart-routing.md` (rolled-100) + `feature-flag-rollout-dark-mode.md` (rolled-50)
- Pull deprecation event from `docs/design/api-versioning-payments.md` (v1 card_id deprecated, sunset 2027-11-14)
- Categorize: smart-routing → user-visible feature; dark-mode → user-visible (partial); charges-api → breaking change; misc-fixes → bug fix bucket (split across categories)
- Per-channel render: CHANGELOG (all 4 buckets), blog (smart-routing headline + dark-mode + API change), in-app modal (smart-routing only), customer email (smart-routing + API change), dashboard banner (deprecation only)
- Redaction: project "phoenix" internal codename → public "Smart Routing"; customer names stripped
- Approval per channel: eng lead (CHANGELOG), marketing + DevRel (blog), product + DevRel (in-app), CS + marketing (email), product (banner)
- Status: DRAFT until `/deploy-health-gate` confirms STABLE; then APPROVED → PUBLISHED per channel
- Auto-chain: `/transactional-email` for email send; `/devdocs-gen` for docs-site changelog update
- Output: `docs/release/release-notes-2026-05-14.md`
