# Go-live gate — AI Trip-Planner (go/no-go tổng hợp)

status: **draft** · ngày: 2026-08-09

> Tổng hợp trạng thái mọi prerequisite + phát hiện kỹ thuật để owner quyết go-live. KHÔNG phải tư vấn
> pháp lý. Mục có "cần luật sư" phải luật sư xác nhận trước khi có khách thật.

## Tình trạng kỹ thuật (DEV)

| Hạng mục | Trạng thái |
|---|---|
| Data 37 tỉnh (trai_nghiem 100% · place_id ~51% · giờ-link) | ✅ DONE |
| Engine grounded (rank/badge/chat theo trải nghiệm) | ✅ DONE |
| 30 city-unit wire (17 tight + 13 tách mega) | ✅ DONE (DEV) |
| Prod-data R2 + cache | 🟡 CODE xong — cần R2 creds + upload |
| Automation rebuild (Windows Task) | ✅ DONE |
| **Commit / deploy** | 🔴 CHƯA — cả session loose trên branch |

## Gate — BLOCKER vs READY (từ prerequisites)

| Prereq | Chủ đề | Status | Chặn go-live? |
|---|---|---|---|
| giay-phep-lu-hanh | Giấy phép lữ hành nội địa | cần luật sư | **CHẶN nếu bán/gói.** Tư vấn miễn phí (hiện tại) chưa cần — luật sư xác nhận |
| google-places | ToS lưu trữ | done (xem cập nhật) | ✅ hợp (chỉ place_id + link) |
| wikidata / OSM / Overture / FSQ | Licensing | draft | 🟡 **cần attribution hiện trong app** (CC BY-SA · ODbL · CDLA) |
| analytics-consent | PDPL + consent | todo | 🟡 cần cơ sở pháp lý + consent nếu thu PII người dùng/analytics |
| data-access-cuc-du-lich | Registry 403 | cần xin quyền | ⚪ chỉ ảnh hưởng hạng sao/giá KS — không chặn planner |
| hotelbeds | Hạng/giá KS đối tác | todo | ⚪ tùy chọn làm giàu — không chặn |
| ban-do-tiles / osrm | Bản đồ / routing | done / todo | 🟡 chọn nhà cung cấp tile trước khi có traffic |

## Money (xem `cost-model.md`)

Phí vận hành **rẻ** (~cent/lịch, free tier lo phần đầu). Blocker "money" thật = **mô hình kinh doanh chưa
chốt** (bán/gói/marketplace → kéo theo giấy phép lữ hành), KHÔNG phải phí hạ tầng.

## 4 rủi ro cần owner chốt trước khách thật

1. **Giấy phép lữ hành** — nếu sản phẩm BÁN/gói/đặt hộ → cần giấy phép + luật sư. Hiện chỉ "tư vấn thông tin
   miễn phí" → prompt đã ràng "không đặt hộ". Giữ ranh giới này tới khi có giấy phép.
2. **PII — SĐT.** Contract (#522/#532): **điểm-đến phone = PII → strip tại model** (`slot()` trong `plan.ts`
   null phone; phủ cả DTO lẫn RSC `/lich-trinh`). **Khách sạn + nhà hàng phone = số business công khai → GIỮ**
   ("gọi trước"). PDPL 2025 vẫn cần đánh giá + **disclaimer trên UI** cho 2 số business này (owner chốt); tùy
   chọn: chỉ hiện khi bấm. KHÔNG còn rò điểm-đến theo đường vòng RSC.
3. **Licensing attribution** — mô tả verbatim **Wikipedia (CC BY-SA)** phải giữ nguồn + link; **OSM (ODbL)**,
   **Overture (CDLA)**, **Foursquare** cần dòng attribution hiện trong app. Chưa có → thêm footer/nguồn.
4. **Disclaimer sản phẩm** — "thông tin tham khảo · giá/giờ chưa xác minh, gọi trước · không đặt hộ · lịch do hệ
   thống dựng từ dữ liệu công khai". Hiện chỉ trong prompt chat — cần hiện trên UI kết quả.

## Đề xuất thứ tự gỡ (khi quyết ship)
1. Chốt **mô hình kinh doanh** → biết có cần giấy phép lữ hành không (luật sư).
2. Thêm **attribution + disclaimer UI** (rẻ, code).
3. Đánh giá **PII phone** → ẩn/gate.
4. Prod: R2 creds + upload + Vercel env → deploy. Commit branch trước.

Liên quan: [cost-model.md](cost-model.md) · [giay-phep-lu-hanh.md](giay-phep-lu-hanh.md) ·
[google-places.md](google-places.md) · [analytics-consent.md](analytics-consent.md)
