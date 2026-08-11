---
name: 001-memory-brain-restructure
description: tái cấu trúc bộ não Tourism KB — CLAUDE.md thành chỉ mục mỏng (doctrine + luật rút gọn + memory map), lịch sử/kế hoạch/issue vào memory/{plans,issues,history}/; history theo ngày, mỗi vấn đề 1 file; 35 bài học cũ archive nguyên văn
type: plan
status: done
date: 2026-08-02
---

# 001 · Tái cấu trúc memory/brain

> **Cập nhật 2026-08-02 (sau):** quyết định "archive nguyên khối" ở dưới đã bị THAY THẾ.
> 35 post-mortem giờ tách theo domain vào `../../lessons/<domain>/` (mỗi bài 1 file,
> chỉ mục `../../lessons/_index.md`); bản gộp `history/archive/mistake-log-2026-07-27_08-01.md`
> đã xoá. Xem `history/2026-08-02/lessons-domain-split.md`.

**Bối cảnh.** `CLAUDE.md` nested tự nạp CỘNG DỒN mỗi lượt trong `tourism-kb/`; 87.5 KB,
93.6 % là 35 post-mortem có ngày → chi phí context mỗi lượt bất kể tác vụ.

**Đã làm.**
- `CLAUDE.md` → chỉ mục mỏng: doctrine + `## Distilled Rules` (luật 1 dòng, trỏ archive theo
  ngày+từ khoá) + `## Memory Map`. Sơ đồ cập nhật: `mem = CLAUDE.md (index) + memory/ (detail)`.
- `memory/{plans,issues,history}/` + `memory/README.md` (bản đồ não: quy ước, frontmatter,
  retrieve, vòng đời). Mượn mẫu hệ memory gốc (`MEMORY.md` index + frontmatter `description`
  là bề mặt recall + `[[link]]` + một-fact-một-file).
- 35 bài học cũ → `history/archive/mistake-log-2026-07-27_08-01.md` nguyên văn; mô hình
  theo-ngày/theo-vấn-đề áp dụng TỪ NAY.

**Quyết định (đã chốt với user).** Tên folder tiếng Anh · archive nguyên khối + rút luật ·
CLAUDE.md giữ luật inline + con trỏ. Retrieve = chỉ mục dày từ khoá + đọc-khi-cần (không engine).

**Kiểm.** Xem phần Verification trong plan file phiên này. `memory/` tracked, không PII,
không đổi logic guard; G8 vẫn xanh.
