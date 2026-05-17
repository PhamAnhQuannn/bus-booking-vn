---
name: devtool-distribution-channels
description: Distribution channel plan for devtools/SDKs/CLIs — npm/PyPI/crates.io/Maven Central/RubyGems publishing, Homebrew tap, Scoop bucket, GitHub Releases binaries, Docker Hub/GHCR images, language-package-manager priority matrix, install-command copy-paste-ability, post-publish smoke. Outputs channel matrix + publish pipeline spec to `docs/inception/devtool-distribution-<product>.md`. Reads `/project-classify` to skip XS. Use when user says "distribution channels", "package publishing", "npm publish", "Homebrew tap", "Docker image", "where do devs install from", "/devtool-distribution-channels", or before first SDK/CLI release.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 5h
---

# /devtool-distribution-channels — Devtool Distribution Channel Plan

## Why you'd care

A devtool that lives only on your website is invisible. Developers install from package managers they already trust (`npm i`, `pip install`, `brew install`, `cargo add`, `docker pull`) — every extra step (download from website, `chmod +x`, add-to-PATH) cuts adoption ~40%. Picking the wrong channels — or publishing in the wrong order — strands users and forces a do-over six months later when you realize half your ICP uses Windows and you only shipped to Homebrew.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Confirm artifact type: library/SDK (language-specific), CLI (cross-language), agent/daemon (long-running), container image, terraform/pulumi module, IDE extension. Channels differ per type.
3. Pull ICP language/OS mix from `/buyer-persona-deep` or analytics — Python-heavy ML vs JS-heavy frontend vs Go-heavy infra ICPs route to very different package registries.
4. Decide v0/v1 split — `S` and `M` ship 1-2 channels, defer the rest; `L`/`XL` ship a multi-language matrix from day one.

## Inputs
- Artifact type + target languages/runtimes.
- ICP OS/language mix (from `/buyer-persona-deep`).
- Existing CI provider (GitHub Actions, CircleCI, Buildkite) — release automation lives here.
- Brand handle availability on each registry (squat early).
- License (MIT/Apache-2/BSL/commercial) — some registries reject non-OSS or require declaration.

## Process

1. **Channel inventory by artifact type** — map your artifact to the canonical registries.

   | Artifact | Tier-1 channel | Tier-2 channel | Tier-3 channel |
   |---|---|---|---|
   | JS/TS library | **npm** (registry.npmjs.org) | GitHub Packages, jsr.io | CDN bundle (unpkg/jsDelivr) |
   | Python library | **PyPI** (pypi.org) | conda-forge | Anaconda channel |
   | Rust library | **crates.io** | — | git dependency |
   | Go module | **proxy.golang.org** (auto from Git tag) | — | vendored |
   | Java/Kotlin/Scala | **Maven Central** (Sonatype OSSRH) | JitPack | GitHub Packages |
   | Ruby gem | **RubyGems.org** | — | git ref |
   | .NET | **NuGet.org** | GitHub Packages | private NuGet feed |
   | PHP | **Packagist** | — | private composer |
   | Swift | **Swift Package Index** (auto from Git tag) | CocoaPods (legacy) | Carthage (legacy) |
   | macOS CLI | **Homebrew tap** (`brew install owner/tap/tool`) → eventually homebrew-core | MacPorts | direct binary |
   | Linux CLI | **GitHub Releases** (tarball + checksum) | apt repo (`deb`), yum repo (`rpm`) | Snap, Flatpak, AUR |
   | Windows CLI | **Scoop bucket**, **winget** | Chocolatey | MSI installer |
   | Cross-platform CLI | **GitHub Releases** + install-script (`curl ... \| sh`) | Homebrew + Scoop + winget | language-native (npm/pip for thin wrapper) |
   | Container image | **Docker Hub** | **GitHub Container Registry (ghcr.io)** | quay.io, ECR Public |
   | K8s operator/helm | **Artifact Hub** + own Helm repo | OperatorHub.io | OCI registry |
   | Terraform module | **Terraform Registry** (registry.terraform.io) | git ref | private registry |
   | VS Code extension | **VS Code Marketplace** | Open VSX Registry (Cursor, VSCodium) | sideload .vsix |
   | JetBrains plugin | **JetBrains Marketplace** | — | direct download |
   | Browser extension | **Chrome Web Store** + **Firefox AMO** + **Edge Add-ons** | Safari App Store | sideload |

