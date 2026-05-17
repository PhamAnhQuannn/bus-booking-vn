---
name: hsm-rotation-policy
description: Key rotation cadence, dual-control ceremony, m-of-n quorum, HSM partition design, and audit-trail requirements per NIST SP 800-57 cryptoperiods and FIPS 140-3 Level 3+ controls. Outputs to `docs/security/hsm-rotation-policy-<project>.md`. Reads `/project-classify` to skip XS/S/M. Use when user says "key rotation", "rotation cadence", "cryptoperiod", "dual control", "m-of-n quorum", "HSM partition", "FIPS 140-3", "key ceremony", "root of trust", "/hsm-rotation-policy", or when CMEK / BYOK keys exist but rotation runbook is missing.
output_size:
  XS: skip
  S: skip
  M: skip
  L: 2h
  XL: 4h
---

# /hsm-rotation-policy — Rotation Cadence + Key Ceremony

## Why you'd care

Auditors don't grade you on "we have CMEK" — they grade you on "show me the rotation ceremony log from last quarter, who attended, the m-of-n quorum used, and the witness signature." Without a written + executed rotation policy, SOC2 finds it, ISO 27001 finds it, FedRAMP rejects, BSI C5 / SecNumCloud / DORA reject harder. Worse, when a key compromise actually happens, your incident commander needs the rotation runbook ready — improvising mid-incident with dual-control HSM operations is how data gets lost. Write it once, drill it quarterly, sleep at night.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS / S / M → SKIP (shared platform key rotation handled by provider).
2. `/cmek-design` ran (and optionally `/byok-design`) — rotation policy applies to keys those skills designed.
3. HSM platform identified: AWS CloudHSM cluster, AWS KMS (FIPS 140-2 L2 default / L3 in CloudHSM-backed custom key stores), GCP Cloud HSM (FIPS 140-2 L3), Azure Managed HSM (FIPS 140-3 L3), or on-prem Thales / Entrust / YubiHSM.
4. Personnel identified: minimum 3 named key custodians + 1 witness role + 1 auditor role.
5. `/audit-log-design` ran — rotation events must land in tamper-evident audit log.

## Inputs
- Key inventory from `/cmek-design` + `/byok-design` (KEK list, per tenant, per region)
- Compliance regime requirements (FIPS 140-3 level, NIST SP 800-57 cryptoperiod targets)
- Personnel availability for quorum (m-of-n typically 2-of-3 or 3-of-5)
- Acceptable downtime per rotation (ideally zero; design accordingly)
- Incident-driven rotation budget (how fast can we rotate every tenant key under duress)

## Process

1. **Cryptoperiod table — NIST SP 800-57 Part 1 Rev 5 §5.3 derived**:

   | Key class | Use period (originator) | Use period (recipient) | Max total | Trigger to rotate |
   |---|---|---|---|---|
   | Symmetric DEK (data encrypting) | ≤ 2 years | up to 5 years | 7 years | epoch boundary; on KEK rotation (lazy) |
   | Symmetric KEK (key encrypting) | ≤ 2 years | ≤ 2 years | 2 years | annual scheduled |
   | RSA-4096 wrapping key (BYOK import) | ≤ 2 years | single-use | 24h per import | per ceremony |
   | TLS server key | ≤ 1 year | ≤ 1 year | 1 year | cert renewal (ACME) |
   | Signing key (JWT, webhooks) | ≤ 1 year | overlap 90d | 1 year | overlap rotation (key-id in header) |
   | Root-of-trust HSM key | ≤ 5 years | n/a | per HSM lifecycle | hardware EOL / compromise only |

   Defaults for SaaS-grade enterprise: KEK annual, DEK lazy on KEK rotation, signing keys annual with 90-day overlap, root every 5y or on HSM replacement.

2. **Rotation trigger taxonomy**:

   | Trigger | Cadence | Quorum required | Downtime window |
   |---|---|---|---|
   | Scheduled (annual) | Calendar quarter Q1/Q3 | 2-of-3 | zero — overlap rotation |
   | On-demand (tenant request) | within 30 days of request | 2-of-3 | zero |
   | Incident-driven (suspected compromise) | within 4 hours of declaration | 3-of-5 + IC sign-off | brief — accept ciphertext re-wrap latency |
   | Personnel-change (custodian departure) | within 14 days | 2-of-3 + new custodian onboarded | zero |
   | Algorithm deprecation (e.g. RSA-2048 → RSA-4096) | within compliance deadline | 2-of-3 | per-tenant cutover |
   | Annual mandatory (provider auto-rotation) | provider-driven | n/a | zero — provider transparent |

