---
name: court-admissible-logging
description: Evidence-grade audit logging for trading systems — SEC Rule 17a-4 WORM + CFTC Reg 1.31 retention, cryptographic hash-chaining, tamper-evident Merkle anchoring, FRE 901/902(14) authentication, courtroom chain-of-custody, e-discovery export. Outputs to `docs/compliance/court-admissible-logging-<project>.md`. Reads `/project-classify` to skip XS+S. Use when user says "court-admissible logs", "evidence-grade logging", "WORM storage", "17a-4", "Reg 1.31", "chain of custody", "e-discovery export", "/court-admissible-logging", or before a litigation hold / regulatory production. Pairs with `/audit-log-design` (general audit) and `/matching-engine-invariants` (deterministic replay).
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /court-admissible-logging — Evidence-Grade Trading Audit Trail

Invoke as `/court-admissible-logging`. A regular audit log proves "what happened in our app". A court-admissible log proves "this is the original record, it has not been altered, here is who held it from creation to courtroom, and a custodian will testify to it under oath."

## Why you'd care
When SEC Enforcement, CFTC DOE, a plaintiff's class-action, or DOJ shows up, your normal Postgres `audit_events` table is not evidence — it is a defendant's database. If you cannot produce records meeting SEC Rule 17a-4(f) WORM requirements, you face independent violations ($1M+ per finding under SEA §32) **plus** an adverse inference on the underlying conduct. The 2021–2024 off-channel-comms sweep alone produced ~$3B in fines, almost entirely under 17a-4(b)(4).

## Effort caveat — this is a control system, not a logging library
- **Hours in this skill** = scope + control-design + vendor-eval + chain-of-custody-doc.
- **Real-world build:** 3–6 months for a 17a-4(f)-compliant WORM stack + storage-medium notification to SEC + designated-third-party (D3P) access letter + retention schedule + e-discovery pipeline.
- A pure-software hash chain alone is **not** 17a-4(f) compliant — the medium itself must enforce non-rewriteable / non-erasable.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP.
2. Read `docs/compliance/regulatory-<project>.md` — confirm broker-dealer (SEC), FCM/swap-dealer (CFTC), ATS, exchange, or SEF status.
3. Read `docs/design/audit-log.md` if it exists — this skill **supersedes** the general design for in-scope records.
4. Identify designated supervisor (FINRA Rule 3110), BSA officer, records custodian.
5. Confirm storage-medium vendor candidate (AWS S3 Object Lock Compliance mode, Azure Immutable Blob, Dell EMC Centera replacement / PowerScale SmartLock, NetApp SnapLock Compliance, Hitachi HCP).

## Inputs
- Record types in scope (orders, executions, communications, blue-sheets, books-and-records, surveillance alerts).
- Retention rules: SEC 17a-4(b) 3yr first 2yr accessible / 17a-4(e) 6yr customer accounts / 17a-3(a)(17) 3yr after account close; CFTC 1.31(b) 5yr first 2yr readily accessible; FINRA By-Laws Art XI; MSRB G-9 6yr.
- Litigation-hold posture (active matters, pending matters, regulatory inquiries).
- Cross-border exposure (MiFID II RTS 22/RTS 24, MAR Art 16, FINMA, MAS PSA §29).
- Jurisdictional rules of evidence (FRE 901/902(14) US, PACE §69 UK, EU eIDAS qualified e-seal).

## Process

1. **Scope the in-scope record set** — be explicit; over-scoping is expensive, under-scoping is fatal:

   | Record class | Rule | Retention | Form |
   |---|---|---|---|
   | Order/execution records | SEC 17a-3(a)(6)-(8) + 17a-4(b)(1) | 6 yr (3 yr accessible) | electronic OK if 17a-4(f) |
   | Books of original entry | 17a-3(a)(2) + 17a-4(a) | 6 yr | "" |
   | Customer account records | 17a-3(a)(17) + 17a-4(e)(5) | 6 yr after close | "" |
   | Communications | 17a-4(b)(4) — "originals received, copies sent" | 3 yr (2 yr accessible) | "" — this is the off-channel-comms sweep target |
   | Audit-system records | 17a-4(f)(3)(v) | duration of WORM medium | WORM mandatory |
   | Trade reconstruction (CFTC) | Reg 1.35(a) | 5 yr | voice + electronic |
   | Swap data | CFTC 45.2, 46.2 | life + 5 yr | electronic |
   | Position records | CFTC 1.31(b) | 5 yr | electronic |
   | CAT events (broker-dealer) | Rule 613 / CAT NMS Plan | 6 yr | submission via FINRA CAT LLC |
   | MAR Art 16 STORs | EU MAR Art 16 | 5 yr | electronic |
   | MiFID II order data | RTS 22 / 24 | 5 yr | electronic, ARM if reportable |

