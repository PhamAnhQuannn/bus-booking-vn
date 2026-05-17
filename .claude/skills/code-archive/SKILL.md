---
name: code-archive
description: Archive a retired codebase so future you (or new owner) can read, build, and run it years later. Outputs to `docs/ops/code-archive-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "archive code", "decommission repo", "freeze project", "sunset codebase", "/code-archive", or when shutting a product/internal-tool down.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 4h
---

# /code-archive — Freeze the Codebase Right

## Why you'd care

A retired repo with no README, no `.env.example`, and no documented build is unbuildable in three years — which is exactly when someone needs it back. One day of archive discipline now saves a week of archaeology the day a customer drags you to court or a new owner asks for the source.

Invoke as `/code-archive`. Dead repo with no README, no .env example, no working build = useless. Spend one day now or one week of pain in three years when you need it.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Decision to archive is final (vs maintenance mode).
3. Git repo accessible; CI history available.

## Inputs
- Project name + final version
- Reason for archive (sunset / merged / replaced / abandoned)
- Likelihood of revival (low / medium / high)
- Sensitive content scan needed? (secrets, customer data in test fixtures)

## Process

1. **Final-state README** — written for someone with zero context:
   - 1-line description: what it did
   - Status: ARCHIVED <date>, reason
   - Last working version + commit SHA + tag
   - Build instructions tested against tagged state
   - Run instructions with example .env
   - Architecture sketch (1 page max)
   - Known issues / TODOs left undone
   - Where docs live; where data went

2. **Pin reproducibility**:
   - Pin language version (`.nvmrc`, `.python-version`, `Gemfile`, `go.mod`)
   - Pin tool versions (`Dockerfile` recommended — locks OS too)
   - Lock files committed (`pnpm-lock.yaml`, `poetry.lock`, etc.)
   - One Dockerfile that builds and runs the app start-to-finish
   - Tag final commit: `vX.Y.Z-final` + `archived-YYYY-MM-DD`

3. **Secret + PII sweep** — before public archive:
   - Run `gitleaks` / `trufflehog` across full history
   - Rotate any leaked secret (then audit-log the leak too)
   - Strip customer PII from test fixtures (replace with synthetic)
   - Remove `.env*` files from tracked tree (history is fine if no secrets)
   - Document any irrevocable historical secret + confirm rotated

4. **Documentation pack** — what survives with the code:
   - `README.md`: as above
   - `ARCHIVE.md`: this runbook's output
   - `ARCHITECTURE.md`: components, dependencies, data flow (1-3 pages)
   - `LESSONS.md`: what you learned, what you'd do differently
   - `docs/` directory preserved as-is

5. **Dependency snapshot**:
   - Run lockfile install + verify it works
   - SBOM generation (CycloneDX or SPDX; see `/sbom-generate`)
   - Snapshot of external service contracts (API versions, auth setups)
   - List of vendors used (with offboarding status; see `/vendor-offboarding`)

6. **Data + state**:
   - Final DB schema dump (`pg_dump --schema-only`)
   - Final DB data dump if sensitive / valuable (encrypted; store offline)
   - Sample data fixtures committed for repro
   - Document storage: blobs, files, search indexes → archived where?

7. **Repo status**:
   - GitHub: Settings → Archive this repository (read-only)
   - Move to org's `archived/` folder or attic team
   - Remove CI minutes / paid integrations (Codecov, Sentry project, etc.)
   - Disable Dependabot / Renovate (no more PRs)
   - Update repo description: "ARCHIVED <date> — see README"

8. **Access + ownership**:
   - Assign permanent owner (someone who'll be around in 3y)
   - Document where to find them
   - Backup of the repo to cold storage (org-controlled S3 + GitHub clone)
   - Recovery plan if GitHub vanishes: have a tarball

9. **Anti-patterns**:
   - Archive without README update — repo unreadable a year later
   - Archive with broken build — can't even reproduce
   - Secrets in history left in place — leak permanence
   - No final tag — "which commit was actually running?"
   - One-developer ownership with no succession — repo dies with that person
   - Mixing live + dead repos in same nav — confusing for future spelunkers

## Output

Write `docs/ops/code-archive-<project>.md`:

```markdown
# Code Archive — <project>
**Archive date:** <YYYY-MM-DD> | **Final owner:** <name + contact>

## What it was
<one paragraph: purpose, lifespan, users>

## Status
ARCHIVED — <reason>
Last commit: <SHA> tagged `vX.Y.Z-final`

## Build + run
```bash
git checkout vX.Y.Z-final
docker build -t archive .
docker run -p 3000:3000 --env-file .env.example archive
```
Tested working: <YYYY-MM-DD> on <OS/arch>

## Architecture (1-page)
[brief sketch]

## Tech stack
- Language: <version>
- Framework: <version>
- DB: <version>
- Key deps: <list>

## Secrets scan
- gitleaks: clean / <list of rotated secrets>
- All leaked creds rotated <date>

## Data
- Schema dump: archive/db-schema.sql
- Data dump: encrypted; key in 1Password
- Blob storage: s3://archive/<project>/
- Customer data: deleted per retention policy <date>

## Vendor offboarding
- See docs/ops/vendor-offboarding-*.md
- Stripe: cancelled
- Sentry: project closed
- AWS: tagged for retention

## Lessons
- What worked: <bullets>
- What didn't: <bullets>
- What we'd do differently: <bullets>

## Revival plan (if needed)
- Estimated effort to bring back: <hrs/days>
- Likely blockers: <list>
- Owner to contact: <name>

## Backups
- GitHub: archived repo, settings flag set
- Cold storage: s3://archive/<project>/repo.tar.gz
- Last verified readable: <YYYY-MM-DD>
```

## Verification
- README updated with final-state instructions.
- Build reproduced from final tag on clean machine.
- gitleaks clean OR documented leaks rotated.
- Final tag created + pushed.
- GitHub repo marked Archived.
- Cold-storage backup verified.
- Owner assigned + contact recorded.
- Vendor offboarding cross-linked.
