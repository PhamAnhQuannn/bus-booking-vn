# SECURITY-DEEP REVIEW — PR #399 "feat(tourism): Đà Lạt knowledge-base pipeline + PII-safe data boundary"

    PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/399
    Base/Head: master ← feat/tourism-kb-scripts @ 27f73b46
    Decision:  (none yet)
    Generated: 2026-07-29
    Lens:      /security-review-deep + /pii-inventory (folded in, not run separately)
    Scope:     55 files · +10,813 / −757 · 8 commits
    Mode:      read-only (no checkout, no worktree, no install)

    Findings: 12  (P1: 3 · P2: 4 · P3: 5)

This is not a crypto PR and not an endpoint PR. Cat 1 (crypto), Cat 3 (rate-limit),
Cat 4 (audit-log) and Cat 5 (authz) are **empty by construction** — the diff adds no
`app/api/**` route, no handler, no `prisma/schema.prisma` change, no `createCipheriv`,
no `createHash`. Verified: no `lib/**` path in the diff. The entire security surface of
this PR is Cat 6 (privacy/PII) plus the two new security *controls* it introduces
(`.gitignore` boundary, `secret-scan-staged.sh`) plus the scraping transport.

So this review is organised around the decisive question rather than the skill's
category order.

---

## VERDICT — is the PII boundary complete?

### **No.**

Three independent reasons, in descending order of how much they matter.

**1. The PR commits real harvested Vietnamese phone numbers.** Three of them, in two
files. The PR body states *"PII scan across all 55 files: **no phone numbers**, no API
keys."* That claim is false. It is false because the scan used
`\+?84[35789][0-9]{8}` and `(^|[^0-9])0[35789][0-9]{8}([^0-9]|$)` — both of which
require an **unbroken digit run**, and both numbers in the worst case are written with
**dots between groups**. `.gitleaks.toml`'s `vn-mobile-number` rule
(`\+84[35789]\d{8}`) misses them for the same reason *and* additionally requires a
`+84` prefix, so neither the local scan nor the CI rule can see them. See P1-1, P1-2.

**2. The boundary is enforced by a command-line argument, not by a default.** Every one
of the 43 scripts derives its output path from `sys.argv` / `process.argv` with no
hardcoded default inside an ignored directory. `.gitignore` protects
`documentation/tourism/` and `docs/*.docx`. It does **not** protect `docs/*.md` — and
`build_huong_dan.py` writes the guide as **markdown**, the same PII-bearing content as
the ignored `.docx`. `git check-ignore` confirms `docs/huong-dan.md` is NOT ignored. The
boundary is *currently effective* because the operator happens to type
`documentation/tourism/...`; it is not *sufficient*. See P1-3.

**3. The one control that could have caught any of this fails open, silently.** Five
demonstrated ways, including one that silently skips **every non-ASCII filename** — in a
Vietnamese-language project. See P2-1.

### What the boundary does get right

Recorded so remediation does not regress it:

- **Nothing was ever committed under the new globs.** `git log --all --diff-filter=A`
  finds no `*.docx` under `docs/`, no `prod-e2e-*.png`, no `validate-*.png`, no `*.pyc`,
  no `documentation/tourism/**`, no `.tourism-data/**` in any commit on this branch or on
  master; `git ls-files` confirms none is tracked now. `.gitignore`'s non-retroactivity
  is therefore **not** an issue here. (One unrelated `.docx` does exist in history —
  `documentation/business/BAO-CAO-KINH-DOANH-TONG-HOP.docx`, commit `5021160`, no longer
  tracked and outside the new globs.)
- **No phone numbers in the 9 new `docs/qa/` files.** This PR widens what lands in the
  `.gitleaks.toml` allowlisted class but does not itself put PII there. Verified per file.
- **No line-break-split numbers.** A whitespace-tolerant multiline pass across all 55
  files returns zero.
