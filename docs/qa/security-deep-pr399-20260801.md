# SECURITY-DEEP REVIEW — PR #399 "feat(tourism): Đà Lạt knowledge-base pipeline + PII-safe data boundary"

```
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/399
Base/Head: master ← feat/tourism-kb-scripts @ c9b240f7
Decision:  none
Generated: 2026-08-01
Repo:      PUBLIC (gh repo view → visibility: PUBLIC, isPrivate: false)

Findings: 4  (P1: 1 · P2: 2 · P3: 1)
```

**Applicability note.** This PR adds no `app/api/**`, no `route.ts`, no `proxy.ts`, no
`middleware.ts`, and no `prisma/schema.prisma` change — verified with
`gh pr diff 399 --name-only`. So Cat 2 (new endpoint authz), Cat 3 (rate-limit on auth/email/
payment routes), Cat 4 (audit-log on admin/payment mutations) and Cat 5 (authz surface vs
siblings) are **inapplicable, not unmet** — there is no handler for them to apply to. The live
surface here is an offline Python/Playwright data pipeline: outbound network trust, TLS, and PII
egress. That is where this pass concentrated.

---

## P1 — BLOCKING

### `scripts/tourism/sweep_quanlyluhanh.py:17,19-22,24` 🚫 P1: TLS verification disabled, warning suppressed, and a bare-IP fallback that only functions because of it

```python
15  s = requests.Session()
16  s.headers["User-Agent"] = UA
17  s.verify = False                                    # ← certificate validation OFF, session-wide
18  try:
19      import urllib3
20      urllib3.disable_warnings()                      # ← the warning that would say so, silenced
21  except Exception:
22      pass
23
24  BASES = ["https://www.quanlyluhanh.vn/search/", "https://103.139.202.245/search/"]
                                                        # ↑ HTTPS to a raw IP — can never present a
                                                        #   valid cert, so it REQUIRES verify=False
```

Three mutually reinforcing parts, which is what makes this P1 rather than a lint nit:

1. `verify = False` accepts **any** certificate — self-signed, expired, wrong-hostname, or
   attacker-issued. Every request in this session is open to an active network attacker.
2. `urllib3.disable_warnings()` removes the one signal that would surface (1) to whoever runs it.
   The `try/except Exception: pass` means even a failure to silence fails silently.
3. The bare-IP entry in `BASES` is not an unrelated convenience — an IP literal can never match a
   hostname cert, so it is **only reachable** with verification off. Fixing (1) without removing
   (3) breaks the fallback; the two are coupled and must be resolved together.

**Why it matters more than the usual `verify=False`:** this script's own docstring (`:4`) states
its purpose — *"Trả lời câu hỏi 'công ty này có giấy phép thật không'"* / "answers the question
*does this company actually hold a licence*". It writes state-register records that the knowledge
base then presents as **licence verification**. An attacker on any hop between this machine and
that host can serve a forged listing, and the pipeline will parse it with BeautifulSoup, write it
to `.tourism-data/`, and surface it as a government-issued badge of legitimacy. The security
property the data claims to provide is exactly the one the transport gives away.

Scope is narrow and fully contained — `grep -rn "verify\s*=\s*False\|CERT_NONE\|rejectUnauthorized" scripts/`
returns **this line and nothing else**, and the bare-IP grep returns **only `:24`**. One file.

**Fix:**
1. Delete `s.verify = False` and the `urllib3.disable_warnings()` block.
2. Delete the `https://103.139.202.245/search/` fallback.
3. Run once against the hostname. If the certificate genuinely fails, do **not** reinstate the
   bypass — pin the server's public-key fingerprint (`requests` + a custom adapter, or
   `verify="/path/to/cert.pem"`), which keeps the connection authenticated while tolerating a
   chain that public roots reject. Record the reason and the date in a comment at the site.
4. If neither works, that is a finding about the source, not a reason to keep the bypass — the
   register is a public government site and an unauthenticated read of it is not worth
   publishing forged data.

