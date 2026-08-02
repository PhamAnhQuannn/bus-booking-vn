# Scraper Ethics Review — PR #399 (`feat(tourism): Đà Lạt knowledge-base pipeline + PII-safe data boundary`)

**Reviewed:** 2026-07-29
**Reviewer:** scraper-ethics (read-only; no script executed, no third-party request issued other than reading published policy pages)
**Subject:** `scripts/tourism/` — 42 scripts, 17 of which issue outbound requests. Base `master` ← `feat/tourism-kb-scripts`, +10,813 / −757 across 55 files, not draft.
**Verdict: NEEDS CHANGE — 4 × P1.** Three of the four are one-line fixes. The fourth is a policy decision the merge should not silently make.

---

## 0. Executive summary

This is a genuinely careful pipeline. It identifies itself honestly on every request it controls, sleeps on nearly every loop, caches on the sources whose policies demand caching, refuses to store review scores and post text with the reason written down, keeps conflicting prices visible instead of picking one, and excludes the personal-data corpus from git with a rationale committed next to the rule. That is a higher standard than most scraping code in production anywhere. Section 6 credits it specifically, and the credit is not padding — several of these decisions are load-bearing and would be the first thing to regress.

The problems are not carelessness. They are four places where a control was designed correctly and then landed one notch narrower than the thing it protects:

1. The gitignore boundary the PR is *named after* has already been breached — two real business phone numbers sit in tracked source, committed in `a852fd5`, and merging is the act that publishes them to `master`.
2. The pre-commit gate that should have caught them contains six API-key patterns and **no phone pattern at all**.
3. `docs/*.docx` is a single-level glob and the builders take their output path from `sys.argv[2]`, so one natural invocation plus `git add -A` publishes 730 numbers.
4. `documentation/business/tour-discovery/data-sources.md:124` — in this PR — states the project's own conclusion that these numbers have **no available lawful basis** under PDPL 91/2025/QH15. There is no retention limit, no purge path, and no data-subject-request route. Merging ships the pipeline that collects them.

The most serious *exposure* is #4. The most urgent *merge blocker* is #1, because merging is what makes it public.

---

## 1. Per-source table