- **Credential handling is sound.** `sweep_fsq.py:20-44` reads `HF_TOKEN` from the
  environment first, then from `.env.local` / `.env.tourism.local`, and never prints the
  value (`print(f"token: da tim thay tu {WHERE} (khong in ra gia tri)")`). All candidate
  env files confirmed `git check-ignore`-ignored. Same pattern in `sweep_youtube_mon.py`.
- **The `CUT()`-before-read + `POISON` post-check design in the Facebook crawler is
  genuinely good** — it keeps commenter names out of *memory*, not merely out of the
  file, and drops the whole row if post residue survives. That is the right shape.
- **No login, no `storageState`, no cookies, no fingerprint evasion** in either crawler;
  `EXTRACT_SRC` is a static string so there is no evaluate-injection surface.

---

## P1 — BLOCKING

### P1-1 · `scripts/tourism/parse_fb_pages.py:58` 🚫 Real harvested VN mobile + landline in a committed code comment

```python
    # Dien thoai: uu tien DONG CHI CHUA SO — do la truong co cau truc cua
    # Facebook. Bat trong doan van la sai: trang Doi Che Cau Dat viet
    # "Liên hệ: 08xx.xxx.xxx hoặc 0263x.xxx.xxx" o phan gioi thieu, va so
    # dau tien khong phai so tong dai; truong co cau truc ben duoi moi la.
```

`08xx.xxx.xxx` → `08xxxxxxxx`, a live Viettel mobile prefix (`086`). `0263x.xxx.xxx` →
`0263xxxxxxx`, a Lâm Đồng landline (`0263`). Both were read off Đồi Chè Cầu Đất's real
public Facebook page — the comment's own wording (*"the first number is not the
switchboard"*) is only meaningful if the author was looking at the real contact line.

This is precisely the case the PR's `.gitignore` rationale is built around: harvested
business contact data for a Đà Lạt operator, in a repo that is **toggled public during
`/ship`**. It reached a committed file because the comment quoted the source verbatim to
justify a parser decision.

Why every existing control misses it:

| Control | Pattern | Result |
|---|---|---|
| PR body's scan | `(^\|[^0-9])0[35789][0-9]{8}([^0-9]\|$)` | miss — dots break the digit run |
| `.gitleaks.toml:9` | `\+84[35789]\d{8}` | miss — no `+84` prefix, and separators |
| `secret-scan-staged.sh` | 6 API-key patterns | miss — no PII pattern at all |

**Fix:** the comment does not need the number to make its point. Replace both with the
shape (`"Liên hệ: 0xxx.xxx.xxx hoặc 0263x.xxx.xxx"`) and keep the reasoning. Then add a
separator-tolerant PII pattern to the pre-commit scanner and to `.gitleaks.toml` so the
next one is caught rather than argued about — see P2-1.

### P1-2 · `scripts/tourism/enrich_web.py:48` 🚫 Real business landline inside a committed harvest table

```python
OFFICIAL_FACTS = [
    ("DL-32", "gio_mo_cua", "07:30 – 17:30", "baotanglamdong.com.vn", ...),
    ("DL-23", "can_dat_truoc", "có bán vé trước qua ticket.crazyhouse.vn · ĐT (+84) 263 xxxx xxx",
     "crazyhouse.vn", "https://www.crazyhouse.vn/", "trang chính chủ"),
]
```

`(+84) 263 xxxx xxx` is Crazy House's real switchboard, transcribed from crazyhouse.vn.
Lower individual harm than P1-1 — this is a large ticketed attraction, not a one-person
strawberry garden, so the number is not somebody's personal mobile. It is still rated P1
for two structural reasons:

1. It escapes **both** phone controls. `+84` followed by `263` starts with `2`, outside
   `[35789]`; and the spaces would break the run anyway. So `.gitleaks.toml`'s VN-mobile
   rule cannot see any Vietnamese **landline**, ever — a gap worth fixing independently
   of this PR, since `0263` is Lâm Đồng and this whole dataset is Lâm Đồng.
