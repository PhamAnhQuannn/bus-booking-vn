---
name: editorial-tier
description: Proposed doctrine amendment adding a labelled "Editorial" (bien-tap) provenance tier so reader-useful but unsourceable fields (visit_duration, intensity, audience, prep, tip) can ship WITHOUT breaking the "0 dòng bịa" trust axiom.
type: plan
status: approved
date: 2026-08-21
---

# Editorial tier (`tier: "bien-tap"`) — doctrine amendment (APPROVED)

> **Status: APPROVED 2026-08-21** — product sign-off by owner. Scope of first ship: the
> `phu_hop_voi` ("Phù hợp với khách muốn…") field ONLY, as controlled-vocab keyed on vibe-signature
> (`phu_hop_voi_data.PHRASE_TABLE`, ~12 rows, ORIGINAL text — no Wikipedia paraphrase → CC-BY-SA clean).
> Legal/PDPL handled by owner. Section-0 Rule 2/3 carve-outs applied in `build_huong_dan.py`.
> Gated by kill-switch env `EDITORIAL_TIER=1` (off by default). Other editorial fields (duration,
> intensity, prep, tip) remain UNSHIPPED — this approval covers `phu_hop_voi` only.

## Why
The trip-planner UI wants a richer per-destination card (the "Datanla" reference): visit duration,
activity intensity, "phù hợp với" (audience), a prep checklist, an editorial tip. Today these are
**forbidden by design**, not merely missing:

- Axiom — `CLAUDE.md:50-52`: *"a value that reaches a document is a claim. If it cannot be traced to a
  record, measured, or verified, it does not go in — an omission costs a reader nothing, a fabricated
  fact costs them their trust."*
- Section-0 **Rule 2** — `code/build_huong_dan.py:575-576`: only three pre-approved derivations
  (indoor/outdoor · map link · nearby); "KHÔNG suy ra … **thời lượng thăm** hay **mức độ dễ đi lại** từ
  loại hình."
- Section-0 **Rule 3** — `code/build_huong_dan.py:582-586`: "KHÔNG **tự viết** mô tả, 'lý do nên đến'
  hay 'điểm nhấn' … '*Đà Lạt lãng mạn, hợp cho các cặp đôi*' thì không."

So no amount of engineering unlocks them — the doctrine must change first, or they never ship.

## The core idea — add a THIRD tier, do not weaken the first two
Provenance tiers today (`code/export_planner.py`):
1. **`source_id`** — a real external witness; the value is *verified* and joins `verified_fields[]`.
2. **`derived` / `*_nguon`** — a type-affordance true for the whole category, hedged, **no** `source_id`,
   **excluded** from `verified_fields` (e.g. `hoat_dong`, `trai_nghiem`, `vibes`).

Add:
3. **`tier: "bien-tap"` (Editorial)** — reader-useful guidance that can carry neither a `source_id` nor a
   pre-approved derivation. It is stored, rendered, and reasoned about as an **explicitly labelled
   suggestion**, never as a fact.

**Why this keeps the axiom intact.** The axiom protects the reader from a *fabrication that poses as a
fact*. A value that is marked editorial, stored in its own field, excluded from `verified_fields`, and
rendered under a distinct "Gợi ý biên tập" heading does not pose as a fact — it announces itself as a
suggestion. Trust is broken by disguise, not by disclosure. An omission still costs the reader nothing;
this tier is opt-in reader value with the uncertainty made legible.

## The tier contract

### Storage shape
```
"<field>": {
  "value": <controlled value or hedged string>,
  "tier": "bien-tap",
  "is_editorial": true,
  "method": "<how drafted: rule | llm | curated-table | terrain-model>",
  "reviewed_by": "<human>",      // REQUIRED — no review, no export
  "reviewed_at": "<dd/mm/yyyy>"
}
```
- **Never** minted a `source_id`; **never** enters `verified_fields[]` / `source_ids[]`
  (`export_planner.py:222-239` walks `source_id` leaves only — editorial leaves carry none, so this holds
  automatically).
