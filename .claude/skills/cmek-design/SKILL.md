---
name: cmek-design
description: Customer-Managed Encryption Keys (AWS KMS / GCP Cloud KMS / Azure Key Vault) so each tenant's data is wrapped under a key whose policy boundary they (not you) ultimately control. Outputs to `docs/security/cmek-design-<project>.md`. Reads `/project-classify` to skip XS/S/M. Use when user says "CMEK", "customer-managed keys", "KMS per tenant", "envelope encryption", "key hierarchy", "/cmek-design", or before first F500 / EU-sovereign / regulated enterprise sale.
output_size:
  XS: skip
  S: skip
  M: skip
  L: 4h
  XL: 8h
---

# /cmek-design — Customer-Managed Encryption Keys

## Why you'd care

Enterprise procurement asks "can you prove our data is encrypted under a key only we can revoke?" — and "we use platform-managed AES-256" loses the deal because it means your DBAs and your cloud provider's staff can read tenant data. CMEK pushes the key-policy boundary into the customer's control plane: revoke the key, the ciphertext is rubble. Without CMEK, F500/EU-sovereign/healthcare deals stall at security review; retrofitting it after launch means re-encrypting every blob and row, double-writing during cutover, and rotating every audit-logged secret in flight.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS / S / M → SKIP (shared platform keys fine until enterprise plan exists).
2. Tenant model exists (`tenant_id`); `/tenant-isolation-design` ran.
3. Cloud KMS available in target regions (`/data-residency-design` ran or pending).
4. Audit log captures key events (`/audit-log-design` ran).

## Inputs
- Cloud provider(s) at launch (AWS / GCP / Azure / multi-cloud)
- Data classes to wrap (DB at rest, object storage blobs, backups, search indexes, secrets)
- Per-tenant vs per-region vs per-data-class key granularity
- Latency budget per read/write (KMS API adds 5-20ms per call without DEK caching)
- Compliance regime (FIPS 140-3 level required, FedRAMP, BSI C5, SecNumCloud, DORA)
- Cost ceiling (each AWS KMS CMK = $1/month + $0.03 per 10K requests)

## Process

1. **Key hierarchy — KEK / DEK split (envelope encryption)**:

   | Layer | What it is | Where it lives | Lifetime |
   |---|---|---|---|
   | Root / Master | Cloud HSM root, never exported | KMS / Key Vault HSM partition | provider-managed |
   | KEK (Key Encryption Key) | Per-tenant CMK; wraps DEKs | AWS KMS CMK / GCP CryptoKey / Azure Key | rotate annually |
   | DEK (Data Encryption Key) | Per-object or per-tenant-per-day AES-256 | Encrypted-at-rest beside ciphertext | rotate per object or per epoch |

   Rule: KMS never sees plaintext data. App calls `GenerateDataKey` → gets `{plaintext_dek, encrypted_dek}` → encrypts payload with plaintext_dek → stores `{ciphertext, encrypted_dek}` → discards plaintext_dek. Decrypt path: `Decrypt(encrypted_dek)` → plaintext_dek → decrypt ciphertext.

2. **Per-tenant CMK convention** — ARN / resource-name schema:

   | Cloud | Resource pattern |
   |---|---|
   | AWS | `arn:aws:kms:<region>:<account>:key/<uuid>` aliased as `alias/tenant-<tenant_id>-<region>` |
   | GCP | `projects/<p>/locations/<region>/keyRings/tenants/cryptoKeys/tenant-<tenant_id>` |
   | Azure | `https://<vault>.vault.azure.net/keys/tenant-<tenant_id>/<version>` |

   Tenant directory table stores `(tenant_id, region, kek_resource_id, kek_origin)`. `kek_origin = 'CMEK'` (platform-created CMK) vs `'BYOK'` (customer-imported, see `/byok-design`).

