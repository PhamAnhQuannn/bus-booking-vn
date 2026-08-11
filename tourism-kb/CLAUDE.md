# CLAUDE.md — Tourism KB

Guidance for Claude Code when working inside `tourism-kb/`. This file is nested:
it auto-loads **in addition to** the repo-root `CLAUDE.md` whenever you work in
this subtree. Root working-principles and PII rules still apply; this file scopes
them to the tourism product and carries its own mistake log.

## What this is

A **separate offline product** that shares the bus-booking repo and nothing else.
It builds a Đà Lạt trip-advisory knowledge base for an **AI consultant reader**
(not a traveller). It imports nothing from `lib/`, touches no database, and no
app code (`app/`, `lib/`, `components/`) references any path under here — the
coupling is zero. `public/tourism/*.jpg` belongs to the BUS APP (charter-rental
carousel), not to this product; do not touch it.

"First script data for the AI data lookup" — Đà Lạt now, more destinations later.

## Layout — the memory-architecture model

    tourism-kb/
    ├── CLAUDE.md   ← mem INDEX: doctrine + distilled rules + memory map (this file)
    ├── memory/     ← mem DETAIL: plans/ · issues/ · history/ (TRACKED, no PII)
    ├── README.md   ← the pipeline / architecture doc (script-by-script)
    ├── code/       ← ctx: the pipeline (TRACKED)
    ├── raw/<slug>/ ← per-tỉnh (IGNORED): scrape/ (thô+trung gian+build/) · noi-bo/ + docx/ (NỘI BỘ rank nhà hàng+khách sạn, cấm ship)
    ├── wiki/       ← wiki: structured handover .md + TRANG-THAI.md (IGNORED)
    └── output/     ← output: 3 released .docx per location — output/<slug>/ + archive/ (IGNORED)

**RAW = `tourism-kb/raw/<slug>/scrape`** cho mọi script; NỘI BỘ (rank) ghi sang sibling
`noi-bo/`+`docx/` (city=`dirname(RAW)`). Thêm tỉnh = thêm `raw/<slug>/`. Cùng khuôn.

Mapping onto the reference diagram: **raw** = immutable ground truth (sweeps,
crawls, evidence) · **wiki** = structured/linked knowledge (the handover guides)
· **output** = shareable artifacts (the deliverables an AI/human reads) · **ctx**
= `code/` (pipeline logic: rules = `duong_dan_ra.py`/`xep_hang.py`, templates =
`build_huong_dan*.py`, snippets = `docx_chung.py`/`yt_chung.py`) · **mem** = this
file **as a thin index** PLUS `memory/` for the detail (plans, issues, dated
history). CLAUDE.md carries doctrine + one-line rules + addresses; the full
post-mortems and working files live in `memory/` and are read on demand — see
`## Memory Map` below and `memory/README.md`.

Tracked: `code/`, `CLAUDE.md`, `memory/`. Ignored (PII, not size): `raw/`, `wiki/`,
`output/`. See `README.md` for the full stage table and mandatory build order.

## Working Principles

Same four as root `CLAUDE.md` (Think Before Coding · Simplicity First · Surgical
Changes · Goal-Driven Execution). One tourism-specific amplifier, paid for many
times over in the log below: **a value that reaches a document is a claim.** If it
cannot be traced to a record, measured, or verified, it does not go in — an
omission costs a reader nothing, a fabricated fact costs them their trust.

## The Guards — read before touching any output path

Everything this pipeline generates carries **real Vietnamese mobile numbers**
(~14,328 under `raw/`, 416 under `wiki/`). For a one-person business the
"business number" IS a personal mobile, and this repo is toggled **PUBLIC during
`/ship`**, so a mis-placed generated file = published PII. Four coupled layers keep
it out, and they reference paths **by string** — change one, change all in the
same commit, or the protection silently disarms:

1. **`code/duong_dan_ra.py`** — write-guard. `THU_MUC_CHO_PHEP = ("tourism-kb/raw",
   "tourism-kb/wiki", "tourism-kb/output")`. `kiem_loi_ra(path)` raises `SystemExit(1)`
   before any write outside those roots; every builder calls it. Tested both
   directions by `code/test_duong_dan_ra.py`.
