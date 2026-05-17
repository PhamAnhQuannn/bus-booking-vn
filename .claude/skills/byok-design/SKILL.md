---
name: byok-design
description: Bring-Your-Own-Key — customer imports their own key material (RSA-OAEP wrapped) into your CMEK so the master key never originated on your infrastructure. Outputs to `docs/security/byok-design-<project>.md`. Reads `/project-classify` to skip XS/S/M. Use when user says "BYOK", "bring your own key", "import key material", "key import ceremony", "EXTERNAL origin key", "BSI C5", "SecNumCloud", "DORA key control", "/byok-design", or after a F500 / EU-sovereign prospect rejects CMEK as "still your keys".
output_size:
  XS: skip
  S: skip
  M: skip
  L: 4h
  XL: 8h
---

# /byok-design — Bring-Your-Own-Key Import

## Why you'd care

The same enterprise that accepted CMEK last year now wants BYOK because their compliance team read BSI C5 / SecNumCloud / DORA and learned that "customer-managed" still means the key originated in your provider's HSM — and a provider compromise still touches the root. BYOK closes that gap: customer generates the key material on their own HSM, wraps it with your KMS's public import key, ships you the ciphertext, you import without ever seeing plaintext. If you can't offer BYOK, the EU-sovereign / German / French / regulated-finance deals walk to a competitor who can. Retrofitting BYOK into a system that wasn't designed for it means rewriting the key-creation path, the rotation runbook, the destroy semantics, and the DR procedure simultaneously.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS / S / M → SKIP.
2. `/cmek-design` ran — BYOK is a CMEK *variant*, not a replacement.
3. Cloud KMS supports key import: AWS KMS (`Origin=EXTERNAL`), GCP Cloud KMS (import jobs on HSM-protected keys), Azure Key Vault Managed HSM (BYOK via key-exchange key).
4. Audit log captures import / disable / destroy events (`/audit-log-design`).
5. Legal: DPA template has BYOK clause draft (revocation semantics, grace window, data-loss acknowledgement).

## Inputs
- Regulatory driver(s): BSI C5, SecNumCloud (ANSSI), UK FCA, EU DORA, Schrems II
- Customer HSM capability (do they have on-prem HSM, AWS CloudHSM, Thales, Entrust, YubiHSM)
- Wrapping algorithm support: RSA-OAEP SHA-256 (minimum), RSA-AES-KEY-WRAP (preferred for AES-256 material)
- Expected import frequency (per tenant: one-time at onboarding + per rotation event)
- Grace window for destroy (7 days minimum AWS; 24h minimum GCP; up to 30 days commitment)

## Process

1. **BYOK vs CMEK — what changes**:

   | Property | CMEK | BYOK |
   |---|---|---|
   | Key material origin | Provider HSM | Customer HSM |
   | `Origin` marker | `AWS_KMS` / `GOOGLE_DEFAULT` | `EXTERNAL` / `IMPORTED` |
   | Customer can prove sole provenance | No | Yes (HSM attestation) |
   | Auto-rotation | Provider rotates annually | Customer rotates; provider cannot |
   | Destroy semantics | Schedule deletion | Schedule deletion OR `DeleteImportedKeyMaterial` (instant cipher-rubble) |
   | Recovery if customer loses material | Provider re-generates | **No recovery — data lost** |
   | Compliance fit | SOC2, ISO 27001 | + BSI C5, SecNumCloud, DORA, Schrems II hard-mode |

   Document the "customer loses key material = data lost" risk in the DPA explicitly; this is the *feature*, not a bug.

