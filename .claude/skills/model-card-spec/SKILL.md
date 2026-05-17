---
name: model-card-spec
description: Model card authored per Mitchell et al. 2019 "Model Cards for Model Reporting" — Model Details, Intended Use, Factors, Metrics, Evaluation Data, Training Data, Quantitative Analyses (unitary + intersectional), Ethical Considerations, Caveats — adapted for LLMs with hallucination rate, refusal rate, jailbreak resistance, training-data license, and watermarking notes. Use when user says "model card", "model documentation", "Mitchell model card", "publish model facts", "/model-card-spec", or before shipping any model-producing feature, before external model-distribution, or when an enterprise buyer asks for a model fact sheet. Writes docs/ai/model-card-spec-<project>.md.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 8h
---

# /model-card-spec — Mitchell-Style Model Card for an LLM or Classifier

## Why you'd care

A model shipped without a model card is a model nobody outside the original team can audit. Enterprise buyers ask for it, regulators (EU AI Act, NIST AI RMF) increasingly require it, and journalists who do not get one make up their own. Writing the card before launch forces you to discover what you don't actually know about your model — typically the intersectional slices and the out-of-scope uses — while there is still time to fix it.

Invoke as `/model-card-spec`. Required before any consequential or externally-distributed model, recommended for any production-facing LLM feature.

## Pre-flight

- Read `docs/classify/<project>.md`. XS → SKIP (toy projects do not need a formal card).
- Read `docs/design/ai-bias-<project>.md` if `/ai-bias-audit-design` has been run — its slice metrics feed the Quantitative Analyses section directly.
- Read `docs/inception/regulatory-<project>.md` to map the card to the regulatory regime (EU AI Act high-risk, NYC LL144, Colorado AI Act, FDA SaMD, etc.).
- Identify whether the model is internally trained, fine-tuned from a base, or used as-is via API — the card sections differ.
- Confirm the audience: internal eng, enterprise buyer, regulator, end user, research community. The same nine sections, three different levels of redaction.

## Inputs

- Model artifact identifier (checkpoint hash, base-model id + adapter, or API model version).
- Training-data provenance: sources, licenses, dates, demographics, consent posture.
- Evaluation dataset(s) and how labels were sourced.
- Performance metrics on the eval set, including per-slice breakdowns when available.
- Known failure modes from internal testing or red-teaming.
- Intended deployment surface and decision authority (auto-action, human-in-loop, advisory).
- License under which the model itself will be distributed or accessed.

## Process

1. **Pin the model identity.** Capture developer/owner, release date, version string, model type (autoregressive LLM, encoder classifier, diffusion, retrieval-augmented composite), base model + adapter chain, paper or technical report URL, code repo, model license (Apache 2.0, MIT, Llama Community, OpenRAIL, proprietary), API model id if served. Without an immutable identifier the rest of the card is unverifiable.
2. **Write the Intended Use section twice — primary and out-of-scope.** Primary: the use case the model was trained and evaluated for, the user persona, and the decision authority. Out-of-scope: enumerated misuses (clinical diagnosis, legal advice, credit decisions, high-stakes content moderation without human review, generation of biometric identifiers). Out-of-scope is the section most often skipped and most often cited by attackers; write it.
3. **Enumerate Factors.** Demographic groups (age band, sex, race/ethnicity per relevant taxonomy, language, dialect), phenotypic groups where relevant (skin tone via Fitzpatrick or MST for vision, accent for speech), instrumentation factors (device class, lighting, sample rate, prompt length, tool-availability), and environment factors (jurisdiction, time of day, locale). Each factor becomes a slice axis in the Quantitative Analyses table.
4. **Pick Metrics and decision thresholds.** Choose primary metric per task (accuracy, F1, BLEU/ROUGE/BERTScore for generation, exact-match for QA, retrieval recall@k, faithfulness for RAG). For LLMs add: **hallucination rate** (claims unsupported by source or world-knowledge, measured against a labelled set), **refusal rate** (rate of declining benign requests, the false-positive of safety), **jailbreak resistance** (pass rate on an adversarial prompt suite — team-set threshold; domain-dependent). Capture decision thresholds (the score above which the model output is acted on) and the rationale.
5. **Describe Evaluation Data.** For each eval set: dataset name, version, size, motivation for inclusion, preprocessing, label provenance (human-labelled with N raters and IRR, model-labelled, synthetic), license, and demographic composition where measurable. If the eval set was constructed in-house, link to the construction protocol.
6. **Describe Training Data with the same fields,** plus the consent posture (public web crawl, licensed corpus, user-consented data, synthetic, model-generated), the training-data license that propagates to the model (especially for derivative use), and any deduplication or PII-scrubbing applied. For API-only models where training data is opaque, state that explicitly and link to the upstream provider's disclosure.
7. **Run Quantitative Analyses — unitary and intersectional.** Unitary: primary metric per factor slice (age band, sex, race, language). Intersectional: at minimum the cross of the two most consequential factors (e.g. race × sex, language × dialect). For LLMs add per-slice hallucination and refusal rates. Flag slices with N below a usability threshold (commonly N<100, team-set) as insufficient-evaluation rather than reporting noisy point estimates.
8. **Write Ethical Considerations.** Foreseeable harms (allocational, quality-of-service, representational, stereotyping, denigration, surveillance enablement), known dual-use risks, mitigations in place, residual risk accepted by the deployment owner. Reference the bias-audit output if it exists.
9. **Write Caveats and Recommendations.** What the eval doesn't cover (slices not measured, environments not tested, attack surfaces not red-teamed), recommended human-review thresholds, sunset triggers (when to retrain or retire), and watermarking or provenance posture (C2PA, SynthID, none).
10. **Pin the card itself.** Card version, card author, card date, card review cadence, where the card lives (public URL, internal wiki, repo `docs/ai/`). The card is itself versioned — when the model changes the card changes, and the prior card is preserved.