| Source | Tier | Permitted? | Compliant? | Evidence |
|---|---|---|---|---|
| **OpenStreetMap** (planet extract on disk) | 1 | Yes — ODbL, bulk extract is the *sanctioned* route | **Yes** | `enrich_osm_ondisk.py` reads a local extract, zero requests. Exactly what `operations.osmfoundation.org/policies/api/` asks for: *"Large or frequent data users must use the download service 'planet.osm'"* |
| **Overpass API** (`overpass-api.de`) | 1 | Yes — ~10k req/day, 1 GB/day fair use | **Yes** | ONE request total (`sweep_osm_facilities.py:56-61`), real cache gate at `:51` skips it entirely on re-run. UA `BusBooking-KB/0.1 (tourism research)` `:58` — no contact address (P3-1) |
| **Nominatim** | 1 | Yes, under a strict policy | **Yes — best-in-set** | Policy: max 1 req/s, non-stock UA, *"Results must be cached on your side"*, no grid/systematic queries. Code: `time.sleep(1.2)` `enrich_diachi.py:47` with the policy cited inline; contact-bearing UA `:25`; real cache `nominatim.json` checked **before** the request `:36`; 36 named points, not a grid. One defect: failures are cached as `{}` `:44-46` (P3-2) |
| **OSRM demo server** | 2 | Tolerated, not promised — *"Excessive use is not allowed… access may be withdrawn"*; commercial use must stay unpaywalled + attributed | **Mostly** | 1.0–1.2 s sleeps (`enrich_osrm_nearest.py:35,39,55,65` — all four exit paths, cleanest in the set; `osrm_rows.py:57`). Resume caches at `osrm_rows.py:27`, `build_huong_dan.py:289-292`. Gap: `osrm_rows.py:45-48` `continue`s past the sleep on non-`Ok` (P2-3). Commercial-use attribution: ODbL footer present, **OSRM itself unnamed** in the guide (P3-3) |
| **Overture Maps** (S3 parquet) | 0/1 | Yes — CDLA-Permissive-2.0, public bucket, bulk is the intended access | **Yes, with a caveat** | `sweep_overture.py:13-19` via duckdb `httpfs`. No UA, no throttle, no concurrency cap — the library decides volume. Acceptable against a CDN-fronted open data bucket; would not be acceptable against a site. Attribution recorded (`build_destinations_md.py:496-507`) |
| **Foursquare OS** (HF mirror) | 0 | Yes — Apache 2.0, gate accepted | **Attribution incomplete** | `sweep_fsq.py:2,46-54` acknowledges the licence and the gate. But the Apache 2.0 **NOTICE obligation is printed into the published document** (`build_destinations_md.py:503-504`, `build_data_report.py:357-358`) and **no NOTICE file exists anywhere in the repo** (P2-4). `sweep_fsq.py:52` also `NameError`s on undefined `ENVFILE` (`:17` defines `ENVFILES`) — in the no-token branch an auditor hits first (P3-4) |
| **Wikidata / Wikipedia** | 1 | Yes — CC0 data; WDQS asks for an identifying UA | **Mostly** | Contact UA `sweep_wikidata.py:5`, `enrich_wikidata.py:18`; 0.3 s sleeps `:125,:168`. Two gaps: no cache at all (~60 entities re-hit every run), and `continue` on exception `:93,:146` **bypasses the sleep** → sustained failure becomes an unthrottled loop (P2-3) |
| **OpenTopoData** | 1 | Public, 100 pt/req + 1 call/s documented limits | **Yes** | `enrich_diahinh.py:47-58` batches 90 pts/req (under the cap), 1.2 s sleep, real cache `dem.json` `:46` |
| **YouTube Data API** | 0 | Yes — official API, keyed | **Yes, and the only 429-aware script** | `sweep_youtube_mon.py:119-125` catches `HTTPError`, `break`s on 403/429. 0.4 s sleep `:128`, real per-item cache `:100`. Minimisation is exemplary — see §6 |
| **`csdl.vietnamtourism.gov.vn`** (state lodging register) | 2 | **Silent** — no `robots.txt` (verified 404), no published scraping terms found. Public register; reading and citing is within purpose | **Etiquette yes, hygiene no** | Contact UA `sweep_csdl.py:6`. 1.0 s sleep `:32`. But: scrapes and replays a CSRF token `:9,:16-17` across up to 89 form POSTs, **no cache** → every re-run is a fresh 89-request burst; **no status check at all** (`r.text` parsed unconditionally `:15`); `sweep_csdl_stars.py` fires 2 requests per iteration behind 1 sleep `:25` → effective ~1 req/0.6 s. Legal exposure is not the scrape, it is the republication — see §4 |
| **`quanlyluhanh.vn`** (state tour-operator register) | 2 | **Silent** — no `robots.txt` (verified 404) | **NO** | `sweep_quanlyluhanh.py:17` `s.verify = False` with urllib3 warnings suppressed `:19-22`, plus a bare-IP fallback `https://103.139.202.245/search/` `:24` that routes around the hostname. Up to 158 requests/run, no cache, no 429 handling, no delay between the two `BASES` attempts `:30-37`. **P1-4** |
| **Facebook public pages** | **3** | **NO.** `facebook.com/robots.txt`: `User-agent: *` → `Disallow: /`, plus *"Collection of data on Facebook through automated means is prohibited unless you have express written permission from Facebook"* | **Non-compliant with robots.txt by design** | `fb_pages_crawl.mts` drives headless Chromium over ~35 pages, 4 s apart `:44,:238`, logged out, no cookies `:159-160`, no proxy, no stealth plugin, no captcha service. Sets **no User-Agent** — presents as ordinary Chromium `:160`. The file's own defence `:4-7` (Meta v. Bright Data — Meta's terms bind logged-in users) is a sound answer to the *contract* leg and no answer to robots.txt or the express-permission clause. **P2-1** |
| **Commercial travel / tour-operator sites** | 2 | Site-by-site; unknown, unchecked | **Partially** | `tour_sites_crawl.mts` 3.5 s delay `:46,:180`, sub-page fan-out capped `MAX_SUB = 2` `:48`, candidates `.slice(0, 8)` `:156`. But `:28` **asserts robots.txt compliance that is not implemented** — and this is the only link-discovering crawler in the tree, i.e. the one place robots.txt materially applies. It also has **no personal-data cut and no poison check**, unlike its Facebook sibling. **P2-2** |

**Tier key** (from `/scraper-ethics-pre`): 0 = official API/bulk feed · 1 = permissive ToS + robots allows · 2 = silent ToS · 3 = ToS or robots prohibits · 4 = behind auth.

---

## 2. robots.txt — the systemic gap