2. **Import ceremony — RSA-OAEP wrapping flow (AWS KMS example, GCP/Azure analogous)**:

   ```
   Step 1 — Provider side (platform issues per-import single-use wrapping pair):
     AWS: kms:GetParametersForImport
       → returns: { PublicKey (RSA-4096), ImportToken, ParametersValidTo (24h) }
       → WrappingAlgorithm = RSAES_OAEP_SHA_256 (or RSA_AES_KEY_WRAP_SHA_256 for AES-256 material)
       → WrappingKeySpec = RSA_4096

   Step 2 — Customer side (their HSM, never touches platform):
     a) Generate 256-bit AES key material in HSM (or use existing)
     b) Export wrapped with platform's PublicKey under chosen WrappingAlgorithm
     c) HSM emits attestation: "this material exists only in this HSM"

   Step 3 — Customer ships to platform:
     - Wrapped ciphertext (binary)
     - ImportToken (echo back, opaque)
     - Attestation receipt (stored alongside in tenant key registry)

   Step 4 — Provider side imports:
     AWS: kms:ImportKeyMaterial(KeyId, EncryptedKeyMaterial, ImportToken, ExpirationModel)
       → ExpirationModel = KEY_MATERIAL_DOES_NOT_EXPIRE (default) OR KEY_MATERIAL_EXPIRES with TTL
       → KMS unwraps inside HSM boundary; platform never sees plaintext

   Step 5 — Verify:
     - DescribeKey → Origin=EXTERNAL, KeyState=Enabled
     - Test Encrypt+Decrypt round-trip with EncryptionContext
     - Tenant audit log entry: 'key.imported' with attestation hash
   ```

   The ImportToken + 24h expiration window prevents replay; the wrapping public key is *single-use*.

3. **Per-provider import API map**:

   | Step | AWS KMS | GCP Cloud KMS | Azure Key Vault Managed HSM |
   |---|---|---|---|
   | Create empty key | `CreateKey Origin=EXTERNAL` | `cryptoKeys.create` with `importOnly=true` | `keys/create kty=RSA-HSM` |
   | Get wrap key | `GetParametersForImport` | `importJobs.create` → returns `publicKey` | `keys/import/getKey-exchange-key` |
   | Import | `ImportKeyMaterial` | `cryptoKeyVersions.import` with `importJob` | `keys/import` with wrapped blob |
   | Verify origin | `DescribeKey.Origin == EXTERNAL` | `cryptoKeyVersions.get.importJob != null` | `keys/get` returns `hsmPlatform` |
   | Destroy material | `DeleteImportedKeyMaterial` (instant) | `cryptoKeyVersions.destroy` (24h grace) | `keys/delete` + purge protection window |

4. **Attestation capture — proof of sole provenance**:
   - Customer HSM signs an attestation: `{ key_id_at_customer, key_alg, key_length, hsm_serial, hsm_firmware, timestamp }` with HSM vendor cert chain.
   - Platform stores attestation receipt in tenant key registry table alongside `kek_resource_id`.
   - Surfaced in trust portal: "Your KEK was imported under attestation <hash>; verify against your HSM logs."
   - For audits, attestation + your `ImportKeyMaterial` CloudTrail event together prove the chain.

5. **Tenant key registry schema** (extends `/cmek-design` registry):
   ```sql
   ALTER TABLE tenant_keys ADD COLUMN origin text NOT NULL DEFAULT 'CMEK';
     -- 'CMEK' | 'BYOK' | 'BYOK_EXPIRED'
   ALTER TABLE tenant_keys ADD COLUMN import_token_hash text;
   ALTER TABLE tenant_keys ADD COLUMN attestation_receipt jsonb;
   ALTER TABLE tenant_keys ADD COLUMN material_expires_at timestamptz; -- null if non-expiring
   ALTER TABLE tenant_keys ADD COLUMN destroy_scheduled_at timestamptz;
   ALTER TABLE tenant_keys ADD COLUMN destroy_grace_window interval NOT NULL DEFAULT '7 days';
   ```
   Index on `(origin, material_expires_at)` for the expiration-monitor cron.

6. **Revocation semantics — disable vs destroy, with grace window**:

   | Action | What happens | Reversible? | Grace |
   |---|---|---|---|
   | `DisableKey` | KMS rejects all ops; DEK cache TTL until full denial | Yes — re-enable | Instant |
   | `ScheduleKeyDeletion` (CMEK + BYOK) | Key destroyed after N days | Yes within N days | 7-30d configurable |
   | `DeleteImportedKeyMaterial` (BYOK only) | Material wiped immediately; key skeleton remains | Yes only if customer re-imports same material | Instant |
   | Customer-side material loss | If no platform-copy and material never re-importable | **No** — data lost | None |

   Tenant-facing control: dashboard exposes `Disable` (instant, reversible) and `Schedule destroy in [7|14|30] days`. The "destroy now" button requires typed confirmation + secondary auth + audit log "tenant.key.destroy.confirmed" event.