Previously catalogued as **P1-4** in `docs/qa/scraper-ethics-pr399-20260729.md:39`. Re-raised
because it is **unchanged after the 9 commits** that landed since, and the PR is now being
prepared for merge rather than review.

---

## P2 — SHOULD FIX

### `scripts/tourism/parse_fb_pages.py:134,141` ⚠️ P2: live business phone numbers printed to stdout

```python
133  for r in lech:
134      print(f"  LECH {r['id']} {r['ten']}: fb={r['dien_thoai_fb']}"
135            f" ovt={targets.get(r['id'],{}).get('dien_thoai_overture')}")
...
140      for r in nghi:
141          print(f"  {r['id']} {r['ten']} · theo doi={r['so_nguoi_theo_doi']}"
142                f" · web={r['website_fb']}")
```

Every other summary line in this file prints a **count** (`sum(1 for r in ...)`,
`n('dien_thoai_fb')`) — which is the correct shape and shows the author's intent. These two
diagnostic loops print the **values**: a real business phone at `:134` (two of them, ours and
Overture's), and a business name plus website at `:141`.

This is a P2 rather than the rubric's default P3 because the leak channel is already documented as
having fired once — by this same PR. `.gitignore` adds `/scratch_out*.txt` with the explicit
reason:

> *"File tam cua cac lan do dac (`scratch_out*.txt`) cung the: chung chua **ten quan, dia chi va
> so dien thoai that**, va khong khop bat ky mau ignore nao."*

Redirected stdout carrying real phone numbers is precisely what created the file that rule now
catches. The ignore rule blocks the artifact; `:134` is the source that produces it. The PR title
is "PII-safe data boundary", and stdout is a hole in that boundary that the PR itself documents
one file over.

**Fix:** mask at the print site — `+8490xxxxxx4`-style, or print only the last two digits, or
print `id`/`ten` and the *fact* of a mismatch without either number. The diagnostic's job is
"these two sources disagree for row X", which does not require either value on screen.

### `scripts/tourism/fb_pages_crawl.mts` ⚠️ P2: crawls a `Disallow: /` host with no robots.txt fetch, while its sibling *claims* compliance it does not implement

`facebook.com/robots.txt` is `User-agent: *` → `Disallow: /`, plus an express clause: *"Collection
of data on Facebook through automated means is prohibited unless you have express written
permission from Facebook."* This crawler drives headless Chromium over ~35 pages.

The file's header is unusually careful and it is worth saying so — no login, no proxy, no stealth
plugin, no captcha service, no fingerprint spoofing, 4 s pacing (`:191,:238`), and a
**pre-read** cut of the user-post region (`CUT()`) so third-party names never enter memory, with
PDPL 2025 cited as the reason. Its `Meta v. Bright Data` argument (`:4-7`) is a sound answer to
the **contract** leg, since Meta's terms bind logged-in users.

It is **not** an answer to robots.txt or to the express-permission clause, and the file does not
claim to be. The asymmetry is the finding: sibling `tour_sites_crawl.mts:28` asserts *"Tôn trọng
robots.txt"* with **no implementing code** — `grep -rn "robots|robotparser|RobotFileParser"` over
the whole tree returns only comments, never a fetch — and that is the one crawler that
*discovers* links, i.e. where robots.txt materially applies.

An unimplemented compliance claim in a comment is worse than no claim: it reads to a reviewer, an
auditor, or a future maintainer as a control that exists.

**Fix (cheap, and the value is the record, not the parse):**
- Either implement the check (`urllib.robotparser` / a 5-line fetch-and-log at the top of each
  sweep, writing a dated artifact next to the raw data), **or** delete the claim at
  `tour_sites_crawl.mts:28` and state the actual posture.
- For the Facebook crawler specifically, keep the honest framing already in the header and add one
  line naming robots.txt as knowingly non-complied-with, with the reason — matching how
  `scraper-ethics-pr399-20260729.md:40` already describes it. A documented, deliberate,
  narrowly-scoped exception is defensible; a silent one is not.

Previously **P2-1 / P2-2** in the 2026-07-29 scraper-ethics report. Unchanged since.

---

## P3 — ADVISORY

### `scripts/tourism/sweep_csdl.py:15,19` and `sweep_csdl_stars.py:19,20` ℹ️ P3: network response parsed with no status check

```python
15  soup = BeautifulSoup(r.text, "lxml")     # no `if r.status_code != 200`, no raise_for_status()
```

`r.text` is parsed unconditionally. A 403, a WAF interstitial, a captcha page or an error template
is fed to the parser and yields zero rows — indistinguishable from "this page genuinely had no
listings". Its sibling `sweep_quanlyluhanh.py:36` *does* check (`if r.status_code != 200:
continue`), so the omission is inconsistent rather than deliberate.

Ranked P3, not P2: BeautifulSoup on a hostile page is a data-integrity problem, not code
execution, so it does not meet this skill's P2 bar for unvalidated network input. But note it is
**live right now** — CLAUDE.md (2026-07-31) records that this host *"now returns 403 to
everything … blanket"*, so these two sweeps currently parse 403 bodies as listings and report
success. **Fix:** `r.raise_for_status()` before the parse, and count-and-print non-200s.

---

## Confirmed elsewhere — not double-counted in this tally

- **Live PII in a public repo.** `docs/qa/code-review-pr124-20260622.md:81` carries
  a real-looking +84 mobile (now masked to `+8490xxxxxx4`), surviving because
  `.gitleaks.toml` path-allowlisted `docs/qa/.*`
  against every rule — and the pre-commit scanner this PR adds has no PII pattern, so that tree
  has no PII gate at either layer. Full analysis and the four-step fix are the **P1** in
  `docs/qa/code-review-pr399-20260801.md`. It is a genuine security finding and would be P1 here
  too; counted once, there.

---

## Clean — checked, no finding

- **No crypto primitives at all.** `grep -rnE "hashlib|createHash|createCipher|md5|sha1|Math\.random|randomBytes|secrets\."`
  over `scripts/tourism/` and `scripts/audit/` returns nothing. Cat 1's cipher/KDF/IV/PRNG rows
  have no code to fire on.
- **No injection sink.** No `eval(`, `exec(`, `subprocess`, `os.system`, `shell=True`, no raw SQL,
  no `dangerouslySetInnerHTML`. The single `exec(` hit is `RegExp.prototype.exec` at
  `tour_sites_crawl.mts:78`.
- **No SSRF in the link crawler.** `tour_sites_crawl.mts:155` bounds discovered links with
  `.filter(h => h.startsWith(location.origin))` and caps fan-out twice (`.slice(0, 8)` then
  `MAX_SUB`). Navigation targets come from a curated data file, not from request input.
- **No open redirect, no upload path, no file-write from network-controlled paths.**
- **Every outbound call is bounded.** 16 `urlopen` sites with explicit `timeout=` (30–240 s); both
  `page.goto` calls pass `timeout: NAV_TIMEOUT`; every crawler paces with `waitForTimeout(DELAY_MS)`.
- **No credential is literal.** All keys via `os.environ` with an `.env.tourism.local` fallback;
  `git check-ignore` confirms that file is covered by `.gitignore:37` (`.env*`).
- **The contact email in User-Agent strings is intentional and correctly justified.**
  `phamanhquan4068@gmail.com` appears in 7 UA headers — Nominatim's usage policy *requires* a
  contact address, and it is already the git author on every public commit. Zero marginal
  exposure; the PR body says so accurately.

---

```
SUMMARY: 1 P1 · 2 P2 · 1 P3 · pinned to c9b240f7
```

## RECOMMENDED NEXT

- **Fix the P1 before merge.** It is three lines in one file and has no dependants — the smallest
  fix in this review and the largest consequence.
- Mask the two `parse_fb_pages.py` print sites; it is a one-line change per site and closes the
  stdout hole in the boundary this PR exists to establish.
- Resolve the robots.txt asymmetry by **either** implementing the check **or** deleting the claim.
  Leaving an unimplemented compliance assertion in a comment is the worst of the three options.
- The P3 can ride a later change unless a `csdl` re-run is planned, in which case fix it first —
  the source is returning 403 today and the sweep will report success on empty data.