**No file anywhere under `scripts/` fetches or parses `robots.txt`.** Grep for `robots|robotparser|RobotFileParser` over the whole tree returns exactly two hits, both comments:

- `scripts/research/vexere-operators.mjs:26` — a human read robots.txt once and froze the result into a hardcoded `DISALLOWED_SLUGS` set `:27`. Honest intent; the list silently rots if the target edits its policy.
- `scripts/tourism/tour_sites_crawl.mts:28` — *"Tôn trọng robots.txt, một yêu cầu một lúc, có nghỉ"* — a compliance claim with no implementing code, in the one file that discovers links.

Both government registers return **404** for `/robots.txt` (verified). By convention that is "no rules", which is the outcome the code assumed — but assuming it and *establishing* it are different, and only the latter is a good-faith record if this is ever questioned. The two-line fix is a fetch-and-log at the top of each sweep; the value is not the parse, it is the dated artifact.

Facebook's robots.txt is the one that is neither absent nor permissive, and it is the one the code contradicts.

---

## 3. Technical etiquette — findings

Ranked; `file:line` throughout.

### P1-4 — TLS verification disabled + bare-IP fallback against a state register
`scripts/tourism/sweep_quanlyluhanh.py:17,19-22,24`

```python
s.verify = False
try:
    import urllib3
    urllib3.disable_warnings()
BASES = ["https://www.quanlyluhanh.vn/search/", "https://103.139.202.245/search/"]
```

Three compounding problems. (a) With verification off, every response is MITM-modifiable — and the retained field is a *licence number* used, per the module docstring `:4`, as an authenticity badge (*"trả lời câu hỏi 'công ty này có giấy phép thật không'"*). An unverified channel cannot support an authenticity claim; the data's whole purpose is defeated by the transport. (b) The IP literal reaches the origin bypassing the hostname's own routing and any host-based access control, which is the shape of evasion even when it is not the intent. (c) Warnings are suppressed, so no operator will ever notice.

Also here: `:51` stores an unparsed `txt[:300]` blob with no field whitelist — the same shape that, per the CLAUDE.md 2026-07-27 entry, hid 289 prices, 1,072 phones and 423 emails behind a row count in the `csdl` sweep. That entry's rule ("a source counted as DONE on row-count alone has not been read") applies to this file today.

**Fix:** delete `:17-22` and `:24`'s second entry. If TLS genuinely fails against `quanlyluhanh.vn`, that is a finding to record, not to suppress — pin the certificate or stop.

### P2-1 — Facebook: robots.txt says no, and the recorded defence answers a different question
`scripts/tourism/fb_pages_crawl.mts:4-7`

The header comment is the most carefully reasoned thing in the file, and it is reasoning about contract law:

> *"Đây là phía an toàn của ranh giới Meta v. Bright Data (1/2024): điều khoản Meta chỉ ràng buộc người ĐÃ đăng nhập."*

That is correct and it is the right case. It is also not a complete answer, because robots.txt is a separate, unilateral, *technical* signal that does not depend on contract formation, and Facebook's reads `User-agent: * / Disallow: /` with an explicit express-written-permission sentence above it. The skill's own tier table puts "robots.txt disallows" at Tier 3 — *skip unless legal greenlight* — independent of the ToS analysis.

What the code does right, and it is a lot: no login, no cookies (`:159-160`), no proxy, no stealth plugin, no captcha solving, 4 s between pages, sequential single page object, 35 pages total. Nothing here is evasion; grep for `stealth|captcha|undetected|proxy` returns only the disclaimer at `:4`. The realistic exposure is a C&D or an IP block, not CFAA.

Two smaller things inside it: it sets **no User-Agent**, so it presents as ordinary Chromium — which for every other source in this pipeline the project chose *not* to do, and honest identification is what lets a target throttle you specifically instead of blocking bots wholesale. And there is **no cache**: `:224` writes evidence text that is never read back, so a re-run reloads all 35 pages, in direct tension with the download/parse split `README.md:72-76` was built to enable.

**Fix (choose):** (a) accept the robots.txt divergence *explicitly* — record it as a dated decision with the Meta v. Bright Data reasoning **and** the robots.txt fact side by side, so the next reader is not told only the half that favours proceeding; or (b) drop the Facebook pass. Either way: set an honest UA and add a cache gate, both cheap.

### P2-2 — a compliance claim with no implementing code, in the only link-discovering crawler
`scripts/tourism/tour_sites_crawl.mts:28` vs `:152-156`