7. **Tenant-initiated rotation** — customer ships new material, platform pivots:
   - New `tenant_keys` row created with `version = old.version + 1`, same `tenant_id`, new wrapped material imported.
   - DEKs continue under old KEK for read; new writes use new KEK.
   - Lazy re-encryption: background job re-wraps DEKs under new KEK as records are touched, or on-demand "force re-key" job for compliance windows.
   - Old key disabled (not destroyed) until re-encryption fully drains — destroying too early bricks unread data.
   - See `/hsm-rotation-policy` for cadence + ceremony.

8. **Material-expiration monitor** — when `KEY_MATERIAL_EXPIRES` chosen:
   - Cron: scan `tenant_keys WHERE material_expires_at < now() + interval '30 days'`.
   - Notify tenant security contact at T-30d, T-14d, T-7d, T-1d.
   - At T-0: AWS auto-expires material; KMS returns errors; tenant has lost-data risk if not re-imported.
   - Recommend default = `KEY_MATERIAL_DOES_NOT_EXPIRE` and rotate via ceremony instead.

9. **DR / backup interaction — the hard case**:
   - Backups encrypted under tenant BYOK key are unreadable if customer destroys material.
   - DPA must state: "Customer-initiated key destroy renders backups within the residency region permanently unrecoverable after grace window."
   - Cross-region DR replica: if same multi-Region KMS key with imported material, replicate import into replica region under same procedure (separate `GetParametersForImport` per region — wrap keys are region-bound).
   - Export-on-destroy option: offer tenant a final encrypted export wrapped with a tenant-supplied public key before destroy executes (controlled-decryption escape hatch, fully audited).

10. **Anti-patterns**:
    - Storing customer-provided plaintext material anywhere — even briefly, even in memory beyond the import call — defeats BYOK
    - Using the same wrapping key across multiple imports — replay risk
    - Accepting key material over email / Slack / unencrypted upload — must be via signed API or in-person HSM-to-HSM
    - No attestation captured — cannot prove provenance to auditor
    - Auto-rotation enabled on `Origin=EXTERNAL` key — provider cannot rotate; misconfiguration risk
    - Marketing "BYOK" while platform retains shadow copy of plaintext material — fraud
    - No grace window on destroy — single fat-finger destroys live data
    - Forgetting backups encrypted under destroyed key are unreadable — surprise data-loss incident

## Output Format — `docs/security/byok-design-<project>.md`