3. **Key policy boundaries — admin vs use split**:

   AWS KMS key policy template (paste into `docs/security/cmek-design-<project>.md` as artifact):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "TenantAdmin",
         "Effect": "Allow",
         "Principal": {"AWS": "arn:aws:iam::<tenant-account>:role/KeyAdmin"},
         "Action": ["kms:Disable*","kms:Enable*","kms:ScheduleKeyDeletion","kms:CancelKeyDeletion","kms:PutKeyPolicy","kms:UpdateAlias"],
         "Resource": "*"
       },
       {
         "Sid": "PlatformUse",
         "Effect": "Allow",
         "Principal": {"AWS": "arn:aws:iam::<platform-account>:role/app-runtime-<region>"},
         "Action": ["kms:Encrypt","kms:Decrypt","kms:GenerateDataKey","kms:DescribeKey"],
         "Resource": "*",
         "Condition": {
           "StringEquals": {"kms:EncryptionContext:tenant_id": "<tenant_id>"}
         }
       },
       {
         "Sid": "DenyEverythingElse",
         "Effect": "Deny",
         "Principal": "*",
         "Action": "kms:*",
         "Resource": "*",
         "Condition": {"StringNotEquals": {"aws:PrincipalAccount": ["<tenant-account>","<platform-account>"]}}
       }
     ]
   }
   ```

   Three rules: (a) tenant admins can disable/destroy but never decrypt; (b) platform runtime can use but never administer; (c) `EncryptionContext` binds every operation to the correct tenant — cross-tenant Decrypt fails even with stolen ciphertext.

4. **Encryption context as tenant binding** — non-secret AAD on every op:
   - Every `Encrypt` / `GenerateDataKey` / `Decrypt` passes `EncryptionContext = {"tenant_id":"<id>","data_class":"<rows|blobs|backups>"}`.
   - Decrypt must supply the *same* context or KMS returns `InvalidCiphertextException`.
   - Logged into CloudTrail / Cloud Audit Logs — auditor sees which tenant accessed which key, when, by which principal.
   - Defends against confused-deputy: even if attacker steals a DEK ciphertext from tenant A and submits it to KMS as tenant B, decrypt fails.

5. **DEK cache to kill latency** — KMS at p99 is 20-50ms; do not call per row:
   - In-process LRU keyed by `(tenant_id, data_class, dek_id)`, value = `{plaintext_dek, expires_at}`.
   - TTL = 5-15 min; cap entries; clear on rotation.
   - `GenerateDataKey` called once per tenant per epoch (e.g. once per 1000 writes or once per 10 min, whichever first).
   - Decrypt path: look up `encrypted_dek` from row → check cache → if miss, KMS `Decrypt(encrypted_dek, context)` → cache → use.
   - Cache plaintext DEK in memory only; never disk; zero on process exit if possible.

6. **Dual-region key replication** — DR + residency:
   - AWS: multi-Region KMS keys (`MultiRegion=true`) for in-jurisdiction failover (e.g. `eu-west-1` ↔ `eu-central-1`). Never replicate cross-jurisdiction.
   - GCP: separate `CryptoKey` per region in same key ring; app routes by tenant region (see `/data-residency-design`).
   - Azure: Key Vault geo-redundancy by default within region pair; verify pair stays in legal jurisdiction.
   - Per-region KEK; DEK ciphertext stored beside payload so cross-region restore re-wraps DEKs under destination-region KEK.

7. **CloudTrail / Cloud Audit Logs integration**:
   - All KMS data-plane operations (`Encrypt`, `Decrypt`, `GenerateDataKey`) logged with: principal ARN, key ARN, `EncryptionContext`, source IP, request ID, success/error.
   - Stream to tenant-scoped audit log (see `/audit-log-design`) — tenant can view "every time the platform decrypted our data, by what principal, with what context".
   - Anomaly alerts: decrypt without matching encrypt within window; principal outside expected role set; cross-region decrypt; AccessDenied spikes.

8. **Cost model — be honest about scaling**:

   | Component | AWS KMS price (2026) | Per 1000-tenant platform |
   |---|---|---|
   | CMK | $1 / month / key | $1000/mo at 1 key per tenant |
   | Multi-region replica | $1 / region / month | +$1000/mo per extra region |
   | API request (Encrypt/Decrypt/GenerateDataKey) | $0.03 / 10K | depends on DEK cache hit-rate |
   | HSM-backed key (CloudHSM cluster) | ~$1.45/hour | ~$1050/mo flat (shared) |

   Mitigations: (a) DEK cache → 1000× fewer KMS calls; (b) per-tenant-per-region key, not per-data-class; (c) charge enterprise tier for CMEK so cost passes through.

9. **Provider-specific API name reference** — cite these in the output doc:

   | Operation | AWS KMS | GCP Cloud KMS | Azure Key Vault |
   |---|---|---|---|
   | Create KEK | `CreateKey` | `cryptoKeys.create` | `keys/create` |
   | Generate DEK | `GenerateDataKey` | `cryptoKeyVersions.encrypt` (wrap pattern) | `keys/wrapKey` |
   | Decrypt DEK | `Decrypt` | `cryptoKeyVersions.decrypt` | `keys/unwrapKey` |
   | Rotate | `EnableKeyRotation` (annual) | `cryptoKeys.updatePrimaryVersion` | `keys/rotate` |
   | Disable | `DisableKey` | `cryptoKeyVersions.patch state=DISABLED` | `keys/update enabled=false` |
   | Destroy | `ScheduleKeyDeletion` (7-30d) | `cryptoKeyVersions.destroy` (24h) | `keys/delete` + purge |

10. **Anti-patterns**:
    - Single platform-wide KEK with `tenant_id` only in column — same blast radius as no CMEK
    - No `EncryptionContext` — cross-tenant ciphertext swap works
    - DEK plaintext written to logs / spans / debug dumps — bypasses the entire scheme
    - App role has `kms:PutKeyPolicy` — platform can self-grant decrypt; defeats customer control
    - Same KEK used for hot data and backups — revoking key bricks live system AND DR
    - No DEK cache — KMS becomes critical-path latency + cost bomb
    - Cross-region KEK replica into different jurisdiction — residency violation

## Output Format — `docs/security/cmek-design-<project>.md`

```markdown
# CMEK Design — <project>
**Date:** <YYYY-MM-DD> | **Owner:** <security/platform team>