2. **Priority matrix — what to ship in v0.1 vs v1.0** — score each channel by ICP-reach × effort:

   | Channel | ICP reach | Effort to publish | Effort to maintain | v0.1? |
   |---|---|---|---|---|
   | npm | 95% of JS devs | 30 min | low | yes if JS library |
   | PyPI | 95% of Python devs | 1 hr (build wheel, configure trusted-publisher) | low | yes if Python lib |
   | Homebrew tap (own) | ~60% of macOS dev CLIs | 1 hr (own tap repo) | low | yes if macOS CLI |
   | homebrew-core | 100% of macOS devs | weeks (PR + review) | medium (responsive maintainer required) | v1+ |
   | GitHub Releases | universal | <1 hr (CI) | low | yes |
   | Docker Hub | universal for backend | 1 hr | low | yes if dockerized |
   | conda-forge | ML/data sci | 1 day (feedstock PR) | medium | v1+ for ML ICPs |
   | apt/yum repo | enterprise Linux | days (signing infra) | high (key rotation) | v2+ unless ICP demands |
   | winget | ~30% Windows devs | 1 hr (manifest PR) | low | v1+ if Windows ICP |

3. **Brand-handle squat** — claim your name on all relevant registries on day one, even if you don't publish yet. Once `acme-cli` on npm is taken by squatter, the only paths are renaming or formal name-dispute (slow, public). Claim list — npm org, PyPI user, crates.io, Docker Hub org, ghcr (free with GitHub), Homebrew tap repo name, NuGet ID. Cost: ~1 hour of clicking signup forms, but prevents months of pain.

4. **The "copy-paste install" line is the headline** — design your install UX around a single line that fits in a tweet:
   - `npm i @acme/sdk`
   - `pip install acme-sdk`
   - `brew install acme/tap/cli` (own tap) or `brew install acme` (homebrew-core)
   - `cargo add acme`
   - `go install github.com/acme/cli@latest`
   - `curl -fsSL https://acme.dev/install.sh | sh` (use sparingly — security-review concern at enterprise, but PLG-friendly)
   - `docker run acme/cli:latest`
   This goes on README line 1, pricing page, every blog post, every tutorial. If your install line needs explanation, friction is too high.

5. **Release automation pipeline** — every supported channel needs a CI job. Pick one source-of-truth artifact and fan out:
   - On git tag `v1.2.3`:
     - Build canonical artifact (tarball, wheel, jar, binary matrix).
     - Sign (cosign for containers, sigstore/GPG for tarballs, npm provenance via OIDC).
     - Publish to Tier-1 channel (npm/PyPI/crates).
     - Push container image to Docker Hub + ghcr.io.
     - Create GitHub Release with checksums.txt + binaries for each OS/arch (linux-amd64, linux-arm64, darwin-amd64, darwin-arm64, windows-amd64).
     - Bump Homebrew formula in own tap (auto-PR via `brew bump-formula-pr` or homebrew-releaser action).
     - Submit winget manifest (auto via `wingetcreate` or komac).
     - Trigger conda-forge bot (PR on feedstock).
   - **Trusted publishing** — use OIDC where supported (PyPI Trusted Publisher, npm provenance, crates.io trusted publishing): no long-lived tokens in CI secrets.
   - **Reproducibility** — record the exact build commit + checksum in the release notes so users can verify.

6. **Container image specifics** — multi-arch (linux/amd64 + linux/arm64), minimal base (`distroless`, `alpine`, or `scratch` if static), pin base by digest not tag, sign with cosign, generate SBOM (syft), publish to both Docker Hub (discovery) and ghcr.io (rate-limit fallback, free for public). Tag scheme: `latest` + `1` + `1.2` + `1.2.3` + `sha-<short>`. Document non-root user + read-only-rootfs in README so platform teams adopt easily.

