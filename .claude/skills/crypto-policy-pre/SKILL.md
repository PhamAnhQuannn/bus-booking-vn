---
name: crypto-policy-pre
description: Pre-build cryptography policy — algorithms, key mgmt, KMS choice, post-quantum readiness, FIPS 140-3. Outputs to `docs/inception/crypto-policy-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "crypto policy", "encryption standard", "key management", "FIPS", "post-quantum", "/crypto-policy-pre", or before storing/transmitting sensitive data.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /crypto-policy-pre — Cryptography Policy

## Why you'd care

The MD5 hash sitting in a "legacy" code path because nobody set an algorithm allowlist is what blocks SOC 2 renewal six months from now — and the auditor finds it via a 90-second grep that takes engineering 4 sprints to remediate. Setting algorithm + key-lifecycle + KMS choice before any crypto code ships is also how you avoid the harvest-now-decrypt-later post-quantum exposure that turns long-lived secrets stored today into someone's 2032 disclosure.

Invoke as `/crypto-policy-pre`. Algorithm allowlist, key lifecycle, KMS choice, FIPS / PQC posture before any crypto code lands.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/regulatory-<project>.md`.
3. Read `docs/inception/export-control-<project>.md` if applicable.
4. Read `docs/inception/threat-model-pre-<project>.md`.

## Inputs
- Data sensitivity (PII / PHI / PCI / IP / classified).
- Customer requirement (FedRAMP / FIPS / SOC 2 / banking).
- Geographic scope (export control overlap).
- Performance budget vs hardware-token cost.

## Process
1. **Algorithm allowlist** (NIST SP 800-131A current):
   - **Symmetric**: AES-256-GCM (preferred), AES-128-GCM, ChaCha20-Poly1305
   - **Asymmetric**: RSA-3072+ (deprecated for new), ECDSA P-256/P-384, Ed25519
   - **KEM (post-quantum)**: ML-KEM (Kyber, FIPS 203), hybrid X25519+ML-KEM
   - **Signature (PQC)**: ML-DSA (Dilithium, FIPS 204), SLH-DSA (Sphincs+, FIPS 205)
   - **Hash**: SHA-256/384/512, SHA-3, BLAKE2/3
   - **MAC**: HMAC-SHA-256+, KMAC
   - **Password hash**: Argon2id (OWASP), scrypt, bcrypt (cost ≥12)
   - **KDF**: HKDF-SHA-256+, PBKDF2 (legacy only)
2. **Algorithm denylist**:
   - MD5, SHA-1 (collision-broken)
   - DES, 3DES (NIST disallowed 2024)
   - RC4, Blowfish (broken / legacy)
   - AES-ECB (no IV)
   - RSA-PKCS1v1.5 encryption (use OAEP)
   - Curve25519 unbacked by ed25519 (use Ed25519 wrapper)
3. **TLS posture**:
   - **Minimum**: TLS 1.2; **preferred**: TLS 1.3
   - **Cipher suites**: AEAD only (GCM, ChaCha20-Poly1305)
   - **Key exchange**: ECDHE only (no RSA key exchange — no PFS)
   - **Cert**: ECDSA P-256 or RSA-3072+; Let's Encrypt or ACM
   - **HSTS**: max-age 31536000 + includeSubDomains + preload
   - **Test**: SSL Labs A+ target
4. **Key management**:
   - **KMS choice**:
     - AWS KMS (envelope encryption, IAM-bound)
     - GCP Cloud KMS
     - Azure Key Vault
     - HashiCorp Vault (self-host or Cloud)
     - HSM-backed (AWS CloudHSM, Thales, Gemalto) — FIPS 140-3 L3
   - **Lifecycle**: generate → distribute → use → rotate → archive → destroy
   - **Rotation cadence**:
     - DEK (data encryption key) — per-record or annual
     - KEK (key encryption key) — annual
     - Signing keys — 1–2 yr
     - TLS certs — Let's Encrypt 90d auto-renew
   - **Backup**: KMS-internal (AWS replicates); cross-region for DR
   - **Destruction**: schedule deletion (AWS 7–30d window)
5. **FIPS 140-3** compliance:
   - **L1**: software, no physical
   - **L2**: tamper-evident
   - **L3**: tamper-resistant + identity-based auth
   - **L4**: tamper-detection + zeroize
   - FedRAMP / DoD / banking → L2 minimum
   - AWS KMS FIPS endpoints: kms-fips.<region>.amazonaws.com
6. **Secrets management**:
   - No secrets in source / env files in repo
   - Secrets manager (AWS Secrets Manager, Vault, Doppler, 1Password Connect)
   - Rotation via secrets-rotation skill
   - Audit log per access
7. **Post-quantum migration**:
   - **Harvest now, decrypt later** risk for long-lived secrets
   - **NIST PQC standards**: ML-KEM (FIPS 203), ML-DSA (FIPS 204), SLH-DSA (FIPS 205) — finalized Aug 2024
   - **Hybrid TLS**: X25519+ML-KEM (Cloudflare, Chrome, Firefox already)
   - **Action plan**: inventory long-lived secrets → prioritize migration
8. **Random number generation**:
   - **OS CSPRNG** only (`/dev/urandom`, `getrandom(2)`, BCryptGenRandom)
   - Never `Math.random`, `rand()`, mt19937 for security
   - Seed audit if HSM-backed
9. **Crypto-agility**:
   - Algorithm identifier per stored ciphertext (AEAD AAD includes algo ID)
   - Key version tagged per ciphertext
   - Migration paths documented per algorithm