- A record with only editorial fields still counts as source-less for the `≥1 source_id` gate
  (`export_planner.py:263-265`) — editorial content can never satisfy that gate.

### Mandatory FORM — bound the fabrication surface
Prefer controlled/typed shapes over free per-place prose, and key on the existing **28-activity `ACTS`
taxonomy** (`code/sweep_hoat_dong.py:78-129`) so most editorial claims are **per-type, not per-place**
(one reviewed decision covers every instance of the type — far smaller surface, far easier to audit):

| Field | Required form | Keyed on |
|---|---|---|
| visit_duration | hedged range ("thường ~2–3 giờ") | activity type |
| intensity | fixed scale {Nhẹ · Vừa · Cao} | activity type |
| "phù hợp với" / audience | controlled vocab (like `vibes`), NOT free prose | activity type / vibe |
| prep checklist | per-activity item list | activity type |
| tip | short hedged note, OR an attributed external quote (existing `chi_tu_vlog` pattern, `code/hoat_dong_data.py:494-496`) | per-place allowed if attributed |

Free per-place editorial prose is the **last** resort and always needs individual review.

### Governance — non-negotiable
- An LLM MAY draft; a **human MUST review and approve every editorial value** before it exports.
  `reviewed_by`/`reviewed_at` are required fields; the exporter drops any editorial value missing them.
- A review log lives beside this plan (`review-log.md`) — date, field, city/type, reviewer, verdict.
- **Legal checkpoint** before first ship (CC-BY-SA originality, PDPL, ToS — see hard limits).
- **Kill-switch:** the editorial tier is gated by a single export flag; off ⇒ zero editorial fields ship.

### Hard limits — UNCHANGED (still forbidden, even inside the editorial tier)
- **Price / star rating / rank** — ToS + owner rules stand (`CLAUDE.md:85-91`). Editorial may never carry
  a price or a rating.
- **Social-scraped data** (posts / account names / faces) — PDPL 2025 (`CLAUDE.md:83-84`).
- **Paraphrasing** Wikipedia or any quoted source — CC BY-SA ShareAlike. Editorial text is **original
  writing**, never a derivative of a source we quote elsewhere.
- **Fake provenance** — an editorial value must never be dressed as a `source_id` or an `[S]` citation.

## UI contract (trip-planner)
- A new `DtoItem` sub-object `bien_tap` (or per-field `tier` flags) carries editorial values so the
  client can style them apart.
- `ItineraryCard`/dossier card renders editorial fields under a **distinct "Gợi ý biên tập" heading + a
  one-line disclaimer**, never interleaved with the verified badge (`✓ Mở … · N nguồn`) or the sourced
  description. The reader must be able to tell verified from suggested at a glance.

## The actual Section-0 edits (applied ONLY after sign-off)
Two live doctrine sites change; both keep the fact-tier ban and add the editorial carve-out:
- `code/build_huong_dan.py:575-576` (Rule 2): keep "no duration/difficulty as fact or as a from-type
  inference"; append *"…trừ khi gắn nhãn **[GỢI Ý BIÊN TẬP]**: dạng khoảng có hedge, đã qua người duyệt,
  KHÔNG vào `verified_fields`."*
- `code/build_huong_dan.py:582-586` (Rule 3): keep "no authored prose posing as description/fact"; add
  the same editorial carve-out for audience/tip, restricted to controlled vocab or an attributed quote.
- `CLAUDE.md` "Working Principles" / "PII Discipline": document the three-tier model and that the
  editorial tier never enters `verified_fields` and never carries price/rating/social/paraphrase.

## Rollout
Pilot ONE city × a few activity types → human review → measure reader value + error rate → then scale to
all cities. Editorial tier stays behind its export flag until the pilot passes review.

## Out of scope (follow-on, only after this amendment is approved)
`enrich_*.py` writers, the curated 28-row activity tables, export wiring, the `bien_tap` DTO field, and
the planner UI — see the trip-planner data-roadmap (Tier 2/3). None of it may proceed until the amendment
above is signed off.