7. **Install-script `curl | sh` pattern** — for cross-platform CLIs, an `install.sh` hosted on your domain is the highest-conversion option. Required hygiene:
   - HTTPS-only, served from your apex domain (not a random S3 bucket).
   - Detects OS+arch, downloads correct binary from GitHub Releases, verifies SHA-256 checksum and minisign/cosign signature before exec.
   - Supports `INSTALL_DIR=$HOME/.local/bin` override (corporate machines without sudo).
   - Supports pinning version: `curl ... | VERSION=1.2.3 sh`.
   - Print non-interactive summary at end (version installed, path, next command).
   - Mirror in `install.ps1` for Windows.
   Avoid `eval` of remote content; avoid sudo unless absolutely required; print exact actions before performing them.

8. **Channel-specific gotchas — the part that costs you a week if you don't know**:
   - **npm**: scoped packages (`@acme/sdk`) default to private; publish with `--access public`. Set `provenance: true` via `npm publish --provenance` (requires OIDC). Squat name + use `@acme` scope for sub-packages.
   - **PyPI**: ship wheels (`*.whl`), not just sdist. Use `cibuildwheel` for binary extensions across linux/macos/windows × py3.9-3.13. Enable 2FA + trusted publishing.
   - **crates.io**: every version is permanent — yanking only hides from resolver, doesn't delete. Once `1.0.0` is published you can never republish it.
   - **Maven Central**: requires GPG-signed artifacts + namespace verification (com.acme TLD ownership). Migration from Sonatype OSSRH → Central Portal in progress. Budget 1-2 weeks first time.
   - **Homebrew core**: PR is gated on notability (300+ GitHub stars OR 30+ forks OR equivalent reputation signal). Run your own tap until then.
   - **Docker Hub**: free orgs are rate-limited (100 anon pulls / 6h per IP). Mirror to ghcr.io to give users an escape valve.
   - **VS Code Marketplace**: Microsoft account + publisher verification required; review can take 24-48h on first publish. Mirror to Open VSX for Cursor/VSCodium/Codium users.
   - **Go modules**: there is no central publish — `proxy.golang.org` fetches from your Git tag. But: once a version is fetched it's cached immutably. Bad release → bump version, never retag.

9. **Discoverability beyond registries** — registries surface packages by name; discovery happens elsewhere:
   - **README on GitHub** — install line in first 5 lines, badge row (npm version, license, build status, downloads/month).
   - **shields.io badges** — show download count, version, supported runtimes.
   - **awesome-* lists** — submit PR to language-specific curated lists (awesome-python, awesome-rust).
   - **language showcase pages** — Rust's "what people are doing" page, Go's pkg.go.dev, npm's "trending".
   - **Hacker News + Lobsters** — single launch post tied to v1.0.
   - **Conference talks + meetup mentions** — drives long-tail registry traffic.

