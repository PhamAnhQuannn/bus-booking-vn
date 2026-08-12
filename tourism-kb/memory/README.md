# memory/ — bộ não (brain) của Tourism KB

`mem` trong sơ đồ memory-architecture giờ là MỘT THƯ MỤC, không còn là một file.
`../CLAUDE.md` là **chỉ mục mỏng** (doctrine + luật rút gọn + địa chỉ); mọi chi tiết
nằm trong đây và chỉ được Đọc khi cần (đó là toàn bộ "hệ thống retrieve" — chỉ mục
dày từ khoá + đọc-file-khi-cần, không có engine).

## Bốn nhánh

    memory/
    ├── plans/      ← kế hoạch cần thực hiện. Mỗi kế hoạch = 1 subfolder.
    ├── issues/     ← lỗi phát hiện khi chạy product. Mỗi issue = 1 subfolder.
    ├── history/    ← việc ĐÃ làm xong. Chia theo NGÀY; mỗi vấn đề xử lý xong = 1 file.
    └── lessons/    ← bài học / post-mortem. Chia theo DOMAIN; mỗi bài = 1 file.

## Quy ước đặt tên

| Nhánh | Đường dẫn | Ví dụ |
|---|---|---|
| plans | `plans/<NNN-slug>/README.md` (+ file phụ) | `plans/001-memory-brain-restructure/README.md` |
| issues | `issues/<NNN-slug>/README.md` (+ file phụ) | `issues/003-docx-word-lock/README.md` |
| history | `history/<YYYY-MM-DD>/<vấn-đề-slug>.md` | `history/2026-08-02/output-per-location-subfolders.md` |
| lessons | `lessons/<domain>/<YYYY-MM-DD>-<slug>.md` | `lessons/scraping-ethics/2026-07-31-star-rank-missing-and-403.md` |

`NNN` = số thứ tự 3 chữ số (giống `issues/` gốc của repo). Tất cả file liên quan đến
CÙNG một kế hoạch / một issue nằm chung trong subfolder của nó. `lessons/` chia theo
domain (`data-integrity`, `scraping-ethics`, `build-pipeline`, `pii-guards`, `ranking`,
`docs-output`, …); chỉ mục ở `lessons/_index.md`.

## Frontmatter (bắt buộc mọi file lá — mượn từ hệ memory gốc)

```yaml
---
name: <slug>
description: <một dòng DÀY TỪ KHOÁ — đây là bề mặt để retrieve/recall, không phải nhãn ngắn>
type: plan | issue | history | lesson
status: open | done      # chỉ plans/issues
date: YYYY-MM-DD
---
```

`description` là thứ chỉ mục trong `../CLAUDE.md` trỏ tới; viết như một abstract nén
(nội dung + con số/quyết định load-bearing) để khớp khi một tác vụ cần nó.

## Liên kết

Dùng `[[slug]]` để nối các file memory với nhau (giống hệ memory gốc). Bài học/post-mortem
nằm ở `lessons/<domain>/` — mỗi bài 1 file, tìm qua `lessons/_index.md` (ngày + từ khoá).

## Vòng đời

1. Có việc phải làm → tạo `plans/<NNN-slug>/`.
2. Chạy product thấy lỗi → tạo `issues/<NNN-slug>/`.
3. Xử lý xong một vấn đề → viết `history/<hôm-nay>/<vấn-đề>.md`, và lật `status: done`
   trên plan/issue tương ứng. **history chỉ ghi thêm — không sửa file của ngày đã qua.**
4. Bài học rút ra (luật + "greppable smell") → viết `lessons/<domain>/<ngày>-<slug>.md`
   (nguyên văn post-mortem) + thêm MỘT DÒNG vào `## Distilled Rules` của `../CLAUDE.md`
   trỏ về nó, và cập nhật `lessons/_index.md`.

## Ranh giới

- `memory/` được git THEO DÕI (doctrine + lịch sử, cùng loại với CLAUDE.md) — **không**
  chứa PII. Không dán số điện thoại thật vào đây; gitleaks + G8 vẫn canh.
- Pipeline (`code/`) KHÔNG bao giờ ghi vào `memory/` — nên write-guard `duong_dan_ra.py`
  và G8 không đụng tới nhánh này.
