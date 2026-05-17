---
name: ai-bias-audit-design
description: AI/ML bias + fairness audit design — protected-class disparity, slice metrics, harm taxonomy, eval set, red-team plan, EU AI Act / NYC LL144 / Colorado AI Act gates. Outputs `docs/design/ai-bias-<project>.md`. Use when system makes consequential decisions about people (hiring, lending, housing, healthcare, insurance, education, criminal-adjacent), or uses LLM outputs touching people. Reads `/project-classify`; XS skip; S+ fires if AI-decisions touch a person.
output_size:
  XS: skip
  S: 1h
  M: 4h
  L: 8h
  XL: 16h
---

# /ai-bias-audit-design — AI Bias & Fairness Audit

## Why you'd care

A consequential model deployed without a bias audit is a class-action waiting on the first journalist with a disparate-impact dataset. NYC LL144, Colorado AI Act, and EU AI Act now require evidence — and "we never measured" reads worse in court than the disparity itself.

Invoke as `/ai-bias-audit-design`. Required when model output influences a decision about a person (hire/fire, approve/deny, price, content moderation, risk score, dose/diagnose, sentence, admit).

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP. (No ML at XS.)
   - Decorative AI (image style transfer, autocomplete in private editor) → SKIP, note in risks.
2. Read `docs/inception/regulatory-<project>.md`.
3. Identify the decision: who is the subject, what is decided, what is the harm of being wrong.

## Inputs
- Decision under audit: input → output → consequence chain.
- Protected classes in scope (race, sex, age, disability, religion, national origin, sexual orientation, plus jurisdiction-specific: marital, source-of-income, veteran).
- Training data provenance.
- Eval set + labels + how labels were sourced.
- Deployment surface (auto-action vs human-in-loop).

## Process
1. **Harm taxonomy** for this decision:
   - **Allocational harm**: who gets the resource (loan, job, housing).
   - **Quality-of-service harm**: who gets a worse experience (speech recog accuracy by accent).
   - **Representational harm**: who is misrepresented (search results, generated images).
   - **Stereotyping harm**: outputs reinforce stereotypes.
   - **Denigration harm**: outputs are insulting.
   - **Over-/under-representation**: outputs are skewed.
2. **Pick fairness metric(s)** per decision (no single metric works for all):
   - **Demographic parity**: P(decision=positive | group=A) ≈ P(decision=positive | group=B).
   - **Equal opportunity**: TPR equal across groups (good for "should-be-approved" pool).
   - **Equalized odds**: TPR and FPR equal across groups.
   - **Calibration**: predicted prob matches actual freq per group.
   - **Counterfactual fairness**: flip the protected attribute, output shouldn't change.
   - Metric impossibility: can't satisfy all simultaneously when base rates differ; pick by harm taxonomy.
3. **Disparate-impact rule of thumb** (US EEOC 80% / 4/5 rule):
   - selection_rate(minority) / selection_rate(majority) ≥ 0.8 → presumptively OK.
   - <0.8 → presumptive disparate impact; document business necessity.
4. **Slice-eval matrix** — evaluate model on:
   - Each protected class slice.
   - Intersectional slices (race × sex; age × disability).
   - Geo / language / device slices (often correlated with class).
   - Min N per slice — if a slice has <100 examples, flag insufficient-eval, gather more.
5. **Red-team set**: hand-curated adversarial cases (names, dialects, demographic-coded text/images, edge poses, accessibility devices).
6. **Regulatory checks**:
   - **EU AI Act** (in force 2026, banned + high-risk obligations 2025+): high-risk systems need conformity assessment, risk management, data governance, human oversight, transparency, accuracy/robustness/cybersecurity, post-market monitoring. Fines up to 7% global turnover or €35M.
   - **NYC LL144** (AEDT in hiring): annual independent bias audit, public summary, candidate notice.
   - **Colorado AI Act** (effective 2026): consequential decisions, impact assessment, notice, appeal right.
   - **CA + IL + MD**: video-interview disclosure laws.
   - **EEOC + DOJ** guidance: existing anti-discrimination law applies to AI tools.
   - **Federal Reserve / OCC SR 11-7**: model risk mgmt for banks.
   - **FDA SaMD**: medical decisions need FDA pathway (separate skill).
7. **Mitigation lever order** (cheapest first):
   - Re-label / de-bias training data.
   - Reweighting / resampling.
   - Threshold-per-group calibration (legally fraught in US — get legal review).
   - Post-processing rejection rules.
   - Add human-in-loop where automated decision crosses harm threshold.
   - Don't ship the feature.
