---
name: ai-act-classifier
description: EU AI Act risk-tier classification — prohibited / high-risk / limited / minimal + GPAI. Outputs to `docs/inception/ai-act-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "AI Act", "EU AI", "GPAI", "high-risk AI", "/ai-act-classifier", or before deploying AI in EU.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /ai-act-classifier — EU AI Act Risk Classification

## Why you'd care

EU AI Act fines reach 7% of global turnover and "we didn't know our system was high-risk" is not a defense. Tier classification before deploy decides whether you need a conformity assessment, a fundamental-rights impact assessment, both, or neither.

Invoke as `/ai-act-classifier`. Required for any AI system touching EU users or sold in EU. Regulation (EU) 2024/1689.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP (no AI yet)
2. Read `docs/inception/regulatory-<project>.md`.
3. Read `docs/inception/gdpr-<project>.md` (overlap on profiling, automated decisions).

## Inputs
- AI system or general-purpose AI model (GPAI)?
- Use cases (recruitment, credit, biometrics, education, law enforcement, etc.).
- Provider, deployer, importer, or distributor role.
- EU users or models placed on EU market.
- Foundation model FLOPs (>10^25 = systemic risk GPAI).

## Process
1. **Role classification**:
   - **Provider** — develops AI system or has it developed and places on EU market
   - **Deployer** — uses AI system under its authority (excluding personal non-professional use)
   - **Importer** — brings AI system from outside EU
   - **Distributor** — makes available without altering
2. **Risk tier (Article 6 + Annex III)**:
   - **Prohibited** (Article 5) — social scoring by public, real-time biometric ID in public, emotion recognition in workplace/school, predictive policing solely on profiling, untargeted facial scraping, manipulation of vulnerable groups, dark patterns
   - **High-risk** (Annex III) — biometric ID, critical infrastructure, education/vocational, employment/HR/recruitment, essential services (credit scoring, public benefits, life/health insurance pricing), law enforcement, migration/border, justice/democratic processes; OR safety component of regulated product (Annex I)
   - **Limited risk** (Article 50) — chatbots, deepfakes, emotion recognition, AI-generated content → transparency obligations only
   - **Minimal risk** — everything else (spam filter, video game AI) → voluntary code of conduct
3. **GPAI obligations** (Chapter V, applies Aug 2025):
   - Technical documentation
   - Copyright policy (training data)
   - Training content summary (template forthcoming)
   - **Systemic risk GPAI** (>10^25 FLOPs or designated): model evaluation, adversarial testing, incident reporting, cybersecurity
4. **High-risk obligations** (Chapter III, full applicability Aug 2026):
   - Risk management system (Article 9)
   - Data governance — training/validation/test sets quality
   - Technical documentation (Annex IV)
   - Record-keeping — automatic event logs
   - Transparency to deployer + instructions for use
   - Human oversight design
   - Accuracy, robustness, cybersecurity
   - Quality management system
   - Conformity assessment (internal control or notified body)
   - CE marking
   - EU declaration of conformity
   - Registration in EU AI database (Article 71)
   - Post-market monitoring + serious incident reporting (15 days; immediate for fundamental rights infringement)
5. **Deployer obligations** (high-risk):
   - Use per instructions
   - Human oversight assignment
   - Input data relevance
   - Monitor operation + log retention 6 months
   - Inform affected workers (worker representatives) before use
   - Fundamental Rights Impact Assessment (FRIA) for public bodies + private essential services
6. **Transparency (limited risk Article 50)**:
   - Disclose AI interaction (chatbot)
   - Label deepfakes ("artificially generated")
   - Label AI-generated text on public-interest matters
   - Inform subjects of emotion recognition / biometric categorization
7. **Timeline**:
   - **Feb 2025** — prohibited practices ban + AI literacy obligation
   - **Aug 2025** — GPAI obligations + governance bodies + penalties
   - **Aug 2026** — high-risk Annex III + transparency
   - **Aug 2027** — high-risk Annex I (regulated products) + GPAI placed before Aug 2025
8. **Fines**:
   - Prohibited practice: €35M or 7% global revenue
   - Other obligations: €15M or 3%
   - Misleading info to authority: €7.5M or 1%
   - SME caps: lower of the two
9. **Sandboxes** (Article 57) — each Member State must have AI regulatory sandbox; preferential access for SMEs

## Output
Write `docs/inception/ai-act-<project>.md`:

```markdown
# EU AI Act Classification — <project>
**Date:** <YYYY-MM-DD>

## Role
- **Type:** Provider (we develop the model + system)
- Also Deployer for internal use cases
- Importer/Distributor: n/a

## System inventory
| System | Use case | Risk tier | Annex |
|---|---|---|---|
| Resume screening AI | HR recruitment | **HIGH-RISK** | Annex III §4 |
| Customer support chatbot | service | LIMITED | Art 50 |
| Spam classifier | email filter | MINIMAL | — |
| Onboarding biometric verify | identity | **HIGH-RISK** | Annex III §1 |

