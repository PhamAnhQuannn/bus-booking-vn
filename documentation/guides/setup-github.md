# GitHub — Branch Protection & Repository Settings Guide

Configure branch protection rules, required status checks, and repository settings for production safety. Code integration: `.github/workflows/ci.yml`. Env vars: none (GitHub-only configuration).

---

## Step 1: Navigate to Branch Protection

1. Go to your repository on GitHub: **https://github.com/YOUR-ORG/Bus-Booking**
2. Click **"Settings"** tab (requires admin access)
3. Left sidebar → **"Branches"** under "Code and automation"
4. Click **"Add branch protection rule"** (or **"Add classic branch protection rule"**)

---

## Step 2: Configure Protection for `master`

| Setting | Value |
|---------|-------|
| Branch name pattern | `master` |

### Required Reviews

| Setting | Value |
|---------|-------|
| ✅ Require a pull request before merging | Enabled |
| Required approving reviews | **1** |
| ✅ Dismiss stale pull request approvals when new commits are pushed | Enabled |
| ❌ Require review from Code Owners | Skip (no CODEOWNERS file yet) |
| ❌ Restrict who can dismiss reviews | Skip |
| ❌ Require approval of the most recent reviewable push | Skip |

### Required Status Checks

| Setting | Value |
|---------|-------|
| ✅ Require status checks to pass before merging | Enabled |
| ✅ Require branches to be up to date before merging | Enabled |

Add these status checks (from `.github/workflows/ci.yml`):

| Check Name | What It Runs |
|------------|-------------|
| `ci / lint` | `pnpm lint` (ESLint + Prettier) |
| `ci / typecheck` | `pnpm tsc --noEmit` |
| `ci / unit-tests` | `pnpm test` (Vitest unit tests) |

To add checks: type the check name in the search box → select from dropdown. Checks only appear after CI has run at least once on a PR.

### Additional Settings

| Setting | Value |
|---------|-------|
| ❌ Require signed commits | Skip (not enforced yet) |
| ❌ Require linear history | Skip (merge commits OK for now) |
| ✅ Do not allow bypassing the above settings | **Enabled** — even admins must follow rules |
| ❌ Restrict who can push to matching branches | Skip (PRs-only enforced by review requirement) |
| ✅ Allow force pushes | **Disabled** (default) |
| ✅ Allow deletions | **Disabled** (default) |

Click **"Create"** (or **"Save changes"**).

---

## Step 3: Verify Protection

### Test: Direct Push Blocked

```bash
# From local machine
echo "test" >> README.md
git add README.md
git commit -m "test: direct push should fail"
git push origin master
# Expected: ERROR — remote rejected (protected branch)
```

Clean up:
```bash
git reset HEAD~1
git checkout -- README.md
```

### Test: PR Requires Review

1. Create a test branch: `git checkout -b test/branch-protection`
2. Make a trivial change, push, open PR
3. Try to merge without approval → **"Merge" button should be disabled**
4. Close PR without merging, delete branch

---

## Step 4: Configure Default Branch

Verify `master` is the default branch:

1. **Settings → General → Default branch**
2. Should show `master`
3. If it shows `main`, click the pencil icon → change to `master`

---

## Step 5: Repository Settings (Recommended)

### Merge Button Options

1. **Settings → General → Pull Requests**
2. Configure:

| Setting | Recommended |
|---------|------------|
| ✅ Allow merge commits | Enabled |
| ❌ Allow squash merging | Disabled (keep full commit history) |
| ❌ Allow rebase merging | Disabled (cleaner merge graph) |
| ✅ Always suggest updating pull request branches | Enabled |
| ✅ Automatically delete head branches | Enabled |

### Vulnerability Alerts

1. **Settings → Security → Code security and analysis**
2. Enable:

| Feature | Status |
|---------|--------|
| Dependency graph | ✅ Enable |
| Dependabot alerts | ✅ Enable |
| Dependabot security updates | ✅ Enable |
| Secret scanning | ✅ Enable |
| Secret scanning push protection | ✅ Enable |

Secret scanning catches accidentally committed API keys, tokens, and passwords before they reach the remote.

---

## Step 6: Configure CI Secrets

CI workflow needs environment variables for the E2E build step:

1. **Settings → Secrets and variables → Actions**
2. Repository secrets should include (from `.github/workflows/ci.yml`):

| Secret | Value | Purpose |
|--------|-------|---------|
| `VERCEL_ORG_ID` | From Vercel dashboard | Vercel deployment (if using GitHub Actions deploy) |
| `VERCEL_PROJECT_ID` | From Vercel dashboard | Vercel deployment |
| `VERCEL_TOKEN` | From Vercel account settings | Vercel deployment |

Most CI env vars (JWT_SECRET, CRON_SECRET, etc.) are set directly in the workflow YAML with test-only placeholder values — no GitHub secrets needed for those.

---

## Step 7: Webhook for Vercel (Auto-Deploy)

If Vercel is connected via GitHub integration (recommended setup in `setup-vercel.md`), deployments trigger automatically on push. No manual webhook needed.

Verify: push to a PR branch → Vercel bot comments with preview URL within ~2 minutes.

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| "Merge" button disabled | Status checks haven't run yet | Push a commit to trigger CI; wait for checks to complete |
| Status check not found in dropdown | CI never ran with that check name | Run CI at least once on any PR to register check names |
| Admin can still push to master | "Do not allow bypassing" not checked | Edit rule → enable "Do not allow bypassing the above settings" |
| CI fails on PR | Lint/type/test errors | Fix the code; CI must pass before merge |
| Dependabot PRs failing | Missing test env vars | Ensure CI workflow has all needed env vars in `env:` block |