## Output Format — `docs/ai/model-card-spec-<project>.md`

```markdown
---
project: <project>
date: <YYYY-MM-DD>
card-version: <semver>
model-version: <hash or id>
audience: internal | enterprise | regulator | public
status: draft | reviewed | published
---

# Model Card — <model name> v<version>

## Model Details
- Developer / owner:
- Release date:
- Model version:
- Model type: <autoregressive LLM | encoder classifier | diffusion | RAG composite>
- Base model + adapters: <e.g. Llama-3-70B + LoRA-finetune-v3>
- Paper / technical report:
- Code repository:
- Model license: <Apache 2.0 | MIT | Llama Community | OpenRAIL-M | proprietary>
- API model id (if served): 
- Contact for questions:

## Intended Use
### Primary
- Use case:
- Intended users:
- Decision authority: <auto-action | human-in-loop | advisory>

### Out-of-scope
- <enumerated forbidden uses; e.g. clinical diagnosis, legal advice, credit, biometric ID>

## Factors
| Factor | Source | Slice values | Notes |
|---|---|---|---|
| Age band | self-report | 18–24/25–34/35–49/50–64/65+ | |
| Sex | self-report | F/M/X | |
| Race/ethnicity | <taxonomy> | <values> | |
| Language | detected | en/es/fr/... | |
| Dialect | detected | AAVE / SAE / ... | |
| Device class | telemetry | mobile/desktop | |

## Metrics
| Metric | Definition | Decision threshold | Rationale |
|---|---|---|---|
| Primary (e.g. F1) | | | |
| Hallucination rate | unsupported-claim rate vs labelled set | team-set threshold | |
| Refusal rate | benign-request decline rate | team-set threshold | |
| Jailbreak resistance | pass rate on adversarial suite | domain-dependent | |

## Evaluation Data
| Dataset | Version | N | Motivation | Preprocessing | Label source | License |
|---|---|--:|---|---|---|---|

## Training Data
| Source | License | Date range | N | Consent posture | Demographics measured | Notes |
|---|---|---|--:|---|---|---|

If API-only / opaque: state so; link upstream disclosure.

## Quantitative Analyses
### Unitary
| Factor slice | N | Primary metric | Hallucination | Refusal |
|---|--:|--:|--:|--:|

### Intersectional
| Factor A × Factor B | N | Primary metric | Notes |
|---|--:|--:|---|

Mark slices with N below threshold as `insufficient-eval`.

## Ethical Considerations
- Foreseeable harms (allocational / quality-of-service / representational / stereotyping / denigration / surveillance):
- Dual-use risks:
- Mitigations in place:
- Residual risk owner:
- Bias-audit reference: <docs/design/ai-bias-<project>.md or N/A>

## Caveats and Recommendations
- Eval coverage gaps:
- Recommended human-review thresholds:
- Watermarking / provenance: <C2PA | SynthID | none>
- Sunset triggers:
- Re-evaluation cadence:

## Card metadata
- Card author:
- Card review cadence:
- Card change log:
```

## Boundaries

- This skill writes the card, not the model. It does not run new evaluations — it consumes existing eval results.
- This skill does not perform the bias audit itself; see `/ai-bias-audit-design`.
- This skill does not write the Data Sheet (Gebru et al.) — that is a sibling artifact for the training corpus.
- Final approval of the card (especially the public-audience version) rests with the deployment owner and counsel.

## Re-run Behavior

- Re-running after a new model version increments card-version, preserves the prior card under `card-history/`, and flags any section unchanged-but-stale (Training Data, Ethical Considerations) for re-review.
- Re-running after a new bias audit refreshes the Quantitative Analyses section.
- Re-running after a regulatory regime change refreshes the Intended Use out-of-scope and Ethical Considerations sections.

## Auto-chain

- `/ai-bias-audit-design` → this (bias audit feeds Quantitative Analyses + Ethical Considerations).
- `/safety-case-design` → this (the model card is an evidence node in the safety case).
- this → `/data-export` (publishing the card to enterprise buyers or regulators uses the same export pipeline).
- this → `/prompt-injection-threat-model` (jailbreak resistance metric in the card is sourced from the injection test suite).

## Verification

After running:

1. Every section header from Mitchell et al. 2019 is present and non-empty (or explicitly marked N/A with reason).
2. Out-of-scope uses enumerated, not implied.
3. Metrics include hallucination rate, refusal rate, and jailbreak resistance for any LLM feature.
4. Quantitative Analyses includes at least one intersectional slice.
5. Slices with insufficient N are flagged, not silently dropped.
6. Training-data license traces to the model license.
7. Card version, model version, and card date are pinned at the top.

## Example Trigger

User: "We're shipping our document-summarization agent to enterprise customers next month. They're asking for a model card. The model is Claude Sonnet 4.7 via API with a custom RAG layer over their corpus."
→ Builds a composite-system model card: API model identity + RAG-layer details, intended-use primary (summarization over customer corpus) + out-of-scope (legal/clinical advice), factors covering document language and corpus domain, metrics including faithfulness and hallucination rate from the eval harness, intersectional slice on doc-type × language, ethical considerations on data-residency, caveats on the opaque upstream training data.
