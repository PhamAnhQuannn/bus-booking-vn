---
name: chain-of-custody-financial
description: Evidence chain-of-custody for financial transactions, customer communications, orders, and trading messages — tamper-evident audit, hash-chain, WORM retention, FINRA/SEC/OCC admissibility. Outputs to `docs/compliance/chain-of-custody-<project>.md`. Reads `/project-classify`; skip XS+S. Use when user says "chain of custody", "evidence chain", "tamper evident", "WORM", "17a-4", "FINRA recordkeeping", "court admissible", "/chain-of-custody-financial", or before audit / regulatory exam / litigation hold.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /chain-of-custody-financial — Financial Evidence Chain Design

Invoke as `/chain-of-custody-financial`. Designs the record-of-record for every transaction, order, customer communication, and trading message: how it's captured, how it's hash-chained, how it's stored immutably for 3–7 years, and how it survives subpoena.

## Why you'd care
A SEC 17a-4 / FINRA 4511 / CFTC 1.31 violation isn't "we couldn't find the email." It's "we found three versions of the email and can't prove which one was sent." Without chain-of-custody you can't prove a trade happened the way your blotter says, your compliance defense fails, and counsel can't represent you on the record. Real penalties: SEC 17a-4(f) failures have produced $50M+ fines against tier-1 broker-dealers.

## Effort caveat — multi-quarter implementation
- **Hours here** = design + control mapping.
- **Real calendar:** 9–18 months to land at exam-grade. Initial WORM storage + ingest pipeline 3–4 months. Hash-chain proofs + verifier 2 months. 3 quarters of clean exception monitoring before regulators give credit. Replatforms often take 2+ years.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP.
2. Read `docs/design/audit-log.md` (or run `/audit-log-design` first — this skill builds on it).
3. Read `docs/compliance/regulator-relations-<project>.md`.
4. Confirm record-retention policy: which records, which regulator, which years (SEC 17a-4 = 3–6 yr; FINRA = 3 yr min; CFTC = 5 yr; OCC = 5 yr; BSA = 5 yr; SOX work papers = 7 yr).

## Inputs
- List of record classes in scope: trade records, blotters, orders, customer agreements, communications (email/chat/voice), social-media supervision, marketing pieces, financial statements, board records.
- Primary regulator(s).
- Volume estimate: events/day per class.
- Existing systems-of-record (trading platform, CRM, email archive, voice recorder).
- Litigation-hold pattern (do you currently respond to subpoenas? how?).

## Process

1. **Record-class taxonomy** — declare what is in scope and what regulator owns it:

   | Class | Examples | Primary rule | Retention | WORM required? |
   |---|---|---|---|---|
   | Trade records | executions, allocations, blotters | SEC 17a-3/4(a), FINRA 4511 | 6 yr (first 2 accessible) | Yes |
   | Orders | order tickets, modifications, cancels | SEC 17a-3(a)(6), CAT rules | 5–6 yr | Yes |
   | Customer accounts | new-account forms, KYC, agreements | SEC 17a-3(a)(17), 4511 | Life of account + 6 yr | Yes |
   | Communications — email | internal + external | 17a-4(b)(4), FINRA 3110 | 3 yr (first 2 accessible) | Yes (or compliant archive) |
   | Communications — chat/IM/SMS/WhatsApp | Bloomberg, Slack, Teams, WhatsApp | 17a-4(b)(4), 2021–2024 enforcement sweep | 3 yr | Yes |
   | Voice | recorded lines for solicited trades | FINRA 3110, MIFID II (EU) | 3 yr US / 5 yr EU | Yes |
   | Social-media | LinkedIn / X / public posts by RRs | FINRA 2210, 3110 | 3 yr | Yes |
   | Marketing / sales literature | retail comms, institutional comms | FINRA 2210 | 3 yr | Yes |
   | Books + records | GL, journals, balance sheets | 17a-3(a)(1–5), Reg S-X | 6 yr | Yes |
   | Board / committee minutes | minute books, charters | 17a-4(d), state corp law | Life of corp | Yes |
   | BSA records | CTR, SAR, KYC, transaction monitoring | BSA / 31 CFR 1010.430 | 5 yr | Yes |

2. **SEC 17a-4(f) electronic-storage requirements** — the canonical test for "WORM enough":
   - **(f)(2)(ii)(A)** preserve in non-rewriteable, non-erasable format
   - **(f)(2)(ii)(B)** verify automatic quality and accuracy of recording
   - **(f)(2)(ii)(C)** serialize the original + index — duplicate copy on separate media
   - **(f)(2)(ii)(D)** time-date stamp; downloadable index
   - **(f)(3)** designated third-party access — D3P letter on file with SEC
   - Acceptable today: cloud-WORM (AWS S3 Object Lock in Compliance Mode, Azure Immutable Blob, GCS Bucket Lock), regulated archives (Smarsh, Global Relay, Proofpoint, Mimecast, Bloomberg Vault). Note: 17a-4 was modernized 2022 — Audit-Trail Alternative permits non-WORM if a compliant audit trail exists.