2. **Pick the WORM medium** — 17a-4(f) requires non-rewriteable, non-erasable, with auto-verification of recording quality. Software-only chains do **not** satisfy by themselves; the medium must enforce immutability:

   | Option | 17a-4(f) status | Cost band | Notes |
   |---|---|--:|---|
   | AWS S3 Object Lock — Compliance mode | Yes (per SEC no-action letters Cordium, Eagle, Smarsh stack) | $0.023/GB/mo + Glacier tier | Root cannot delete in Compliance mode; retention-period set at object level |
   | Azure Immutable Blob Storage (time-based) | Yes (Cohasset Associates attestation) | similar | legal-hold flag separate from time-based |
   | NetApp SnapLock Compliance | Yes | hardware $$$ | on-prem; tamper-resistant clock |
   | Dell PowerScale SmartLock Compliance | Yes | on-prem $$$ | replaces legacy Centera |
   | Hitachi Content Platform | Yes | enterprise | |
   | Bare Postgres "append-only by convention" | **No** | — | DBA can DROP TABLE; not 17a-4(f) |
   | Blockchain-only (public chain) | Maybe — depends on no-action; rarely accepted | $$ | use as anchor, not primary medium |

3. **Hash-chain + Merkle-anchor design** — software layer on top of the WORM medium:
   - Per-tenant / per-record-class chain: `event_n.prev_hash = event_{n-1}.hash`
   - `event.hash = SHA-256(canonicalize(event_without_hash) || prev_hash)`
   - Use RFC 8785 JSON Canonicalization Scheme (JCS) for deterministic serialization
   - Build a Merkle tree of all `event.hash` values per day per chain → daily Merkle root
   - **Anchor** the daily Merkle root to:
     - the WORM store itself (immutable object), AND
     - an external transparency log (RFC 9162 Certificate Transparency-style, or a public blockchain timestamp via OpenTimestamps / Bitcoin OP_RETURN), AND
     - the regulator-required "Designated Third Party" (D3P) — see step 5.
   - Sign each event with HSM-backed key (FIPS 140-2 Level 3+, e.g., AWS CloudHSM, Thales Luna, YubiHSM2 in enterprise mode). Key rotation logged into the chain itself.

4. **Event schema** — fixed, signed, no free-form payloads:
   ```ts
   type CourtAdmissibleEvent = {
     id: string                   // UUIDv7 (RFC 9562, time-sortable)
     ts: string                   // ISO-8601 UTC, monotonic source
     ts_source: 'NTP-stratum-1' | 'PTP-IEEE-1588' | 'GPS-disciplined'
     record_class: string         // '17a-4(b)(1)' | '17a-4(b)(4)' | 'CFTC-1.35' | 'CAT' | ...
     actor: { type: string; id: string; auth_method: string }
     subject: { type: string; id: string; tenant_id: string }
     action: string               // dotted verb
     payload_ref: string          // pointer to WORM object; payload NEVER inline
     payload_sha256: string       // hash of payload as written to WORM
     prev_hash: string
     hash: string                 // signed below
     hsm_signature: string        // ECDSA P-256 or Ed25519 over hash
     hsm_key_id: string
     hsm_key_serial: string       // for key-rotation audit
     clock_attestation?: string   // signed time attestation if available
   }
   ```
   Critical: **payload lives in the WORM object, not in the chain row**. The chain row is metadata + hash; the WORM object is the evidence. Two stores, both immutable, cross-referenced.

