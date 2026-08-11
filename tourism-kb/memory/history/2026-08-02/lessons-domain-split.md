---
name: lessons-domain-split
description: tách 35 post-mortem tourism-kb từ bản gộp monolith (history/archive/mistake-log-2026-07-27_08-01.md) thành lessons/<domain>/ — mỗi bài 1 file, 6 domain (data-integrity 13, scraping-ethics 11, build-pipeline 7, pii-guards 2, ranking 1, docs-output 1); thêm nhánh lessons/ vào bộ não; xoá monolith; supersede plan 001
type: history
date: 2026-08-02
---

# lessons/ theo domain — thay bản gộp

**Bối cảnh.** Restructure chung của cả repo (app + tourism) chốt: bài học = MỘT-FILE-MỘT-BÀI,
chia theo domain — thống nhất hai product. Tourism-kb trước đó (plan 001) chọn bản gộp
`history/archive/mistake-log-2026-07-27_08-01.md` (82 KB). User yêu cầu tách + đặt bài học
tourism NGAY TRONG `tourism-kb/` (không để trong auto-memory của app).

**Đã làm.**
- 35 post-mortem → `memory/lessons/<domain>/<ngày>-<slug>.md` nguyên văn (verbatim, giữ
  dấu tiếng Việt + code span). Domain: data-integrity 13 · scraping-ethics 11 ·
  build-pipeline 7 · pii-guards 2 · ranking 1 · docs-output 1.
- Thêm nhánh thứ 4 `lessons/` vào `memory/README.md` (bảng tên, frontmatter `type: lesson`,
  vòng đời bước 4, `lessons/_index.md`).
- `CLAUDE.md`: `## Distilled Rules` + `## Memory Map` trỏ về `lessons/<domain>/` thay vì monolith.
- Xoá `history/archive/mistake-log-2026-07-27_08-01.md` (+ thư mục `archive/` rỗng).
- Annotate plan 001 là đã bị supersede.

**Kiểm.** `grep -rn mistake-log-2026-07-27` còn 0 ref sống (chỉ dòng lịch sử trong plan 001,
đã ghi chú supersede). `find lessons -name '*.md'` = 35 + `_index.md`. `memory/` tracked,
không PII.
