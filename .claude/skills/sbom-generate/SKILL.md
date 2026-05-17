---
name: sbom-generate
description: CycloneDX/SPDX Software Bill of Materials per release, signed, customer-publishable, vulnerability-gated. Outputs to `docs/build/sbom-pipeline.md` + `.github/workflows/sbom.yml`. Reads `/project-classify` to skip XS. Use when user says "SBOM", "bill of materials", "supply chain", "CycloneDX", "SPDX", "/sbom-generate", or before enterprise/government sale.
output_size:
  XS: skip
  S: 1h
  M: 4h
  L: 4h
  XL: 4h
---

# /sbom-generate — Software Bill of Materials Pipeline

Invoke as `/sbom-generate`. SBOM is the ingredient list. Generate on every build, sign it, publish it, and fail the build when a known critical vuln ships.

## Why you'd care

Enterprise and government buyers increasingly require a signed SBOM before they'll sign. Build the pipeline once and the bill of materials becomes a sales asset, not a procurement blocker.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. CI exists (GitHub Actions / GitLab / CircleCI).
3. Container or package artifact produced per build.

## Inputs
- Build artifact type (Docker image / npm package / Python wheel / Go binary)
- Customer requirement (SOC2 reads SBOMs; gov buyers may demand SPDX)
- Vulnerability gate thresholds (block on critical? high?)
- Publishing target (public `/sbom/` endpoint, S3, GitHub release asset)

## Process

1. **Format pick** — CycloneDX vs SPDX:

   | Format | Pros | Cons | Pick if |
   |---|---|---|---|
   | CycloneDX (OWASP) | rich vuln model, BOM-Link, easy tools | newer | default; security-focused buyers |
   | SPDX (Linux Foundation, ISO) | ISO 5962:2021, license-focused | verbose | gov/aerospace/automotive buyers |
   | Both | belt + suspenders | 2× pipeline cost | high-compliance market |

   Default: CycloneDX JSON 1.5+. Add SPDX only if a buyer asks.

2. **Generator pick**:

   | Tool | Coverage | Notes |
   |---|---|---|
   | `syft` (Anchore) | OS pkgs, npm, pip, gem, go, jar, cargo, alpm, deb, rpm, image layers | recommended default |
   | `cdxgen` (CycloneDX) | many ecosystems incl. Java/Go/JS | rich Java support |
   | `cyclonedx-cli` | format conversion, sign, validate | utility, not generator |
   | Build-tool plugins (npm, maven, pip) | exact resolved deps | use IN ADDITION for accuracy |

   Strategy: ecosystem plugin → most accurate; `syft` over final container → catches OS libs + transitive.

3. **CI step** — generate post-build, attach to release:
   ```yaml
   # .github/workflows/sbom.yml (excerpt)
   - name: Build image
     run: docker build -t ghcr.io/${{ github.repository }}:${{ github.sha }} .

   - name: Install syft
     uses: anchore/sbom-action/download-syft@v0

   - name: Generate SBOM (CycloneDX JSON)
     run: |
       syft ghcr.io/${{ github.repository }}:${{ github.sha }} \
         -o cyclonedx-json=sbom.cdx.json \
         -o spdx-json=sbom.spdx.json

   - name: Scan SBOM for vulns
     uses: anchore/scan-action@v3
     with:
       sbom: sbom.cdx.json
       fail-build: true
       severity-cutoff: critical
   ```

4. **Signing** — cosign attest, keyless via OIDC:
   ```yaml
   - uses: sigstore/cosign-installer@v3
   - name: Sign SBOM
     env: { COSIGN_EXPERIMENTAL: '1' }
     run: |
       cosign attest --predicate sbom.cdx.json \
         --type cyclonedx \
         ghcr.io/${{ github.repository }}:${{ github.sha }}
   ```
   Keyless = no private key to rotate; trust anchored in OIDC + Rekor transparency log.

5. **Vulnerability gate** — block bad merges:

   | Severity | Action |
   |---|---|
   | Critical | block CI (fail build) |
   | High | warn + open Linear issue auto-assigned to maintainer |
   | Medium | weekly digest |
   | Low | quarterly review |
   | Any with active exploit (CISA KEV) | block regardless of severity |

   Tooling: `grype` (Anchore) reads CycloneDX directly; `trivy` is alternative.

6. **Customer publishing** — make discoverable:
   - Store: `https://<your-domain>/sbom/<git-sha>.cdx.json`
   - Index: `https://<your-domain>/sbom/index.json` (sha → URL, version → URL, latest)
   - Headers: `Content-Type: application/vnd.cyclonedx+json; version=1.5`, `Cache-Control: public, max-age=31536000, immutable`
   - Document the URL in security.txt and customer trust portal
   - Optional: VEX statements (vulnerability exploitability exchange) for accepted-risk items

7. **Retention** — keep N versions:
   - Last 12 monthly tags + every minor release: indefinite
   - Every patch: 90d (download from build cache if needed)
   - Each SBOM is small (KB-MB); storage cheap; deletion mostly for cleanliness

8. **Drift detection** — catch unexpected changes:
   - Diff new SBOM vs previous: list added / removed / version-changed components
   - Surface diff in PR (comment via gh)
   - Reviewer sees "we added 3 new transitive deps in this PR"

9. **Anti-patterns**:
   - Generating SBOM only on release (not every commit) — drift hidden
   - Manifest-only SBOM (no resolved versions) — useless for vuln matching
   - No signing — attacker can swap SBOM for clean fake
   - No vuln gate — SBOM is decoration, not control
   - Publishing only internally — enterprise buyers can't fetch

## Output

Write `docs/build/sbom-pipeline.md`:

```markdown
# SBOM Pipeline
**Date:** <YYYY-MM-DD> | **Owner:** <build/security team>

## Formats
- Primary: CycloneDX JSON 1.5
- Secondary: SPDX JSON (on demand)

## Generation
- Tool: syft over final container image
- Trigger: every CI run (PR + main + tag)
- Output: sbom.cdx.json artifact

## Signing
- Tool: cosign keyless via GitHub OIDC
- Rekor transparency log entry per artifact

## Vulnerability gate
| Severity | Action |
|---|---|
| Critical | block build |
| CISA KEV (any sev) | block build |
| High | warn + auto-ticket |
| Medium | weekly digest |
| Low | quarterly review |

## Publishing
- URL: https://<domain>/sbom/<sha>.cdx.json
- Index: /sbom/index.json
- Linked from security.txt + trust portal

## Retention
- Releases + monthly tags: forever
- PR builds: 90 days

## Drift detection
- Bot comments diff on PRs

## Customer-facing notice
"For each release we publish a CycloneDX SBOM and a cosign attestation.
SBOMs are available at <url> and signed via Sigstore."
```

Write `.github/workflows/sbom.yml` with the steps in Process #3-4.

## Verification
- SBOM generated on EVERY build, not only releases.
- Vulnerability gate blocks critical + CISA KEV.
- Signing in place (cosign attest).
- SBOM URL public + indexed.
- Drift comment lands on PRs.
- Format version specified (CycloneDX 1.5+, SPDX 2.3+).
