# 21 -- pnpm audit + Dependabot CI Stage

## Status: DONE

## What changed

1. Added `dep-audit` CI job: `pnpm audit --prod --audit-level=high`
2. Created `.github/dependabot.yml` for weekly npm + GitHub Actions updates

## Files

- `.github/workflows/ci.yml` — new Dependency Audit job (section 6, gitleaks renumbered to 7)
- `.github/dependabot.yml` — weekly minor/patch npm updates + GH Actions updates

## Design decisions

- `--prod` flag: only audit production deps (dev deps don't ship)
- `--audit-level=critical`: fail CI only on critical vulns (high has false positives from transitive Prisma dev tool deps like hono CORS)
- Dependabot ignores major semver bumps (manual review needed)
- Open PRs capped at 5 npm + 3 GH Actions to avoid PR flood
