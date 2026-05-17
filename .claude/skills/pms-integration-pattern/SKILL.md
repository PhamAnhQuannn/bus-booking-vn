---
name: pms-integration-pattern
description: Practice Management System / EHR integration patterns — Epic (App Orchard / Showroom), Oracle Cerner (CODE / Open Developer Experience), athenahealth (Marketplace), eClinicalWorks, Veradigm/Allscripts (Developer Program), NextGen, Greenway, Healthie, Canvas Medical, Elation. Picks FHIR R4 + SMART on FHIR (preferred), HL7 v2 (legacy), proprietary REST. Covers OAuth scopes, refresh-token strategy, registration costs, Bulk Data, write-back limitations, certification cycles, app-marketplace listing. Reads `docs/inception/hipaa-<project>.md`. Writes `docs/design/pms-integration-<project>.md`. Trigger phrases "EHR integration", "PMS integration", "Epic App Orchard", "Cerner CODE", "athenahealth Marketplace", "SMART on FHIR", "EHR launch", "/pms-integration-pattern", or before any clinical-workflow product touches an EHR.
output_size:
  XS: skip
  S: skip
  M: 4h
  L: 12h
  XL: 24h
---

# /pms-integration-pattern — EHR/PMS Integration Pattern

Invoke as `/pms-integration-pattern`. Run during design phase. EHR integration is the #1 hidden cost in health-tech; this skill makes it visible early.

## Why you'd care

EHR integration timelines are measured in quarters, not weeks. Picking the wrong pattern — say, HL7 v2 where SMART on FHIR was available — locks you into a marketplace certification cycle you can't shortcut.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP.
2. Read `docs/inception/hipaa-<project>.md`.
3. Read existing `docs/legal/baa-*-<project>.md`.

## Inputs
- Target EHRs and rough customer demand share (top-3 typically: Epic, Oracle Cerner, athenahealth).
- Workflow: read-only (read patient/encounter/lab), write-back (create note/order/appt), or both.
- Launch context: standalone web app, SMART EHR-launch (in iframe), patient-facing portal, B2B API.
- Volume: # connected practices target Y1, peak concurrent users.
- Customer-purchasing reality: does the customer practice already use the EHR's developer program, or are we asking them to enable us?
- Aggregator option: Redox, Particle Health, Health Gorilla, 1upHealth — one integration covers many EHRs.

## Process
1. **Picture the market** (US 2026 EHR share, ambulatory + hospital):
   - Epic ~38% (dominant hospital + large group)
   - Oracle Cerner ~22% (hospital, some ambulatory)
   - Meditech ~10% (hospital)
   - athenahealth ~6% (ambulatory)
   - eClinicalWorks ~5% (ambulatory)
   - NextGen ~3% (ambulatory)
   - Veradigm/Allscripts ~3% (ambulatory)
   - Greenway ~2% (ambulatory)
   - Healthie / Canvas / Elation / DrChrono ~5% combined (modern-ambulatory niche)
   - Long tail ~6%
2. **Decide: direct vs. aggregator vs. hybrid**
   - **Direct** (Epic App Orchard, Cerner CODE, athena Marketplace): credibility + Marketplace co-sell + native UX; high cost (Epic listing fee historically waived for early stage but cert + technical work $100–500k); 6–18 mo.
   - **Aggregator** (Redox $4–10k/mo + per-transaction; Particle/1upHealth $1–5k/mo): one API across many EHRs; 4–12 wk per EHR; less control; abstraction leaks for write-back.
   - **Hybrid**: aggregator for long tail, direct for the top customer demand.
3. **Pick the right FHIR/SMART version**:
   - **FHIR R4** is current standard (USCDI v3+ required for certified EHRs under ONC HTI-1 rule, 2024).
   - **SMART on FHIR v2** (OAuth 2.0 + OpenID Connect). EHR-launch (`launch/patient`, `launch/encounter`) vs. standalone-launch.
   - **Bulk Data Access** (Flat FHIR, NDJSON) for population-level pulls.
   - Legacy HL7 v2 still required for some workflows (orders, results) — see `/lab-integration-design`.
