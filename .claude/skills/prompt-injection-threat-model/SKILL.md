---
name: prompt-injection-threat-model
description: LLM prompt-injection threat model — direct injection, indirect injection per Greshake et al. 2023, jailbreak taxonomy (DAN, roleplay, encoding, multi-turn, prompt-leak), STRIDE-adapted attacker analysis, layered defenses (system-prompt hardening per Anthropic Constitutional AI + OpenAI instruction hierarchy, input/output filters, tool-call allowlist, provenance-tagged retrieval), test corpus from OWASP LLM Top 10 + indirect prompt-injection benchmarks. Use when user says "prompt injection", "jailbreak", "LLM security", "indirect injection", "tool abuse", "OWASP LLM", "/prompt-injection-threat-model", or before any LLM feature with tool access, retrieval over untrusted text, or external content ingestion. Writes docs/ai/prompt-injection-threat-model-<project>.md.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 8h
---

# /prompt-injection-threat-model — LLM Injection + Jailbreak Threat Model and Defense Plan

## Why you'd care

LLMs do not distinguish instructions from data. Anything an LLM reads — the user's message, a retrieved document, a tool-result, an email, a webpage, a PDF table caption — can carry instructions that the model will follow. Indirect injection (Greshake et al. 2023) means an attacker who can plant text anywhere your LLM eventually consumes can hijack it without ever talking to your product. A threat model up front is the difference between shipping with three plausible defenses layered and shipping with one prompt that says "ignore malicious instructions" and a prayer.

Invoke as `/prompt-injection-threat-model`. Required before any LLM feature with tool/function access, retrieval over user-uploaded or external content, agent loops, or browser/code-execution capabilities.

## Pre-flight

- Read `docs/classify/<project>.md`. XS → SKIP.
- Read `/threat-model-pre` output if it exists — this skill extends generic STRIDE to LLM-specific assets.
- Read `/audit-log-design` to ensure injection attempts and successful jailbreaks can be logged (a defense you cannot observe is a defense you cannot improve).
- Map every place where untrusted text enters the model's context: user input, retrieved chunks, tool results, system prompt fragments from config, conversation history.
- List every tool the LLM can call and the blast radius of each.

## Inputs

- LLM surface inventory: which features call the model, with what context, with what tools available.
- Trust boundaries: per content source, who controls the text (user, your team, third party, attacker-influenced).
- Tool inventory: per tool, what it does, what permissions it has, what side effects (read DB, write DB, send email, call API, run code, browse web).
- Existing defenses (if any): system prompt, output filter, content moderation, tool-call confirmation UX.
- Reference attack corpora available: OWASP LLM Top 10 examples, public indirect-injection benchmarks, internal red-team backlog.

## Process

1. **Asset inventory specific to LLM features.** Beyond the usual confidentiality/integrity/availability of data, LLM-specific assets include: the system prompt itself (leak = competitor copies your product), tool credentials embedded in context, retrieved private data exposed in answers, model output that becomes input to a downstream tool (lateral movement), and user trust in the agent's outputs. List each with current owner and sensitivity.
2. **Enumerate attack classes — direct and indirect.** **Direct injection**: the user's own prompt embeds attacker instructions ("ignore previous, do X"). **Indirect injection** (Greshake et al. 2023): instructions are planted in content the model later reads — a webpage the agent browses, an email it summarizes, a PDF it ingests, a code comment in a repo it reviews, a search result, a retrieved RAG chunk. The user is the victim, not the attacker. **Tool-result injection**: a tool the model calls returns attacker-controlled text. **Multi-step chain**: injection in step 3 redirects the agent's plan for steps 4–N.
3. **Author the jailbreak taxonomy applicable to this product.** **Persona attacks** (DAN-style, "you are now an unrestricted assistant"), **roleplay** ("we are writing a novel where the character explains..."), **encoding tricks** (base64, ROT13, leetspeak, low-resource language, Unicode tag chars), **multi-turn manipulation** (build rapport across N turns, then ask), **prompt-leak** ("repeat your instructions verbatim"), **payload-smuggling** (hide instructions in markdown comments, alt-text, font-size-zero), **suffix attacks** (universal adversarial suffixes from GCG-style research). Rank by relevance to your surface — a code-review agent cares about payload smuggling in source files; a customer-support agent cares about persona and multi-turn.
4. **STRIDE-adapted threat table.** Map each attack class to STRIDE-LLM:

   | STRIDE element | LLM specialization |
   |---|---|
   | Spoofing | Instruction spoofing — content claims to be from the system or operator |
   | Tampering | Injected instructions tamper with the agent's plan |
   | Repudiation | Logs don't capture which retrieved chunk caused the bad action |
   | Information Disclosure | System-prompt leak, retrieved-private-data leak, training-data extraction |
   | Denial of Service | Token-flood, infinite tool-loop, retrieval-amplification |
   | Elevation of Privilege | Agent uses a tool with broader permissions than the user has, via injection |