2. `OFFICIAL_FACTS` is a **pattern**, not an incident. It is a hardcoded table of
   manually harvested facts living in tracked source, populated by hand each pass. Today
   it holds one landline. The next pass that records a `can_dat_truoc` for a homestay puts
   a personal mobile there, and nothing in the repo will notice.

**Fix:** move the phone out of the literal — the guide already has a phone column fed
from the ignored dataset, and section 12 exists to hold "numbers to call". If the value
must stay inline, mask it. Structurally: `OFFICIAL_FACTS` should read its values from
`.tourism-data/` rather than be a hand-maintained literal in tracked source, so the
boundary applies to it by construction.

### P1-3 · `.gitignore:104-132` + every script's `sys.argv` output path 🚫 The boundary is a convention, not a rule — `docs/*.md` is an unignored sink for the same PII

The ignore list covers `documentation/tourism/`, `.tourism-data/`, `docs/*.docx`,
`/prod-e2e-*.png`, `/validate-*.png`. Measured coverage of the paths the pipeline can
actually be pointed at:

```
IGNORED     docs/Huong-Dan-Da-Lat.docx
IGNORED     documentation/tourism/huong-dan.md
IGNORED     .tourism-data/raw/fb_pages.json
NOT-IGNORED docs/huong-dan.md            ← markdown guide: SAME CONTENT as the ignored .docx
NOT-IGNORED docs/sub/x.docx              ← docs/*.docx is NON-RECURSIVE
NOT-IGNORED documentation/business/huong-dan.md
NOT-IGNORED huong-dan.md                 ← repo root
NOT-IGNORED osrm_matrix.json             ← and this one has a DEFAULT, see below
NOT-IGNORED coords.json  merged_dalat.json
```

Every write in the pipeline is argv-derived — there is no default that lands inside an
ignored directory:

- `build_huong_dan.py:19` — `RAW, OUT = sys.argv[1], sys.argv[2]`; `TRIP_OUT = sys.argv[3]`.
  Line 923 `io.open(OUT, "w").write(_final)` writes the **markdown guide**. This file has
  11 phone-field references; the PR body itself says the guides carry the operators' real
  numbers. `docs/*.docx` was ignored on the reasoning *"this is output, regenerable, and
  derived from the excluded PII"* — that reasoning applies identically to the `.md`, and
  the `.md` has no rule.
- `build_destinations_md.py:6-7` — same shape, also writes `.md`.
- `build_huong_dan_docx.py:24`, `build_report.py:11-12`, `build_data_report.py:13-14` —
  `OUT = sys.argv[2]`, `doc.save(OUT)`. Protected only where `OUT` happens to end in
  `.docx` **and** sit directly in `docs/`.
- **`sweep_osrm.py:7` — `RAW = sys.argv[1] if len(sys.argv) > 1 else "osrm_matrix.json"`.**
  The one script with a default, and the default is a **relative path resolving to the
  repo root**, unignored. A zero-arg run drops an unignored artifact into the working
  tree. Content is a road-distance matrix (coordinates, no contact data), so the PII
  impact is low — but it is a demonstrated escape reachable by *omitting* an argument
  rather than by mistyping one.

`scripts/tourism/README.md:57` documents the invocation as
`python scripts/tourism/<script>.py .tourism-data/raw` — **one** argument. The builders
need two or three. The README's table (line 40) says the output is "`.md` + `.docx`" and
never says where. So the safe path is not documented, not defaulted, and not enforced.

This is the class the mistake log already names: an invariant that holds because of
current operator habit reads as a control until the habit changes. `CLAUDE.md`'s
2026-07-28 entry is the same shape — *"a 'disabled' gateway is not a disabled ROUTE."*
Here: an ignored `.docx` is not an ignored **guide**.