10. **Standards mapping**:
    - **NIST SP 800-131A** transition rules
    - **NIST SP 800-57** key mgmt
    - **NIST SP 800-175B** crypto mechanism guide
    - **PCI DSS 4.0** §3.5–3.7 strong crypto
    - **HIPAA Security Rule** §164.312(a)(2)(iv) encryption addressable
    - **GDPR Art 32** state-of-the-art crypto
    - **EU eIDAS** for qualified signatures

## Output
Write `docs/inception/crypto-policy-<project>.md`:

```markdown
# Crypto Policy — <project>
**Date:** <YYYY-MM-DD>

## Scope
- Data: PII + PCI-tokenized + customer files
- Customer: enterprise (SOC 2 + ISO 27001) + EU GDPR + future FedRAMP
- FIPS posture: AWS KMS FIPS endpoint baseline

## Algorithm allowlist
| Use | Algorithm | Min strength |
|---|---|---|
| Data-at-rest | AES-256-GCM | 256 |
| Data-in-transit | TLS 1.3 (ECDHE+AES-GCM/ChaCha) | TLS 1.2 floor |
| Asymmetric (sign) | Ed25519, ECDSA P-256 | — |
| Asymmetric (encrypt) | RSA-OAEP-3072 / ECIES-P-256 | 3072 |
| Hash | SHA-256, SHA-384 | 256 |
| MAC | HMAC-SHA-256 | — |
| Password hash | Argon2id (m=64MiB, t=3, p=1) | — |
| KDF | HKDF-SHA-256 | — |
| KEM (PQC, hybrid) | X25519+ML-KEM-768 | post-quantum |
| Sig (PQC, future) | ML-DSA-65 | post-quantum |

## Algorithm denylist (CI-enforced via SAST)
- MD5, SHA-1
- DES, 3DES
- RC4, Blowfish
- AES-ECB
- RSA-PKCS1v1.5 enc
- bcrypt (new; legacy keep)

## TLS posture
- Minimum TLS 1.2; prefer 1.3
- ECDHE only; AEAD ciphers only
- HSTS max-age=31536000; includeSubDomains; preload (after 6mo)
- mTLS for service-to-service inside VPC
- SSL Labs target: A+

## Key management
| Aspect | Choice |
|---|---|
| KMS | AWS KMS (FIPS endpoint) |
| Envelope encryption | DEK per record + KEK in KMS |
| HSM | AWS CloudHSM for ML-DSA + signing roots |
| Rotation: DEK | annual + on-suspect-compromise |
| Rotation: KEK | annual |
| Rotation: TLS | Let's Encrypt 90d auto |
| Rotation: signing | 2-yr cycle |
| Backup | KMS multi-region replica |
| Destruction | 30-d scheduled with audit log |

## Secrets management
- Tool: AWS Secrets Manager (Y1) → HashiCorp Vault (Y2 if multi-cloud)
- Rotation: per `/secrets-rotation` skill
- Access audit: CloudTrail
- Local dev: 1Password CLI
- CI: OIDC to short-lived role; no static creds

## Post-quantum readiness
- Inventory long-lived secrets (signing keys, encrypted backups)
- Hybrid TLS X25519+ML-KEM enabled at edge (Cloudflare default)
- Backup encryption: plan ML-KEM-768 wrap by Y2
- Signing migration to ML-DSA: Y3 target
- Decision driver: NIST PQC finalized Aug 2024

## Random number generation
- Source: OS CSPRNG only (Node `crypto.randomBytes`, Python `secrets`)
- Banned: `Math.random`, `random.random()`, `rand()`
- Audit: SAST rule

## Crypto-agility
- Ciphertext envelope: `{algo, key_id, iv, ct, tag, aad}`
- Algo identifier in AAD prevents downgrade
- Key version per record for rotation
- Migration docs per algorithm

## FIPS compliance posture
- KMS: AWS KMS FIPS-validated module
- TLS termination: ALB or CloudFront FIPS endpoints
- Crypto libs: BoringSSL FIPS / OpenSSL 3 FIPS provider where available
- Audit cadence: annual

## Effort + cost
| Activity | Cost |
|---|--:|
| KMS setup + IAM | 1 wk eng |
| Secrets manager | $0–5k/yr |
| HSM (CloudHSM) | $1.50/hr/HSM × 2 = $26k/yr (Y2) |
| Crypto SAST rules | 2 d eng |
| PQC research + plan | 1 wk eng |
| Annual review | 3 d |
| **Y1 total** | **~$5k + 2 wk dev (no HSM)** |
| **Y2 with HSM** | **~$31k** |

## Standards mapping
- NIST SP 800-131A ✓
- NIST SP 800-57 ✓
- PCI DSS 4.0 §3.5–3.7 ✓
- HIPAA §164.312(a)(2)(iv) ✓
- GDPR Art 32 ✓
- ISO 27001 A.10 (cryptography) ✓

## Risk if skipped
- Weak crypto in audit → SOC 2 / ISO 27001 fail
- TLS misconfig → MITM, cred theft
- Hardcoded secrets in repo → breach
- Pre-PQC long-lived secrets → harvest-now-decrypt-later
- FIPS gap → blocks federal sales

## 90-day plan
1. Algorithm allowlist + denylist publication (week 1)
2. SAST rules in CI (week 2)
3. KMS + Secrets Manager bootstrap (week 2–3)
4. TLS audit + cipher allowlist (week 3)
5. SSL Labs A+ achieved (week 4)
6. Password hash audit (Argon2id migration if bcrypt) (week 4–6)
7. Crypto-agility envelope spec (week 6)
8. PQC inventory + migration plan (week 8)
9. Annual review calendar (week 12)
```

## Verification
- Algorithm allowlist + denylist published.
- TLS posture set (min version, ciphers, HSTS).
- KMS choice + key lifecycle named.
- Secrets manager named.
- PQC plan referenced.
- FIPS posture declared.