2. **`G8`** in `../scripts/audit/greppable-invariants.sh` (`check_g8_tourism_artifacts`)
   — fails CI if `git ls-files` finds anything tracked under `tourism-kb/{raw,wiki,
   output}`, any `*.docx`, any guide basename anywhere, or `tourism-kb/code/*.json`.
   The write-guard stops a file being born in the wrong place; G8 stops it reaching
   a push. Neither subsumes the other.
3. **`tourism-kb/.gitignore`** — the by-location/by-type ignore rules.
4. **`../.github/workflows/ci.yml`** — runs `test_xep_hang.py` + `test_duong_dan_ra.py`;
   `../.gitleaks.toml` carries the `\+84[35789]\d{8}` phone rule.

Prove a guard fires before trusting it: run `test_duong_dan_ra.py` (both
directions) and confirm G8 both PASSes clean and FAILs on a forced `git add -f`.

## PII Discipline

- Phone numbers ARE the value (every row needs a verify call) — they stay, but
  stay OUT of git.
- No posts, account names, or faces stored (PDPL 2025 has no "publicly posted"
  exemption). Only public business data, no login, no technical bypass.
- No rating scores stored — only `place_id` (Google) / Location ID (TripAdvisor).
  **EXCEPTION (owner decision 2026-08-05):** customer output (export JSON + nhà hàng docx) is
  now ORDERED by internal VQS influence — the ORDER ships, the numbers never do. Overrides the
  old "order ≡ number, equal risk" rule (`xep_hang_song.py`); see README `## Thứ tự ảnh hưởng`.
  Ranking rules live in files (`xep_hang.py`, Wilson thresholds); the numbers do
  not. No hotel star grades (`GIA_3SAO` is a price convention, say so at each site).
- Commercial prices → `gia_tham_khao` with every conflicting value shown.

## Build order is load-bearing

`build_huong_dan.py` **writes** `guide_data.json`; `build_huong_dan_docx.py` only
**reads** it. Run both in the SAME pass, then `kiem_parity.py` (it refuses if the
two outputs are >300 s apart). Word must be closed (`PermissionError` otherwise).

    python tourism-kb/code/build_huong_dan.py      tourism-kb/raw/da-lat/scrape
    python tourism-kb/code/build_huong_dan_docx.py tourism-kb/raw/da-lat/scrape
    python tourism-kb/code/kiem_parity.py

**Docx CHUẨN = bản RÚT GỌN** (đọc export, slug tự suy qua `dia_diem_config`; không cần `.md`/parity):
- **Điểm đến**: `build_diem_den_docx.py` → 6 cột (STT · Tên · Loại hình/trải nghiệm · Địa chỉ · Giờ · Giá vé), đọc `export/<slug>/diem-den.json`.
- **Nhà hàng**: `build_nha_hang_docx.py` → 5 cột (Nhà hàng · Loại món · Giá TB · Địa chỉ · Điểm Google), **sort theo THỨ TỰ ẢNH HƯỞNG** (VQS nội bộ qua `anh_huong.py`; KHÔNG in số — QĐ 2026-08-05), đọc `export/<slug>/nha-hang.json`. City mới: `sweep_nha_hang.py`+`export_planner.py` trước.
- **Khách sạn**: `build_khach_san_docx.py` → 5 cột (Khách sạn · Loại hình · Địa chỉ · Điện thoại · Bản đồ-link), thứ tự ảnh hưởng, **BỎ cột giá/sao** (nguồn Overture không có; đừng pad "Chưa xác minh"). City không sổ nhà nước (NT/DN): `sweep_luu_tru_overture.py` (bulk, giá/sao null, provenance `SRC_OT`) + `resolve_quan_overture.py` (place_id nhà hàng, nhắm đúng tập export top-250) trước.
`build_huong_dan*.py` verbose là **legacy** (KS có giá — chỉ Đà Lạt/CSDL).

    python tourism-kb/code/build_diem_den_docx.py  tourism-kb/raw/<slug>/scrape
    python tourism-kb/code/build_nha_hang_docx.py  tourism-kb/raw/<slug>/scrape
    python tourism-kb/code/build_khach_san_docx.py tourism-kb/raw/<slug>/scrape

## Distilled Rules

Rules paid into context every tourism-kb turn — keep terse. Each is distilled from a
dated post-mortem; full evidence in `memory/lessons/<domain>/` (one file per post-mortem —
find via `memory/lessons/_index.md` or the `date · keyword` tag). New lesson → add ONE line
here + a `memory/lessons/<domain>/<YYYY-MM-DD>-<slug>.md` file.

