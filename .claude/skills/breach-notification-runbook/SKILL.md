---
name: breach-notification-runbook
description: 60-day HIPAA breach notification runbook — detection → triage → investigation → notification (HHS OCR, affected individuals, media >500, state AGs per state-law overlay, CE if we're a BA). Includes Risk-of-Compromise assessment (4-factor test under 45 CFR 164.402), notification templates, OCR portal submission steps, evidence preservation, post-mortem trigger. Reads `docs/inception/hipaa-<project>.md`. Writes `docs/ops/breach-notification-<project>.md`. Trigger phrases "breach", "PHI breach", "breach notification", "HHS OCR", "60-day clock", "Risk of Compromise", "data breach runbook", "/breach-notification-runbook", or after any suspected unauthorized PHI access.
output_size:
  XS: skip
  S: 1h
  M: 3h
  L: 5h
  XL: 8h
---

# /breach-notification-runbook — HIPAA Breach Runbook

## Why you'd care

A HIPAA breach starts a 60-day clock the moment discovery happens — and HHS OCR, affected individuals, state AGs, and (above 500) the press all have separate notification rules. Without a pre-built runbook, the team improvises during the worst week of the year and gets the timeline wrong.

Invoke as `/breach-notification-runbook`. Build once per project; rehearse via tabletop quarterly.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP.
2. Read `docs/inception/hipaa-<project>.md` to know CE vs BA role.
3. Read `docs/legal/baa-*-<project>.md` for negotiated tighter timelines (most BAAs require ≤24–72h CE notice, stricter than the 60-day HHS floor).

## Inputs
- CE or BA role.
- Subcontractor BAAs and their breach-notice timelines.
- States of operation (state AG notification overlay).
- Detection signals available (SIEM, audit logs, EDR, DLP, customer report).
- Incident commander + privacy officer + outside counsel + cyber insurer contacts.
- Last tabletop date.

## Process
1. **Definition** — under 45 CFR 164.402, a breach = acquisition, access, use, or disclosure of PHI in a manner not permitted by Privacy Rule that compromises security or privacy. Exceptions: (a) unintentional good-faith access by workforce, (b) inadvertent disclosure between authorized persons at same CE/BA, (c) recipient could not reasonably have retained the PHI.
2. **Risk of Compromise (RoC) — 4-factor test** — presumption is breach UNLESS demonstrate "low probability of compromise" via 4 factors:
   - Nature & extent of PHI (sensitivity, identifiers).
   - Unauthorized person who used/received PHI.
   - Whether PHI was actually acquired/viewed.
   - Extent to which risk has been mitigated.
3. **60-day clock** — starts at *discovery* (when known, or should have been known via reasonable diligence), NOT at incident date. BA must notify CE; CE notifies individuals + HHS.
4. **Notification cascade**:
   - **Affected individuals**: written notice ≤60 days from discovery, by first-class mail (or email if individual agreed). Substitute notice (website + media) if >10 unreachable.
   - **HHS OCR**: if ≥500 affected → contemporaneous with individuals AND media in state; if <500 → annual log submitted within 60 d after calendar year-end.
   - **Media**: if ≥500 in one state/jurisdiction → notify prominent media outlets serving that area.
   - **CE (if we are BA)**: per BAA, typically 24h initial + 72h confirmation + 30d full report (see `docs/legal/baa-*-<project>.md`).
   - **State AGs**: 47 states + DC + PR + USVI have breach laws layered on HIPAA. CA, NY, TX, WA, FL trigger most often. Timing 30–90 days varies. Some require AG notice ≥500; some at any size.
   - **Cyber insurer**: per policy, typically ≤72h.
5. **Investigation** — preserve evidence (forensic image, logs, chain of custody). Engage outside counsel for privilege. Engage forensic firm (Mandiant, CrowdStrike, Kroll). Identify root cause, scope, affected records, identifiers exposed.
6. **Mitigation** — contain (revoke creds, isolate systems), eradicate (patch, key rotation), recover (restore from clean backup). Update Risk Register.
7. **Documentation** — keep breach log (6 years). Each entry: discovery date, incident date, nature, affected count, RoC analysis, notifications sent, mitigations.
8. **Post-mortem** — invoke `/post-mortem` skill within 14 d; blameless; produce action items + owner + due date.
9. **State-law overlay specifics**:
   - **CA**: AG notice if >500 CA residents (CCPA + Civil Code 1798.82).
   - **NY SHIELD**: AG, DOS, State Police — any size.
   - **TX HB 300 / Identity Theft Enforcement Act**: AG if >250 TX residents.
   - **WA MHMD (2024)**: covers consumer health data outside HIPAA; AG notice.
   - **FL Information Protection Act**: AG ≤30 days if >500 FL residents.
10. **2024–2026 vintage signals**:
    - HHS proposed Security Rule update (Dec 2024 NPRM): may require ≤24h workforce reporting and ≤72h CE→HHS in future; track final rule.
    - Change Healthcare ransomware (Feb 2024, ~100M affected) — largest healthcare breach; informs ransomware sub-runbook below.
    - NIST 800-66r2 (Feb 2024) realigned HIPAA Security Rule guidance to 800-53/CSF.
    - State AG enforcement up post-2023: NY, CA, TX active.

## Ransomware sub-runbook (post-2024 OCR guidance)
Ransomware affecting PHI = presumed breach (per HHS guidance, 2016, reaffirmed post-Change Healthcare 2024). Even if exfiltration not proven, encryption of PHI by unauthorized party = unauthorized "acquisition". 60-day clock starts at discovery.
- Decide pay vs. no-pay (FBI guidance: do not pay; consider OFAC sanctions if threat actor is sanctioned entity → illegal to pay).
- Engage cyber insurer immediately (some policies require pre-approval before paying ransom).
- Engage outside counsel + forensics under privilege.
- Restore from immutable/offline backup.
- Run RoC analysis; document why ransomware did or did not cause breach.

## Output
Write `docs/ops/breach-notification-<project>.md`:

```markdown
# Breach Notification Runbook — <project>
**Date:** <YYYY-MM-DD>
**Owner:** <Privacy Officer / Security Lead>
**Reviewed quarterly:** <next: YYYY-MM-DD>
**Tabletop cadence:** quarterly; last tabletop: <YYYY-MM-DD>

## Roles
| Role | Person | Contact |
|---|---|---|
| Incident Commander | <name> | <phone>, <email>, on-call |
| Privacy Officer | <name> | <phone>, <email> |
| Security Lead (CISO) | <name> | <phone>, <email> |
| Legal (in-house) | <name> | <phone>, <email> |
| Outside Counsel (privilege) | <firm + partner> | <24h hotline> |
| Forensic firm | <Mandiant/CrowdStrike/Kroll> | <retainer #> |
| Cyber insurer | <carrier + broker> | <claim hotline> |
| PR / Comms | <name> | <phone>, <email> |
| CE customer success | <name> | <phone>, <email> |

## Detection sources
- SIEM alerts (Datadog Security / Splunk / Sumo).
- Audit log anomaly (unusual PHI access pattern).
- EDR (CrowdStrike Falcon / SentinelOne).
- DLP alerts (egress, email, USB).
- Customer / workforce / external report (web form, abuse@).
- Vendor notification (sub-BA reports breach to us per their BAA).

## Phase 1 — Triage (T+0 to T+1h)
1. On-call ack → page Incident Commander.
2. Open incident channel `#incident-<id>` (private; Slack/Teams).
3. Open shared doc (privileged: "Attorney-Client Privileged & Work Product" header).
4. Initial scoping: what systems, what data, who reported, when discovered.
5. **Set 60-day clock**. Record discovery datetime UTC.
6. Page outside counsel for privilege.
7. Notify cyber insurer (within policy window, typically ≤72h).
8. Decide containment vs. observe (preserve evidence vs. stop the bleed) — usually contain.

## Phase 2 — Contain & investigate (T+1h to T+72h)
- Revoke compromised credentials.
- Isolate affected systems (network segmentation; do not power off — lose memory artifacts).
- Forensic image affected hosts (preserve chain of custody).
- Engage forensic firm.
- Pull audit logs covering window (extend back 90+ days; attackers often dwell).
- Identify: initial vector, lateral movement, exfil channels, persistence.
- Estimate affected record count + identifiers exposed (18-identifier matrix).
- **Initial CE notice (if BA)** — per BAA, typically ≤24h. Use template below.

## Phase 3 — Risk of Compromise assessment (T+24h to T+10d)
Document 4-factor analysis (45 CFR 164.402):
| Factor | Finding | Score (low/med/high risk) |
|---|---|---|
| 1. Nature & extent of PHI | <e.g., name + DOB + diagnosis = sensitive> | high |
| 2. Unauthorized recipient | <e.g., external threat actor, unknown intent> | high |
| 3. PHI actually acquired/viewed? | <forensic finding> | <l/m/h> |
| 4. Mitigation extent | <e.g., laptop recovered, encryption verified> | <l/m/h> |

**Conclusion:** <breach | low probability of compromise — documented exception>

If "low probability of compromise" → document and retain (6 yrs); no notification required.
If breach confirmed → proceed to Phase 4.

## Phase 4 — Notify (within 60 days of discovery)

### 4a. CE notice (if BA)
- Initial ≤24h; confirmation ≤72h; full report ≤30d (per BAA).
- Template: `templates/breach-notice-to-ce.md`.

### 4b. Affected-individual notice
- Method: first-class mail to last known address; email if individual previously agreed.
- Content (45 CFR 164.404(c)) — must include:
  - Brief description of what happened.
  - Types of PHI involved (e.g., name, DOB, SSN, diagnosis).
  - Steps individuals should take.
  - What we are doing.
  - Contact (toll-free, email, web, mailing).
- Substitute notice if >10 individuals unreachable: web posting 90 d + major-print/broadcast media.
- Template: `templates/breach-notice-to-individual.md`.

### 4c. HHS OCR notification
- ≥500 affected → contemporaneous (same time as individual notice; no later than 60 days).
- <500 affected → annual log within 60 days of calendar year-end.
- Submit via HHS OCR Breach Portal: https://ocrportal.hhs.gov/ocr/breach/
- Required fields: CE/BA name + addr, # individuals, date of breach, date of discovery, type (theft/loss/unauthorized access/hacking/improper disposal), location of breached info (laptop, server, email, paper, EHR, other), brief description, safeguards in place.

### 4d. Media (if ≥500 in single state/jurisdiction)
- Press release to prominent outlets serving that state.
- Template: `templates/breach-press-release.md`.
- Coordinate with Comms.

### 4e. State AG notification overlay
| State | Trigger | Timing | Recipient |
|---|---|---|---|
| CA | >500 CA residents | "without unreasonable delay" | AG (electronic submission) |
| NY | any size | "most expedient time possible, w/o unreasonable delay" | AG + DOS + State Police |
| TX | >250 TX residents | ≤60 days | AG |
| FL | >500 FL residents | ≤30 days | AG |
| WA | >500 WA residents | ≤30 days | AG |
| MA | any size | "as soon as practicable" | AG + OCABR |
| IL | >500 IL residents | "most expedient time possible" | AG |
| (others) | varies | varies | per state law |

### 4f. Cyber insurer + outside counsel + (if relevant) FBI / IC3
- Insurer per policy (≤72h typical).
- FBI / IC3 (https://www.ic3.gov) — voluntary; recommended for ransomware, nation-state, large breach.

## Phase 5 — Document & close (T+60d to T+90d)
- Final RoC + notification log entered in breach register (retain 6 yrs).
- Update HHS OCR portal with corrective action.
- Invoke `/post-mortem` — blameless RCA, action items, owners.
- Update `docs/risks/<project>.md`.
- Customer comms (CE customers): retention-focused, executive summary.
- Workforce comms: lessons learned, training refresh.

## Notification templates (referenced in Phase 4)

### Template: CE notice (BA → CE)
```
Subject: Notification of Security Incident under BAA §<n>

Date discovered: <YYYY-MM-DD HH:MM UTC>
Date occurred (estimated): <YYYY-MM-DD>
Description: <2–3 sentences, factual>
PHI types potentially affected: <name, DOB, SSN, diagnosis, …>
Estimated affected records: <N> (preliminary; final count by T+72h)
Containment status: <ongoing/contained>
Forensic firm engaged: <firm>
Next update: <YYYY-MM-DD HH:MM UTC>
Contact: <name, email, 24h phone>
```

### Template: Affected-individual notice
```
[Letterhead]
[Date]
[Individual Name + Address]

Dear [Name],

We are writing to inform you of a security incident that may have involved some of your personal health information.

What happened: <brief, plain language>
What information was involved: <list of identifiers; do NOT include actual PHI>
What we are doing: <containment, forensics, mitigation>
What you can do: <fraud monitoring, credit freeze; if SSN involved: complimentary credit monitoring 12–24 mo>
For more information: <toll-free + email + web + mailing>

We deeply regret any concern this may cause.

Sincerely,
[Privacy Officer name + title]
```

## Tabletop scenarios (rehearse quarterly)
1. Stolen laptop with unencrypted PHI — workforce member.
2. Phishing → cred theft → admin console access for 7 days.
3. Misconfigured S3 bucket exposes 10k records, indexed by search engine.
4. Sub-BA notifies us of their breach 45 days after their discovery (our 60-day clock).
5. Ransomware: production DB encrypted; threat actor demands payment; exfil unclear.
6. Departing employee emails patient list to personal Gmail.
7. Vendor email-marketing tool sends test blast to real patients with diagnosis in subject line.

## Risk if skip / runbook absent
- HHS OCR fines $137 – $68,928 per violation; annual cap **$2.07M** (2024 indexed).
- Late or missing notification = separate violation per individual per day.
- State AG penalties stacking (CA, NY active enforcement).
- Class action under state laws (CMIA treble damages; statutory damages in many states).
- Cyber insurer may deny claim for procedural failure.
- CE customer termination + reputational damage.
```

## Verification
- 60-day clock anchored on discovery, not incident.
- 4-factor Risk of Compromise framework documented.
- HHS OCR portal submission steps captured.
- State AG overlay covers our operational states.
- BAA-tighter timelines (CE notice ≤24–72h) reflected.
- Ransomware sub-runbook present (post-Change-Healthcare).
- Templates ready: CE notice, individual notice, press release.
- Tabletop scenarios listed; quarterly cadence on calendar.
- Privileged communications structure (outside counsel) defined.
