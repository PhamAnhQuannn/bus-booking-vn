---
name: state-medical-board-multi-licensure
description: Track practitioner multi-state licensure for telehealth: IMLC (Interstate Medical Licensure Compact, MD/DO), NLC (Nurse Licensure Compact, RN/LPN), PSYPACT (psychology), ASLP-IC (audiology + SLP), PT Compact, EMS Compact, plus state-by-state controlled-substance prescribing rules and license-verification cadence. Reads `docs/inception/hipaa-<project>.md`. Writes `docs/compliance/licensure-<project>.md`. Trigger phrases "state license", "telehealth license", "IMLC", "NLC", "PSYPACT", "DEA telehealth", "Ryan Haight", "controlled substance prescribing", "license verification", "/state-medical-board-multi-licensure", or before launching telehealth in any new state.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 6h
---

# /state-medical-board-multi-licensure — Multi-State Practitioner Licensure Tracking

Invoke as `/state-medical-board-multi-licensure`. Run during inception per practitioner-type the product supports. Re-run quarterly + before launching in any new state.

## Why you'd care

Telehealth across state lines without per-state licensure mapping is unauthorized practice of medicine — fines, license revocation, criminal exposure. The compacts (IMLC, NLC, PSYPACT) cut the matrix dramatically, but only if you map them deliberately.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP unless legally scoped.
2. Read `docs/inception/hipaa-<project>.md`.
3. Read regulatory-preflight if exists.

## Inputs
- Practitioner types served (MD, DO, NP, PA, RN, LPN, LCSW, psychologist, audiologist, SLP, PT, OT, RD, etc.).
- Operating states (initial + 12-mo expansion plan).
- Synchronous vs. asynchronous care.
- Controlled-substance prescribing? (Schedule II–V?)
- Patient-located-in-state-X / provider-located-in-state-Y combos.
- Workforce-management system (Healthie, Athena, custom).
- DEA registration status of practitioners.

## Process
1. **Core rule**: practitioner generally must be licensed in **the state where the PATIENT is physically located at the time of the encounter** (with narrow exceptions: cross-state ER consults, Veterans Affairs, IHS, federally declared emergencies, registered cross-state exemptions per state).
2. **Compacts (2026 vintage)**:
   - **IMLC (Interstate Medical Licensure Compact)** — MDs/DOs. 40+ states + DC + Guam (track ongoing — Florida, NY, California historically out; check current at imlcc.org). Expedited license issuance (~weeks) in any member state; still pay each state fee. Not a single license — accelerated path to each state's license.
   - **NLC (Nurse Licensure Compact)** — RNs + LPN/VNs. 40+ states (track current at ncsbn.org/nlc). True multistate license — work in any compact state on home-state license; APRN Compact separate and only partially adopted as of 2026.
   - **PSYPACT** — psychologists. 40+ states (track at psypact.org/PSYPACT-states). Authority to Practice Interjurisdictional Telepsychology (APIT) + temporary in-person (E.Passport). Doctoral-level psych only.
   - **ASLP-IC** — audiology + speech-language pathology compact (effective 2024). Growing — check aslpcompact.com.
   - **PT Compact** — physical therapy. 35+ states.
   - **EMS Compact (REPLICA)** — EMS personnel.
   - **OT Compact** — newer (2024 effective for early-adopter states).
   - **Counseling Compact** — LPC/LMHC (effective 2024). Growing.
   - **Social Work Compact** — LCSW. Coming online 2024–2026.
3. **Non-compact path**: license-by-endorsement state-by-state. Time: 2–12 wk per state. Cost: $200–$1,000 per state per year. Documents: primary-source verification of degree, board exams, prior licenses, malpractice history, fingerprints for some.
4. **Telehealth-specific waivers / registrations** (some states allow non-licensed cross-state telehealth under registration):
   - Florida: Out-of-State Telehealth Provider Registration (alternative to license).
   - New Jersey, Arizona, Vermont, Maryland, others: similar registration schemes (variable, check current).
   - Some states ended COVID-era flexibilities; matrix changes constantly.
5. **DEA + controlled substances**:
   - **Ryan Haight Act** (2008): generally requires in-person exam before prescribing controlled substances via telemedicine, with exceptions (DEA-registered practice, prior in-person, certain hospitals).
   - **COVID flexibility extended**: DEA extended COVID-era telemedicine prescribing flexibilities through Dec 31, 2025 (per Oct 2024 rulemaking); final rule expected 2025–2026 — track DEA telemedicine special-registration final rule.
   - **DEA registration**: required per state where practitioner prescribes (separate from medical license). Each state DEA = ~$888/3yrs.
   - **State PMP / PDMP** (Prescription Drug Monitoring Programs): query before C-II prescribing in most states; mandate varies.
   - **State controlled-substance schedules**: differ from federal in some states (kratom, marijuana, etc.).
