---
name: stack-profile
description: Pick concrete stack opinions (frontend, backend, ORM, auth, queue, payment, deploy, monitor, logger, test, i18n, lint) per project class. Reads `docs/classify/<project>.md` and emits `docs/stack/profile.md` that all Build-phase skills branch on. Use as first Build step on any new project, when user says "pick stack", "stack profile", "what should I use for X", "/stack-profile", or before invoking `/scaffold-feature`, `/codegen-from-contract`, `/lint-setup`.
---

# /stack-profile — Stack Opinions per Project Class

Invoke as `/stack-profile`. Routes project class → concrete tool choices per concern. Output is read by every other Build-phase skill to branch behavior. Without this file, Build skills fall back to language-agnostic guidance only.

---

## Why you'd care

Picking the stack ad-hoc per feature is how teams end up with three ORMs, two auth providers, and a queue nobody owns. A profile branched by class is what keeps Build-phase skills consistent across the project.

## Pre-flight

1. Read `docs/classify/<project>.md`. If missing → run `/project-classify` first, halt.
2. If `docs/stack/profile.md` exists → ask: refine existing, fork variant, or replace?
3. If class = **XS** and lifetime = throwaway → emit minimal profile (lang + test runner only), skip all SaaS-stack concerns.
4. If class ≥ **M** and user has not stated preferences → run `/grill-me` w/ prompt: "Extract preferred language, hosting target, payment need, realtime need, regulation."

---

## Inputs

- `docs/classify/<project>.md` (required for class + axis scores)
- Conversation context or existing PRD (preferred lang, hosting, hard constraints)
- Optional: existing `package.json` / `pyproject.toml` / `go.mod` — if present, lock detected stack (don't fight reality)

---

## Concerns × class rubric

Default picks per concern × class. Override only with stated user constraint.

| Concern         | XS                  | S                       | M                          | L                                | XL                                       |
|-----------------|---------------------|-------------------------|----------------------------|----------------------------------|------------------------------------------|
| **Language**    | match user habit    | TS or Python            | TS                         | TS + Go for hot paths            | TS + Go/Rust + audited language          |
| **Frontend**    | none / CLI          | static HTML or Astro    | Next.js App Router         | Next.js + RSC + WS client        | Next.js + strict CSP + SRI               |
| **Backend**     | single file         | Next.js API routes      | Next.js route handlers     | Next.js + dedicated WS server    | Next.js + service split + mTLS           |
| **ORM**         | raw sqlite          | Drizzle                 | Prisma                     | Prisma + read replicas           | Prisma + audit-log layer                 |
| **DB**          | sqlite              | sqlite / Postgres       | Postgres (Neon/Supabase)   | Postgres + Redis                 | Postgres HA + KMS-encrypted at rest      |
| **Auth**        | none                | NextAuth email-magic    | NextAuth + OAuth           | NextAuth + WebAuthn + MFA        | Enterprise SSO (SAML/OIDC) + MFA + HSM   |
| **Queue**       | none                | none                    | none / Inngest             | BullMQ + Redis or Inngest        | Kafka or SQS w/ DLQ + replay             |
| **Payment**     | none                | none                    | Stripe Checkout            | Stripe + webhooks + reconciliation | Stripe + PCI-DSS proxy or HSM           |
| **Deploy**      | local               | Vercel / Fly            | Vercel                     | Vercel + Fly for WS              | Self-host k8s or AWS w/ audit            |
| **Monitor**     | console.log         | Vercel Analytics        | Sentry + Vercel Analytics  | Sentry + Datadog + OTel          | Datadog + OTel + SIEM                    |
| **Logger**      | console             | console + JSON          | pino                       | pino + OTel                      | pino + audit-log to SIEM                 |
| **Test runner** | language default    | vitest / pytest         | vitest + Playwright        | vitest + Playwright + k6         | + mutation testing + fuzz                |
| **i18n**        | none                | none                    | next-intl                  | next-intl + RTL                  | next-intl + locale-gated regulation copy |
| **Lint/format** | none                | prettier                | eslint + prettier          | biome or eslint-strict + prettier| biome + commit-sign + SAST scanner       |
| **Pre-commit**  | none                | none                    | husky + lint-staged        | + commitlint + type-check        | + secret-scan + license-check            |

---

## Override matrix

Hard overrides — adopt even if rubric says otherwise:

| Signal                          | Force                                  |
|---------------------------------|----------------------------------------|
| User says "Python primary"      | Python lang + FastAPI backend + SQLAlchemy ORM + pytest |
| User says "Go primary"          | Go lang + chi/echo backend + sqlc + ginkgo |
| User says "no framework"        | Vanilla node/ts-node + sqlite + console logger |
| Regulation axis = 4             | Bump auth → enterprise SSO; logger → audit-log; deploy → self-host or audited cloud |
| Concurrency axis = 4            | Bump queue → Kafka/SQS; backend → service split; monitor → OTel mandatory |
| Lifetime axis ≥ 3               | Bump lint → strict; pre-commit → full; test → + mutation |
| Existing repo detected          | Lock detected stack regardless of class. Note divergence under "Drift" section. |

---

## Workflow

1. Read class + axis scores from `docs/classify/<project>.md`.
2. For each concern, look up default by class.
3. Apply override matrix in order. Later overrides win.
4. For each axis = 4, document why the upgrade fired.
5. Emit profile file. List unknowns explicitly under "Open questions" — do not invent.
6. Recommend next skill chain (usually `/lint-setup` then `/scaffold-feature`).

---

## Output template

Write to `docs/stack/profile.md`:

```markdown
# Stack Profile — <project name>

**Class: <XS|S|M|L|XL>** | **Date: <YYYY-MM-DD>** | **Iteration: 1**

## Concerns

| Concern        | Choice           | Reason                                |
|----------------|------------------|---------------------------------------|
| Language       | <e.g. TS>        | <class default / user override>       |
| Frontend       | ...              | ...                                   |
| Backend        | ...              | ...                                   |
| ORM            | ...              | ...                                   |
| DB             | ...              | ...                                   |
| Auth           | ...              | ...                                   |
| Queue          | ...              | ...                                   |
| Payment        | ...              | ...                                   |
| Deploy         | ...              | ...                                   |
| Monitor        | ...              | ...                                   |
| Logger         | ...              | ...                                   |
| Test runner    | ...              | ...                                   |
| i18n           | ...              | ...                                   |
| Lint/format    | ...              | ...                                   |
| Pre-commit     | ...              | ...                                   |

## Active overrides

- <e.g. Regulation axis = 4 → forced enterprise SSO>
- ...

## Drift from class default

- <e.g. existing repo uses Drizzle, class M default is Prisma — keeping Drizzle>

## Open questions

- <items the user must answer before Build phase starts>

## Skip-when (for downstream Build skills)

- `/form-wire` skip-when Frontend = none
- `/codegen-from-schema` skip-when ORM = raw / none
- `/mock-server` skip-when external API consumer count = 0
- ...

## Next

Recommended chain: `/lint-setup` → `/scaffold-feature` (per first issue).
```

---

## When to re-run

Re-profile on: class change, hard requirement flip (e.g. add payment), or after 6 months. Update in place — keep iteration counter.