8. **Logging + monitoring** for drift:
   - Log input feature distribution + output distribution per slice.
   - Alert on slice metric drift > 2σ week-over-week.
   - Quarterly re-audit cadence.
9. **Documentation artifacts**:
   - **Model card** (Mitchell et al. 2019): intended use, performance, limitations, ethical considerations.
   - **Data sheet** (Gebru et al.): training-data provenance, demographics, consent.
   - **Impact assessment**: who could be harmed, severity, likelihood, mitigation.

## Output
Write `docs/design/ai-bias-<project>.md`:

```markdown
# AI bias & fairness audit — <project>
**Date:** <YYYY-MM-DD>
**Decision audited:** <e.g. loan approval / candidate ranking / triage score>
**Auditor:** <internal or external>

## Decision scope
- Input: <features used>
- Output: <score, label, ranking>
- Consequence: <approve/deny/escalate/auto-action>
- Human-in-loop: <yes/no/threshold>

## Harm taxonomy
- Allocational: <Y/N — describe>
- Quality-of-service: <Y/N>
- Representational: <Y/N>
- Other: <list>

## Fairness metric choice
- Primary: <equal opportunity, justified by ...>
- Secondary: <calibration, justified by ...>
- Not used (and why): <demographic parity — base rate differs legitimately>

## Protected classes evaluated
| Class | Source | N | 80% rule pass? |
|---|---|--:|:--:|
| Race (US Census 6 cat) | self-report | 12,400 | ⚠ 0.74 (B/W) |
| Sex | self-report | 12,400 | ✓ 0.91 |
| Age (40+/<40) | DOB | 12,400 | ✓ 0.86 |
| Disability | self-report | 1,200 | ⚠ insufficient-N |

## Slice metrics (primary: equal opportunity)
| Slice | TPR | FPR | Note |
|---|--:|--:|---|
| Overall | 0.83 | 0.11 | baseline |
| Race=B | 0.71 | 0.14 | gap 0.12 |
| Race=W | 0.85 | 0.10 | reference |
| Sex=F | 0.81 | 0.11 | within 2pp |
| Sex=M | 0.84 | 0.11 | reference |
| Age 60+ | 0.74 | 0.13 | gap 0.10 |
| Race=B × Sex=F | 0.66 | 0.16 | intersectional |

## Red-team set results
| Case | Expected | Actual | Pass |
|---|---|---|:--:|
| AAVE dialect resume | rank top-quartile | bottom-quartile | ✗ |
| Wheelchair in photo | no class effect | -8% score | ✗ |
| Non-anglo names same content | within 2pp | -11% | ✗ |

## Regulatory exposure
- EU AI Act: high-risk (employment) → full Annex III obligations. Conformity assessment needed by GA.
- NYC LL144: AEDT-applicable; annual audit + public summary. Done by ~2026-08.
- Colorado AI Act: consequential decision; impact assessment + notice required by 2026-02-01.
- EEOC: 80% rule failing on race; document business necessity + less-discriminatory alternative search.

## Mitigations
| # | Mitigation | Cost | Expected lift |
|---|---|---|---|
| 1 | Drop "years at address" feature (proxy for SES) | 1 day | +0.05 TPR gap close |
| 2 | Resample training data to balance race | 1 wk | +0.06 |
| 3 | Add human review for borderline scores | 2 wk eng + ongoing ops | residual close |
| 4 | Quarterly re-audit + drift monitor | ongoing | catch regression |

## Decision gates
- [ ] Disparate impact (80%) addressed before launch.
- [ ] Model card published.
- [ ] Data sheet published.
- [ ] Impact assessment filed.
- [ ] Legal/compliance sign-off (EEOC + AI Act + state-specific).
- [ ] Monitoring + drift alerts live.
- [ ] Appeal path designed (Colorado / EU requirement).

## Monitoring
- Slice metrics logged daily, alert on >2σ week-over-week drift.
- Quarterly re-audit scheduled.
- Annual independent audit per NYC LL144.

## Risk if skip
- EU AI Act fines up to 7% global turnover or €35M.
- NYC fines + injunction.
- EEOC class action.
- Reputational: AI-bias story is the cheapest journalism scoop in 2026.
```

## Verification
- Decision scope + consequence stated.
- Harm taxonomy applied.
- Fairness metric(s) picked with reasoning (not all metrics).
- Slice metrics including intersectional.
- 80% rule computed per class.
- Red-team set authored and run.
- Regulatory regime mapped (EU AI Act / NYC LL144 / Colorado / federal).
- Mitigations ordered cheapest-first.
- Monitoring + re-audit cadence.
