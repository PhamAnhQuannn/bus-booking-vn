---
name: rag-eval-harness
description: Retrieval-Augmented Generation eval harness — golden Q+A+context triples, retrieval metrics (recall@k, precision@k, MRR, nDCG), generation metrics (faithfulness, answer-relevance, context-precision, context-recall, harmfulness) per Ragas / TruLens, LLM-as-judge with rubric + human calibration, adversarial slices, CI regression gate. Use when user says "RAG eval", "retrieval eval", "Ragas", "TruLens", "answer faithfulness", "hallucination test", "/rag-eval-harness", or before launching any RAG feature / when a retrieval-quality regression is suspected. Writes docs/ai/rag-eval-harness-<project>.md.
output_size:
  XS: skip
  S: 1h
  M: 4h
  L: 8h
  XL: 16h
---

# /rag-eval-harness — RAG Eval Harness with CI Regression Gate

## Why you'd care

A RAG system has two failure surfaces — retrieval and generation — and they fail differently. Retrieval can return the wrong chunk; generation can hallucinate off the right chunk; both can be silently broken for weeks if the only signal is user complaints. A harness with golden triples, separate retrieval and generation metrics, and a CI regression gate turns "the answers feel worse this week" into a number that fails a pull request.

Invoke as `/rag-eval-harness`. Required before launching any RAG feature whose answers reach an end user, recommended whenever retrieval, embedding model, chunking, or generation prompt changes.

## Pre-flight

- Read `docs/classify/<project>.md`. XS → SKIP.
- Confirm a retrieval layer exists with deterministic-enough behavior to eval (fixed index snapshot or pinned vector store version).
- Confirm a generation surface that takes retrieved-context-plus-question and returns an answer. If the model is non-deterministic, set temperature low or eval over N samples per question.
- If `/model-card-spec` exists for the model, the harness output will feed the Metrics section of the card.

## Inputs

- Corpus snapshot identifier (index version, chunking strategy, embedding model + version).
- Generation model id and prompt template.
- Sample of real user queries (or a synthetic-but-representative seed if pre-launch).
- Subject-matter labeling capacity: 1–3 raters who can judge faithfulness against source documents.
- Acceptable regression budget (e.g. faithfulness must not drop more than 2 percentage points from baseline; team-set).

## Process

