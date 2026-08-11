SECURITY-DEEP REVIEW — PR #408 "refactor(tourism-kb): relocate tourism KB into a standalone feature"
──────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/408
Base/Head: master ← feat/tourism-kb-relocation @ b9e7a5bf
Decision:  (none)
Generated: 2026-08-02

No security-deep findings.
(Crypto, authz, rate-limit, audit-log, PII patterns clean.)

Scan detail:
  - No new files under app/api/** — zero new endpoints, so Cat 2/3/4/5 (threat-model delta, rate-limit,
    audit-log, authz surface) have no triggers.
  - Cat 1 crypto: no createCipher/createCipheriv/createHash/Math.random-for-token/bcrypt/pbkdf2/scrypt
    in added CODE lines. Every keyword match (token/verify/eval/exec/search.list) is inside relocated
    MISTAKE-LOG PROSE (root CLAUDE.md + new tourism-kb/CLAUDE.md doctrine), not executable code.
  - Cat 6 PII: this PR is net-POSITIVE for PII posture. It relocates and re-verifies the four
    string-referenced guards that keep ~14,328 real VN mobile numbers out of a repo that goes public
    during /ship, all in one atomic commit:
      · greppable-invariants.sh G8 → git ls-files on tourism-kb/{raw,wiki,output} + code/*.json (INDEX,
        i.e. push-reachability); code/ deliberately excluded as the tracked subtree.
      · duong_dan_ra.py write-guard → tourism-kb/{raw,wiki,output} allow-roots.
      · .gitignore → scoped tourism-kb/.gitignore (KEEPS the docs/archive/current-status negation).
      · python-syntax.py → repo-wide git ls-files '*.py' (relocated tourism py stays gated).
      · secret-scan-staged.sh + .gitleaks.toml → comment path updates, no rule weakened.
    PR body reports G8 PASSes clean and FAILs on a forced `git add -f` (guard proven to fire).

RECOMMENDED NEXT:
  - None. The relocation preserves every PII guard's logic and remaps its string paths coherently.
  - CI's tourism-guard job (greppable-invariants + python-syntax) + gitleaks are the runtime proof —
    watch those go green.

SUMMARY: 0 P1 · 0 P2 · 0 P3 · pinned to b9e7a5bf