`:28` claims robots.txt respect. `:152-156` discovers same-origin sub-links and `:160` navigates them. There is no fetch, no parse, no check. This is the exact failure mode CLAUDE.md's 2026-07-28 entry names — *"an invariant comment asserted something its own parenthetical contradicted… on squash-merge these become the permanent commit message"* — one axis over: here the comment asserts a property nothing implements, and on squash-merge it becomes permanent justification.

Second, asymmetric-control problem in the same file: it has **no personal-data cut and no poison check**. Its four `BON DIEU BAT BUOC` `:16-33` cover site identity, price handling, politeness and an esbuild workaround; personal data is not among them. It writes full uncut `innerText` to `raw/pages/web-*.txt` (47–146 lines, vs 15–35 for the cut Facebook files). Tour-operator sites routinely carry a named guide, a Zalo number, a `Mr./Anh/Chị` contact. The Facebook crawler's cut-before-read design is correct and it is not applied to the sibling that needs it for the same reason.

**Fix:** implement the robots.txt check the comment promises (it is ~10 lines with `urllib.robotparser`'s JS equivalent, or fetch-and-substring-match), or delete the claim. Port `STOP`/`POISON` from `fb_pages_crawl.mts`.

### P2-3 — error paths that bypass their own throttle
`scripts/tourism/enrich_wikidata.py:93,146` · `scripts/tourism/osrm_rows.py:45-48`

Each of these `continue`s before reaching the `time.sleep()` at the bottom of the loop. A sustained failure — including a 429 or a 5xx, i.e. precisely the condition where backing off matters — becomes an un-throttled retry loop against Wikidata, Wikipedia and the OSRM demo server. `osrm_rows.py:43` gets this right for the exception path (`sleep(5)`) and wrong for the `code != "Ok"` path immediately below it, which is the more likely one.

**Fix:** `try/finally` around the loop body, or move the sleep to the top. Three lines total across both files. `enrich_osrm_nearest.py:35,39,55,65` already demonstrates the correct pattern — every exit path sleeps.

### P2-4 — the Apache 2.0 NOTICE obligation is published to the reader and not discharged
`build_destinations_md.py:503-504` · `build_data_report.py:357-358`

Both builders emit, into the delivered document, that Foursquare OS requires retaining `NOTICE.txt` verbatim and shipping a licence copy to downstream recipients. `find . -iname "NOTICE*"` (excluding `node_modules`/`.git`) returns nothing. The document tells the reader an obligation exists and is the only place it is recorded.

The irony is exact and worth stating: `sweep_fsq.py:4-6` records that the anonymous S3 bucket returns *only* `LICENSE.txt` and `NOTICE.txt` — the two files that were obtainable without the gate are the two not kept, while the gated data was.

**Fix:** commit `NOTICE.txt` and `LICENSE-foursquare.txt` alongside the pipeline. Two files, no code change.

### P3 — smaller items
- **P3-1** — `sweep_osm_facilities.py:58`, `enrich_diahinh.py:19`, `enrich_osrm_nearest.py:29`, `osrm_rows.py:37`, `build_huong_dan.py:298` degrade the UA from the contact-bearing form to `BusBooking-KB/0.1 (tourism research)` or bare `BusBooking-KB/0.1`. A UA with no contact route cannot be throttled-not-blocked, which is the entire benefit of identifying honestly. One shared constant fixes all five.
- **P3-2** — `enrich_diachi.py:44-46` writes `{}` into the cache on exception. A transient Nominatim failure becomes a permanent, indistinguishable-from-real "no address". Cache successes only.
- **P3-3** — the guide's source line (`build_huong_dan_docx.py:206-207`) names six sources and omits **Nominatim, Facebook, `quanlyluhanh.vn`, YouTube, and the commercial price sources**. Nominatim is covered transitively by the ODbL footer; the rest are not named anywhere in the delivered document.
- **P3-4** — `sweep_fsq.py:52` references undefined `ENVFILE` (`:17` defines `ENVFILES`) → `NameError` in the no-token branch, which is the first branch a reproducer or auditor hits.
- **P3-5** — no kill switch anywhere. No `*_ENABLED` flag, no source allowlist, no dry-run. Disabling a source means editing a URL literal or an on-disk JSON. For a 42-script one-operator pipeline this is a small gap, but "stop within 1 hour on complaint" currently has no mechanism.
- **P3-6** — no request audit log. `enrichment.json` is a fine *provenance* ledger (512 rows, each with `source`/`url`/`date`/`method`) but records where a *retained value* came from, not what requests were issued, when, or with what status. If a target ever asks "what did you do to us and when", nothing answers.

### Also genuinely fine on etiquette
Sequential everywhere it matters; parallelism only inside duckdb against open-data object storage. `MAX_SUB = 2` and `.slice(0, 8)` bound the only fan-out. `FB_LIMIT` `:155` exists so a broken extractor costs 1 page load instead of 35 — a politeness decision disguised as a debugging aid. And the only two spoofed browser UAs in the repo (`scripts/crawl-online-gov.mjs:4`, `scripts/research/vexere-operators.mjs:22-24`) are **outside** `scripts/tourism/`: this PR's own code is uniformly honest.

---

## 4. Personal data — the core question

### P1-1 — two real business phone numbers are in tracked source, and merging publishes them to `master`

```
scripts/tourism/parse_fb_pages.py:58
    # "Liên hệ: 08xx.xxx.xxx hoặc 0263x.xxx.xxx" o phan gioi thieu, va so
```
`:57` attributes it to a named business (Đồi Chè Cầu Đất). `08xxxxxxxx` (đã che) is a live Viettel mobile. Committed in `a852fd5`, tracked, in a repo `README.md:14-15` states is toggled public during `/ship`.

```
scripts/tourism/enrich_web.py:48
    ("DL-23", "can_dat_truoc", "có bán vé trước qua ticket.crazyhouse.vn · ĐT (+84) 263 xxxx xxx",
```
A venue switchboard, published by the venue itself `:49` — materially lower sensitivity, but the same class.

The number in `parse_fb_pages.py:58` is there for a *good* reason: `:56-59` documents why the structured field must win over prose-scraping, and the real example is what makes the reasoning checkable. The fix is to keep the reasoning and mask the digits (`08xx.xxx.444`) — the comment loses nothing.

**This is the merge blocker.** Everything else on this list can be a follow-up; this one is published by the act of merging.

### P1-2 — the PII gate contains no PII pattern

`.husky/pre-commit:5` runs `scripts/audit/secret-scan-staged.sh` as the first gate. Its entire pattern list, `:30-36`: Google `AIza`, HuggingFace `hf_`, OpenAI `sk-`, GitHub `ghp_`, Slack `xox`, AWS `AKIA`. **No phone pattern. No PII pattern of any kind.**

And `.gitleaks.toml:9` is `\+84[35789]\d{8}` — literal `+84`, mobile prefix, eight *contiguous* digits. `08xx.xxx.xxx` fails on the leading `0` and on the dots. `(+84) 263 xxxx xxx` fails on the spaces and because `2` is not a mobile prefix. Both leaks sit in the exact blind spot.

`.gitignore:111-112`'s reasoning — allowlisting 14k real numbers would disable the very rule written to catch them — is correct, and it is correct about the *bulk* path: Overture and Foursquare emit canonical `+84…`, which is why the rule works on the generated documents. It does not work on hand-typed comments, and hand-typed comments are where both leaks are. The protection was reasoned about at the point of bulk data and not at the point of prose.

**Fix:** add a loose-format VN phone pattern to `secret-scan-staged.sh` (`(\+84|\b0)[\s.()-]?[35789]([\s.()-]?\d){8}`) with a narrow allowlist for the `x`-masked placeholder form. This is the gate that should have caught P1-1 and is the reason it did not.

### P1-3 — `docs/*.docx` is single-level and the output path is caller-supplied

| Path | `git check-ignore` |
|---|---|
| `docs/x.docx` | `.gitignore:123` ✅ |
| `docs/tourism/x.docx` | **NOT IGNORED** |
| `docs/reports/g.docx` | **NOT IGNORED** |
| `documentation/tourism/x.docx` | `.gitignore:117` ✅ (directory rule — recursive) |

All three docx builders take the destination from the command line: `build_huong_dan_docx.py:24`, `build_data_report.py:14`, `build_report.py:12`. So the protection for 730 real mobile numbers rests entirely on the operator choosing a path that is a *direct child* of `docs/` — with five versions already accumulating there (`Huong-Dan-Da-Lat{,-v2,-v3}.docx`, …), `docs/v6/guide.docx` is a natural next choice. Then `git add -A`.

`documentation/tourism/` is protected correctly because it is a directory rule. `docs/` is not, and it holds the same data.

**Fix:** `docs/**/*.docx` plus a root `*.docx`, or have the builders refuse a destination that `git check-ignore` does not cover. One line either way.

### P1-5 — no lawful basis, no retention limit, no erasure route (the most serious exposure)

This PR adds `documentation/business/tour-discovery/data-sources.md`, and at `:124` it contains the project's own analysis:

> Vietnam's PDPL (**Law 91/2025/QH15, effective 2026-01-01**) has **no legitimate-interest basis** analogous to GDPR Art 6(1)(f) — Art 19.1(a) is a narrow defensive carve-out. Consent is effectively mandatory, so scraped reviewer names, avatars and review text have **no available lawful basis**. **Business owners' personal phone numbers count too.**

That last sentence is the finding. The same document `:118,:130` records the decision *not* to scrape review platforms — a decision made on this reasoning and honoured. The phone corpus was then collected from other sources and retained.

Against the four tests:

- **Data minimisation.** The phone number is *necessary* for the stated purpose, and unusually defensibly so: `README.md:20-21` explains that every row needing phone verification carries its number so the verification is possible, and the pipeline's whole epistemics (§6) depend on "call to confirm" being actionable. This is the strongest leg. It is also narrow — it justifies the number for the ~36 curated destinations a guide actually describes, not 730 in the handover docs and 14,328 in the raw store. The minimisation argument was made for the guide and inherited by the sweep.
- **Purpose limitation.** These numbers were published by their owners for *inbound customer contact*. Aggregation into a redistributable knowledge base is a different purpose, and it is the purpose PDPL cares about. "Already public" is not a basis, and the project knows this — `sweep_youtube_mon.py:47-53` and `README.md:91-93` both say so in terms.
- **Retention / deletion.** **There is none.** Grep across `scripts/tourism/`, `documentation/tourism/`, `documentation/business/tour-discovery/` for `retention|purge|delete after|TTL|xóa sau|thời hạn` returns zero substantive hits. The app's machinery is real but DB-scoped: `lib/account/retentionPolicy.ts:27` (`GUEST_PII_RETENTION_DAYS = 365`), `:35` (`KYB_DOC_RETENTION_DAYS = 90`), swept by `lib/jobs/retentionSweeper.ts`. `scripts/prod/purge-demo-catalog.ts:8-9` is Prisma-only and touches no filesystem. Nothing in `DS-015-dsar-privacy` mentions the tourism corpus. 730 numbers in the handover documents and 14,328 in raw have no expiry, no review date, and no removal procedure.
- **The gitignore boundary as sole safeguard.** It is the *right* control for the risk it addresses — publication — and it works: `git check-ignore -v` confirms `.tourism-data/` (`:116`), `documentation/tourism/` (`:117`) and all 10 `docs/*.docx` (`:123`). A tracked-file sweep for `\+?84[35789]\d{8}` and `0[35789]\d{8}` across `git ls-files` returns only synthetic sequential fixtures already allowlisted in `.gitleaks.toml:14-54`; `documentation/business/tour-discovery/*.md` (613 lines, tracked) contains **zero** phone numbers. The boundary holds for the bulk path. But it is a control on *distribution* only. It does not bound retention, it does not survive P1-3's glob gap, and it says nothing about a laptop holding 14,328 numbers indefinitely with no encryption-at-rest statement and no review date. One control was asked to do four jobs.
- **Should any of it be republished in a customer-facing guide?** Not on the current record. The handover document is an internal artifact and the numbers in it are arguably defensible as an operational tool for a business that will phone these venues. A *customer-facing* guide is redistribution to the public, which is the step PDPL most clearly reaches and for which `data-sources.md:124` says no basis exists. If a public guide is the destination, the honest options are: publish only venues whose numbers you have consent to list, publish switchboard/landline numbers of registered companies (a narrower and much more defensible set — `parse_csdl.py:18`'s `"Nhà ở có phòng cho khách thuê"` category is the opposite: household lets, where the pipeline stores name + home address + room count + price + phone + email at `:104-106`), or publish no numbers and link to the state register.

**Minimum before merge (P1-5):** this does not require solving PDPL. It requires that the PR not silently *decide* the question. Write down, in `scripts/tourism/README.md` or a new `documentation/tourism/DATA-GOVERNANCE.md`: a retention period with a date, where the data lives, who can access it, that no lawful basis has been established for republication, and that publication to customers is blocked pending one. Then the follow-up is scoped rather than forgotten. Right now the only written legal conclusion is a finding *against* the collection, sitting in a file that reads as background research.

### P2-5 — count drift in the committed rationale
`.gitignore:107` and `scripts/tourism/README.md:12` both state **416** real mobile numbers in the handover documents. Measured: `grep -rhoE '\+84[35789][0-9]{8}' documentation/tourism/ | sort -u | wc -l` → **730**. The raw figure (14,328) is exactly right.

The number was accurate when written and was not walked forward when the lodging and dining tables gained phone columns. It matters because `.gitignore:105-115` is the artifact a future reader will use to judge the risk, and it currently understates it by 1.76×. Same class as the 2026-07-24 CLAUDE.md entry — a rationale committed at commit 1 and not re-read against the final diff, which on squash-merge becomes the permanent message.

### P2-6 — the two POISON regexes over the same bytes have diverged
| Site | Pattern |
|---|---|
| `fb_pages_crawl.mts:121` | `(đang ở \|\bis at \|Bình luận\|\bComment\b\|Tác giả\|Thích\n\|\bLike\n)` |
| `parse_fb_pages.py:44` | `(đang ở \|\bis at \|Bình luận\|\bComment\b\|Tác giả\|Tất cả cảm xúc\|All reactions)` |

The Python version's two unique alternatives are **STOP markers** (`crawl.mts:114`), removed by the cut, so they can never appear in a file the crawler wrote — dead by construction. Meanwhile it *loses* `Thích\n` / `\bLike\n`. Net: the second-pass guard is strictly weaker than the first while looking like redundant defence.

`parse_fb_pages.py:9-11` states the rule this breaks, about itself: *"MỘT bộ trích duy nhất… Hai bộ trích cho cùng một byte là cách sinh ra lệch — dự án này đã dính đúng một lần (parser VNPay, 26/07)."* Extract the pattern to one shared constant. Also `:86-88` drops a poisoned row from the output but never unlinks the offending `.txt`.

---

## 5. Kill switch, abuse contact, audit trail

| Control | State |
|---|---|
| Per-source kill switch | **Absent** (P3-5). No env-gated allowlist; disabling a source means editing a URL literal |
| Abuse contact | `phamanhquan4068@gmail.com` in 7 UA strings — reachable, and a real contact route. Not an `abuse@` alias, and it is the developer's personal address committed to a public repo |
| Request audit log | **Absent** (P3-6). Provenance ledger exists (`enrichment.json`); request log does not |
| C&D procedure | Undocumented |
| Retention / purge | **Absent** (P1-5) |

For a one-operator, run-by-hand pipeline the kill switch is a small gap — `Ctrl-C` is the kill switch and the operator is the on-call. The audit log matters more: it is the artifact that answers a complaint, and it is the cheapest of these to add.

---

## 6. What is genuinely right

Not padding. Several of these are the first thing that would regress, and the review would be wrong to bury them.

**The Nominatim pass is a model implementation.** `enrich_diachi.py` sleeps 1.2 s with the policy quoted at the sleep `:47`, sets a contact-bearing UA `:25`, caches to `nominatim.json` and checks it **before** the request `:36`, and queries 36 named points rather than the grid the policy explicitly prohibits. Every clause of a strict published policy is satisfied, and the citation is at the line that satisfies it — exactly what the 2026-07-21 SePay rule demanded ("the exact auth header string and the exact success-ack body must be transcribed from the vendor's live docs and cited in a comment at the verification site").

**Cut-before-read is the correct architecture, and the reason is written down.** `fb_pages_crawl.mts:18-23`: *"CẮT VÙNG BÀI ĐĂNG TRƯỚC KHI ĐỌC, không lọc sau khi đọc… nên tên người không bao giờ đi vào bộ nhớ, không chỉ là không vào file."* Mitigating at ingestion rather than at output is the harder and right choice, and `:104-106` records the specific failure that motivated it — English-only markers under `locale: 'vi-VN'` matched nothing, the cut became a no-op, and commenter names went to disk (named at `:105`). Markers are now bilingual `:107-115`, with a `POISON` backstop `:121-122` that drops the whole row rather than writing a suspect file, and `:224` is unreachable when poisoned. It held on all 35 evidence files.

**The minimisation notes explain *why a field was refused*, which is the rare part.** `sweep_youtube_mon.py:47-53` is the best single example in the repo:

> `CHỈ LẤY DUY NHẤT totalResults. Không lưu tiêu đề, không lưu tên kênh, không lưu ID video, không lưu mô tả.` … *"Đây là thứ giữ toàn bộ việc này NGOÀI phạm vi PDPL 2025 — luật không có miễn trừ 'đã đăng công khai', nên một con số tổng hợp thì không phải dữ liệu cá nhân, còn một tiêu đề kèm tên kênh thì là."*

Enforced at `:114-116` (items discarded at the call site) and asserted at `:140`. Same discipline at `sweep_nha_hang.py:7-9` (Google Places → `place_id` only; TripAdvisor → Location ID only, *"rào cản là quyền"*), `emit_fb_enrichment.py:21-23` (Facebook recommend-% routed to `ty_le_gioi_thieu`, **never** mapped to `Đánh giá của khách`), and `gan_lan_can.py:24` (`Rating` = 0, *"Không tính ở đây, không in ở đâu"*).

**The gitignore block states its reasoning, not just its patterns.** `.gitignore:105-115` explains that the exclusion is about PII rather than size, that a sole trader's business number *is* their personal number, that the repo goes public during `/ship` so commit equals publication, and that allowlisting 14k numbers would disable the rule written to catch them. That last point is genuinely subtle and correct. It is also *why* P1-3 and P2-5 were findable at all — a rationale you can check is worth more than a rule you cannot.

**The epistemic discipline on operational values is real and it is unusual.** Prices from commercial sources go to `gia_tham_khao` carrying *every* conflicting value rather than one picked winner (`README.md:97-98` — three sources disagreed 3× on the same attraction). `enrich_web.py:46-49` records that Bảo tàng Lâm Đồng publishes two different opening times on two of its own pages and keeps both. The licence tables at `build_data_report.py:351-359` and `build_destinations_md.py:496-507` name *obligations*, not just licence strings — which is how the missing NOTICE (P2-4) became detectable.

**Nothing in this pipeline evades anything.** No stealth plugin, no captcha service, no proxy rotation, no residential IPs, no login, no cookies, no CAPTCHA-bypass, no anti-bot defeat. The two spoofed browser UAs in the repo are both outside `scripts/tourism/`. Against the skill's own anti-pattern list, this PR is clean on nine of the twelve technical items.

---

## 7. Verdict and required changes

**NEEDS CHANGE.** Blocking:

| # | Change | Cost |
|---|---|---|
| **P1-1** | Mask the two real numbers — `parse_fb_pages.py:58`, `enrich_web.py:48`. Keep the reasoning, lose the digits. | 2 lines |
| **P1-2** | Add a loose-format VN phone pattern to `scripts/audit/secret-scan-staged.sh` `:30-36`. This is the gate that should have caught P1-1. | ~3 lines |
| **P1-3** | `docs/*.docx` → `docs/**/*.docx` + root `*.docx`. | 2 lines |
| **P1-4** | Delete `sweep_quanlyluhanh.py:17-22` (`verify=False` + warning suppression) and the bare-IP fallback at `:24`. | 7 lines deleted |
| **P1-5** | Write the data-governance note: retention date, storage location, access, and an explicit "no lawful basis established for republication; customer-facing publication blocked pending one". Do not solve PDPL — just stop the PR from deciding it silently. | 1 short doc |

Should land with them or immediately after (P2): the Facebook robots.txt decision recorded honestly on both legs (**P2-1**); the unimplemented robots.txt claim at `tour_sites_crawl.mts:28` either implemented or deleted, and `STOP`/`POISON` ported to it (**P2-2**); the three sleep-bypassing `continue`s (**P2-3**); `NOTICE.txt` committed (**P2-4**); 416 → 730 in `.gitignore:107` and `README.md:12` (**P2-5**); one shared POISON constant (**P2-6**).

**The single most serious exposure** is P1-5. Not because it is the most likely to be enforced, but because it is the only one no control fixes: the project has written down, inside this PR, that these numbers have no available lawful basis under a law in force since 2026-01-01, and the PR ships the pipeline that collects 14,328 of them with no retention limit and no erasure route. P1-1 through P1-4 are gaps between a control and what it protects, and they are all one-line fixes. P1-5 is a decision, and merging makes it by default.

**A note on re-review.** CLAUDE.md's 2026-07-28 entries record three consecutive rounds in which fixing a review finding introduced a new one. Two candidates here: masking `parse_fb_pages.py:58` must not break the comment's evidentiary value (mask digits, keep the format that makes the two-tier ordering checkable), and widening the docx glob must be checked against `git check-ignore` for each builder's actual destination rather than assumed. Re-run this review on the fix.