10. **Post-publish smoke test** — before announcing, run a fresh install on a clean container/VM for every supported channel:
    ```bash
    docker run --rm -it node:20 sh -c "npm i @acme/sdk && node -e 'require(\"@acme/sdk\")'"
    docker run --rm -it python:3.12 sh -c "pip install acme-sdk && python -c 'import acme'"
    docker run --rm -it homebrew/brew sh -c "brew install acme/tap/cli && cli --version"
    ```
    Automate as a `release-smoke` CI job that runs after publish; failure rolls back the announcement, not the publish (you can't unpublish, only deprecate).

11. **Deprecation + sunset signaling** — when a channel ages out:
    - npm: `npm deprecate @acme/sdk@"<1.0.0" "Upgrade to 1.x; see MIGRATION.md"`.
    - PyPI: yank with message; cannot delete.
    - Docker: keep image but stop pushing new tags; add `org.opencontainers.image.deprecated=true` label.
    - Homebrew: `brew style` + `deprecate!` directive in formula.
    Cross-link to `/sdk-versioning-policy` for the version-level discipline.

12. **Channel metrics — what to track per channel monthly**:
    - npm: downloads/week (npm Insights), version distribution (% on latest major).
    - PyPI: downloads via pypistats.org or BigQuery.
    - Docker Hub: pulls/week.
    - Homebrew: analytics opt-in (`brew analytics`) — limited.
    - GitHub Releases: download count per asset.
    - Roll up into a "channel mix" dashboard — if 95% of installs come from one channel you can deprioritize the rest; if mix is even you must keep them all green.

## Output

Write to `docs/inception/devtool-distribution-<product>.md`:

```markdown
# Distribution Channels — <product>

## Artifact type
<library | CLI | container | terraform module | IDE extension>

## Target ICP language/OS mix
- Languages: <Python 60%, JS 30%, Go 10%>
- OS: <macOS 55%, Linux 35%, Windows 10%>

## Channel matrix (priority)

| Channel | Tier | v0.1 | v1.0 | v2.0+ | Owner |
|---|---|---|---|---|---|
| npm `@acme/sdk` | 1 | yes | yes | yes | <name> |
| Homebrew tap `acme/tap/cli` | 1 | yes | yes | — | <name> |
| homebrew-core `acme` | 2 | — | yes | yes | <name> |
| GitHub Releases (linux/darwin/win × amd64/arm64) | 1 | yes | yes | yes | CI |
| Docker Hub `acme/cli` + ghcr.io | 1 | — | yes | yes | CI |
| winget | 2 | — | yes | yes | CI |
| conda-forge | 3 | — | — | yes | community |

## Install lines (copy-paste headline)
- `npm i @acme/sdk`
- `brew install acme/tap/cli`
- `curl -fsSL https://acme.dev/install.sh | sh`
- `docker run --rm acme/cli:latest --help`

## Brand-handle squat status
- [x] npm org `@acme`
- [x] PyPI user `acme`
- [x] crates.io `acme`
- [x] Docker Hub org `acme`
- [x] Homebrew tap repo `acme/homebrew-tap`
- [ ] winget `Acme.Cli` (pending PR)

## Release pipeline (CI)
- Trigger: git tag `v*.*.*`
- Steps: build → sign → publish-npm → publish-pypi → push-docker → create-github-release → bump-homebrew → submit-winget → smoke-test → announce.
- OIDC trusted-publishing enabled for: npm, PyPI.
- SBOM + signatures attached to every release.

## Install-script hygiene
- Served from `https://acme.dev/install.sh`
- Verifies SHA-256 + cosign signature before exec
- Supports `INSTALL_DIR=...` + `VERSION=...` overrides
- Mirrored `install.ps1` for Windows
- Source published in `scripts/install.sh` of this repo

## Post-publish smoke matrix
- node:20-alpine — `npm i && require()`
- python:3.12 — `pip install && import`
- ubuntu:22.04 — `curl ... | sh && cli --version`
- mcr.microsoft.com/windows/servercore — `winget install`

## Discoverability
- README install line + 4 shields.io badges
- pkg.go.dev / npmjs.com / pypi.org listing pages curated (description, keywords, repo link, homepage)
- Awesome-list PRs targeted: <list-1>, <list-2>

## Metrics dashboard
- npm weekly downloads — target trajectory
- Docker pulls/week — target trajectory
- Homebrew analytics — track when listed in core
- GitHub Releases download mix

## Risks
- <e.g. "homebrew-core PR rejected — operate own tap indefinitely; mitigate via install-script promotion">
```

## Verification
- [ ] Every artifact type produced is mapped to at least one Tier-1 channel.
- [ ] Install line is one shell command, fits in a tweet, copy-pasteable.
- [ ] Brand handle squatted on all Tier-1 + Tier-2 registries.
- [ ] CI publish pipeline is fully automated from git tag — no manual `npm publish` from a laptop.
- [ ] Trusted publishing (OIDC) enabled for npm/PyPI where supported; no long-lived tokens in CI secrets.
- [ ] Post-publish smoke test runs against a clean container for every channel and gates the announcement.
- [ ] Cross-linked to `/sdk-versioning-policy` for per-version discipline.