**Fix — any one of these closes it; the first is strongest:**
1. Make the boundary structural: have the builders refuse to write outside an allowlisted
   root. Ten lines — resolve `OUT`, compare against `documentation/tourism/` and
   `.tourism-data/`, `sys.exit(2)` otherwise. Then the ignore list stops being the only
   thing standing between the data and a public repo.
2. Broaden the globs: `docs/**/*.docx`, `docs/*.md` (or the specific guide basenames),
   and give `sweep_osrm.py` a default under `.tourism-data/`.
3. At minimum, document the full invocation with the output path in
   `scripts/tourism/README.md` so the convention is at least written down.

---

## P2 — SHOULD FIX

### P2-1 · `scripts/audit/secret-scan-staged.sh` ⚠️ Fails open five ways, silently — and misses the class this PR is about

Judged as a control. **It fails open.** All five verified empirically against the real
script in an isolated scratch repo (never the shared tree), using
`AKIA-IOSFODNN7EXAMPLE` (khoá mẫu công khai của AWS; gạch nối thêm vào để hook không tự chặn chính báo cáo này), which the baseline correctly blocks with exit 1.

| # | Vector | Line | Observed |
|---|---|---|---|
| a | `for f in $FILES` — unquoted, word-split | `:19` | filename **with a space** → exit **0**, no output |
| b | `core.quotePath` octal-escapes non-ASCII paths | `:11,19` | **Vietnamese filename** → exit **0**, no output |
| c | scans the **worktree**, not the staged blob | `:22` | staged secret + scrubbed worktree → exit **0** |
| d | `grep` rc≠0 ⇒ "clean"; rc **2** is an *error* | `:22` | unreadable path / bad regex reads as clean |
| e | `grep -I` skips binaries | `:22` | key in plaintext inside a `.docx` → exit **0** |

(b) is the worst of these in this repo specifically. `git diff --cached --name-only`
emits `"ghi-ch\303\272-\304\221\303\240-l\341\272\241t.txt"` — quoted, with literal
backslashes — so `[ -f "$f" ]` is false and `continue` skips it **with no message**. In a
project whose documentation, data and filenames are Vietnamese, that is not an edge case.

(a) and (b) are the same root cause and the same fix: iterate NUL-delimited.

```sh
git diff --cached --name-only -z --diff-filter=ACM | while IFS= read -r -d '' f; do ...
```

…noting that a `while` in a pipeline runs in a subshell, so `FOUND` must be carried out
via exit status rather than a variable.

(c) is the classic pre-commit mistake: the hook must scan what is being **committed**.
Use `git show ":$f"` (or `git diff --cached -U0`) rather than reading the file from disk.

(e) matters more than the inline comment allows. `secret-scan-staged.sh:21` asserts
*"-I bo qua file nhi phan (.docx, anh) — chung khong chua khoa dang van ban"* — binaries
don't contain keys as text. A `.docx` is a **zip of XML** and its `word/document.xml` is
plain text; measured, `grep -I` returns rc 1 while `grep -a` returns rc 0 on the same
file. The comment names `.docx` as the example of a file that can't carry a secret, in
the PR whose entire rationale is that the `.docx` guides carry the sensitive content.
Per `CLAUDE.md` 2026-07-28: an invariant comment justifying a security decision must
state a property that actually holds — on squash-merge this becomes the permanent commit
message.

**Coverage vs the actual threat — confirmed, and it is the stated gap:** 6 patterns, all
API-key shapes, **zero PII patterns**. A staged file containing
`Lien he: +84987654321 va 08xx.xxx.xxx` passes. It also misses
`-----BEGIN … PRIVATE KEY-----`, which gitleaks' `useDefault = true` **does** catch — so
the hook is a strict subset of CI in places, not a superset. The PR body is commendably
honest about the PII gap; this review's addition is that the gap is wider than stated and
that the delivery mechanism fails open independently of coverage.

**Overlap with `.gitleaks.toml`:**

- Hook catches, gitleaks may not: nothing material — gitleaks' default ruleset covers all
  six shapes.