**Name-matching, dedup & toponyms**
- Match Vietnamese names WITH diacritics and word boundaries; a bare `in`/substring test conflates `bánh căn`⊂`bánh canh` — one boundary-aware matcher, used by every matcher on the path. (2026-07-29 · tim_cum)
- Derive stopwords from corpus token-frequency, never a hand list — the no-discriminating-power words are dataset-specific (province/city names saturate business names). (2026-07-28 · stopword)
- A frequency stoplist raises precision and destroys recall — before reusing a name-match fix, check which direction it errs. (2026-07-28 · mirror)
- Before harvesting a label set into a stopword/generic set, check for proper nouns — one (`Chè hé` the shop) silently deletes the entity it names. (2026-07-29 · proper-noun)
- Screen matched entities for TOPONYMS: fold the name and test if it appears in its own address — a business named after its street matches mentions of the street, not the shop. (2026-07-30 · toponym)
- Before collapsing records on a shared key, measure distance/second-axis between them — identical names are branches at least as often as duplicates; dedup-by-name-alone destroys real rows. (2026-07-30 · branches)
- Before porting a name-matcher to a new entity class, check the discriminating axis EXISTS there (dishes have a token axis; lodging has none) and whether the class names itself after the search vocabulary. (2026-07-31 · lodging-axis)
- A warning in the docstring of the module that built your input is part of the data contract — grep the sweep for `bay`/`bẫy`/`trap`/`⚠` before writing a matcher. (2026-07-31 · category-prefix)

**Guard & test discipline**
- To test a guard sitting in front of a side effect, call the GUARD (`duoc_phep`), never the thing it guards (`build_x.py`) — the latter runs the side effect. (2026-08-01 · call-the-guard)
- A filter decides what to KEEP, never what to SAVE — any gate before persistence turns a bad heuristic into lost data. (2026-07-28 · keep-not-save)
- "Could not test" ≠ "tested and failed" — a verification whose inputs can be empty must report the two separately. (2026-07-28 · could-not-test)
- When a self-written check fails, establish WHICH code path produced the result before changing anything — a failing assertion is evidence about (test, code), and the test is often the wrong half. (2026-07-31 · which-half)
- An acceptance check must be decidable from the artifact it runs against — never threshold a count from a non-reproducible upstream (search API, live feed); test the invariant, not the magnitude. (2026-07-30 · decidable)
- A guard keyed on rendered UI text must cover every locale the caller can request AND carry a positive assertion that it fired — "matched nothing" and "nothing to match" look identical. (2026-07-28 · locale-guard)
- Any check that can abort a run must run BEFORE the run spends a non-refundable resource; a guard reading prior state must distinguish missing from unreadable. (2026-07-29 · abort-early)

**Cross-output parity**
- A parity/consistency checker must compare COUNTS, not presence — `a>0 and b>0` passes every off-by-N, and off-by-N on a warning is one output asserting as fact what the other flags as disputed. (2026-07-30 · counts)
- A checker where step 2 can fail after step 1 wrote its output must refuse to bless a stale/half-updated set (compare mtimes or a shared run-id) and must state which layers it does NOT compare. (2026-07-31 · freshness)
- A cross-output parity check cannot see an error upstream of the split (both outputs read one input) — that class needs a check that reads the INPUTS. (2026-07-30 · upstream)
- A rule shared by two renderers lives in the shared module, or one output silently loses data; delete a field from N renderers and add its replacement in the same commit, same place. (2026-07-30 · shared-rule)
- A value written as a literal in more than one place goes stale — make it a named constant when you hand-fix the same drift a third time. (2026-07-30 · named-const)

