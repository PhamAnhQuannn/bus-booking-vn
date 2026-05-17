---
name: zero-trust-posture
description: Zero-trust architecture posture — identity-centric, never-trust-always-verify, micro-segmentation, BeyondCorp / NIST 800-207. Outputs to `docs/inception/zero-trust-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "zero trust", "BeyondCorp", "ZTNA", "NIST 800-207", "/zero-trust-posture", or for L+ enterprise / govtech.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /zero-trust-posture — Zero-Trust Architecture

Invoke as `/zero-trust-posture`. Identity-centric access; no implicit network trust. NIST SP 800-207 + Google BeyondCorp + DoD ZT Reference Architecture.

## Why you'd care

Perimeter-based security in 2026 is a posture every enterprise buyer's CISO will reject in the questionnaire. NIST 800-207 identity-centric architecture is the answer they expect and the design that survives the actual threat model.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S → SKIP
2. Read `docs/inception/threat-model-pre-<project>.md`.
3. Read `docs/inception/attack-surface-<project>.md`.
4. Read `docs/inception/regulatory-<project>.md` (FedRAMP / EO 14028).

## Inputs
- Workforce size + remote distribution.
- Cloud + on-prem mix.
- Customer requirement (FedRAMP, DoD CMMC, EU NIS2).
- BYOD vs managed device fleet.

## Process
1. **Five core tenets** (NIST SP 800-207):
   - All data sources + computing services treated as resources
   - All comm secured regardless of network location
   - Access granted per-session
   - Access determined by dynamic policy (identity, device, behavior, env)
   - Asset integrity + security monitored continuously
2. **Maturity model** (CISA Zero Trust Maturity Model v2):
   - **Traditional → Initial → Advanced → Optimal**
   - Pillars: Identity / Devices / Networks / Apps & Workloads / Data
   - Cross-cuts: Visibility & Analytics / Automation & Orchestration / Governance
3. **Identity layer**:
   - Single IdP (Okta, Auth0, Azure AD, Google) for workforce
   - SSO mandatory; passwordless + phishing-resistant MFA (FIDO2 / WebAuthn)
   - Conditional access policies (device + risk + geo)
   - JIT (just-in-time) elevation for admin
   - SCIM for joiner/mover/leaver
4. **Device layer**:
   - MDM (Jamf, Intune, Kandji) on every endpoint
   - Device posture check (OS version, disk encrypt, screen lock)
   - Device cert (mTLS) for high-trust apps
   - BYOD: container or browser-only access
5. **Network layer**:
   - Eliminate VPN as primary access (BeyondCorp model)
   - **ZTNA** (Zero Trust Network Access): Cloudflare Access, Tailscale, Twingate, Zscaler
   - Micro-segmentation in cloud (VPC + SG per-app)
   - mTLS service-to-service (Linkerd / Istio / AWS App Mesh)
6. **Application layer**:
   - All apps behind identity-aware proxy
   - SaaS via SSO + SCIM
   - Internal apps via ZTNA
   - API: OAuth2 / OIDC; JWT short-lived + refresh
7. **Data layer**:
   - Classification (public / internal / confidential / restricted)
   - Encryption at rest + in transit (per `/crypto-policy-pre`)
   - DLP on egress
   - Row-level / attribute-based access control
8. **Continuous evaluation**:
   - Risk score per session (impossible travel, new device, off-hours)
   - Re-auth on risk delta
   - Behavioral analytics (UEBA — Splunk / Datadog / Microsoft Sentinel)
9. **Reference architectures**:
   - **Google BeyondCorp** (workforce remote)
   - **DoD ZT Reference Architecture v2** (govtech)
   - **CISA Zero Trust Maturity Model v2**
   - **NIST SP 800-207** (ZTA architecture)
   - **NIST SP 1800-35** (implementing ZTA)
   - **EO 14028** mandates federal ZTA migration
10. **Phasing**:
    - Phase 0: SSO + MFA everywhere
    - Phase 1: Device MDM + posture
    - Phase 2: ZTNA replace VPN
    - Phase 3: mTLS + micro-seg in cloud
    - Phase 4: continuous risk + auto-remediation

## Output
Write `docs/inception/zero-trust-<project>.md`:

```markdown
# Zero-Trust Posture — <project>
**Date:** <YYYY-MM-DD>

## Driver
- FedRAMP Mod target Y2
- EO 14028 alignment
- 80% remote workforce
- Multi-cloud (AWS primary, GCP for BigQuery)