- Gitleaks catches, hook misses: private-key blocks, generic high-entropy assignments, the
  project's own `SEPAY_*` / `VNPAY_*` / `MOMO_*` shapes, and `vn-mobile-number`.
- **Neither catches:** separator-formatted VN phone numbers (P1-1) and VN landlines
  (P1-2).
- They also **disagree on scope in a way that hides things**: gitleaks path-allowlists
  `docs/qa/**` and `e2e/**`; the hook scans them. That asymmetry is fine. The problem is
  the reverse — content the hook cannot see (binaries, non-ASCII paths) is content gitleaks
  will also not see once it is inside an allowlisted path.

**Bypass surface:** `git commit --no-verify` / `-n` defeats it entirely — inherent to
pre-commit hooks and acceptable **provided CI gitleaks is the real gate**, which it is.
Two things it gets *right*, worth preserving: `.husky/pre-commit` invokes it as
`sh scripts/audit/.../secret-scan-staged.sh || exit 1`, so (i) the exec bit is irrelevant
and (ii) a missing file or syntax error exits non-zero and **fails closed**. Verified
separately that `set -e` does not abort on the `[ -z "$FILES" ] && exit 0` line
(POSIX: `-e` is ignored for a non-final command of an AND-OR list) — that line is benign.

**Net rating:** a real improvement in *timing* (blocks before the commit exists) built on
a delivery mechanism that silently passes several whole file classes. Fix (a)+(b)+(c)
before merge — they are a few lines each — and add the PII patterns, or downgrade the
comment so it does not read as coverage it lacks.

### P2-2 · `scripts/tourism/sweep_quanlyluhanh.py:17-24` ⚠️ TLS verification disabled against the state licence register, with a bare-IP fallback

```python
s.verify = False
try:
    import urllib3
    urllib3.disable_warnings()
except Exception:
    pass

BASES = ["https://www.quanlyluhanh.vn/search/", "https://103.139.202.245/search/"]
```

The only `verify=False` in the diff. Three compounding parts:

1. Verification is disabled on the **whole session**, so it applies to the domain leg too,
   not just the IP leg.
2. `urllib3.disable_warnings()` removes the only runtime signal that it is off.
3. The fallback is a **raw IP over `https://`** — which is *why* verification had to be
   disabled, since no certificate will match an IP literal. So the fallback leg has no
   server identity check of any kind, and `requests` follows redirects by default, each
   hop equally unverified.

Why this is more than hygiene: this script's docstring says it exists to answer *"does
this company actually hold a licence — the identity badge."* It is the trust anchor for
every "state-verified" claim downstream. An on-path attacker, a hostile DNS answer, or
simply that IP being re-assigned lets arbitrary operator records — company names, licence
numbers, **phone numbers** — flow into the guide wearing the regulator's authority. The
document's whole value is that the register's word is better than a blog's; unverified
transport erases the distinction while the provenance tag still says otherwise.

`CLAUDE.md` already carries the adjacent rule from this same body of work — *"'official
source' licenses you to record a value, not to stop checking"* — reached there via a
site contradicting itself. This is the transport-layer version.

**Fix:** drop `s.verify = False` and the IP fallback; if `www.quanlyluhanh.vn` presents a
broken chain, pin its certificate or its CA explicitly and record the reason inline with
the date. If the IP fallback must stay, scope the exemption to that one request
(`s.get(..., verify=False)`), set `allow_redirects=False` on it, and tag every row
sourced through it so the guide can mark them unverified rather than regulator-verified.

### P2-3 · `scripts/tourism/tour_sites_crawl.mts:124` ⚠️ Real browser navigates to a URL taken from a public, editable dataset — no scheme or host allowlist

```ts
const targets = dvs.filter((d) => d.website && !NOT_A_SITE.test(d.website));
...
await page.goto(dv.website!, { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });
...
writeFileSync(join(PAGES_DIR, `web-${dv.id}-1.txt`), d.van_ban, 'utf-8');
```