## GPAI status
- Foundation model: **No** (we fine-tune Llama / Mistral / GPT-4)
- Or: **Yes** if pre-training compute >10^25 FLOPs
- Systemic risk: No (no >10^25 model)
- Note: if downstream of GPAI provider, request their technical doc summary

## Prohibited check
- Social scoring: NO
- Real-time public biometric: NO
- Emotion recognition in workplace: **REVIEW** — sentiment analysis on support calls borderline; legal review
- Subliminal manipulation: NO
- Untargeted face scraping: NO
- Verdict: borderline emotion → mitigate (opt-in, no employment decisions)

## High-risk obligations (per system)
| Obligation | Resume AI | Biometric | Notes |
|---|:--:|:--:|---|
| Risk management system | ⚠ build | ⚠ build | ISO/IEC 23894 reference |
| Data governance | ⚠ build | ⚠ build | bias audit, representativeness |
| Technical doc (Annex IV) | ✗ | ✗ | model card pre-draft skill |
| Auto event logging | ✗ | ✗ | 6-mo retention min |
| Transparency to deployer | ⚠ | ⚠ | instructions for use |
| Human oversight | ⚠ | ⚠ | reviewer override workflow |
| Accuracy + robustness testing | ⚠ | ⚠ | adversarial eval |
| Quality management system | ✗ | ✗ | QMS ISO 9001-style |
| Conformity assessment | ✗ | ✗ | internal control allowed for Annex III §4 |
| CE marking | ✗ | ✗ | |
| EU declaration of conformity | ✗ | ✗ | |
| EU AI database registration | ✗ | ✗ | Article 71 |
| Post-market monitoring | ✗ | ✗ | incident reporting 15 days |

## Limited-risk transparency (Article 50)
- Chatbot: "You are speaking with an AI" disclosure on first message ✓
- Deepfake / AI-generated images: visible label + machine-readable marker
- AI-generated public-interest text: label
- Emotion recognition / biometric categorization: inform subjects

## Fundamental Rights Impact Assessment (FRIA)
- Required for: public bodies + private deployers of high-risk AI in essential services
- Applies to us? Resume AI for non-public employer → **No** (deployer is private + recruitment not "essential service" per Art 27)
- Document anyway (good practice + audit defense)

## Conformity assessment route
- Resume AI: Annex III §4 → **internal control** (Annex VI) sufficient
- Biometric: Annex III §1 → **notified body** (Annex VII) required
- Notified body candidates: TÜV, Bureau Veritas, DEKRA (when designated)

## Timeline + gates
| Date | Obligation triggered |
|---|---|
| 2025-02-02 | Prohibited practices live + AI literacy training launched |
| 2025-08-02 | GPAI obligations live (n/a — we don't provide GPAI) |
| 2026-08-02 | Full high-risk obligations live → CE mark + DB registration |
| 2027-08-02 | Annex I high-risk + grandfathered GPAI |

## Effort + cost (Y1–Y2)
| Activity | Cost |
|---|--:|
| Risk management system + QMS build | $40k |
| Data governance audit (training set quality, bias) | $25k |
| Technical doc (Annex IV) per system | $15k each |
| Conformity assessment (internal) | $10k |
| Conformity assessment (notified body — biometric) | $50k |
| Post-market monitoring tooling | $20k/yr |
| Legal counsel (AI specialist) | $30k |
| **Total to Aug 2026** | **~$200k** |

## Sandbox option
- Apply to <Member State> AI sandbox (DE BfDI, FR CNIL, IE DPC) for staged compliance
- SME preferential access (free or low fee)
- Useful for biometric system pre-launch

## Risk if skip
- €35M or 7% global revenue (prohibited)
- €15M or 3% (high-risk non-compliance)
- EU market exclusion
- Civil liability under AI Liability Directive (forthcoming)
- Class action under Representative Actions Directive

## Adjacent regimes
- **GDPR Article 22** — automated individual decisions overlap
- **DSA / DMA** — recommender systems for very large platforms
- **Product Liability Directive** (revised 2024) — AI included
- **AI Liability Directive** (proposed) — fault presumption easing

## 90-day plan
1. Inventory all AI systems + classify per Annex III (week 1–2)
2. Prohibited practices audit + cease/mitigate (week 1–2)
3. AI literacy training rollout (week 3–4)
4. Risk management system charter (week 4–6)
5. Data governance gap analysis (week 6–8)
6. Technical doc template + first system fill (week 8–10)
7. Conformity route decision per system (week 10–12)
8. Notified body engagement if needed (week 12)
```

## Verification
- Role decided.
- Each AI system tier-classified with Annex citation.
- Prohibited practices explicitly checked.
- High-risk obligations enumerated per system.
- Conformity route + timeline declared.
- FRIA decision documented.