```markdown
# BYOK Design — <project>
**Date:** <YYYY-MM-DD> | **Owner:** <security/platform team>

## Regulatory drivers
- BSI C5 (Germany), SecNumCloud (France/ANSSI), UK FCA, EU DORA, Schrems II hard-mode
- Cited tenants: <enterprise prospects requiring BYOK>

## Supported wrapping
- AWS KMS: RSAES_OAEP_SHA_256, RSA_AES_KEY_WRAP_SHA_256
- GCP: RSA-OAEP-3072-SHA256 import jobs (HSM protection level)
- Azure: RSA-HSM key-exchange-key wrap

## Import ceremony
1. Platform issues single-use wrap pair (24h TTL) via `GetParametersForImport`
2. Customer HSM generates material, wraps under PublicKey, emits attestation
3. Customer transmits {wrapped_material, ImportToken, attestation} over signed API
4. Platform `ImportKeyMaterial` — KMS unwraps inside HSM; platform never sees plaintext
5. Round-trip Encrypt+Decrypt test with EncryptionContext
6. Audit entry: `key.imported {tenant_id, key_arn, attestation_hash}`

## Tenant key registry
- Columns: origin, import_token_hash, attestation_receipt, material_expires_at,
  destroy_scheduled_at, destroy_grace_window
- Origin: 'CMEK' | 'BYOK' | 'BYOK_EXPIRED'
- Default expiration: KEY_MATERIAL_DOES_NOT_EXPIRE (rotate via /hsm-rotation-policy instead)

## Revocation
- Disable: instant, reversible, DEK cache TTL ≤ 10 min
- Schedule destroy: tenant-chosen 7|14|30d grace
- DeleteImportedKeyMaterial: requires typed confirm + secondary auth + audit
- Customer material loss: data permanently unrecoverable (DPA-disclosed)

## Rotation
- New version per import (version++); see /hsm-rotation-policy for cadence
- Lazy re-encryption: DEKs re-wrapped on next write
- Old KEK disabled (not destroyed) until re-encryption drains
- Force re-key job available for compliance-driven hard cuts

## DR / backup
- Backups under BYOK key unreadable post-destroy (DPA-disclosed)
- Multi-Region KMS: separate import per region (wrap keys region-bound)
- Export-on-destroy: optional tenant-pubkey final export before destroy

## API map
(provider-specific table per Process #3)

## Audit events emitted (→ /audit-log-design)
- key.import.requested  (GetParametersForImport call)
- key.import.completed  (ImportKeyMaterial success)
- key.import.failed     (token expired / wrap mismatch)
- key.disabled
- key.destroy.scheduled
- key.destroy.executed
- key.material.expiring (T-30/14/7/1)

## DPA clause draft
"Customer Key Material imported under BYOK ceremony is held exclusively within
provider-attested HSM boundary; platform never accesses plaintext. Customer
revocation (Disable / DeleteImportedKeyMaterial / ScheduleKeyDeletion) takes
effect within stated grace window. Backups and replicas encrypted under
destroyed Customer Key Material are permanently unrecoverable; Customer
acknowledges this is the intended security property."
```

## Boundaries
- BYOK is the *import* path. The CMEK skeleton (KEK/DEK hierarchy, EncryptionContext, DEK cache, policy templates) is `/cmek-design` — do not duplicate.
- Rotation cadence, ceremony script, dual-control, m-of-n quorum is `/hsm-rotation-policy`.
- Region routing of imports is `/data-residency-design`.
- Audit event schema is `/audit-log-design`; this skill only specifies which events to emit.
- Key-compromise / break-glass during import is `/incident-commander-runbook`.

## Re-run Behavior
- Re-run when: new provider added (Azure on top of AWS), new wrapping algorithm supported, regulatory regime added (DORA after originally targeting GDPR-only), or first BYOK customer onboarding reveals ceremony friction.
- Preserve `## Tenant-specific notes` section and signed DPA clauses across re-runs.
- Diff section appended at top on each re-run.

## Auto-chain
- Prereq: `/cmek-design` (BYOK is a CMEK variant; cannot exist without the envelope hierarchy)
- Prereq: `/tenant-isolation-design`, `/data-residency-design`, `/audit-log-design`
- Followed by: `/hsm-rotation-policy` (rotation of imported material; ceremony reused)
- Cross-ref: `/incident-commander-runbook` (key-compromise: imported-material destroy is harder to reverse than CMEK)

## Verification
- `tenant_keys.origin = 'BYOK'` rows have non-null `attestation_receipt` and `import_token_hash`.
- Platform code path for import never logs / persists / forwards plaintext key material.
- `GetParametersForImport` wrap key is single-use; second import requires new call.
- Round-trip Encrypt+Decrypt with EncryptionContext succeeds before tenant marked active.
- Disable path: tenant action → KMS Disable → all reads error within DEK cache TTL.
- Destroy path: requires typed confirmation + secondary auth + grace window enforced server-side.
- Material-expiration monitor cron tested with synthetic T-30/14/7/1 fixtures.
- DPA clause matches actual technical revocation semantics (no overpromise, no underclaim).
- Audit events emitted on every state transition; no silent path.
- Cross-region BYOK: each region has its own attested import (no plaintext crossing regions).

## Example Trigger
> "BSI C5 audit asked us to prove the EU customer's key never originated in AWS. Run /byok-design."

> "Prospect rejected CMEK because 'the key was still born on your provider'. Design BYOK."

> "DORA goes live and three EU banks want bring-your-own-key before signing. Spec the import ceremony."