## Maturity baseline (current → target)
| Pillar | Current | Y1 target | Y2 target |
|---|---|---|---|
| Identity | initial | advanced | optimal |
| Devices | traditional | initial | advanced |
| Networks | initial | advanced | advanced |
| Apps & Workloads | initial | advanced | optimal |
| Data | initial | advanced | advanced |
| Visibility | initial | advanced | optimal |
| Automation | traditional | initial | advanced |
| Governance | initial | advanced | advanced |

## Identity layer
- IdP: Okta Workforce
- MFA: WebAuthn (YubiKey 5 + platform Touch ID)
- SSO: 100% workforce apps (no shared creds)
- Conditional access: device-trust + geo (block from countries A,B,C)
- JIT elevation: ConductorOne for AWS admin, 1-hr TTL
- SCIM: Okta → all SaaS for joiner/mover/leaver
- Customer auth: separate Auth0 tenant; magic-link + passkey

## Device layer
- MDM: Jamf (Mac) + Intune (Windows + iOS + Android)
- Posture: disk encrypt + OS version + screen lock + EDR (CrowdStrike)
- Device cert: SCEP-issued for ZTNA + mTLS apps
- BYOD: browser-only via Cloudflare Browser Isolation

## Network layer
- VPN deprecated Q3 (last app migrated to ZTNA)
- ZTNA: Cloudflare Access (workforce) + Tailscale (eng on-call)
- Cloud micro-seg: per-app VPC + SG least-priv
- Service mesh: Linkerd in EKS (mTLS auto)
- East-west traffic: encrypted + authz per call

## Application layer
- All SaaS: SSO + SCIM
- Internal apps: Cloudflare Access policy per app
- Public API: OAuth2 + OIDC + short-lived JWT (15 min) + refresh (7 d)
- Internal API: mTLS + JWT
- Admin console: SSO + MFA + IP allowlist + session record (BeyondCorp pattern)

## Data layer
- Classification: public / internal / confidential / restricted (per `/data-classification-scheme`)
- Encryption: per `/crypto-policy-pre`
- DLP: Nightfall on cloud storage + egress
- Row-level: PostgreSQL RLS per tenant
- Attribute-based: OPA for fine-grained authz

## Continuous evaluation
- Risk score: Okta + Cloudflare Access signals
- Triggers re-auth: impossible travel, new device, sensitive op
- UEBA: Datadog Cloud SIEM + custom rules
- Auto-remediation: high-risk → revoke session + alert

## Phasing roadmap
| Phase | Quarter | Outcome |
|---|---|---|
| 0 | Q1 | SSO + WebAuthn 100% |
| 1 | Q2 | MDM + posture on 100% devices |
| 2 | Q3 | ZTNA replace VPN |
| 3 | Q4 | mTLS service mesh + micro-seg |
| 4 | Y2 Q2 | UEBA + auto-remediation |

## Effort + cost
| Tool | Cost/yr |
|---|--:|
| Okta Workforce | $30k |
| Cloudflare Access + Browser Isolation | $25k |
| Jamf + Intune MDM | $20k |
| CrowdStrike EDR | $40k |
| Tailscale Business | $5k |
| Datadog SIEM | $35k |
| ConductorOne JIT | $15k |
| Nightfall DLP | $20k |
| **Y1 total** | **~$190k** |
| Eng time | ~3 mo for full migration |

## Standards alignment
- NIST SP 800-207 ZTA ✓
- NIST SP 1800-35 implementation ✓
- CISA ZTM v2 ✓
- EO 14028 ✓
- DoD ZT RA v2 (Y2 alignment for FedRAMP)
- ISO 27001 A.5.15 / A.8.2 access control ✓

## Risk if skipped
- Lateral movement on compromise (flat network)
- VPN single-point-of-failure
- FedRAMP / govtech disqualifies
- Insider risk uncontained
- EO 14028 non-compliance for fed customers

## 90-day plan
1. IdP audit + Okta hardening (week 1–2)
2. WebAuthn rollout (week 2–4)
3. MDM enrollment 100% (week 4–6)
4. Device posture enforcement (week 6–8)
5. ZTNA pilot (one app) (week 8–10)
6. ZTNA expansion (week 10–12)
7. VPN deprecation timeline (week 12)
```

## Verification
- All 5 NIST pillars addressed.
- Maturity baseline + target named.
- IdP + MFA strategy declared.
- ZTNA migration phased.
- Cost + effort estimate set.