`dv.website` originates in **Overture's `website` field**, which is community-editable —
anyone can set it. The only filter is `NOT_A_SITE`, a denylist of chat/social hosts
(`zalo.me`, `facebook.com`, …). There is no scheme check and no host allowlist, so
`file:///C:/Users/<user>/…/.env.local`, `http://localhost:3001/api/…`, or
`http://169.254.169.254/latest/meta-data/` would each be navigated by a real headless
Chromium and the extracted text written to disk — on the machine that also runs this app
on port 3001 and holds `.env.local`.

`CLAUDE.md` already records the empirical base rate for this field: of 8 stored "official"
domains, **3 did not resolve and 8 more pointed at unrelated businesses** — a pagoda's
website field held a shoe shop. So the field is known-contaminated, and the pipeline
navigates it anyway. `enrich_web.py:33-42` (`CONTAMINATED`) is the record of that
contamination, which means the contamination is understood but is handled *after*
navigation, not before.

Rated P2 rather than P1 because it requires poisoning an upstream open dataset (real but
non-trivial), and the extracted text is written locally into an ignored directory rather
than transmitted — there is no exfiltration channel in the script itself.

**Credit where due, and important not to regress:** sub-page hops **are** constrained —
`:155` filters `h => h.startsWith(location.origin)` — so the second hop cannot leave the
origin. The context uses no `storageState` and no login. The docstring's rule 1 already
mandates verifying the site belongs to the operator; the gap is that this is deliberately
deferred to the analysis step (rule 2, "always save evidence"), which is a good rule that
happens to place navigation before validation.

**Fix:** before `goto`, require `new URL(dv.website).protocol` ∈ `{http:, https:}` and
reject private/loopback/link-local hosts (`localhost`, `127.*`, `10.*`, `172.16-31.*`,
`192.168.*`, `169.254.*`, `::1`, and bare-IP hosts generally). Five lines, preserves the
fetch-then-verify design.

### P2-4 · `scripts/tourism/parse_fb_pages.py:125-126` · `scripts/tourism/fb_pages_crawl.mts:257` ⚠️ Harvested phone **values** printed to stdout, into a workflow that commits build output to a gitleaks-allowlisted path

```python
for r in lech:
    print(f"  LECH {r['id']} {r['ten']}: fb={r['dien_thoai_fb']}"
          f" ovt={targets.get(r['id'],{}).get('dien_thoai_overture')}")
```

```ts
for (const r of lech) console.log(`  LECH ${r.id} ${r.ten}: fb=${r.dien_thoai_fb}`);
```

Two real numbers per mismatched row, verbatim, plus the business name. Every **other**
summary print in the pipeline is a count — `n('dien_thoai_fb')` at
`fb_pages_crawl.mts:245` is `rows.filter(...).length`, `parse_csdl.py:120` is `cnt(...)`,
`sweep_luu_tru.py:147` and `sweep_nha_hang.py:154` are `sum(1 for ...)`. So the discipline
is otherwise consistent and these two sites are the exception, which is why they are worth
flagging rather than accepting as inherent.

The reason this is P2 and not P3 is how the two controls compose. This project's routine
is to paste build output into `docs/qa/` reports and PR bodies — that is what `docs/qa/`
is for, and this PR adds 9 such files. `.gitleaks.toml:49` **path-allowlists
`docs/qa/**`**. So a pasted `LECH DL-07 Vườn dâu …: fb=08xxxxxxxx ovt=+848xxxxxxxx` line
would be committed *and* invisible to the CI scan, in a repo that goes public during
`/ship`. Neither control is wrong alone; together they leave a path with no scanner on it.

**Fix:** print the count and the IDs, not the values — `LECH DL-07 (fb≠ovt)` carries the
same diagnostic signal. If the values are genuinely needed to adjudicate a mismatch, write
them to a file under `.tourism-data/` and print the path.

---