3. **Capture-at-source pattern** — record is born immutable:
   - **Trades + orders:** drop a hash-chained event at the exchange/EMS boundary; persist before broadcasting fills
   - **Email:** journal mailbox in M365/Google to archive; never user-deletable
   - **Chat:** native connectors (Smarsh, Theta Lake, 8x8); ban personal devices via MDM + attestation
   - **Voice:** recorded extension or per-line; transcript + audio both archived
   - **WhatsApp / SMS:** corporate-issued device with archived comms or business-channel like LeapXpert
   - **Web forms / customer agreements:** PDF/A render + cryptographic signature; store render not source markup
   - **Marketing:** approval workflow in CRM/CMS; pre-publish snapshot archived

4. **Hash-chain design** — tamper-evidence at the row level:
   - Each record stores: `id`, `prev_hash`, `payload_hash`, `chain_hash = sha256(prev_hash || payload_hash || ts)`
   - Daily roll-up: per-class `daily_root_hash` = Merkle root of all events that day
   - Periodic anchor: publish `daily_root_hash` to (a) signed regulator filing, (b) public timestamp like RFC 3161 TSA, or (c) blockchain anchor for high-stakes — proves no historical edit
   - Verifier script reproduces hashes on demand for examiner

5. **Three-tier storage**:
   - **Hot** (0–90 days): primary DB + indexed search; sub-second retrieval
   - **Warm** (90 days – 2 yr): S3 Standard with Object Lock Compliance Mode; minutes-to-seconds retrieval
   - **Cold** (2–7+ yr): S3 Glacier Deep Archive with Object Lock; 12–48hr retrieval acceptable for archived comms
   - All tiers have the same `chain_hash`; only access SLA differs

6. **Custody metadata** — every record carries provenance:
   ```
   record_id, record_class, source_system, source_event_id,
   captured_at, captured_by (system/user), ingested_at,
   payload_sha256, prev_chain_hash, chain_hash,
   retention_class, legal_hold_ids[], delete_eligible_at,
   custody_log[]: [{action, actor, ts, justification}]
   ```
   Every read/export/restore appends to `custody_log` — auditor needs this.

7. **Legal-hold + litigation-hold workflow**:
   - Legal opens a hold → tag matching records with `legal_hold_id`
   - Tagged records suspend retention deletion regardless of retention class
   - Hold release requires General Counsel sign-off + audit-log entry
   - Periodic "are these holds still active?" review — orphan holds = e-discovery cost spiral

8. **Designated Third-Party (D3P)** — under 17a-4:
   - Letter on file with SEC naming a third party who can independently access records if firm refuses
   - Most archive vendors offer D3P-attestation service (Smarsh, Global Relay)
   - File undertaking + access procedure; refresh on vendor change

9. **Comms surveillance overlay** — required for FINRA 3110 + record completeness:
   - Lexicon-based + ML-based comms review (Bloomberg Vault, Behavox, Shield, NICE Actimize)
   - Sampling cadence: 100% of flagged + risk-based sampling on green
   - Disposition log: every alert → review → disposition → reviewer → ts
   - Off-channel detection: WhatsApp + iMessage attestations + device-level monitoring (Theta Lake / Movius / LeapXpert)
   - 2021–2024 SEC + CFTC off-channel sweep collected ~$3B+ in fines; this is the #1 enforcement vector

10. **Subpoena / production workflow**:
    - Intake: legal logs subpoena → opens hold → defines date range + custodians
    - Collection: query archive(s) for custodians + date + keyword; preserve copies in evidence-locker bucket
    - Review: privilege + responsiveness review in eDiscovery tool (Relativity, Everlaw, Reveal)
    - Production: Bates-stamped, load file (DAT/OPT), with chain-of-custody affidavit signed by archive vendor or custodian
    - Re-ingest production set back into archive as separate class — proves what was produced

11. **Reconciliation + completeness testing** — proves "no gaps":
    - Daily: count of expected vs ingested per source (e.g., trade fills vs trade-record rows)
    - Weekly: sample-based content reconciliation
    - Monthly: hash-chain verifier across all classes
    - Quarterly: third-party attestation (SOC2 + ISAE 3402) on archive controls
    - Annual: independent surveillance-program test

12. **Anti-patterns** (named in real consent orders):
    - Off-channel comms on personal devices — leading enforcement vector 2021–2024
    - User-deletable email retention (no journaling) — 17a-4(f) violation per se
    - "We use cloud, so it's compliant" — without Object Lock Compliance Mode, it isn't
    - No D3P letter on file
    - Retention destruction running during active legal hold
    - Hash-chain claimed but no verifier ever run
    - Archive vendor swap without re-ingesting + chain continuity
    - Surveillance lexicon never updated (still has Enron-era terms only)

## Output

Write `docs/compliance/chain-of-custody-<project>.md`:

```markdown
# Chain-of-Custody Program — <project>
**Date:** <YYYY-MM-DD> | **Owner:** <Chief Compliance Officer + Records Officer> | **Approved:** Board <date>

## Record-class register
| Class | Source system | Volume/day | Primary rule | Retention | Archive | WORM mode |
|---|---|---|---|---|---|---|
| Trade records | EMS/OMS | ~50k events | SEC 17a-3/4 | 6 yr | S3 Object Lock | Compliance |
| Orders | OMS | ~120k events | SEC 17a-3(a)(6), CAT | 5 yr | S3 Object Lock | Compliance |
| Email | M365 journal | ~80k msgs | 17a-4(b)(4) | 3 yr | Smarsh | Vendor WORM |
| Chat (Teams) | Theta Lake connector | ~200k msgs | 17a-4(b)(4) | 3 yr | Smarsh | Vendor WORM |
| Voice | NICE recorder | ~6k calls | FINRA 3110 | 3 yr | NICE Compliance Center | Vendor WORM |
| Mobile (WhatsApp) | LeapXpert | ~3k msgs | 17a-4(b)(4) | 3 yr | Smarsh | Vendor WORM |
| Marketing | CRM workflow snapshot | ~50/wk | FINRA 2210 | 3 yr | S3 Object Lock | Compliance |
| GL / books | ERP nightly | ~daily | 17a-3(a)(1–5) | 6 yr | S3 Object Lock | Compliance |
| Board minutes | Diligent → archive | monthly | 17a-4(d) | Life of corp | S3 Object Lock | Compliance |

## Capture pipelines
- Trades: EMS → Kafka → hash-chain ingest → S3 Object Lock
- Email: M365 journal → Smarsh
- Chat: Theta Lake connector → Smarsh
- Voice: NICE Engage → NICE Compliance Center → S3 Glacier export
- Mobile: corporate-issued + LeapXpert (BYOD banned; quarterly attestation)
- Marketing: CRM workflow auto-snapshots approved versions

## Hash-chain spec
- Per record: `chain_hash = sha256(prev_hash || payload_hash || captured_at)`
- Daily Merkle root per class; anchored to RFC 3161 TSA
- Verifier: scripts/coc-verify.ts — examiner-runnable
- Anomaly alert: missing-link / hash-break → page Compliance Eng on-call

## Custody metadata schema
- record_id (UUIDv7)
- record_class, source_system, source_event_id
- captured_at, captured_by, ingested_at
- payload_sha256, prev_chain_hash, chain_hash
- retention_class, delete_eligible_at
- legal_hold_ids[] (array)
- custody_log[] = [{action, actor, ts, justification}]

## D3P (17a-4) attestation
- Filed with SEC: YYYY-MM-DD
- D3P vendor: <Smarsh / Global Relay>
- Access procedure: <link>
- Refresh: annual

## Surveillance overlay
- Vendor: Behavox / Shield
- Lexicon: review quarterly with Legal
- 100% review of flagged comms; 5% random sample of green
- Off-channel detection: MDM scan + quarterly attestation; failure = ticket to HR

## Storage tiers
| Tier | Window | Backend | Retrieval SLA |
|---|---|---|---|
| Hot | 0–90d | Postgres + ES | <2s |
| Warm | 90d – 2y | S3 Object Lock Compliance | <60s |
| Cold | 2y – 7y | S3 Glacier Deep Archive Object Lock | <48h |

## Subpoena / e-discovery workflow
1. Legal intake → ticket + hold ID
2. Open `legal_hold_id` against custodians/date-range/keywords
3. Suspend retention deletion across all classes
4. Collect → evidence-locker bucket (separate Object Lock)
5. Review in Relativity / Everlaw
6. Produce Bates-stamped with archive-vendor chain-of-custody affidavit
7. Re-ingest production set as `produced` class
8. Hold release requires GC sign-off + log entry

## Reconciliation cadence
- Daily: expected-vs-ingested count per source
- Weekly: 1% content sample
- Monthly: hash-chain verifier all classes
- Quarterly: SOC2 + ISAE 3402 archive attestation review
- Annual: external surveillance-program test (Deloitte/PwC)

## Anti-patterns (avoid)
- Personal-device off-channel comms
- User-deletable mail (no journaling)
- "Cloud = compliant" without Object Lock Compliance Mode
- Missing D3P letter
- Retention destruction during active legal hold
- Hash-chain claimed without runnable verifier
- Vendor swap breaking chain continuity
- Surveillance lexicon never updated

## Penalty exposure if skipped
- SEC 17a-4(f): up to $100k/day/record + injunction
- FINRA 4511: censure + fine + sanction; principal liability
- CFTC 1.31: $1M+/violation
- 2021–2024 off-channel sweep: $200M–$500M per tier-1 broker-dealer
```

## Verification
- Every in-scope record class has source → archive → retention named.
- WORM mode (Compliance not Governance) confirmed per archive.
- Hash-chain verifier script exists and runs.
- D3P letter on file with SEC (broker-dealer scope) + annual refresh.
- Surveillance lexicon quarterly review scheduled.
- Off-channel comms ban + attestation operational.
- Reconciliation cadence (daily/weekly/monthly) running with breaks tracked.
- Subpoena workflow tested with mock subpoena.