## Scope
- Data classes wrapped: DB rows (sensitive cols), object blobs, backups, search indexes
- Carve-outs: anonymized analytics (platform key), marketing site (none)
- Granularity: one KEK per (tenant_id, region)

## Key hierarchy
- Root: provider HSM (AWS KMS / GCP Cloud HSM / Azure Managed HSM)
- KEK: per tenant, per region, CMK-origin (BYOK upgrade: `/byok-design`)
- DEK: AES-256-GCM, per-tenant-per-epoch, cached 10 min

## Naming
- AWS alias: `alias/tenant-<tenant_id>-<region>`
- GCP: `projects/<p>/locations/<region>/keyRings/tenants/cryptoKeys/tenant-<tenant_id>`
- Azure: `https://<vault>.vault.azure.net/keys/tenant-<tenant_id>`

## Key policy
- Tenant admin: enable/disable/destroy; NO decrypt
- Platform runtime: encrypt/decrypt/generate-data-key; NO admin
- Cross-account deny default
- EncryptionContext required: {tenant_id, data_class}

## Envelope encryption
- `GenerateDataKey` per tenant-epoch; DEK cached in-process (LRU, 10 min)
- `{ciphertext, encrypted_dek, dek_id, context_hash}` stored together
- Decrypt: cache hit → reuse; miss → KMS Decrypt with same context

## Multi-region
- AWS multi-Region KMS keys within jurisdiction pair only
- Per-region KEK; DEK re-wrapped on cross-region restore
- No cross-jurisdiction replication (residency: see /data-residency-design)

## Audit
- All KMS data-plane ops → CloudTrail → tenant audit log (/audit-log-design)
- Anomaly alerts: decrypt-without-encrypt, cross-region decrypt, AccessDenied spike

## Cost
- ~$1/CMK/month × tenant × region
- DEK cache target hit-rate: ≥99% (caps KMS spend)
- Pass-through on enterprise tier pricing

## Rotation
- KEK: annual auto-rotation (provider-native) + on-demand (see /hsm-rotation-policy)
- DEK: per-epoch; re-encryption on KEK rotation = lazy (next write)

## Revocation
- Tenant disables KEK → reads return error within DEK cache TTL (≤10 min)
- Tenant schedules destroy → 7-30d grace; documented in DPA
- Backups encrypted under same KEK become unreadable on destroy — by design

## Provider API map
(table per Process #9, copy verbatim into doc)

## Verification checklist (mirrored from Verification section)
```

## Boundaries
- CMEK only — customer-imported key material is `/byok-design` scope.
- Rotation cadence + ceremony is `/hsm-rotation-policy` scope.
- Tenant region routing is `/data-residency-design` scope.
- Key-event audit-log schema is `/audit-log-design` scope; this skill only specifies what events to emit.
- This skill picks the *design*; runtime rotation runbook and break-glass procedure live in `/hsm-rotation-policy`.

## Re-run Behavior
- Idempotent on the output doc (re-run regenerates with updated date + diff section).
- Re-run when: new region added, new data class introduced, KMS pricing model changes, FIPS / FedRAMP boundary changes, or tenant requests BYOK upgrade (chain to `/byok-design`).
- Preserve manual edits inside `## Tenant-specific notes` section if present.

## Auto-chain
- Prereq: `/tenant-isolation-design`, `/data-residency-design`, `/audit-log-design`
- Pairs with: `/byok-design` (BYOK extends CMEK with customer-imported key material)
- Followed by: `/hsm-rotation-policy` (rotation cadence + ceremony for the CMKs designed here)
- Cross-ref: `/incident-commander-runbook` (key-compromise scenario uses the destroy path designed here)

## Verification
- Every encrypted payload stored with `{ciphertext, encrypted_dek, dek_id, encryption_context}`.
- Platform role policy has no `kms:Put*` / `kms:Schedule*` on tenant KEKs.
- Tenant admin role policy has no `kms:Decrypt` / `kms:GenerateDataKey`.
- EncryptionContext present on every KMS call; missing context → request fails closed.
- DEK plaintext never written to logs, traces, or persistent storage.
- DEK cache p99 hit-rate ≥ 99% measured in load test.
- CloudTrail captures every KMS data-plane op with tenant_id in context.
- Test: stolen ciphertext from tenant A submitted under tenant B context → `InvalidCiphertextException`.
- Test: tenant disables KEK → all reads error within cache-TTL window.
- No KEK replicated across legal jurisdictions.

## Example Trigger
> "We have a F500 healthcare prospect at security review and they want CMEK on PHI before signing. Run /cmek-design."

> "Procurement says 'data must be encrypted with keys we can revoke' — design the CMEK story."