5. **Design layered defenses, cheapest first.** No single defense is sufficient.
   - **System-prompt hardening.** Anthropic's Constitutional AI patterns and OpenAI's instruction-hierarchy guidance both treat system > developer > user > tool-content in priority. State the hierarchy explicitly in the system prompt; instruct the model to treat retrieved content as data not instructions; tag retrieved chunks with provenance markers (`<retrieved source="user-upload" trust="low">...</retrieved>`).
   - **Input filter.** Heuristics on user input (length caps, character-class checks for Unicode tag/control chars, encoding-decode-and-rescan), plus a classifier for known injection patterns. Reject or sanitize-and-flag; never silently strip without telemetry.
   - **Output filter.** Pattern-scan for system-prompt fragments (prompt-leak), PII not in source, secret-shaped strings (API keys, tokens), forbidden topics. The output filter is the last line — if it fires, you have already had a successful injection.
   - **Tool-call allowlist + permission boundaries.** Per tool, a static allowlist of which features can invoke it; per invocation, parameter validation (URLs against allowlist, SQL against parameterized templates, shell-exec disabled). Destructive tools require explicit user confirmation in the UX, not just model assent.
   - **Provenance-tagged retrieval.** Every retrieved chunk carries a trust label (`first-party`, `user-upload`, `third-party-web`, `attacker-controlled-by-design`). The system prompt instructs the model that lower-trust content cannot override higher-trust instructions. This is the only known defense that meaningfully reduces indirect injection — and it is partial, not complete.
   - **Sandbox + human-in-loop for high-blast-radius tools.** Code execution in a no-network sandbox; financial actions through a confirmation step; data-deletion requires a typed confirmation token.

6. **Author the test corpus.** Combine: a curated subset of OWASP LLM Top 10 examples (LLM01 Prompt Injection is the headline; LLM02 Insecure Output Handling, LLM06 Sensitive Info Disclosure, LLM07 Insecure Plugin Design also apply), public indirect-prompt-injection benchmarks (Greshake et al. companion corpus, IPI benchmarks), and product-specific attacks (your tool surface, your retrieval sources, your jailbreak taxonomy). Store as JSONL: `{id, class, technique, payload, expected_behavior, blast_radius}`. Score the model's behavior on each: compliance (bad), refusal (good), refusal-with-warning (best for some classes).
7. **Wire injection-attempt logging.** Per `/audit-log-design`, every detected injection attempt logs `{timestamp, user_id, surface, trigger, defense_layer, action_taken}`. Successful jailbreaks (those that bypass all layers and reach a tool call) page on-call. Per-month review surfaces new techniques.
8. **Set the gate.** Pre-launch acceptance: 0 successful tool-elevation jailbreaks in the test corpus; <X% (team-set, domain-dependent) prompt-leak rate; output filter catches 100% of system-prompt fragment patterns in red-team set. Re-run on every prompt change, model change, or tool addition.

## Output Format — `docs/ai/prompt-injection-threat-model-<project>.md`