## P3 — ADVISORY

### P3-1 · `.gitleaks.toml:12-54` ℹ️ Rating the allowlist: a whole-directory exemption defended by a claim about content that nothing enforces

Assessed as requested, and the finding is about the mechanism, not this PR's use of it.

**This PR does not exploit it.** Verified per-file: the 9 new `docs/qa/` files contain
zero phone-shaped strings under any of the 13 phone patterns used here. So the widening
is real but unexercised.

**The mechanism is still the weak link.** `paths` allowlists `docs/qa/.*` wholesale, with
the description *"Placeholder/fake VN phone numbers in seeds, tests, QA smoke artifacts …
not real PII."* That is an assertion about **content**, enforced by nothing, applied by
**path**. Compare the same file's `regexes` block, which allowlists the two known
placeholder literals `+84901234567` and `+84901230001` individually — that is the correct
shape, and it is right there for reference.

The pre-existing finding is the demonstration. `docs/qa/code-review-pr124-20260622.md:81`
reads:

```
- Changed: hold created for +8493xxxxxxx → hold created for +8490xxxxxxx
```

The number is the **pre-redaction value** — the QA doc is recording the fix that masked
it, and in doing so preserved the original. That is affirmative evidence the number is
real, not merely that it looks unlike the other placeholders. It is on master and out of
this PR's scope, and it sits there because the path allowlist means gitleaks never looked.

`CLAUDE.md`'s own rule is exactly on point: *an exemption is only as strong as the
authentication it defers to; re-derive that authentication whenever you add a path to
one.* This PR adds 9 files to that path. The authentication being deferred to is "a human
remembered to x-mask it," which failed once already.

**Recommendation (own issue, not a merge blocker):** narrow `docs/qa/.*` to the specific
placeholder literals already listed in `regexes`, so a real number in a QA artifact fails
the scan; and file the `pr124` line for redaction. Also note that the
`vn-mobile-number` rule itself only matches `\+84[35789]\d{8}` — no `0`-prefixed form, no
separators, no landlines — so it would not have caught P1-1 or P1-2 even outside an
allowlisted path. Widening that regex is the higher-value change of the two.

### P3-2 · `scripts/tourism/resolve_facebook.py:100,125` ℹ️ `facebook.com/` matched unanchored on the whole URL

```python
FB = re.compile(r"facebook\.com/", re.I)
...
socials = [u for u in (best.get("socials") or []) if FB.search(u)]
...
"fb_url": socials[0],
```

`fb_url` is then navigated by `fb_pages_crawl.mts:177`. `FB.search()` on the full URL is
a substring test, so `https://evil.tld/?u=facebook.com/x` passes. Narrower than P2-3 —
an attacker must get the string into Overture's `socials` array — but the same shape.
**Fix:** parse and compare the host — `urlsplit(u).hostname` ∈
`{facebook.com, www.facebook.com, m.facebook.com, web.facebook.com}`.

### P3-3 · `scripts/tourism/sweep_fsq.py:52` ℹ️ `NameError` in the credential-not-found path

Line 17 defines `ENVFILES` (a list); line 52 prints `f"  3. Dan vao dong HF_TOKEN= trong: {ENVFILE}"` — singular, undefined. The no-token branch raises `NameError` instead of printing the setup instructions, so the one path that exists to stop someone from improvising credential storage is the path that crashes. Not a vulnerability; worth fixing because of where it sits. **Fix:** `{ENVFILES[1]}` or `{' hoac '.join(ENVFILES)}`.

### P3-4 · `scripts/tourism/tour_sites_crawl.mts:113` ℹ️ One browser context shared across all target sites

`const ctx = await browser.newContext({ locale: 'vi-VN' })` is created once and reused for every site in the loop, with no `ctx.clearCookies()` between targets. Cookies and `localStorage` set by one third-party site persist into navigations to the next. No session or credential exists in the context, so impact is low. **Fix:** `browser.newContext()` per target, or `await ctx.clearCookies()` between iterations.