6. **License verification cadence**:
   - **At onboarding**: primary-source verification (PSV) via state board website or NPDB query.
   - **Quarterly**: sanction-check via NPDB (National Practitioner Data Bank) and OIG LEIE (HHS Office of Inspector General List of Excluded Individuals/Entities) + GSA SAM exclusions.
   - **At renewal**: catch expirations early; auto-block scheduling if expired.
   - **Vendor options**: Verifiable, MedAllies, CAQH ProView, Modio, symplr.
7. **Scope of practice**: each state defines what each practitioner type can do (e.g., NP independent practice in ~28 states, restricted/supervisory in others; PA collaborative requirements; psychologist Rx authority limited to a handful of states).
8. **Continuing education (CE)**: each state has CE hour + topic requirements (e.g., CA suicide prevention, FL HIV/AIDS, TX human trafficking). Track per practitioner per state.
9. **Malpractice insurance**: must cover each state of practice. Most carriers add coverage states cheaply; some compact states require explicit endorsement.
10. **Audit + corporate-practice-of-medicine (CPOM)** doctrine: many states (CA, TX, NY) prohibit corporate practice — telehealth co. must structure via MSO + PC (friendly-PC model). Out of scope for this skill but flag.
11. **2024–2026 vintage signals**:
    - DEA telemedicine special-registration final rule pending (Oct 2024 NPRM revised; current flexibility extended through Dec 31, 2025).
    - Several states tightening cross-state telehealth post-PHE (some dropping registration alternatives).
    - Counseling Compact + Social Work Compact + OT Compact actively rolling out — re-check state list quarterly.
    - APRN Compact: only a handful of states active; not a full solution for NP scaling yet.

## Output
Write `docs/compliance/licensure-<project>.md`:

```markdown
# Multi-State Licensure Plan — <project>
**Date:** <YYYY-MM-DD>
**Owner:** <Clinical Ops / Credentialing Lead>
**Reviewed quarterly:** <next: YYYY-MM-DD>

## Practitioner types served
| Type | Compact (if any) | Active count | Y1 plan |
|---|---|--:|---|
| MD / DO | IMLC | 18 | grow to 50 |
| NP | APRN Compact (limited) | 8 | grow to 20 |
| PA | none (state-by-state) | 4 | grow to 10 |
| RN (care coordination) | NLC | 12 | grow to 25 |
| LCSW | Social Work Compact (new) | 6 | grow to 15 |
| Psychologist (PhD) | PSYPACT | 3 | grow to 8 |

## States covered (Q2 2026)
| State | MD via IMLC? | NP path | LCSW Compact? | PSYPACT? | NLC? | Out-of-state telehealth registration? | DEA flexibility through 2025? |
|---|:--:|---|:--:|:--:|:--:|:--:|:--:|
| CA | no (not IMLC) | endorsement (~12 wk) | not yet | yes | no | no | yes |
| TX | yes | endorsement (~8 wk) | not yet | yes | yes | no | yes |
| FL | no (not IMLC) | endorsement (~10 wk) | yes (effective) | yes | yes | yes (OSTPR) | yes |
| NY | no (not IMLC) | endorsement (~16 wk) | not yet | yes (effective 2024) | no | no | yes |
| IL | yes | endorsement (~6 wk) | yes | yes | no | no | yes |
| WA | yes | endorsement (~8 wk) | yes | yes | yes | no | yes |
| AZ | yes | endorsement (~6 wk) | yes | yes | yes | yes (registration) | yes |
| CO | yes | endorsement (~4 wk) | yes | yes | yes | no | yes |
| GA | yes | endorsement (~6 wk) | yes | yes | yes | no | yes |
| NC | yes | endorsement (~6 wk) | yes | yes | yes | no | yes |
| (… continue per operating state) | | | | | | | |

(Update via NCSBN, IMLCC, PSYPACT, FSMB, ASLP-IC, DEA quarterly.)

## Per-practitioner licensure registry
Maintained in `data/practitioner-licensure.csv`:
- practitioner_id, type, NPI, home state, license # per state, license expiry per state, DEA per state, board cert, malpractice carrier, sanction-last-checked, PMP-access per state.

## Credentialing flow (onboarding)
1. CAQH ProView profile current.
2. Primary-source verification per state license (state board website or Verifiable/Modio).
3. NPDB query (continuous monitoring enrolled).
4. OIG LEIE check.
5. GSA SAM exclusion check.
6. Malpractice insurance verified covers each state of practice.
7. DEA verified per state (if Rx C-II–V).
8. State PMP/PDMP access requested and verified.
9. State-specific CE compliance check.
10. Document retention: 10 yrs post-termination (NCQA recommendation).

## Continuous monitoring
- NPDB continuous monitoring (subscribe) — alerts on action.
- OIG LEIE: monthly.
- State board: quarterly (or via Verifiable/Modio's continuous monitoring).
- License expiry: 90/60/30/14-day alerts; auto-block scheduling at expiry.

## App enforcement (technical)
- Booking: filter providers by (patient state, practitioner license state, license expiry > visit date, license not sanctioned).
- Prescribing: filter providers by (state DEA active, controlled-substance check via PMP per state mandate, Ryan Haight compliance — in-person within X days OR DEA telemedicine flexibility OR special-registration once final rule).
- Encounter geolocation: capture patient state at scheduling AND at start-of-visit (IP geo + self-attestation); deny if mismatch with practitioner license.

## Controlled-substance prescribing
- **Current status (May 2026)**: DEA telemedicine flexibility extended through Dec 31, 2025. Final rule on special-registration expected 2025–2026; verify monthly.
- **Ryan Haight default**: in-person exam required before C-II–V telemedicine prescribing (with exceptions).
- **App behavior**:
  - At schedule: warn if controlled-substance Rx likely + flexibility deadline approaching.
  - PMP query mandated pre-Rx in most states; integrate via Appriss/Bamboo Health/state-direct.
  - C-II e-Rx via EPCS (Electronic Prescribing of Controlled Substances) with 2FA per DEA.

## CE tracking
- Per state per practitioner: required CE hours + topic-mandates.
- Renewal-prep automation: 90/60/30-day alerts; show shortfall by topic.

## Corporate-practice-of-medicine (CPOM) flag
- Operating in CA, TX, NY, CO, NJ, IL: CPOM concerns; structure via MSO + friendly-PC.
- Counsel review confirmed: <YYYY-MM-DD> (link to legal memo).

## Vendor stack
| Function | Vendor |
|---|---|
| Credentialing platform | <Verifiable / Modio / symplr / CAQH> |
| PMP integration | Bamboo Health |
| EPCS | <DrFirst / Surescripts EPCS partner> |
| Malpractice carrier | <name> |
| Background check | <Checkr / Sterling> |

## Cost
| Item | Cost / yr |
|---|--:|
| State licenses (50 practitioners × avg 5 states × $400) | $100k |
| DEA registrations | $30k |
| Credentialing platform | $20k |
| PMP integration | $10k |
| EPCS | $5k |
| Background checks | $5k |
| Malpractice (group rate) | varies |
| **Y1 estimate** | **~$170k** |

## 12-mo state-expansion roadmap
| Quarter | New states | Practitioner types | Compact path used | Notes |
|---|---|---|---|---|
| Q2 | TX, IL, GA | MD, NP, LCSW | IMLC + Social Work Compact | top 3 markets |
| Q3 | FL, OH, NC | MD, NP, LCSW | endorsement (FL not IMLC; FL OSTPR considered for MDs) | FL OSTPR pilot |
| Q4 | NY, NJ, PA | MD, LCSW, Psych | endorsement + PSYPACT for psych in NY | NY long lead time |
| Q1 next year | CA, AZ, WA, OR | all | endorsement + AZ registration | CA last (CPOM + cost) |

## Risk if skip / weak
- Practicing across state lines without license = unauthorized practice; criminal in many states + civil penalties.
- State medical board sanction → NPDB report → cascade other states.
- DEA action → loss of Rx privilege everywhere.
- Lapsed license + visit performed = malpractice insurance void.
- HHS OIG exclusion = ineligible for Medicare/Medicaid; cascade to all payers; revenue cliff.
- CPOM violation → unwinding corporate structure (CA, TX particularly active).

## References (verify quarterly)
- IMLCC: https://imlcc.org/participating-states/
- NCSBN NLC: https://www.ncsbn.org/nlc.htm
- PSYPACT: https://psypact.org/page/psypactmap
- ASLP-IC: https://aslpcompact.com/
- PT Compact: https://ptcompact.org/
- Counseling Compact: https://counselingcompact.org/
- Social Work Compact: https://swcompact.org/
- FSMB: https://www.fsmb.org/
- DEA telemedicine flexibility: https://www.deadiversion.usdoj.gov/
- NPDB: https://www.npdb.hrsa.gov/ (HRSA)
- OIG LEIE: https://oig.hhs.gov/exclusions/
```

## Verification
- Practitioner types + compact mapped.
- State coverage matrix populated for current + planned states.
- Per-practitioner registry structure defined.
- Credentialing onboarding flow + continuous monitoring set.
- App-level booking + Rx enforcement defined.
- Ryan Haight / DEA flexibility status current (Dec 2025 deadline).
- CPOM flag set for relevant states.
- Cost + 12-mo expansion roadmap present.
- Reference URLs cited; quarterly review on calendar.
