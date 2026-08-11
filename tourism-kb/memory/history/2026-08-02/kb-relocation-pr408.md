---
name: kb-relocation-pr408
description: Tourism KB dời vào tourism-kb/ độc lập (PR #408, feat/tourism-kb-relocation, commit c7922ba) — code/raw/wiki/output + CLAUDE.md/README.md nested; 4 guard PII repoint; wiki đã xác minh gitignore sạch, G8 xanh
type: history
date: 2026-08-02
---

# Dời Tourism KB thành feature độc lập (PR #408)

**Việc.** Toàn bộ tính năng du lịch gom vào `tourism-kb/` (tách khỏi app đặt vé):
`code/` (tracked, subtree DUY NHẤT commit) · `raw/`+`wiki/`+`output/` (gitignored, PII) ·
`CLAUDE.md`+`README.md` nested. Commit `c7922ba`, nhánh `feat/tourism-kb-relocation`,
PR #408 (OPEN tại thời điểm ghi — chưa merge; user tự merge).

**Trạng thái đã xác minh phiên này.**
- Không có artifact sinh ra nào bị track ở bất kỳ đâu; G8 PASS exit 0.
- Mọi file `wiki/` được ignore qua `tourism-kb/.gitignore:20 wiki/` (check-ignore từng file).
- Bảo vệ PII hiện single-layer: chỉ `tourism-kb/.gitignore` mang luật raw/wiki/output;
  root `.gitignore` (dòng 109-116) chỉ là COMMENT trỏ tới file nested. G8 chặn ở tầng push.
- 4 guard đều trỏ path mới: write-guard `code/duong_dan_ra.py` (`THU_MUC_CHO_PHEP`),
  G8 `scripts/audit/greppable-invariants.sh`, hai `.gitignore`, `.github/workflows/ci.yml`.

**Còn treo.** `wiki/TRANG-THAI.md` còn path cũ (`scripts/tourism/`, `.tourism-data/`) —
gitignored nên không commit; user coi đây là generated output, không sửa tay.

Liên quan: [[output-per-location-subfolders]]