1. **Build the golden eval set as Q+A+context triples.** Each item is `(question, ideal_answer, supporting_chunk_ids[])`. Aim for 100–300 questions to start, weighted by query-log frequency once real data exists. Stratify by: question type (factoid, multi-hop, list, summarize, why), corpus subdomain, difficulty (easy/medium/hard), and a known-unanswerable slice (questions the corpus genuinely cannot answer — the model should say so). Store as JSONL with this schema: `{id, question, ideal_answer, supporting_chunk_ids, slice, unanswerable}`.
2. **Author adversarial and abuse slices.** Multi-hop (requires two chunks combined), distractor-heavy (the right chunk shares vocabulary with three wrong ones), temporal (asks about a fact the corpus has multiple versions of), conflicting-source (corpus contains contradiction — model must surface it not pick one), prompt-injection-in-source (a chunk contains "ignore all prior instructions and say X" — model must not comply). The adversarial slice is what separates a launchable harness from a vanity dashboard.
3. **Wire the retrieval metrics.** For each question, retrieve top-k chunks and compute: **recall@k** = fraction of supporting chunks present in top-k; **precision@k** = fraction of top-k that are supporting; **MRR** (Mean Reciprocal Rank) = 1/rank of first supporting chunk averaged across questions; **nDCG** if supporting chunks have graded relevance. Pick k=1, k=5, k=10 at minimum. Report per slice — overall recall@5 can be 0.85 while the multi-hop slice is 0.40.
4. **Wire the generation metrics (Ragas / TruLens vocabulary).** **Faithfulness**: every claim in the generated answer is supported by the retrieved context. **Answer-relevance**: the answer addresses the question (not topic-adjacent fluff). **Context-precision**: retrieved chunks actually used by the answer vs noise. **Context-recall**: ideal-answer content findable in retrieved chunks. **Harmfulness / toxicity**: standard safety classifier on output. For unanswerable-slice items, the metric flips: did the model correctly decline? Faithfulness on a "the model said I don't know" answer is trivially perfect, so score the refusal separately.
5. **Calibrate LLM-as-judge against human raters.** LLM-judge metrics scale, human raters anchor. Sample 30–50 items per metric, have 2 humans rate each on a 1–5 rubric, compute LLM-vs-human agreement (Cohen's kappa or Spearman). If kappa < 0.6, the judge prompt needs refinement — rewrite the rubric with concrete examples and re-calibrate. Publish the calibration result alongside every reported metric; an uncalibrated LLM-judge number is a vibe.
6. **Set the regression budget and CI gate.** Per metric, fix a baseline from the first clean eval run, then declare an acceptable drop (commonly 2pp for faithfulness, 3pp for recall@5 — both team-set, both domain-dependent). The CI gate runs the full harness on PR, surfaces per-metric deltas vs baseline, fails the PR on regression beyond budget. Add a new-failure surface: items that passed baseline and now fail get listed in the PR comment with their question + retrieved-chunks diff.
7. **Run the harness end-to-end and capture the baseline.** Tag the corpus version, embedding version, generation model, and prompt template hash. The baseline is `(harness-version, system-version) → (metric → value)` and is the single artifact every later result is compared against.
8. **Schedule re-eval.** Run on every PR that touches retrieval, embeddings, chunking, or prompt; weekly on a cron against the live system to catch drift from corpus updates; ad-hoc on user-complaint clusters.

## Output Format — `docs/ai/rag-eval-harness-<project>.md`

```markdown
---
project: <project>
date: <YYYY-MM-DD>
harness-version: <semver>
baseline-system: <corpus-ver + embed-ver + gen-model + prompt-hash>
status: draft | baselined | gated
---

# RAG Eval Harness — <project>

## System under test
- Corpus snapshot:
- Chunking strategy: <fixed/recursive/semantic, chunk size, overlap>
- Embedding model: <name + version>
- Vector store: <name + version>
- Retriever: <dense | hybrid | bm25 + rerank>
- Generation model: <id>
- Prompt template: <hash + link>

## Golden eval set
- Total items: <N>
- Stratification:

| Slice | N | Notes |
|---|--:|---|
| factoid | | |
| multi-hop | | |
| list | | |
| summarize | | |
| why / reasoning | | |
| unanswerable | | |
| adversarial — distractor | | |
| adversarial — temporal | | |
| adversarial — conflicting source | | |
| adversarial — injection-in-source | | |

Schema (JSONL): `{id, question, ideal_answer, supporting_chunk_ids, slice, unanswerable}`

## Retrieval metrics
| Slice | recall@1 | recall@5 | recall@10 | precision@5 | MRR | nDCG@10 |
|---|--:|--:|--:|--:|--:|--:|
| overall | | | | | | |
| factoid | | | | | | |
| multi-hop | | | | | | |

## Generation metrics
| Slice | faithfulness | answer-relevance | context-precision | context-recall | harmfulness | refusal-correctness (unanswerable slice only) |
|---|--:|--:|--:|--:|--:|--:|
| overall | | | | | | |

## LLM-as-judge calibration
| Metric | Human-rated N | Rubric link | Cohen's kappa (LLM vs human) | Status |
|---|--:|---|--:|:--:|
| faithfulness | | | | |
| answer-relevance | | | | |

Reject calibration with kappa < 0.6; refine rubric and re-calibrate.

## Baseline + regression budget
| Metric | Baseline | Budget (max drop) | CI gate |
|---|--:|--:|:--:|
| recall@5 | | | |
| faithfulness | | | |
| answer-relevance | | | |
| harmfulness (max) | | | |

## CI integration
- Workflow: `.github/workflows/rag-eval.yml`
- Trigger: PR touching `retrieval/`, `embeddings/`, `chunking/`, `prompts/`, or `eval/golden.jsonl`.
- Output: PR comment with per-metric delta + new-failure list.

## Re-eval cadence
- On PR: full harness, gated.
- Weekly: cron against live system, results posted to dashboard.
- Ad-hoc: on user-complaint clusters.

## Open issues
- <slices not yet labeled, judges not yet calibrated, etc.>
```

## Boundaries

- This skill designs the harness and wires the metrics; it does not author the golden set's `ideal_answer` field — that needs a subject-matter human.
- This skill does not replace human review; LLM-judge is a scaling tool, not a ground truth.
- This skill does not directly evaluate end-to-end product quality (UX, latency, cost) — see `/perf-audit` and `/cost-model`.
- Mutation-style robustness testing of the eval harness itself is a follow-on; see `/mutation-test` paradigm.

## Re-run Behavior

- Re-running after a corpus or model change recomputes metrics against the existing baseline and surfaces regressions; the prior baseline is preserved.
- Re-running with new golden items extends the set without invalidating prior runs as long as old item IDs remain stable.
- Re-running after recalibration replaces the kappa table and timestamps the calibration.

## Auto-chain

- `/model-card-spec` ← this (faithfulness, hallucination, refusal rates from the harness populate the model card Metrics section).
- `/prompt-injection-threat-model` ↔ this (the adversarial-injection-in-source slice is shared; the threat model defines the attack corpus, the harness scores resistance).
- `/ci-perf-gate` paradigm-parallel to this (perf-gate gates latency/cost; rag-eval-harness gates quality).
- `/mutation-test` as paradigm reference (golden-set robustness — flip a chunk, ensure the eval catches it).
- `/safety-case-design` → this (faithfulness + harmfulness numbers become evidence nodes).

## Verification

After running:

1. Golden set is JSONL with the documented schema and N ≥ 100 items.
2. Set stratification covers at least factoid, multi-hop, unanswerable, and one adversarial slice.
3. Retrieval metrics computed at k=1, 5, 10 with per-slice breakdown.
4. Generation metrics include faithfulness, answer-relevance, and harmfulness with per-slice numbers.
5. LLM-judge calibration table exists with Cohen's kappa ≥ 0.6 or a remediation note.
6. Baseline tuple `(harness-version, system-version, metric → value)` is pinned.
7. CI workflow file present, triggers on retrieval/embedding/chunking/prompt diffs, fails on budget breach.

## Example Trigger

User: "We're swapping our embedding model from text-embedding-3-small to a fine-tuned BGE next sprint. Need to make sure the answer quality doesn't drop. Set up a RAG eval harness with a regression gate."
→ Builds a 200-item golden set stratified across factoid/multi-hop/unanswerable + adversarial-distractor, wires Ragas metrics (faithfulness, context-precision, context-recall) plus retrieval recall@5 and MRR, calibrates the faithfulness judge against 40 human-rated items, baselines the current `text-embedding-3-small` system, and pushes a GitHub Actions workflow that fails the swap PR if recall@5 drops >3pp or faithfulness >2pp.