**Record-level extraction & fields**
- Name the RECORD a field belongs to before extracting it — a per-field sweep over a multi-record page yields an unattributable bag indistinguishable from invented values. (2026-07-28 · record-not-field)
- Never concatenate independently-authored text fields before substring matching — the join fabricates character adjacencies present in no source field. (2026-07-29 · seam)
- Before promoting a field to a per-row column, print its value DISTRIBUTION, not just fill count — a constant column is one fact wearing N rows; a field whose default is indistinguishable from a real value is not coverage. (2026-07-30 · distribution)
- Absence of an attribute ON an entity is not absence in the AREA — sub-features are mapped as separate records; query the bounding area for the feature type before declaring it unavailable. (2026-07-28 · bbox)
- "Source X lacks field Y" is valid only for sources whose fields you enumerated — a source counted DONE on row-count alone has not been read; grep the raw payloads for the label. (2026-07-27 · unread-blob)
- An extractor is not evidence the field exists — check its hit-rate against the stored corpus; a "not found" branch returning bare None/0 with no count hides a 0%-yield field. (2026-07-31 · hit-rate)

**Quota & overwrite safety**
- A source metered per DAY makes mid-run truncation the ordinary exit — never let a poorer/newer result overwrite a fuller one; write atomically (`os.replace`). (2026-07-29 · per-day-quota)
- An independence threshold must count the independent ACTOR (channel), not the artifact (video) — artifacts are cheap to duplicate and duplication is the failure mode being screened. (2026-07-29 · actor)
- A filter evaluated with any-of over several contexts is defined by the LOOSEST context — prefer a query-independent reference set derived from the data. (2026-07-29 · loosest)

**File patching**
- Never patch a file containing escape sequences via a heredoc-fed inline script — `\n`/`\t`/`\\` pass through two layers of interpretation; use the Edit tool, and parse-before-write so a failed patch leaves the file untouched. (2026-07-29 · heredoc)
- Never delete/rewrite a multi-line construct (call, f-string, dict, list item) with a line-oriented regex — use Edit with the FULL construct as old_string. (2026-07-28 · line-regex)

**Provenance & source verification**
- Two readers of the same authenticated/persisted bytes must share ONE parser; before counting two fields as two sources, trace both to origin — a reverse-geocode of your own coordinate is not a witness. (2026-07-30 · identity)
- Distance is not identity — a spatial join may fill an entity-describing field only when corroborated by something other than proximity; the verdict belongs to the ELEMENT, not the row. (2026-07-30 · proximity)
- "Official source" licenses recording a value, not stopping checking — read ≥2 pages of the same site; when unofficial aggregators disagree, the disagreement IS the finding, show all values. (2026-07-28 · two-source)
- A value with provenance must not lose to a value without it; when both exist and differ, show the disagreement — grep every field reading the same merge layer when you fix one. (2026-07-30 · precedence)
- On a 403 (especially on robots.txt) stop and request access — do not re-dress the client; a source that worked three days ago is not one you still have. (2026-07-31 · 403)
- A third-party CATCH-ALL category (landmark/attraction/entertainment/poi) must not be mapped onto a specific label — the specificity you emit cannot exceed the specificity the source asserts; quarantine generic buckets before a taxonomy drives a decision. (2026-08-08 · overture-catchall)

**Ranking / thresholds**
- A threshold/scale derived from a single extreme-valued row (max, "the famous one") is a sample of size one and will not reproduce — calibrate against the reference ONCE, then freeze as absolute constants. (2026-08-01 · benchmark)
- "All observations of X satisfy P" is meaningless without a per-GROUP minimum count — re-run against the largest reference and watch if the answer moves; if it moves you measured your sample size. (2026-07-31 · per-group-n)
- A plausible mechanism stated without measurement is a hypothesis, not a diagnosis. Keep two negative states distinct: `—` below-standard (a conclusion) vs `None` not-enough-evidence (a gap). (2026-08-01 · measure)

## Memory Map

The brain lives in `memory/` (see `memory/README.md`). Read a leaf only when a task
matches its hook — that IS the retrieval mechanism (dense index + read-on-demand).

- `memory/plans/<NNN-slug>/` — plans to execute; one subfolder per plan.
- `memory/issues/<NNN-slug>/` — bugs found running the product; one subfolder per issue.
- `memory/history/<YYYY-MM-DD>/<problem>.md` — completed work, one file per solved problem per day.
- `memory/lessons/<domain>/<YYYY-MM-DD>-<slug>.md` — post-mortems (mistakes/bugs learned), one file each, domain-foldered; index at `memory/lessons/_index.md`. Distilled above.

Frontmatter (`name`/`description`/`type`/`status`/`date`) + `[[slug]]` links per
`memory/README.md`. `memory/` is tracked and MUST stay PII-free (gitleaks + G8 gate it).