### P3-5 · `.gitignore:130-132` ℹ️ `__pycache__/` and `*.pyc` newly ignored — confirmed clean, no action

Recorded as a checked negative: `git log --all --diff-filter=A -- '*.pyc' '*__pycache__*'` returns nothing, and `git ls-files` shows none tracked, so the retroactivity problem does not apply. `scripts/tourism/__pycache__/` does exist in the working tree (it blocked one of this review's own scans), so the rule is warranted.

---

## Categories with no findings

| Cat | Scope | Result |
|---|---|---|
| 1 — Crypto correctness | no `createCipher*`, `createHash`, KDF, `Math.random()` for secrets in diff | **clean — N/A** |
| 2 — Threat-model delta | no new `app/api/**` route, no upload path, no `eval`/`exec`, no SQL, no redirect handler | **clean** (scraping surface covered in P2-2/P2-3/P3-2) |
| 3 — Rate-limit + abuse | no new endpoint. Outbound politeness *is* present: `DELAY_MS` 3500–4000 ms, sequential, `MAX_SUB = 2` | **clean** |
| 4 — Audit-log emission | no mutation handler, no admin/payment path | **clean — N/A** |
| 5 — Authz surface | no new handler | **clean — N/A** |
| 6 — Privacy / PII | **P1-1, P1-2, P1-3, P2-4, P3-1** | **findings** |

Note on `documentation/business/tour-discovery/data-sources.md` and `README.md`: both
reference phone *fields* (8 and 3 mentions) but contain no phone *values* under any of the
13 patterns. Same for `CLAUDE.md`'s 8 mentions. The only email in the tourism scripts is
`phamanhquan4068@gmail.com` in 7 User-Agent strings — Nominatim's and Overpass's usage
policies require a contact address, it is already the git author on every public commit
and already in `SECURITY.md`, so the PR body's "zero marginal exposure" assessment is
accepted as correct.

---

## RECOMMENDED NEXT

**Merge decision: NEEDS-CHANGE (hold).**

Before merge — three small edits, all in files already in the diff:
1. **P1-1** — mask the two numbers in `parse_fb_pages.py:58`. One-line edit, keeps the reasoning.
2. **P1-2** — take the landline out of `enrich_web.py:48`'s `OFFICIAL_FACTS`.
3. **P1-3** — close the `.md` sink: broaden the globs (`docs/*.md` or the guide basenames, `docs/**/*.docx`), give `sweep_osrm.py:7` a default under `.tourism-data/`, and document the full builder invocation in `scripts/tourism/README.md`. The allowlisted-output-root guard is the better fix and is worth doing here rather than deferring, because it is what turns the boundary from a habit into a rule.

Also before merge, because it is cheap and the PR's own rationale depends on it:
4. **P2-1(a)(b)(c)** — NUL-delimited iteration and scan the staged blob. Without (b) the hook cannot see Vietnamese filenames at all, which in this repo is most of the new content. Add a separator-tolerant VN phone pattern in the same pass so P1-1/P1-2 become detectable rather than reviewable.

Correct the PR body's Verification section before squash-merge: *"no phone numbers"* is
false, and on squash-merge it becomes the permanent commit message. Per `CLAUDE.md`
2026-07-24, the body is written against the first commit and must be walked forward to the
final diff.

Deferrable to follow-up issues: **P2-2**, **P2-3**, **P2-4**, **P3-1** (which should also
carry the `pr124` redaction and the `vn-mobile-number` regex widening), **P3-2**–**P3-5**.

Cross-links: `/pii-inventory` folded in above — do not run separately. Scraping
ethics/ToS deliberately **not** covered here (separate agent). `/pr-feedback-route 399`
for the post-review loop.

    SUMMARY: 3 P1 · 4 P2 · 5 P3 · PII boundary INCOMPLETE · secret scanner FAILS OPEN · pinned to 27f73b46