5. **Designated Third Party (D3P) — 17a-4(f)(3)(vii) mandatory**:
   - 17a-4(f)(3)(vii) requires a D3P (e.g., a recordkeeping consultant or attorney) with **access and ability to download records** independent of the firm.
   - Letter must be filed with SEC (and any relevant SRO) naming D3P, stating D3P can provide records directly to regulators on request.
   - D3P typically: Iron Mountain, Smarsh, Global Relay, Proofpoint Archiving, ZL Tech, Theta Lake, or a securities-attorney-of-record with vendor access.
   - Annual D3P engagement letter renewal + audited access test (download sample records and verify integrity).
   - Document the D3P access path: VPN + MFA + read-only IAM role + audit-logged session recording. D3P must **not** require firm cooperation to retrieve.

6. **Chain-of-custody documentation** — required to satisfy FRE 901(a) authentication:
   - Custodian role: named individual + named deputy. Each access logged (who, when, what, why).
   - **Storage medium notification letter** to SEC under 17a-4(f)(2)(i) prior to first use of electronic storage media — file with the firm's Designated Examining Authority (DEA, usually FINRA).
   - Quarterly audit of integrity: pull random sample of 30+ records, recompute hash chain, verify Merkle root matches anchor.
   - Annual independent attestation (SOC 1 Type 2 or AT-C 105 + AT-C 205 engagement, often by Cohasset Associates, Protiviti, or Big 4).
   - Chain-of-custody form for **every export** to a third party (regulator, opposing counsel, internal counsel): record requestor, scope, custodian-handoff timestamp, recipient signature, hash of export.

7. **Court admissibility under FRE 901 / 902(14)**:
   - **FRE 901(b)(9)**: process or system that produces an accurate result. Document the system: design, controls, testing, deviations.
   - **FRE 902(14)**: self-authenticating "certified records generated by an electronic process or system" — submit a certification meeting FRE 902(11) (custodian declaration). Use **902(14) declaration template**: identify the system, certify the hash-chain process, attach the integrity audit.
   - **FRE 803(6) business-records hearsay exception**: record kept in regular course, made at or near event, by someone with knowledge → custodian foundation testimony.
   - **Daubert** factors: testable, peer-reviewed, known error rate, generally accepted in the industry. Hash-chain + WORM is accepted in *In re Vee Vinhnee* (Bk. 9th Cir. 2005), *Lorraine v. Markel* (D. Md. 2007), *United States v. Vayner*.
   - International: UK PACE §69 + Civil Evidence Act 1995 + EU eIDAS Reg 910/2014 qualified electronic timestamp + qualified e-seal. Use a Qualified Trust Service Provider (QTSP) anchor (D-Trust, InfoCert, Buypass) for EU records.

8. **E-discovery export pipeline** — production format must be defensible:
   - **EDRM XML 1.2** or **Concordance load file** (.dat + .opt + .lfp) — industry standards.
   - **Native + TIFF/PDF + extracted text + metadata** — the "load file" must align all four.
   - **Hash manifest** (MD5 + SHA-256) per produced file — opposing counsel uses to confirm no alteration in transit.
   - **Bates numbering** with consistent prefix per matter (e.g., `BROKER-001-0000001`).
   - **Privilege log** integration if attorney-client material is filtered (Rule 26(b)(5) FRCP).
   - Export tool: Relativity, Reveal, Everlaw, Logikcull, or in-house with vendor attestation.
   - Litigation-hold workflow: legal-hold flag on records overrides time-based retention deletion (S3 Object Lock legal hold; Azure legal hold flag).

9. **Time-source integrity** — clocks lie:
   - Mandatory NTP with **stratum-1** sources (NIST, USNO, GPS-disciplined). Document drift bounds.
   - CFTC Reg 1.31(c) requires "true and complete" — implies accurate timestamp.
   - MiFID II RTS 25 mandates UTC + microsecond precision for HFT firms (RFC 8915 NTS for NTP authentication).
   - Log NTP source, sync state, last-sync-error in every event header.
   - Use IEEE 1588 PTP if microsecond precision required (CAT requires millisecond for non-HFT, microsecond for HFT).