3. **HSM partition design — FIPS 140-3 Level 3+**:
   - Production partition: tenant KEKs live here; access only via dual-authenticated session
   - Staging partition: pre-production keys, never wrap real customer DEKs
   - Ceremony partition: temporary partition spun up for each rotation; destroyed after
   - Each partition has its own crypto officer (CO) credential set; never share COs across partitions
   - FIPS 140-3 Level 3 minimum for regulated tenancies; Level 4 if available (Thales Luna 7 PCIe HSM, Entrust nShield Solo XC)
   - For AWS: use CloudHSM-backed custom key store for L3; default KMS is L2

4. **Dual-control + m-of-n quorum**:
   - Crypto officer (CO) credentials sharded via Shamir Secret Sharing or HSM-native m-of-n (`cloudhsm_mgmt_util quorum 2 3`)
   - Minimum: 2-of-3 for routine rotation; 3-of-5 for incident or root-of-trust operations
   - Quorum members named in the policy doc; departure triggers re-share ceremony (see Process #2 trigger row)
   - No single operator can perform: key destroy, partition delete, root export, policy change
   - Quorum session logged with timestamp + each participant's authentication event
   - Witness role: separate person observes ceremony, signs witness attestation, has no CO credential

5. **Ceremony script — paste into output doc as artifact**:

   ```
   ROTATION CEREMONY — KEK ROTATION — <tenant_id> / <region>
   Date: <YYYY-MM-DD>    Window: <HH:MM-HH:MM UTC>
   Trigger: [SCHEDULED | ON-DEMAND | INCIDENT | PERSONNEL | DEPRECATION]
   Old key id/version: <arn>:v<N>      New key id/version: <arn>:v<N+1>

   Roles (one person per role; no doubling):
     Crypto Officer A (CO-A): <name, employee_id>
     Crypto Officer B (CO-B): <name, employee_id>
     Crypto Officer C (CO-C, standby): <name, employee_id>
     Witness:                <name, employee_id>
     Auditor (read-only):    <name, employee_id>
     Incident Commander (incident path only): <name>

   Pre-flight checks (Auditor confirms):
     [ ] Tenant audit log open in second pane
     [ ] CloudTrail / Cloud Audit Logs streaming verified
     [ ] DEK cache drain window scheduled
     [ ] Rollback procedure printed and present
     [ ] No active incident on dependent services

   Execution (CO-A reads, CO-B confirms, Witness observes):
     1. CO-A authenticates to HSM partition
     2. CO-B authenticates (quorum 2-of-3 satisfied)
     3. CO-A executes: <provider-specific create-new-version command>
        AWS: aws kms create-key ... --origin EXTERNAL (BYOK) or rotate-on-demand (CMEK)
        GCP: gcloud kms keys versions create --primary
        Azure: az keyvault key rotate
     4. CO-B verifies new version active: DescribeKey / get returns expected state
     5. Round-trip test: Encrypt + Decrypt sample with EncryptionContext
     6. App config flips primary key reference (zero-downtime; old version stays for read)
     7. Lazy re-encryption job enqueued
     8. Witness signs ceremony record

   Post-flight (Auditor):
     [ ] Audit log entry verified present: key.rotated {old_version, new_version, quorum_members, witness}
     [ ] CloudTrail entry verified present
     [ ] Old version status: Enabled (read-only path) — NOT destroyed
     [ ] Re-encryption job dashboard reachable
     [ ] Tenant notification sent (if customer-visible rotation)

   Sign-off:
     CO-A: __________________  CO-B: __________________
     Witness: ________________  Auditor: ________________
     IC (incident only): ________________
   ```

6. **Audit trail requirements** — every rotation event captures:

   | Field | Source |
   |---|---|
   | event_id | UUIDv7 |
   | ts | ISO-8601 UTC (HSM clock, not app clock) |
   | tenant_id | from tenant key registry |
   | key_arn / resource_name | provider-specific |
   | old_version | KEK version before |
   | new_version | KEK version after |
   | trigger | SCHEDULED / ON-DEMAND / INCIDENT / PERSONNEL / DEPRECATION |
   | quorum_members | array of {employee_id, auth_method, auth_timestamp} |
   | witness | {employee_id, signature_hash} |
   | auditor | {employee_id} |
   | ceremony_partition | HSM partition id |
   | provider_request_id | CloudTrail / Cloud Audit Logs request id |
   | attestation_hash | HSM-side attestation receipt |
   | outcome | success / aborted / failed |
   | abort_reason | text if aborted |

   Stream to `/audit-log-design` audit log; hash-chained per tenant; anchored daily to WORM store.

7. **Break-glass procedure** — when scheduled rotation can't wait:

   ```
   BREAK-GLASS KEK ROTATION
   Authority: Incident Commander or VP-Security
   Quorum override: 3-of-5 + IC written approval (Slack #incident-<id> recorded)
   Skipped steps: NONE — break-glass is faster scheduling, not weaker controls
   Compressed timeline:
     T+0:00  Declare incident, page quorum
     T+0:30  Quorum assembled (remote OK via HSM remote-management with attestation)
     T+1:00  Ceremony executed (Process #5)
     T+1:30  Re-encryption job kicked off at high parallelism
     T+4:00  Verified: old KEK disabled, all hot data re-wrapped under new KEK
     T+24:00 Post-incident review: BR-001 template in /incident-commander-runbook
   ```

   Document explicit prohibition: break-glass does NOT skip quorum, does NOT skip witness, does NOT skip audit log.

8. **Zero-downtime rotation pattern** — overlap windows:
   - Phase 1: new KEK version created, marked `pending`
   - Phase 2: app config update — new version is `primary` for new writes; old version `read-only-active` for existing ciphertexts
   - Phase 3: lazy re-encryption job rewraps DEKs as records are touched (or aggressive parallel job for incident path)
   - Phase 4: old version transitions `read-only-deprecated` after N days of no decrypt activity
   - Phase 5: old version `disabled` (not destroyed — keep for forensic recovery)
   - Phase 6: old version `scheduled_destroy` after retention horizon (typically 90 days post-disable)

9. **Personnel & training**:
   - Custodian onboarding ceremony: separate event, captures HSM CO credential issuance, recorded
   - Custodian offboarding ceremony: revoke CO credentials, re-share quorum among remaining + new custodian
   - Annual drill: synthetic rotation on staging partition, full ceremony script run, witness signs, auditor reviews
   - Document training records in `docs/security/key-custodian-training-log.md`
   - Minimum 2 custodians at any time; alert if headcount drops to 2 (single failure mode)

10. **Anti-patterns**:
    - Single operator can rotate (no quorum) — auditor immediate finding
    - Witness is same person as CO — defeats separation of duties
    - Destroy old version immediately on rotation — bricks pending reads; lose forensic trail
    - Rotation runbook lives only in someone's head — no ceremony reproducibility
    - Skipping audit log on "minor" rotations — there are no minor rotations
    - Reusing CO credentials across partitions — single credential compromise = full breach
    - Rotation done over Zoom screen-share with HSM admin tool visible — credential exposure
    - No drill — first time the runbook is executed under pressure is during an actual incident
    - Annual rotation that hasn't happened in 18 months — auditor finding, lapsed compliance
    - FIPS 140-2 L2 used where regulation demands L3 — silent compliance gap

## Output Format — `docs/security/hsm-rotation-policy-<project>.md`

```markdown
# HSM Rotation Policy — <project>
**Date:** <YYYY-MM-DD> | **Owner:** <security/platform team>
**Applies to:** keys designed in /cmek-design + /byok-design

## Cryptoperiods (NIST SP 800-57 Part 1 Rev 5 §5.3)
- Symmetric KEK: 2 years max, annual scheduled rotation
- Symmetric DEK: lazy rotation on KEK rotation
- RSA-4096 wrap key (BYOK import): single-use, 24h TTL
- TLS server key: 1 year (ACME-managed)
- Signing key (JWT, webhooks): 1 year with 90d overlap
- Root-of-trust HSM key: 5 years or HSM lifecycle

## HSM platform
- Production: <AWS CloudHSM cluster | GCP Cloud HSM | Azure Managed HSM | Thales Luna | ...>
- FIPS 140-3 level: <L3 | L4>
- Partitions: production / staging / ceremony (ephemeral)

## Triggers + quorum
| Trigger | Cadence | Quorum | Downtime |
|---|---|---|---|
| Scheduled | annual Q1/Q3 | 2-of-3 | zero |
| On-demand (tenant) | ≤30 days | 2-of-3 | zero |
| Incident | ≤4 hours | 3-of-5 + IC | brief |
| Personnel | ≤14 days | 2-of-3 + new custodian | zero |
| Algorithm deprecation | per deadline | 2-of-3 | per-tenant cutover |

## Quorum members
- CO-A: <name>      CO-B: <name>      CO-C: <name>
- Witness pool: <names>      Auditor pool: <names>
- IC (incident path): <name>

## Ceremony script
(Process #5 verbatim — printable artifact)

## Audit trail
- Every rotation emits `key.rotated` event into /audit-log-design log
- Fields: Process #6 table
- Hash-chained per tenant; daily WORM anchor

## Zero-downtime overlap
- Phases: pending → primary → read-only-active → read-only-deprecated → disabled → scheduled_destroy
- Old version retained ≥90 days post-disable for forensic recovery

## Break-glass
- Authority: IC or VP-Security
- Quorum NOT weakened (3-of-5 + written approval)
- Timeline: T+0 declare → T+1 ceremony done → T+4 re-encryption verified

## Drills
- Annual full ceremony drill on staging partition
- Last drill: <date>      Next drill: <date>
- Drill record archived in /docs/qa/

## Training log
- Custodian roster: <link to docs/security/key-custodian-training-log.md>
- Onboarding ceremony recorded; offboarding triggers re-share

## Compliance map
- SOC2 CC6.1, CC6.7
- ISO 27001 A.10.1.2
- FIPS 140-3 L<n> partition usage
- NIST SP 800-57 Part 1 §5.3 cryptoperiod compliance
- BSI C5 KRY-01..04 (if EU sovereign)
- DORA Art 9 (if EU financial)
```

## Boundaries
- This skill specifies cadence + ceremony + quorum + audit fields. It does *not* re-specify key hierarchy (`/cmek-design`), import flow (`/byok-design`), audit-log storage (`/audit-log-design`), or incident command flow (`/incident-commander-runbook`).
- HSM procurement and partition provisioning is out of scope — assumed done.
- Cert / TLS rotation overlap is noted but ACME automation lives in deployment runbooks.

## Re-run Behavior
- Re-run when: new key class added (signing key joining KEK list), HSM platform migration (KMS → CloudHSM L3), quorum membership change, regulatory regime tightens (DORA enactment), or post-incident review surfaces a runbook gap.
- Preserve `## Quorum members`, `## Drills` history, and `## Training log` across re-runs (manual edit zones).
- Append diff section on each re-run.

## Auto-chain
- Prereq: `/cmek-design` (rotation needs keys to rotate)
- Prereq: `/audit-log-design` (rotation events must land in tamper-evident log)
- Pairs with: `/byok-design` (imported-material rotation reuses ceremony with import-ceremony substeps)
- Cross-ref: `/incident-commander-runbook` (break-glass path; key-compromise scenario)
- Cross-ref: `/dr-drill` (rotation drill cadence aligns with DR drill cadence — same quarterly window often)

## Verification
- Quorum enforced at HSM level (2-of-3 minimum); single-operator rotation fails closed.
- Witness role filled by non-CO person; signature captured per ceremony.
- Every rotation produces audit log entry with full field set (Process #6).
- Annual drill executed; record archived; auditor sign-off present.
- Old key versions retained ≥90 days post-disable before destroy.
- Break-glass procedure does not weaken quorum or witness requirements.
- FIPS 140-3 level matches highest tenant compliance requirement.
- Custodian roster ≥3; alert wired for headcount drop.
- No CO credential reuse across partitions (production / staging / ceremony separate).
- Zero-downtime overlap verified in last drill (decrypt under old version still works mid-rotation).
- Cryptoperiods table reflects NIST SP 800-57 Part 1 Rev 5 §5.3 with no looser values.

## Example Trigger
> "SOC2 auditor asked for our key rotation ceremony procedure and last drill record. Run /hsm-rotation-policy."

> "We have CMEK + BYOK but no written rotation runbook — design it before the BSI C5 audit next month."

> "Custodian X is leaving the team. We need the re-share + offboarding ceremony in writing. /hsm-rotation-policy."
