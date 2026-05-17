---
name: supply-chain-risk-pre
description: Pre-build software supply-chain risk — SBOM, SLSA level, dep pinning, signed releases, build provenance. Outputs to `docs/inception/supply-chain-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "supply chain", "SBOM", "SLSA", "dependency risk", "/supply-chain-risk-pre", or before NIST 800-218 / EO 14028 attestation.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /supply-chain-risk-pre — Software Supply-Chain Risk

Invoke as `/supply-chain-risk-pre`. Maps SBOM strategy, SLSA target level, dep risk policy. Driven by SolarWinds, log4shell, xz-utils incidents + EO 14028 + NIST 800-218 SSDF.

## Why you'd care

Executive Order 14028 and NIST 800-218 increasingly require SLSA-grade build provenance for federal customers — and supply-chain attacks (SolarWinds, xz) are now an existential category of risk. Pre-flighting the controls is the cheapest path through both.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/threat-model-pre-<project>.md`.
3. Read `docs/inception/regulatory-<project>.md` (FedRAMP / govtech triggers stricter).

## Inputs
- Language stack (npm, pip, cargo, maven, go).
- Build infra (GitHub Actions, CircleCI, self-hosted).
- Customer requirements (SBOM in contract? FedRAMP attestation?).
- Open-source vs proprietary mix.

## Process
1. **SBOM (Software Bill of Materials)**:
   - **Formats**: CycloneDX (OWASP), SPDX (Linux Foundation)
   - **Generation**: per-build artifact, signed
   - **Tooling**: Syft, cdxgen, Trivy, Snyk SBOM
   - **Storage**: alongside artifact; share on customer request (or Dependency-Track)
   - **EO 14028** US federal customers may require SBOM in contract
2. **SLSA levels** (Supply-chain Levels for Software Artifacts):
   - **L1**: build process documented, provenance generated
   - **L2**: hosted build, signed provenance
   - **L3**: hardened, isolated build, non-falsifiable provenance
   - **L4**: two-person review + hermetic + reproducible (rare)
   - Target: L2 minimum, L3 for FedRAMP / regulated
3. **Provenance + signing**:
   - **Sigstore** (cosign, fulcio, rekor) — keyless signing tied to OIDC
   - **in-toto attestations**
   - **SLSA Provenance v1**
   - GitHub Artifact Attestations (built-in)
4. **Dependency policy**:
   - **Pinning**: lockfile committed (package-lock.json, pnpm-lock.yaml, poetry.lock, Cargo.lock)
   - **Hash pinning**: `--integrity` or `--require-hashes` (pip)
   - **Vendoring**: optional for go/rust at high assurance
   - **Allowlist** new deps: PR review for first-time adds
   - **License gate**: deny GPL/AGPL in proprietary
5. **Vulnerability management (SCA)**:
   - **Tools**: Snyk, Dependabot, Renovate, OSV-Scanner, Trivy
   - **Cadence**: PR-time scan + nightly + alert on KEV
   - **SLA**: critical 7d, high 30d, medium 90d, low best-effort
   - **Auto-PR**: minor + patch via Renovate; major manual
6. **Typosquat / malicious-package detection**:
   - **Phylum, Socket.dev, Snyk Advisor** — install-time scoring
   - **PyPI** known typosquat list
   - **npm install --ignore-scripts** for CI default
7. **Build hardening**:
   - **OIDC** for cloud auth (no long-lived secrets)
   - **Ephemeral runners** (no state across builds)
   - **Network egress allowlist** during build
   - **Reproducible build** target (deterministic)
8. **Third-party risk lifecycle**:
   - Vendor onboarding: SOC 2 review, SBOM request
   - Annual reassessment
   - Off-boarding: token revoke + access remove
9. **Container supply-chain**:
   - Base image pinning (digest, not tag)
   - Distroless / minimal base
   - Image signing (cosign)
   - Image SBOM (Syft)
   - Image scan (Trivy, Grype)
10. **Standards alignment**:
    - **NIST 800-218 SSDF** (Secure Software Development Framework)
    - **NIST 800-161** (C-SCRM)
    - **EO 14028** (US federal procurement)
    - **CISA SBOM minimum elements**
    - **EU Cyber Resilience Act** (CRA) effective 2027 — SBOM + vuln disclosure mandatory for digital products

## Output
Write `docs/inception/supply-chain-<project>.md`:

```markdown
# Supply-Chain Risk — <project>
**Date:** <YYYY-MM-DD>

## Scope
- Stack: TypeScript (pnpm), Python (poetry), container (Docker)
- Build: GitHub Actions
- Customer requirement: SBOM in MSA for enterprise tier; FedRAMP not yet

## SBOM strategy
| Aspect | Choice | Tool |
|---|---|---|
| Format | CycloneDX 1.6 | Syft |
| Generation | per-build, in CI | GitHub Actions step |
| Storage | release asset + Dependency-Track | self-hosted DT |
| Sharing | on contractual request | sales process |
| Versioning | tied to git tag | implicit |

## SLSA target
- **Y1 target: L2** (hosted build, signed provenance via cosign)
- L3 path: post-FedRAMP-decision

## Provenance + signing
- Build attestation: GitHub Artifact Attestations (cosign-backed)
- Container signing: cosign sign with keyless OIDC
- Verification: cosign verify in deploy pipeline

## Dependency policy
| Rule | Enforcement |
|---|---|
| Lockfile committed | required PR review |
| New top-level dep | PR + maintainer approval |
| GPL/AGPL forbidden | licensing-audit gate in CI |
| Hash pinning (pip) | required |
| Major version bump | manual review |
| Patch + minor | Renovate auto-PR + auto-merge if green |

## SCA tooling
| Layer | Tool | Cadence |
|---|---|---|
| npm/pnpm | Snyk + Dependabot | PR + nightly |
| pip/poetry | Snyk + OSV | PR + nightly |
| Container | Trivy | per-build |
| Live runtime | Snyk Container | hourly |
| KEV alert | OSV-Scanner subscription | real-time |

## Vulnerability SLA
| Severity | Patch / mitigate within |
|---|---|
| Critical (CVSS ≥ 9.0 or KEV) | 7 days |
| High (7.0–8.9) | 30 days |
| Medium (4.0–6.9) | 90 days |
| Low (<4.0) | best effort |

## Typosquat / malicious-package defense
- Socket.dev integration on PR (install-time review)
- npm `--ignore-scripts` default in CI
- PyPI typosquat list in CI deny-list

## Build hardening checklist
| Control | Status / target |
|---|---|
| OIDC to AWS (no static keys) | ✓ |
| Ephemeral runners | ✓ (GitHub-hosted) |
| Egress allowlist during build | ✓ via NCC tunnel |
| Reproducible build | partial (target Y2) |
| Two-person review for prod tag | ✓ branch protection |

## Container supply-chain
- Base: gcr.io/distroless/nodejs22-debian12 (digest-pinned)
- SBOM per image: Syft → CycloneDX
- Scan: Trivy in CI; fail on critical
- Sign: cosign keyless
- Registry: ECR with immutable tags + scan-on-push

## Third-party SaaS / vendor risk
| Vendor | SOC 2 type 2? | SBOM available? | Re-assess |
|---|:--:|:--:|---|
| Stripe | ✓ | n/a (managed) | annual |
| Cloudflare | ✓ | n/a | annual |
| Datadog | ✓ | n/a | annual |
| Sentry | ✓ | n/a | annual |
| Resend | ✓ | n/a | annual |
| Linear | ✓ | n/a | annual |

## Effort + cost
| Activity | Cost |
|---|--:|
| Snyk team plan | $25k/yr |
| Socket.dev | $10k/yr |
| Dependency-Track self-host | $0 + ops time |
| cosign / sigstore | $0 (free) |
| SBOM CI integration | 1 wk eng |
| SLSA L2 setup | 1 wk eng |
| Annual vendor review | 1 wk |
| **Y1 total** | **~$35k + 3 wk dev** |

## Standards alignment
- NIST 800-218 SSDF — practices PO/PS/PW/RV mapped
- EO 14028 — SBOM ready
- EU CRA (2027) — SBOM + vuln disclosure aligned
- ISO 27001 A.5.20 (supplier) covered

## Risk if skipped
- log4shell-class incident (pinned dep but unmonitored)
- xz-utils-class supply-chain backdoor (unsigned dep)
- Customer contract block (no SBOM = no enterprise deal)
- FedRAMP / EU CRA non-compliance

## 90-day plan
1. Tool selection (week 1–2)
2. SBOM in CI (week 2–3)
3. Sigstore signing (week 3–4)
4. Renovate auto-PR (week 4)
5. Dependency-Track stand-up (week 5–6)
6. Vendor risk register (week 6–8)
7. SLSA L2 verification (week 9)
8. SBOM publication path (week 10–12)
```

## Verification
- SBOM format + tool chosen.
- SLSA target level declared.
- Dep policy enforceable in CI.
- SCA tooling + SLA defined.
- Build hardening + container chain covered.
