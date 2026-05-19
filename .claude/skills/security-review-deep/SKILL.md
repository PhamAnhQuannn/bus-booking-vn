---
name: security-review-deep
description: Deep security review of an open PR beyond shallow secret-in-diff. Audits crypto correctness (algorithm choice, IV reuse, KDF, hash collision), per-PR threat-model delta (new attack surface vs current model), rate-limit + abuse vectors on new endpoints, audit-log emission for new mutations, authz surface on new endpoints, and PII handling. Read-only — writes `docs/qa/security-deep-pr<PR#>-YYYYMMDD.md`. Triggered on every PR via /pr-inbox dispatch. Use when you want security depth beyond what `/code-review` Cat 2 catches.
output_size:
  XS: 5m
  S: 10m
  M: 10m
  L: 15m
  XL: 20m
---

# /security-review-deep — Crypto + Threat-Model + Rate-Limit + Audit-Log Audit on a PR

## Why you'd care

`/code-review` Cat 2 catches **secret literals in the diff** and **missing-authz on the obvious endpoint**. It does not catch: `createHash('md5')` on a password path, an IV reused across calls to `createCipheriv`, a new `/api/email/send` endpoint without per-IP throttle, a new role-change handler that forgets the audit-log line every sibling endpoint has. Those are the real attack surfaces. This skill scans the diff for them and writes a ranked finding report.

Invoke as `/security-review-deep <PR#>`. PR# required (no zero-arg local mode).

---

## Pre-flight

1. `gh auth status` — required. Stop with install/login hint if missing.
2. `gh pr view <PR#> --json number,title,headRefName,baseRefName,headRefOid,isDraft,state,url,reviewDecision,author,labels` — capture PR shape. Pin `headRefOid` (record it in the report so reader can tell if HEAD has moved).
3. If `state != "OPEN"` → stop, report "PR closed/merged."
4. `gh pr diff <PR#>` — full patch (this skill needs the diff body, not just file names — patterns live in code, not paths).
5. Read `CLAUDE.md` if present — capture any project-declared crypto pattern (e.g. "we use libsodium for everything", "argon2id only") so the skill flags drift from the declared standard.

### Doc-only / config-only auto-skip

If every changed path matches `*.md|docs/**|*.txt|*.rst|CHANGELOG*|LICENSE*` → emit:

```
SECURITY-DEEP REVIEW — PR #<PR#>
─────────────────────────────────
Skipped — doc-only PR.
```

…and stop. Same skip if every changed path is `*.lock|*.toml|*.yaml|*.yml` under `.github/` or root config only.

---

## Categories

### Cat 1 — Crypto correctness

Scan added (`+`) lines in the diff. Flag any of:

- `createCipher(` (Node, deprecated, no IV) → P1.
- `createCipheriv(...)` where the IV argument is a constant Buffer literal, hex string literal, or a module-level constant → IV reuse → P1.
- `Math.random()` used to generate: anything assigned to a variable named `token|secret|key|nonce|salt|otp|csrf|session` → P1.
- `createHash('md5')` or `createHash('sha1')` followed within 30 lines by anything matching `password|pwd|signature|hmac|jwt|token` → P1.
- `AES-ECB` / `ECB` mode string literal → P1.
- `bcrypt.hash(.., N)` where `N < 10` → P2.
- `pbkdf2(.., N, ..)` (or `pbkdf2Sync`) where iteration count `< 100000` → P2.
- `scrypt(.., { N: M })` where `M < 16384` → P2.
- `argon2.hash` without explicit `{ type: argon2.argon2id }` (defaults shifted across versions) → P3 advisory.
- `crypto.randomFillSync` / `randomBytes` of length `< 16` for any variable named `iv|nonce|salt|key` → P2.
- A new exported function named `*encrypt*|*decrypt*|*sign*|*verify*` in a non-server-only module (heuristic: not inside `lib/server/`, `app/api/`, `server/`, `packages/*-server/`) → P2 (crypto crossing trust boundary).
- Missing AEAD: `createCipheriv('aes-256-cbc', ...)` without an accompanying HMAC computation in the same function → P2.

### Cat 2 — Threat-model delta

Detect new attack surface introduced by the diff:

- New file under `app/api/**`, `pages/api/**`, `src/routes/**`, `server/routes/**`, `controllers/**` whose handler body does NOT call any of: `getServerSession`, `auth()`, `requireUser`, `getUser`, `assertRole`, project-specific authz helpers → P1.
- New `multer`, `formidable`, `busboy`, `request.formData()`, `request.file(` upload path without nearby (within 30 lines) `limits:`, `maxFileSize`, `fileFilter`, mime check → P1.
- New `req.query.<x>` / `searchParams.get(` / `request.query` value flowing into: a SQL template string (raw `prisma.$queryRaw\``, `db.execute(`, `pool.query(\``, `knex.raw(`), a shell call (`exec(`, `execSync(`, `spawn(`), an HTML template (`dangerouslySetInnerHTML`, `innerHTML =`, `v-html`), a `fetch(<URL>` where URL is the param → P1 (SQLi / RCE / XSS / SSRF risk).
- New `redirect(` / `res.redirect(` / `Response.redirect(` where the target is derived from `req.query`, `searchParams`, `request.body` without an allow-list match → P1 (open redirect).
- New `JSON.parse(` of network input wrapped in a `try` but no schema validation (`z.parse`, `yup`, `ajv`, `joi`) before use → P2.
- New `eval(`, `Function(`, `vm.runIn`, `child_process.exec(<string interp>)` → P1.

### Cat 3 — Rate-limit + abuse

