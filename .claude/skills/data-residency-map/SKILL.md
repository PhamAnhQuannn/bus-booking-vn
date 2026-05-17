---
name: data-residency-map
description: Pre-build data residency map — region per data class, sovereignty regimes (EU, UK, US-state, India DPDPA, China PIPL, Russia 152-FZ), localization triggers. Outputs to `docs/inception/data-residency-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "data residency", "data sovereignty", "EU only", "Schrems II", "data localization", "/data-residency-map", or before multi-region launch.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /data-residency-map — Data Residency Map

## Why you'd care

Schrems II killed the EU-US Privacy Shield and the replacement DPF is one court ruling from the same fate — meanwhile India DPDPA, China PIPL, and Russia 152-FZ each impose hard localization triggers that route around your default region choice. A pre-build map of which data class lives where, and which transfer mechanism (SCCs, BCRs, DPF) carries it across borders, is what stops a single regulatory shift from forcing an emergency re-architecture mid-roadmap.

Invoke as `/data-residency-map`. Region pinning per data class, sovereignty triggers, transfer mechanisms.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S → SKIP
2. Read `docs/inception/pii-inventory-<project>.md`.
3. Read `docs/inception/regulatory-<project>.md`.

## Inputs
- Customer geographies (EU / UK / US / Canada / India / China / Russia / KSA / Brazil / AUS).
- Sector regulators (banking, health, gov).
- Cloud provider region map (AWS / GCP / Azure).
- Sub-processor regions.

## Process
1. **Localization regimes**:
   - **EU GDPR** — no strict localization but Schrems II constrains transfers
   - **UK GDPR + IDTA** — UK-EU-US transfer rules
   - **Switzerland nDSG** — adequacy + SCC equivalent
   - **Russia 152-FZ** — primary processing must be in-Russia
   - **China PIPL + CSL + DSL** — CAC security assessment for cross-border; in-country for "important data"
   - **India DPDPA 2023** — SDF (Significant Data Fiduciary) localization risk
   - **KSA PDPL** — kingdom data + cross-border restrictions
   - **UAE PDPL + DIFC + ADGM** — free-zone exemptions
   - **Australia Privacy Act + APP 8** — accountability for cross-border
   - **Brazil LGPD Art 33** — transfer mechanisms
   - **Canada PIPEDA + Quebec Law 25** — sectoral health/banking residency
   - **US state**: NY DFS 23 NYCRR 500 (banking), CCPA, sectoral
   - **Schrems II** — Privacy Shield invalidated, US transfers need TIA
2. **Data classes by sensitivity for residency**:
   - **Public marketing** — anywhere
   - **Account metadata** — region of customer
   - **PII** — region of customer + lawful basis
   - **Special category (health/biometric)** — strict pin
   - **Payment** — PCI scope + sectoral
   - **Government / classified** — sovereign cloud
3. **Region selection**:
   - **AWS regions** by jurisdiction (eu-west-1 Dublin, eu-central-1 Frankfurt, eu-west-2 London, eu-south-1 Milan, eu-north-1 Stockholm, etc.)
   - **GCP regions** (europe-west1 Belgium, etc.)
   - **Azure regions** including sovereign (Azure Government, Azure Germany historical, Azure China via 21Vianet)
   - **Sovereign cloud**: AWS European Sovereign Cloud (2025), Azure for EU
4. **Cross-border transfer mechanisms**:
   - **EU SCCs 2021/914** (Modules 1-4)
   - **UK IDTA** + addendum
   - **EU-US Data Privacy Framework** (DPF) since July 2023 (Schrems III risk)
   - **Adequacy decisions** (Andorra, Argentina, Canada commercial, Faroe Islands, Guernsey, IoM, Israel, Japan, Jersey, NZ, ROK, Switzerland, UK, Uruguay, US-DPF certified)
   - **BCRs** (Binding Corporate Rules)
   - **Derogations** Art 49 (rare)
5. **Backups + DR**:
   - Backups must respect residency
   - DR site within same legal region
   - Cross-region DR triggers transfer mechanism review
6. **Logs + observability**:
   - Most observability vendors are US-based
   - Datadog EU site, New Relic EU, Sentry EU
   - PII scrubbing pre-transit if vendor is US
7. **Support / employee access**:
   - Engineer in US accessing EU data = transfer
   - Just-in-time access + approval log
   - Pseudonymize before access where possible
8. **Sovereign cloud trigger**:
   - DoD / IC → AWS GovCloud / Azure Government / Google Assured Workloads
   - EU public sector → AWS European Sovereign Cloud / Azure local cloud
   - China → Alibaba Cloud / 21Vianet Azure / Tencent Cloud
9. **Architecture for residency**:
   - **Region-per-tenant** (preferred for strict residency)
   - **Region-routing** at edge (Cloudflare Workers / Lambda@Edge)
   - **Per-record region tag** (less common)
   - **Encrypt-at-rest + key in jurisdiction** (BYOK / HYOK)
10. **Vendor mapping**:
    - Each sub-processor pinned to region
    - Auth0 EU tenant, Stripe regional, Resend EU option, Datadog EU, etc.

## Output
Write `docs/inception/data-residency-<project>.md`:

```markdown
# Data Residency Map — <project>
**Date:** <YYYY-MM-DD>

## Customer geographies (Y1 → Y3)
| Region | Y1 | Y2 | Y3 |
|---|:--:|:--:|:--:|
| EU | ✓ primary | ✓ | ✓ |
| UK | ✓ | ✓ | ✓ |
| US | ✓ | ✓ | ✓ |
| Canada | – | ✓ | ✓ |
| Australia | – | – | ✓ |
| India | – | – | DPDPA risk Y3 |
| China | OUT (PIPL too heavy) | OUT | OUT |
| Russia | OUT | OUT | OUT |