4. **OAuth scope design**:
   - Resource-scoped: `patient/Patient.read`, `patient/Observation.read`, `user/Practitioner.*`.
   - Smart launch: `launch`, `launch/patient`, `openid`, `fhirUser`, `offline_access` (for refresh token).
   - Bulk: `system/Patient.read`, `system/Observation.read` (backend services via client_credentials).
   - **Minimum-necessary** — only request scopes you'll use; security review will block over-broad.
5. **Refresh-token strategy**:
   - `offline_access` scope → refresh token valid up to EHR-policy max (Epic typically 3 mo; athena varies).
   - Re-auth flow when refresh expires: prompt user OR backend-services flow if practice admin granted.
   - Backend services (client_credentials with JWT assertion + JWKS): no user-context; for bulk + scheduled jobs.
6. **EHR-specific gotchas**:
   - **Epic App Orchard / Showroom (rebranded 2023)**: technical + commercial review; sandbox FHIR; production cert per Epic version (Aura, Galaxy, Hyperdrive, May/Nov releases). Write-back ops limited to certain resources; many flow through Epic's own HL7 still. Listing free for many app classes since 2023, but cert prep $100k+ realistic. Bridges (open) program for community connect.
   - **Oracle Cerner CODE (Open Developer Experience)**: free dev program; production gated by Oracle Health + customer approval; FHIR R4 mature; SMART launch supported. Recent transition (post-Oracle acquisition 2022) means tooling churn.
   - **athenahealth Marketplace**: revenue-share model (15–30% historically); sandbox + production gated by athena's BD. FHIR R4 supported. Strong on ambulatory.
   - **eClinicalWorks**: API portal + Marketplace; per-practice opt-in; integration fees often passed to practice; documentation gaps; account-mgr-driven.
   - **Veradigm/Allscripts Developer Program**: FHIR R4; certification per product line (Sunrise vs. TouchWorks vs. Professional); cost varies $5–25k/yr.
   - **NextGen / Greenway**: limited FHIR; HL7 v2 still primary; per-practice setup.
   - **Healthie / Canvas Medical / Elation / DrChrono**: modern API-first; lighter cert; usually free/low-cost dev tier; weeks not months to integrate.
7. **Marketplace listing motion**:
   - Asset bundle: video demo, screenshots, security questionnaire (often 200+ Qs), HIPAA + SOC 2 evidence, BAA template, support SLA, pricing.
   - Listing typically takes 3–6 mo from start to live (Epic, Cerner, athena).
8. **Write-back limitations** (read >> write across all EHRs):
   - Notes/documents: usually OK as DocumentReference or via HL7 MDM.
   - Orders: limited; often must round-trip through CPOE provider sign.
   - Appointments: write-back available but practice-config-gated.
   - Problems / Allergies / Medications: write-back tightly controlled.
   - Always have a read-only fallback for v1.
9. **Patient-mediated access** (alternative to provider integration):
   - 1upHealth, Particle, Human API: patient logs into their EHR portal via their MyChart/etc creds; data flows to your app.
   - Useful when practice integration not feasible; consumer-app pattern.
   - Coverage: Epic (MyChart) + Cerner (HealtheLife) + many others; quality varies.
10. **TEFCA + QHIN landscape** (2024–2026):
    - TEFCA went live Dec 2023; QHINs (eHealth Exchange, Epic Nexus, Health Gorilla, etc.) provide nationwide query exchange.
    - Use case: treatment exchange across providers. Not a substitute for full PMS integration but covers many read-only needs.
    - As of 2026: ~7 QHINs designated; CMS pushing payer participation.

## Output
Write `docs/design/pms-integration-<project>.md`:

```markdown
# EHR/PMS Integration Plan — <project>
**Date:** <YYYY-MM-DD>
**Owner:** <Eng + BD Lead>

## Demand model
| EHR | Estimated demand (% of pipeline) | Y1 priority |
|---|--:|:--:|
| Epic | 40% | P0 (via aggregator first, direct cert Q3) |
| Oracle Cerner | 18% | P1 |
| athenahealth | 12% | P1 (Marketplace) |
| eClinicalWorks | 8% | P2 |
| Healthie | 7% (our beachhead) | P0 (direct, native) |
| Canvas Medical | 4% | P2 |
| Elation | 3% | P2 |
| Other / long tail | 8% | aggregator catch-all |

## Pattern decision
- **Hybrid**: aggregator (Redox) covers long tail + initial Epic pilots; direct on Healthie (beachhead), athena (Marketplace), Epic (cert Q3 once 3 Epic customers ready), Cerner (after Epic).

## Per-EHR integration card
### Epic
- Protocol: FHIR R4 + SMART on FHIR v2 launch (`launch/patient`, `launch/encounter`)
- Workflow: EHR-launch sidebar in Hyperdrive; read patient/encounter/observation; write DocumentReference
- Scopes: `launch/patient`, `openid`, `fhirUser`, `offline_access`, `patient/Patient.read`, `patient/Encounter.read`, `patient/Observation.read`, `patient/DocumentReference.cuds`
- Path: aggregator (Redox) Q1 → direct App Orchard cert Q3
- Cost: Redox $5k/mo + $3k/integration; direct cert $100–250k incl. internal eng + audit
- Timeline (direct): 9–12 mo
- Risks: Hyperdrive (Chrome-based) rollout still in progress; sidebar UX constraints; release cadence Aura/Galaxy.

### Oracle Cerner (Oracle Health)
- Protocol: FHIR R4 + SMART on FHIR
- Workflow: PowerChart SMART launch
- Scopes: similar to Epic
- Path: direct via CODE program
- Cost: dev free; cert ~$50–100k incl. internal + audit
- Timeline: 6–9 mo
- Risks: org churn post-acquisition; tooling moving from Cerner to Oracle Health portal.

### athenahealth
- Protocol: athenaOne API (REST + FHIR R4 subset)
- Workflow: Marketplace app + iframe + REST
- Path: direct Marketplace
- Cost: 15–30% rev share; setup ~$25–75k internal + audit
- Timeline: 4–8 mo
- Risks: rev share dilutes margin; mitigations via per-practice price floor.

### eClinicalWorks
- Protocol: eCW API portal; mixed FHIR + proprietary
- Path: per-practice; account-mgr-driven
- Cost: variable; sometimes per-practice integration fee passed to customer
- Timeline: 8–12 wk per practice
- Risks: documentation gaps; expect bespoke work.

### Veradigm/Allscripts
- Protocol: FHIR R4 per product line (Sunrise / TouchWorks / Professional)
- Path: Developer Program $5–25k/yr
- Timeline: 8–16 wk
- Risks: product-line fragmentation.

### Healthie (beachhead)
- Protocol: GraphQL API + FHIR (limited)
- Path: direct; free dev tier; partner listing
- Cost: $0 dev; rev share neg per partner agreement
- Timeline: 4–6 wk
- Risks: minimal — modern API.

### Canvas Medical, Elation, DrChrono
- Protocol: REST APIs (FHIR partial)
- Path: direct
- Cost: $0–$5k/yr dev
- Timeline: 4–8 wk each
- Risks: smaller customer base.

### Long-tail (NextGen, Greenway, Practice Fusion, Office Practicum, etc.)
- Path: Redox aggregator
- Cost: $1–3k per integration build (after platform fee)
- Timeline: 4–6 wk each

## SMART on FHIR launch design
- EHR-launch: receive `iss` + `launch` token → discover well-known SMART config → OAuth authorize → token endpoint → access_token + refresh_token + ID token + patient + encounter context.
- Standalone launch (patient-app pattern): app initiates auth; user picks org from a directory; PKCE required.
- Token storage: access_token in memory; refresh_token encrypted at rest (KMS-managed); never log; rotate-on-use where supported.
- Session: app session tracks (org_id, user_id, patient_id, encounter_id) for lifecycle.

## Scope philosophy (minimum-necessary)
Request only what we need. Example minimal set for our use case:
- `launch`, `openid`, `fhirUser`, `offline_access`
- `patient/Patient.read`
- `patient/Encounter.read`
- `patient/Observation.read`
- `patient/DocumentReference.cuds` (write notes back)

Avoid: `patient/*.*`, `user/*.*`, `system/*.*` unless documented backend job justifies.

## Refresh-token + re-auth UX
- Access token typically 30 min – 1 hr; refresh up to 3 mo (Epic) or per-EHR.
- Background refresh in service worker / server-side scheduler.
- On refresh failure: user-facing toast "Reconnect to <EHR>" → SMART launch resume.
- Backend services (client_credentials + JWT assertion): for nightly bulk jobs; JWKS hosted at our `.well-known/jwks.json`.

## Bulk Data Access
- Use case: nightly population pull for analytics / care gaps.
- $/operation: low; but data egress + storage scales.
- Patterns: kick-off → poll status → download NDJSON files → ingest to de-id pipeline.
- Permission: backend services with admin grant per practice.

## Write-back posture
| Resource | Read? | Write? | Notes |
|---|:--:|:--:|---|
| Patient | ✓ | ✗ | rarely allowed |
| Encounter | ✓ | partial | per EHR config |
| Observation | ✓ | partial | usually round-trip via HL7 |
| DocumentReference | ✓ | ✓ | note write-back path |
| ServiceRequest | ✓ | partial | order entry tightly controlled |
| Appointment | ✓ | ✓ (some) | practice-config-gated |
| MedicationRequest | ✓ | ✗ | e-Rx separate (Surescripts) |

## TEFCA / QHIN
- Q2-Q3 evaluate: join QHIN (eHealth Exchange or Health Gorilla) for treatment-purpose query.
- Cheaper than direct integration for read-only treatment use cases.
- Limitations: query-based, not subscription; some payers + providers not yet onboarded.

## Marketplace listing checklist
- [ ] Video demo (90s) + 5–10 screenshots
- [ ] Security questionnaire (HECVAT Lite or Marketplace-specific, 200+ Qs)
- [ ] HIPAA + SOC 2 Type II report (or HITRUST i1/r2)
- [ ] BAA template
- [ ] Support SLA (response + resolution time)
- [ ] Pricing transparent + per-practice or per-user
- [ ] Customer reference (1–3 live practices)
- [ ] App description + value prop
- [ ] Listing fees / rev share negotiated

## Cost summary (Y1)
| Item | Cost |
|---|--:|
| Redox platform | $60k/yr |
| Redox per-integration builds (×6) | $18k |
| Epic cert (internal eng 1 FTE-yr + audit) | $250k |
| Cerner cert (internal eng 0.5 FTE-yr + audit) | $120k |
| athena Marketplace listing (security review + listing) | $50k |
| Healthie native | $20k |
| Canvas + Elation + DrChrono | $30k |
| Long tail per-practice work | $50k |
| **Y1 total** | **~$600k** |

## Risks + mitigations
| Risk | Mitigation |
|---|---|
| Epic cert delays | aggregator parallel path; commit early on cert |
| EHR API rate limits | exponential backoff + per-customer quota |
| Write-back denied | feature-flag write-back per customer; read-only fallback |
| Token leakage | KMS-encrypted at rest; never log; rotate-on-use |
| Customer practice IT blocks | sales engineer + IT runbook + executive sponsor required pre-deal |
| EHR major version upgrade | per-EHR release notes monitor; staged regression suite |

## 12-mo roadmap
- Q1: Redox + Healthie + Canvas live; first 5 practices.
- Q2: Elation + DrChrono + athena Marketplace listed.
- Q3: Epic App Orchard cert + first 3 Epic customers.
- Q4: Cerner CODE cert + TEFCA/QHIN evaluation complete.

## Risk if skip / pick wrong
- Wrong-EHR-first → 6–12 mo wasted → company-killer in healthcare startups.
- Over-broad scopes → security review denial.
- No refresh strategy → users drop off after 1 hr; conversion craters.
- Marketplace listing without SOC 2/HITRUST → blocked at security review.
```

## Verification
- Per-EHR card has protocol, scopes, path, cost, timeline.
- Minimum-necessary scope discipline applied.
- Refresh-token + re-auth UX defined.
- Write-back posture honest (mostly read-only in v1).
- Aggregator vs. direct vs. hybrid decided per EHR.
- Marketplace listing checklist + cost present.
- TEFCA/QHIN evaluated.
- 12-mo roadmap sequenced by demand share.