For each new endpoint (new file under `app/api/**` etc., or new exported handler):

- If route segment matches `login|signin|signup|register|password|reset|otp|verify|email|sms|invite` and no rate-limit middleware import (`@upstash/ratelimit`, `express-rate-limit`, `next-rate-limit`, project-specific `withRateLimit`) → P1.
- If method is POST/PUT/DELETE/PATCH and no rate-limit attached → P2.
- If endpoint creates a paid resource or sends external paid action (Stripe / email / SMS) without per-user quota check → P1.

### Cat 4 — Audit-log emission

Scan the project (`grep -r` first 200 lines of one existing sibling file under `app/api/admin/**` or `app/api/payment/**`) for an existing audit-log call pattern (e.g. `auditLog.write(`, `audit.record(`, `logAudit(`, `db.audit.create(`). Capture the pattern.

For each new mutation handler in `app/api/admin/**`, `app/api/payment/**`, role-change paths (`*role*`, `*permission*`, `*member*`), assignment paths (`*owner*`, `*transfer*`):

- If the project pattern exists elsewhere but the new handler does NOT contain it → P1.
- If the project has no audit-log pattern yet AND the path matches the high-sensitivity list above → P2 advisory ("no audit-log pattern detected in project; consider establishing one — see `/audit-log-design`").

### Cat 5 — Authz surface

For each new handler: compare to sibling handlers in the same directory. If every sibling calls `assertRole('admin')` / `requireAdmin()` and the new one does not → P1.

### Cat 6 — Privacy / PII

For each new `console.log(` / `logger.info(` / `logger.debug(` whose interpolated value name matches `email|phone|ssn|sin|dob|birthdate|address|ip|user\b|userObj|customer\b` without a `redact(` / `mask(` / `…@…` truncation wrapper → P3 advisory.

For each new DB column added in `prisma/schema.prisma` (or equivalent) whose name matches the PII list above and no `@encrypted`, `@map("…_hash")`, or comment indicating at-rest treatment → P3 advisory.

---

## Severity

- **P1** — crypto break, missing-authz on a mutation, missing audit-log on admin/payment mutation, missing rate-limit on auth/email/payment path, open redirect, raw SQL with user input.
- **P2** — weak KDF rounds, unbounded JSON.parse of network input, generic mutation without rate-limit, encrypt without AEAD.
- **P3** — PII in unredacted log, PII column without at-rest notation, argon2 type default.

---

## Output Format

Write to `docs/qa/security-deep-pr<PR#>-YYYYMMDD.md`:

```
SECURITY-DEEP REVIEW — PR #<PR#> "<title>"
──────────────────────────────────────────
PR:        <URL>
Base/Head: <baseRefName> ← <headRefName> @ <headRefOid[:8]>
Decision:  <reviewDecision>
Generated: <ISO timestamp>

Findings: <N>  (P1: <a> · P2: <b> · P3: <c>)

P1 — BLOCKING:
  app/api/admin/users/role.ts:42  🚫 P1: Mutation handler missing audit-log call.
    Sibling handlers in app/api/admin/users/*.ts all call `auditLog.write({ actor, action, target })`. New `POST /role` handler does not. Fix: emit audit-log entry before returning 200.
  lib/crypto/session.ts:18  🚫 P1: `createCipher` is deprecated and uses a derived IV.
    Replace with `createCipheriv('aes-256-gcm', key, randomBytes(12))`; store IV alongside ciphertext.

P2 — SHOULD FIX:
  lib/auth/hash.ts:7  ⚠️  P2: bcrypt rounds = 8 (below threshold 10).
    Bump to `bcrypt.hash(pw, 12)`.

P3 — ADVISORY:
  app/api/orders/create.ts:55  ℹ️  P3: `logger.info(user)` logs full user object including email.
    Wrap with `redact(user, ['email', 'phone'])` or log only `user.id`.

RECOMMENDED NEXT:
  - Address P1 findings before requesting review.
  - If reviewer already requested changes: /pr-feedback-route <PR#>

SUMMARY: <a> P1 · <b> P2 · <c> P3 · pinned to <headRefOid[:8]>
```

Empty case (no findings):

```
SECURITY-DEEP REVIEW — PR #<PR#>
──────────────────────────────────
No security-deep findings.
(Crypto, authz, rate-limit, audit-log, PII patterns clean.)
```

---

## Boundaries

- Read-only. Does NOT comment on PR, does NOT label, does NOT modify code.
- Does NOT run network checks (no `npm audit`, no `osv-scanner`). Pattern-detection only.
- Does NOT replace `/code-review` Cat 2 — augments it with depth.
- Does NOT cover supply-chain — see `/backcompat-review` for new-dep license/typosquat.
- Does NOT cover observability gaps — see `/observability-review`.

## Auto-chain

- **No auto-chain out.** User reads report, picks remediation.
- **Triggered by**: `/pr-inbox` (always-on companion row); `/route` when user says "deep security check on PR" / "crypto review" / "threat-model delta" with a PR#.
- **Cross-links**: `/pr-feedback-route <PR#>` for the post-CHANGES_REQUESTED loop; `/audit-log-design` if Cat 4 emits the no-pattern advisory.

## Integration

- **Produces**: `docs/qa/security-deep-pr<PR#>-YYYYMMDD.md` (idempotent same-day overwrite).
- **Consumes**: `gh pr view --json` + `gh pr diff <PR#>` + project sibling files for audit-log pattern detection.
- **Re-run**: idempotent. Re-run after each push or new commit; report regenerates against new `headRefOid`.