10. **Retention engine + legal hold**:
    - Retention rules table: record_class → retention_years → action (default-delete vs hold-forever-on-flag).
    - Daily job evaluates expiry; expired records moved to "expired-pending-delete" queue with 90-day window for legal-hold check.
    - **Legal hold overrides retention deletion always.** Hold list maintained by Legal; flag is per-custodian (matter ID) and per-record (or per-tag).
    - Document the **destruction process** with witness sign-off (NIST SP 800-88 sanitization for any de-WORM destruction). Issue Certificate of Destruction.
    - Annual retention-schedule attestation by GC + outside counsel.

11. **Off-channel-communications discipline** (the 2021–2024 sweep lesson):
    - Personal-device, WhatsApp, Signal, SMS, personal-email used for business communication = automatic 17a-4(b)(4) violation regardless of content.
    - Capture stack: Smarsh / Global Relay / Theta Lake for SMS + WhatsApp Business + Zoom + Teams. Bloomberg + Symphony + Refinitiv chats captured natively.
    - Mobile MDM with capture-or-block (Microsoft Intune, Jamf with secure-messaging policy).
    - Annual attestation by every registered representative: "I do not use unmonitored channels for business."
    - Tip-line + non-retaliation policy.

12. **Surveillance + replay integration**:
    - Records must support **trade reconstruction** per CFTC 1.35(a): reconstruct any trade end-to-end within 72 hours.
    - Link audit-log records to deterministic-replay snapshots from matching engine (see `/matching-engine-invariants`).
    - Pre-trade risk-check records (15c3-5) link to post-trade execution records via parent order ID.

13. **Anti-patterns**:
    - "We have S3 versioning so we're WORM." Versioning is **not** Object Lock; you can still delete versions. Must be Compliance mode.
    - "We use Postgres with audit triggers." DBA / cloud-admin can DROP TABLE. Not 17a-4(f).
    - "We anchor to Bitcoin so it's tamper-evident." Possibly — but if your private chain hashes change, the anchor proves only what *you wrote*, not what *actually happened*. Anchor early-and-often.
    - "Communications are encrypted so they're private." Encryption ≠ retention. 17a-4(b)(4) requires capture, not just encryption.
    - "We delete after retention expires automatically." Without legal-hold override, this is **spoliation** if a hold is active — adverse-inference instruction at trial (e.g., *Zubulake* line).
    - "Daily Merkle anchor to a private cloud bucket." Internal anchor is not adversarial-resistant; pair with external (CT log, public chain timestamp, or QTSP).
    - "We let any engineer query the audit chain." Need separation of duties — operators write, custodians read, no one updates.
    - "We export to PDF for litigation." Native + load file required; PDF-only is a production deficiency.

## Output

Write `docs/compliance/court-admissible-logging-<project>.md`:

```markdown
# Court-Admissible Logging — <project>
**Date:** <YYYY-MM-DD> | **Custodian:** <name + deputy> | **D3P:** <vendor + contract ref>

## Regulatory scope
- SEC Rule 17a-3 / 17a-4(b),(e),(f) — broker-dealer books and records
- FINRA Rule 4511 + Rule 3110 supervision linkage
- CFTC Reg 1.31(b)-(d) + 1.35(a) trade reconstruction
- CAT Rule 613 / CAT NMS Plan submission via FINRA CAT
- MAR Art 16 STOR (if EU dual-listed) + MiFID II RTS 22 / 24
- Litigation jurisdictions: <list>

## In-scope record classes
| Class | Citation | Retention | Form |
|---|---|---|---|
| Orders / executions | 17a-4(b)(1) | 6 yr / 3 yr accessible | WORM |
| Communications | 17a-4(b)(4) | 3 yr / 2 yr accessible | WORM |
| Customer accounts | 17a-4(e)(5) | 6 yr post-close | WORM |
| Audit-system | 17a-4(f)(3)(v) | medium-life | WORM |
| Trade reconstruction | CFTC 1.35(a) | 5 yr | WORM + voice |
| Swap data | CFTC 45.2 / 46.2 | life + 5 yr | WORM |
| CAT events | Rule 613 | 6 yr | CAT submission + WORM copy |

## WORM stack
- Primary medium: AWS S3 Object Lock Compliance mode (us-east-1, eu-west-1)
- Storage tier: S3 → S3 Glacier Flexible Retrieval at +1yr
- Replication: cross-region, both buckets Compliance-locked
- Storage-medium notification letter to SEC (DEA = FINRA) on file: <date>
- Vendor attestation: Cohasset Associates 17a-4(f) opinion <date>

## Cryptographic controls
- Hash: SHA-256 over RFC 8785 JCS canonicalization
- Per-record-class chain; daily Merkle root per chain
- HSM: AWS CloudHSM (FIPS 140-2 Level 3); ECDSA P-256 signing
- Key rotation: annual; rotation event itself signed into chain
- External anchors: OpenTimestamps daily; QTSP qualified e-timestamp weekly (EU records)

## Time source
- NTP stratum-1 (NIST + GPS-disciplined PTP grandmaster on-site)
- Drift bound: ±1ms documented; alarm at ±5ms
- MiFID II RTS 25 microsecond precision: yes (HFT desks) / no (non-HFT)

## Designated Third Party (D3P)
- Vendor: <Smarsh / Iron Mountain / Global Relay>
- Engagement letter: <ref> — renewed annually
- Access path: read-only IAM role + MFA + session recording
- Annual access test: <date last> — verified <N> records retrieved + chain integrity

## Chain of custody
- Custodian: <name> (RR# <###>)
- Deputy custodian: <name>
- Custody log: <system>; every read/export logged
- Production form: EDRM XML 1.2 with native + TIFF + text + metadata + SHA-256 manifest
- FRE 902(14) declaration template: docs/legal/902-14-template.md

## Retention engine
- Rules table: lib/retention-rules.json (version-controlled)
- Legal-hold flag: per-record + per-matter; overrides expiry always
- Destruction process: NIST SP 800-88 sanitization for any out-of-band destruction
- Certificate of Destruction template: docs/legal/cod-template.md

## Off-channel-communications capture
- SMS / WhatsApp / Teams / Bloomberg / Symphony: Smarsh
- Mobile MDM: Intune with capture-or-block policy
- Annual RR attestation: yes (last run <date>)

## Surveillance + replay
- Linked to matching-engine deterministic snapshots (see /matching-engine-invariants)
- 1.35(a) trade-reconstruction SLA: <hh> < 72hr drill last <date>

## E-discovery
- Tool: <Relativity / Reveal / Everlaw>
- Production format: EDRM XML 1.2 + Concordance load file
- Bates prefix scheme: <prefix>-<matter>-<7-digit>
- Privilege-log workflow: integrated with Legal

## Annual integrity attestation
- Engagement: SOC 1 Type 2 + AT-C 105/205 by <auditor>
- Sample size: 30+ records per record-class per quarter
- Last attestation: <date> — opinion <unqualified/qualified>

## Open items / gaps
- <items>

## Cost band Y1
| Line | $ |
|---|--:|
| WORM storage (S3 OL + Glacier) | $40k–120k |
| HSM (CloudHSM cluster) | $25k–40k |
| Capture vendor (Smarsh / Global Relay) | $80k–250k |
| D3P engagement | $30k–80k |
| Annual SOC 1 / AT-C attestation | $80k–150k |
| E-discovery tool | $50k–200k |
| Time-sync (PTP grandmaster on-site) | $15k one-time + maintenance |
| **Y1 total** | **~$320k–840k** |
```

## Verification
- 17a-4(f)(2)(i) storage-medium notification letter on file with DEA.
- WORM medium is Compliance-mode (not Governance / not versioning-only).
- D3P engagement letter renewed within last 12 months; access test passed.
- Per-tenant / per-record-class hash chain verified by quarterly integrity audit.
- External anchor (OpenTimestamps / QTSP) lands daily; sample audit-log entries trace to anchor.
- Off-channel-comms capture exercised within last quarter (SMS + WhatsApp + Teams sampled).
- FRE 902(14) declaration template + chain-of-custody form template both written and reviewed by outside counsel.
- Legal-hold flag overrides retention expiry — tested by triggering expiry on flagged record and confirming no deletion.