## Data class × region matrix
| Data class | EU customer | UK customer | US customer | Storage region | Backup region | Notes |
|---|---|---|---|---|---|---|
| Marketing site cookies | EU | UK | US | edge | – | minimal data |
| Account metadata | EU | UK | US | per customer region | same | region tag at signup |
| PII (name, email, phone) | EU | UK | US | per customer region | same region | residency pin |
| Profile photo | EU | UK | US | S3 in region | cross-AZ same region | – |
| Payment (PAN tokenized) | Stripe-EU | Stripe-EU | Stripe-US | Stripe vault | Stripe | PCI scope minimal |
| Order history | EU | UK | US | per region | same region | 7yr tax retention |
| Logs (PII scrubbed) | EU agg | EU agg | US agg | Datadog regional | Datadog same | scrubber middleware |
| Analytics events | EU PostHog | EU PostHog | US PostHog | per region | – | – |
| Backups | EU snap | UK→EU | US snap | encrypted KMS-region | – | KMS in region |
| Support tickets | Zendesk EU | Zendesk EU | Zendesk US | regional Zendesk | – | DPA + SCC if US |

## Region pinning architecture
- Customer signup picks region (auto from IP, override possible)
- Region = `eu-west-1` | `us-east-1` (Y1)
- Per-region DB cluster (RDS) + S3 bucket + Redis
- Routing via Cloudflare Workers — region detected on first hit, stuck thereafter
- Cross-region read = explicit consent banner

## Cross-border transfer
| From | To | Mechanism | Notes |
|---|---|---|---|
| EU customer data | EU AWS | n/a | in-EU |
| EU customer data | US AWS | NEVER (Y1) | enforced at app layer |
| EU support ticket | US Zendesk | SCCs 2021/914 + DPF | TIA done |
| EU logs | US Datadog | SCCs + DPF | scrubbed pre-transit |
| EU profile photo | US support reviewer | JIT access + audit log | approval ticket |
| UK customer data | EU primary | UK IDTA addendum to SCC | done |

## Sub-processor region map
| Sub-processor | EU instance? | US instance? | Notes |
|---|:--:|:--:|---|
| Auth0 | ✓ EU tenant | ✓ US tenant | per-customer-region tenant |
| Stripe | ✓ Stripe-EU acct | ✓ Stripe-US acct | dual entities |
| Resend | ✓ EU region | ✓ US | – |
| PostHog | ✓ EU cloud | ✓ US cloud | – |
| Zendesk | ✓ EU | ✓ US | – |
| Datadog | ✓ datadoghq.eu | ✓ datadoghq.com | – |
| AWS | eu-west-1 | us-east-1 | primary infra |
| Cloudflare | global anycast | global | edge only, no PII storage |

## Schrems II posture
- All US sub-processors covered by SCCs 2021/914 + EU-US DPF certification
- TIA per processor on file
- FISA 702 risk acknowledged + mitigated by encryption + minimal data
- Watching Schrems III court action (assume DPF could fall, prep BCRs Y2)

## Sovereign cloud assessment
- Y1: NOT needed (commercial cloud sufficient)
- Y2: monitor DoD pipeline → AWS GovCloud sandbox eval
- Y3: if EU public sector enterprise → AWS European Sovereign Cloud opt-in

## BYOK / HYOK
- Y1: AWS-managed KMS keys per region
- Y2: BYOK option for enterprise customers (KMS external key)
- Y3: HYOK for regulated customers (key in customer HSM)

## Localization-trigger watch list
| Trigger | Action |
|---|---|
| Russia customer | OUT (152-FZ requires Russia primary processing — too heavy) |
| China customer | OUT (PIPL CAC assessment too heavy Y1-Y2) |
| India SDF threshold | monitor; may need in-India region |
| KSA enterprise | likely need in-Saudi Aramco-cloud-region |
| UAE DIFC | free-zone exemption applies |
| Brazil LGPD enterprise | adequacy via SCCs |
| Canada Quebec Law 25 | sectoral health → in-Quebec |
| US healthcare | HIPAA in-US only |

## Effort + cost
| Activity | Cost |
|---|--:|
| Region-aware infra setup | 4 wk eng |
| Per-region pipelines | 2 wk DevOps |
| Sub-processor DPA + SCC chase | 1 wk legal |
| Schrems II TIAs | $5k legal |
| Annual review | 3 d |
| **Y1 total** | **~$15k legal + 6 wk eng** |

## Standards alignment
- GDPR Chapter V (transfers) ✓
- UK GDPR + DPA 2018 ✓
- Schrems II (CJEU C-311/18) ✓
- ISO 27018 (cloud PII) ✓
- ISO 27701 ✓

## Risk if skipped
- EU regulator fine (4% global revenue under GDPR)
- Schrems-style litigation
- Customer trust loss on residency disclosure
- Sales-disqualifying for EU public sector / regulated industries
- Migration retrofit cost = 5–10× if region-unaware Y1

## 90-day plan
1. Customer region survey + projection (week 1)
2. Region architecture decision (week 2–3)
3. Sub-processor region pinning (week 3–4)
4. SCC + DPF + TIA paperwork (week 4–6)
5. Region-routing edge code (week 6–8)
6. Per-region backup + KMS setup (week 8–10)
7. Annual residency review calendar (week 12)
```

## Verification
- Region pin per data class.
- Cross-border mechanism per transfer.
- Sub-processor region map.
- Schrems II posture declared.
- Sovereign cloud assessed.