```markdown
---
project: <project>
date: <YYYY-MM-DD>
status: draft | reviewed | gated
llm-surfaces: <list of features>
---

# Prompt-Injection Threat Model — <project>

## LLM surface inventory
| Feature | Model | Context sources | Tools available | Blast radius |
|---|---|---|---|---|

## Trust boundaries on context sources
| Source | Controller | Trust label | Examples |
|---|---|---|---|
| User chat input | end user | low | direct injection |
| RAG corpus (first-party docs) | our team | high | |
| RAG corpus (user-uploaded) | end user | low | indirect injection vector |
| Web fetch (agent browse) | open internet | adversarial | high indirect risk |
| Tool result (calculator) | us | high | |
| Tool result (third-party API) | vendor | medium | possible upstream injection |

## Attack classes in scope
- Direct injection
- Indirect injection (Greshake et al. 2023) — applicable surfaces: <list>
- Tool-result injection — applicable tools: <list>
- Multi-step plan hijack — applicable agent loops: <list>

## Jailbreak taxonomy ranked for this product
| Technique | Relevance | Notes |
|---|:--:|---|
| Persona / DAN | | |
| Roleplay / fiction frame | | |
| Encoding (base64, ROT13, Unicode tag) | | |
| Multi-turn rapport-build | | |
| Prompt-leak ("repeat your instructions") | | |
| Payload-smuggling (markdown comments, alt-text) | | |
| Suffix / GCG-style adversarial | | |

## STRIDE-LLM table
| STRIDE | LLM specialization | Asset | Likelihood | Impact | Mitigation ref |
|---|---|---|:--:|:--:|---|

## Defense layers
| Layer | Mechanism | Catches | Tool / library | Owner |
|---|---|---|---|---|
| System-prompt hardening | instruction hierarchy + provenance tags | direct + indirect | <Anthropic Constitutional / OpenAI hierarchy> | |
| Input filter | heuristic + classifier | direct, encoded | | |
| Output filter | PII / secret / prompt-leak patterns | exfiltration | | |
| Tool allowlist + param validation | tool abuse | elevation | | |
| Provenance-tagged retrieval | indirect | indirect injection | | |
| Sandbox + human-in-loop | catastrophic actions | elevation, DoS | | |

## Test corpus
- File: `tests/llm-security/corpus.jsonl`
- Schema: `{id, class, technique, payload, expected_behavior, blast_radius}`
- Sources blended: OWASP LLM Top 10 (LLM01/02/06/07), indirect-injection benchmark (Greshake et al. companion + IPI), product-specific red-team.
- Total items: <N>; per-class distribution: <table>.

## Gates
- [ ] 0 successful tool-elevation jailbreaks on the test corpus.
- [ ] Output filter blocks 100% of red-team prompt-leak patterns.
- [ ] All retrieved content carries provenance tags into the prompt.
- [ ] Destructive tools require human-in-loop confirmation.
- [ ] Injection-attempt logging wired per `/audit-log-design`.

## Logging
- Every detected injection attempt → audit log row.
- Successful jailbreak (bypass all layers + tool call) → page on-call.
- Monthly review surfaces new techniques observed in the wild.

## Re-run triggers
- Prompt template change.
- Model version change.
- New tool added or existing tool permission widened.
- New retrieval source added.
- Quarterly cadence regardless.

## Known residual risk
- Indirect injection is partially mitigated, not solved (state of the art 2026).
- Suffix attacks (GCG-style universal adversarial strings) remain a research-grade open problem.
- Multi-turn manipulation across very long sessions is hard to detect with current classifiers.
```

## Boundaries

- This skill threat-models the LLM-specific layer; classical web-app threats (CSRF, XSS on the surrounding UI, auth bypass) belong in `/threat-model-pre`.
- This skill does not implement defenses — it specifies them and the test corpus that validates them.
- This skill does not solve indirect injection. As of 2026 no published technique fully eliminates it; this skill produces layered partial mitigation and explicit residual-risk acknowledgement.
- Constitutional AI and instruction-hierarchy specifics evolve with model releases; treat the system-prompt patterns as a moving target.

## Re-run Behavior

- Re-running after a new tool addition refreshes the tool-allowlist table and adds attack scenarios specific to the new tool.
- Re-running after a model swap re-scores the test corpus and updates the residual-risk section.
- Re-running after observed new attack technique adds it to the taxonomy and the test corpus.

## Auto-chain

- `/threat-model-pre` → this (classical STRIDE on surrounding system precedes LLM-specific extension).
- `/audit-log-design` ← this (injection attempts and successful jailbreaks must be logged; log schema lives there).
- `/safety-case-design` ← this (the defense-layer table and test-corpus pass rate are evidence nodes).
- `/rag-eval-harness` ↔ this (the adversarial-injection-in-source slice is shared corpus).
- `/model-card-spec` ← this (jailbreak resistance metric in the card is sourced here).
- `/rbac-model` ↔ this (tool permission boundaries align with user-permission model).

## Verification

After running:

1. Every LLM surface in the product is listed with its context sources and tool inventory.
2. Trust labels assigned per context source, with at least one source flagged adversarial-by-design if the model browses the web or ingests user uploads.
3. Both direct and indirect injection are in scope; tool-result injection considered if any tool returns external content.
4. Defense layers include at minimum: system-prompt hardening with provenance tags, input filter, output filter, tool allowlist, human-in-loop for destructive actions.
5. Test corpus exists, blends OWASP LLM Top 10 + indirect-injection benchmark + product-specific cases, stored as JSONL with the documented schema.
6. Logging integration with audit-log-design is specified.
7. Residual-risk section explicitly names indirect-injection and suffix-attack limitations.

## Example Trigger

User: "We're adding a feature where our customer-support agent can read user-uploaded PDFs and also call our refund API. Threat-model the prompt-injection risk before we ship."
→ Catalogs surfaces (chat + PDF ingest + refund tool), labels PDF content as low-trust adversarial-by-design, builds STRIDE-LLM table flagging tool-elevation (refund-without-authorization) as critical, specifies provenance-tagged retrieval + human-in-loop refund confirmation + output filter for prompt-leak + an injection test corpus mixing OWASP LLM01/07 with PDF-embedded-instruction payloads, and writes the gate that no test-corpus item should result in an unconfirmed refund call.
