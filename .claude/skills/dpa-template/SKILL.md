---
name: dpa-template
description: Data Processing Agreement template — GDPR Art. 28 + CCPA service-provider terms, SCCs for cross-border, sub-processor chain, security measures, breach notification, audit rights, deletion at end. Outputs to `docs/inception/dpa-template-<project>.md`. Use when user says "DPA", "data processing agreement", "GDPR processor", "CCPA service provider", "SCCs", "/dpa-template", or before any vendor or customer handles personal data.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /dpa-template — DPA Is The Compliance Glue. Without It You're A Data Pirate.

## Why you'd care

The first enterprise prospect's procurement team won't sign the MSA until a DPA is attached, and a hand-redlined one-off DPA per customer costs $400/hr in legal and 3 weeks of deal slip per deal. A pre-drafted DPA template with SCCs baked in and a sub-processor list maintained as living state is what turns "send us your DPA" from a deal-killer into a 5-minute reply, and it's the artifact GDPR Art. 28 makes effectively mandatory between controller and processor anyway.

DPA ≠ optional add-on. DPA = required by GDPR Art. 28 between controller and processor, and effectively required by CCPA / UK GDPR / Brazil LGPD. Without DPA: regulator finds Provider is "selling" data (CCPA), Controller is in breach of Art. 28, Customer can refuse to pay. Standard contractual clauses (SCCs) needed for EU→US transfers post-Schrems II.

## Pre-flight
Run before first paying customer that involves personal data / first vendor processing your customer's data. Pairs with `/pii-inventory-pre`, `/msa-template`, `/privacy-policy-pre`, `/gdpr-preflight`.

## Inputs
- Direction (we're processor receiving Customer data / we're controller sending data to vendor).
- Data subjects' regions (EU / UK / California / Brazil / Canada / global).
- Personal data categories (basic / special category Art. 9 / criminal Art. 10 / children).
- Processing locations (EU / UK / US / India / global).
- Sub-processor chain (cloud / analytics / payment / email / support tools).
- Customer type (B2C / B2B SMB / B2B enterprise demanding specific terms).

## Process
1. **Roles** — controller vs processor vs joint controller (rare).
2. **Scope** — categories of data, subjects, purposes, duration.
3. **Processor obligations** — only on documented instructions, confidentiality, security, sub-processor, assistance, breach notification, deletion.
4. **Sub-processor management** — list + change procedure + flowdown.
5. **Cross-border transfer** — SCCs Module 2 / 3, UK addendum, transfer impact assessment.
6. **Security measures** — Annex II / SoA.
7. **Breach notification timeline** — without undue delay (typically ≤72h).
8. **Audit rights** — annual + on breach, with reasonable scope.
9. **Termination + deletion** — return or delete on instruction.
10. **CCPA service provider language** — flowdown + no-sell + no-share.

## Output
Write `docs/inception/dpa-template-<project>.md`:

```markdown
# DPA Template — <project>
**Owner:** founder / Data Protection Officer / counsel
**Date:** <YYYY-MM-DD>
**Counsel review:** <date + firm>
**Version:** 1.0
**Direction:** we are processor / we are controller / both
**Effective basis:** GDPR Art. 28 + CCPA + UK GDPR + LGPD (as applicable)

## When DPA is needed
- Vendor handles personal data on your behalf (cloud / email / analytics / payment / support / CDN)
- You handle Customer's end-user personal data (SaaS / processor)
- Joint controllers in marketing / co-branded service (rare — Art. 26 joint controller arrangement)
- B2B customer requires you sign their DPA (enterprise SaaS sales)

## When DPA is NOT enough (need more)
- Special category data (Art. 9): explicit consent / DPIA / extra TOMs
- Children's data (under 13/16): COPPA / parental consent
- Health (HIPAA BAA needed)
- Payment card (PCI DSS — separate compliance)
- AI training on personal data (AI Act + data minimization extra rigor)

## Roles
**Controller** — determines purposes + means of processing
**Processor** — processes on behalf of controller, per documented instructions
**Sub-processor** — processor engaged by processor
**Joint controllers** — jointly determine purposes/means (rare for vendor relationships)

**Common confusion:** SaaS Provider is processor for Customer's end-user data, but controller for Customer Contact / billing data. Both DPA + privacy policy needed.

## Document structure

### 1. Definitions
- "Personal Data" — per GDPR Art. 4(1), CCPA / CPRA, UK GDPR, LGPD
- "Process" / "Processing" — per applicable law
- "Controller" / "Processor" / "Sub-processor"
- "Data Subject" — natural person
- "Personal Data Breach" — per GDPR Art. 4(12)
- "Standard Contractual Clauses" — EU 2021/914 + UK Addendum
- "Applicable Data Protection Law" — list of laws covered

### 2. Scope + subject matter
Annex I.B (table):

| Field | Value |
|-------|-------|
| Subject matter | <Services per MSA> |
| Duration | Term of MSA + 30 days wind-down |
| Nature + purpose | <e.g., providing SaaS booking platform> |
| Categories of data subjects | <Customer's employees / end-users / etc> |
| Categories of personal data | <names / email / IP / payment tokens / etc> |
| Special categories (Art. 9) | <none / list> |
| Frequency of transfer | <continuous / periodic> |

### 3. Processor obligations (Art. 28(3))

#### 3.1 Instructions only
- Process only on documented instructions from Controller
- Instructions = Agreement + SOW + DPA + future written instructions
- If Processor believes instruction infringes law: notify Controller before complying (Art. 28(3)(h))

#### 3.2 Confidentiality
- Personnel authorized + bound by confidentiality (statutory or contractual)
- Need-to-know access
- Maintain on termination of employment

#### 3.3 Security (Art. 32)
- Implement appropriate Technical + Organizational Measures (TOMs)
- Detailed in Annex II
- Account for state of the art, costs, nature/scope/context/purposes, risk
- Pseudonymization + encryption where appropriate
- Ongoing CIA (confidentiality, integrity, availability)
- Regular testing / assessment

#### 3.4 Sub-processors (Art. 28(2) + 28(4))
- General authorization with list (Annex III) + change procedure
- OR specific written authorization per sub-processor
- Notice of intended changes: 30 days before, Controller may object
- Flowdown: sub-processor bound by same obligations via written contract
- Processor remains liable for sub-processor's compliance

#### 3.5 Data subject rights assistance (Art. 28(3)(e))
- Assist Controller in responding to data subject requests (access / rectification / erasure / restriction / portability / objection)
- Reasonable assistance, technical + organizational measures
- Forward request to Controller within 5 business days if directed to Processor
- Fees: only reasonable costs beyond standard support

#### 3.6 Compliance assistance (Art. 28(3)(f))
- Assist with DPIA, prior consultation with supervisory authority, security obligations
- Provide info reasonably necessary to demonstrate compliance

#### 3.7 Breach notification (Art. 33-34)
- Notify Controller "without undue delay" of any Personal Data Breach
- **Specific timeline: ≤72 hours** (industry standard; some demand ≤48h or ≤24h)
- Notice includes:
  - Nature of breach
  - Categories + approximate numbers of subjects + records
  - Likely consequences
  - Measures taken or proposed
  - Contact point for more info
- Cooperate in Controller's notification to supervisory authority + data subjects
- No Processor obligation to notify authorities directly (that's Controller's role)

#### 3.8 Return or deletion (Art. 28(3)(g))
- At Controller's choice: return or delete all Personal Data at end of service
- Within <30 / 60 / 90> days
- Certify deletion in writing
- Exception: legal retention obligation (state period)

#### 3.9 Audit (Art. 28(3)(h))
- Make available info needed to demonstrate compliance
- Allow + contribute to audits by Controller or third party (under NDA)
- Frequency: once per year + on documented suspicion of breach
- Notice: 30 days unless emergency
- Scope: relevant to Processor's processing of Controller's data
- Cost: Controller's expense unless audit finds material non-compliance
- Alternative: SOC 2 Type II / ISO 27001 report acceptable as audit substitute

### 4. Sub-processor management

#### List (Annex III)
| Sub-processor | Country | Service | Data accessed |
|---------------|---------|---------|---------------|
| AWS | US (us-east-1) | Hosting | All Customer Data |
| Stripe | US | Payment processing | Payment tokens |
| Sentry | US | Error tracking | IP + UA + path |
| Postmark | US | Transactional email | Email + name |
| ... | | | |

#### Change procedure
- 30 days written notice (email / portal) of new sub-processor
- Controller may object on reasonable grounds (data protection-related)
- If objection unresolvable: Controller may terminate without penalty
- Emergency replacement: notice without 30-day window if necessary

#### Flowdown
- Each sub-processor contract has equivalent terms
- Processor provides copy of sub-processor terms on request (redacted commercials OK)
- Processor liable for sub-processor's compliance failures

### 5. Cross-border transfers

#### Adequacy decisions
- EU adequacy: UK, Switzerland, Japan, South Korea, Israel, NZ, Canada (commercial), USA (DPF — Data Privacy Framework, status check needed)
- Transfers to adequacy countries: no further mechanism needed

#### Non-adequacy (most US transfers post-Schrems II)
- **EU SCCs 2021/914**:
  - Module 1: Controller → Controller
  - Module 2: Controller → Processor (most common — Customer → Provider)
  - Module 3: Processor → Sub-processor (Provider → Sub-provider)
  - Module 4: Processor → Controller (reverse, rare)
- **UK Addendum (IDTA / Addendum to SCCs)** for UK transfers
- **Swiss Addendum** for Swiss transfers
- **Transfer Impact Assessment (TIA)** documented (Annex IV)
- **Supplementary measures** if TIA flags risk: encryption with EU-held keys, contractual additional, organizational

#### EU-US Data Privacy Framework (DPF)
- US Provider can self-certify DPF (commerce.gov)
- DPF certification = adequacy basis (no SCC needed for that flow)
- Active certification check before relying on it

#### Other regional
- LGPD (Brazil): adequacy or contractual safeguards
- China PIPL: standard contract + security assessment
- India DPDP Act: notified country list / contract

### 6. Security measures (Annex II — TOMs)

Required to detail. Sample structure:

#### Physical security
- Data center: tier III+ / SOC 2 Type II / ISO 27001 certified
- Access control: badge + biometric / 24/7 monitored
- Office: keycard / visitor log / clean desk policy

#### Logical security
- Encryption in transit: TLS 1.2+
- Encryption at rest: AES-256
- Key management: HSM / KMS, rotation policy
- MFA for all admin access
- Role-based access control (RBAC)
- Quarterly access review

#### Network security
- Firewall / WAF
- DDoS protection
- VPC isolation
- IDS / IPS

#### Application security
- SDLC with security review
- SAST / DAST in CI
- Dependency vulnerability scanning
- Pen test annually (third party)
- Bug bounty (optional)

#### Operations
- Logging + monitoring 24/7
- SIEM / log retention 12+ months
- Backup: encrypted, offsite, tested quarterly
- Incident response plan (see `/incident-runbook`)
- Business continuity / DR

#### Personnel
- Background checks (where lawful)
- Security training on hire + annual
- Confidentiality agreement
- Termination access revocation within 24h

#### Compliance
- SOC 2 Type II / ISO 27001 / HIPAA / PCI / etc. as applicable
- Pen test report annually
- DPIA on new processing

### 7. CCPA / CPRA service provider terms

For California data + Provider as service provider:

**Required language:**
- Provider is "service provider" not "third party"
- Personal info only used for "Business Purpose" defined in contract
- **No selling, sharing, or retaining** personal info beyond contract
- No combining with other PI from other sources (except aggregated/de-identified)
- Equivalent contractual restrictions on sub-processors
- Allow Controller to monitor compliance
- Notify Controller if cannot meet obligations

**Business Purposes (per CCPA Reg. §7050(b)):**
- Auditing / security / debugging
- Short-term transient use / customer service
- Providing services per contract
- Internal R&D for service improvement
- Limited operational improvement

### 8. Liability + indemnification

#### Standalone DPA cap
- Often references MSA cap
- Some Controllers demand uncapped for data protection law fines + Art. 82 damages
- Counter: cap at 2-3× MSA cap, super-cap exceptions

#### Indemnification
- Mutual for each party's regulatory violations
- Controller indemnifies for unlawful instructions
- Processor indemnifies for violations of DPA obligations

#### Regulatory fines pass-through
- Most jurisdictions: each party pays its own fines (Art. 82 splits liability)
- Negotiate: pass-through if other party caused

### 9. Term + termination
- Coterminous with MSA
- Survives MSA for data retained
- Termination of DPA without termination of MSA = Provider can't process = MSA effectively terminated
- Wind-down: 30 days for return / deletion

### 10. Boilerplate
- Governing law: aligns with MSA
- Order of precedence: DPA > MSA on data protection matters
- Counterparts / electronic signature
- Notices per MSA

## Annexes

### Annex I — Description of processing
**Part A: List of parties**
- Controller (Customer): <details>
- Processor (Provider): <details>
- EU representative (if applicable, Art. 27)
- DPO (if applicable)

**Part B: Description of transfer / processing**
- Categories of data subjects
- Categories of personal data
- Special categories
- Frequency
- Nature of processing
- Purpose
- Retention period
- For SCCs: transfer-specific details

### Annex II — Technical + Organizational Measures
Per Section 6 above.

### Annex III — Sub-processors
List + countries + services + data accessed.

### Annex IV — Transfer Impact Assessment (where SCCs used)
- Recipient country laws affecting SCCs
- Mass surveillance risk
- Supplementary measures
- Onward transfer constraints
- Mitigation conclusion

### Annex V — UK Addendum (if UK transfers)
- IDTA template OR Addendum to EU SCCs
- Tables filled per ICO format

## Counterparty negotiation playbook

### Customer-pushed redlines (we're Provider)
| Their ask | Response |
|-----------|----------|
| Breach notification ≤24h | Counter: ≤72h industry standard, ≤48h with cyber insurance |
| Audit any time, any scope | Counter: annual + on breach, 30-day notice, NDA, SOC 2 acceptable |
| Uncapped liability for breach | Counter: 2-3× MSA cap, exclude fines from Controller's own actions |
| Sub-processor with consent each | Push general authorization + 30-day objection period |
| No sub-processors outside EU | Acceptable if pricing accommodates |
| Annex II must include specific certs | Provide what we have; commit roadmap for others |
| BAA / PCI / FedRAMP supplement | If applicable scope, separate addendum, additional fees |
| Customer's specific TIA | Provide own assessment; theirs as template |
| Indemnify any fine | Counter: only fines caused by our breach |
| Return data in customer-specified format | Reasonable format; standardize on JSON / CSV |
| Insurance specific limits | Standard cyber $1-5M per claim |

### Vendor-pushed redlines (we're Controller)
| Their ask | Response |
|-----------|----------|
| Breach notification ≤7 days | REFUSE — 72h or your team can't comply with your own obligations |
| Sub-processor list "available on portal" | Accept if 30-day change notice |
| Limit assistance with data subject requests | Accept if reasonable cost recovery |
| Exclude special category data | Accept if you don't send it; verify in mapping |
| Audit only via SOC 2 report | Accept if recent + Type II + relevant scope |
| Standard SCCs only, no supplementary | Push back if TIA flags risk |
| Cap their liability at fees paid | Negotiate up + super-cap for Art. 82 + fines |
| No DPF, only SCCs | Accept (DPF stability uncertain) |

## Common DPA configurations

### Configuration A: Provider's DPA (we issue)
- DPA attached as Exhibit B to MSA
- Customer signs DPA as part of MSA execution
- Standard terms apply unless redlined
- One DPA per Customer

### Configuration B: Customer's DPA (enterprise SaaS sales)
- Customer demands their template
- Counsel review essential
- Negotiate specific points (audit, sub-processor, liability, breach timeline)
- Process: 4-12 weeks for enterprise

### Configuration C: Trust Center / online DPA
- Public DPA hosted on website
- Click-through acceptance OR auto-incorporated by ToS
- Used by Stripe / AWS / Google Cloud model
- Update mechanism: notice email + version

### Configuration D: Cross-flow (we are both Controller and Processor)
- Two DPAs needed:
  - We send PII to vendor: we as Controller, vendor as Processor
  - Customer sends PII to us: we as Processor, Customer as Controller
- Keep separate, don't conflate

## Special situations

### B2B with US-only data
- No GDPR coverage if all data subjects US-only
- CCPA service provider terms still needed for CA data
- Simpler DPA — only CCPA + standard MSA confidentiality

### Children's data (COPPA / GDPR-K)
- Parental consent flowdown
- Age verification responsibility allocation
- Stricter retention + deletion

### Cookies + tracking
- DPA covers if cookies = personal data (most cookies are, per GDPR)
- Consent flowdown: Controller obtained consent, Processor relies on Controller's representation
- Not a substitute for cookie consent banner

### AI training on PII
- DPA covers but check:
  - Lawful basis for training
  - Data subject rights (especially erasure → model deletion)
  - Cross-border for model hosting
  - EU AI Act overlay

### Health data (HIPAA)
- Business Associate Agreement (BAA) required, distinct from DPA
- BAA + DPA both needed if Provider handles EU PII + US PHI
- Often single combined document for global SaaS

### Payment card data
- PCI DSS compliance separate
- Use tokenization (Stripe / Adyen handle PCI scope)
- DPA still needed for non-PCI personal data

### Sensitive (Art. 9) data
- Explicit consent or other Art. 9 basis
- DPIA mandatory
- TOMs heightened
- Privacy by design (see `/privacy-by-design-charter`)

## Sub-processor vendor list maintenance
- Annex III maintained as live document
- Quarterly review: new vendors, removed vendors, changed roles
- Customer notification template:
  ```
  Subject: Sub-processor update — <vendor name>
  Effective: <date 30+ days out>
  Service: <description>
  Country: <location>
  Data accessed: <categories>
  Objection deadline: <date>
  ```
- Customer-facing list on website or trust center

## Common DPA failures
- ❌ No DPA at all — found in audit, fine + breach claim
- ❌ DPA with vendor that processes EU data but vendor not in EU and no SCCs
- ❌ Sub-processor not flowdown'd — breaks chain
- ❌ Breach notification too late (>72h to authority via Controller)
- ❌ Annex II generic / not reflective of actual TOMs
- ❌ Audit refused on grounds of confidentiality — should be NDA'd not refused
- ❌ DPA signed but never enforced in operations
- ❌ Old SCCs (2010 pre-Schrems) still referenced
- ❌ DPF reliance without checking active certification
- ❌ No transfer impact assessment for non-adequacy destination

## Versioning
- DPA v1.0 → v2.0 on material change (SCCs update, new regulator guidance)
- Notice to customers: 30 days
- Auto-incorporation or signature renewal
- Track which customer signed which version

## Pre-launch checklist
- [ ] Counsel-reviewed baseline DPA (issue + receive directions)
- [ ] Annex II TOMs reflect actual security posture
- [ ] Sub-processor list maintained + change procedure live
- [ ] SCCs Module 2/3 attached + UK Addendum if UK customers
- [ ] DPF certification (if relying on it)
- [ ] CCPA service provider language (if CA data)
- [ ] Breach notification process tested
- [ ] Audit procedure documented (SOC 2 / ISO substitute)
- [ ] Return / deletion process tested
- [ ] Storage + versioning

## Anti-patterns flagged
- ❌ No DPA in place — Art. 28 breach
- ❌ Vague Annex II (no specific TOMs)
- ❌ No sub-processor change procedure
- ❌ Old SCCs (pre-2021)
- ❌ Reliance on DPF without certification check
- ❌ Audit blanket refused
- ❌ Breach timeline ≥7 days
- ❌ No TIA for non-adequacy transfers
- ❌ DPA signed but operations don't match

## Next
- PII inventory → `/pii-inventory-pre`
- Privacy by design → `/privacy-by-design-charter`
- GDPR preflight → `/gdpr-preflight`
- CCPA preflight → `/ccpa-preflight`
- Cyber insurance → `/cyber-insurance-pick`
- Threat model → `/threat-model-pre`
```

## Verification
- Roles defined (controller / processor / sub-processor).
- Art. 28(3) obligations all covered.
- Sub-processor list + change procedure.
- SCCs Module 2/3 + UK Addendum if needed.
- TIA for non-adequacy.
- TOMs in Annex II reflective.
- Breach notification ≤72h.
- CCPA service provider language for CA data.
- Audit + return/delete procedures.
- Counsel review baseline + per-customer redline.
