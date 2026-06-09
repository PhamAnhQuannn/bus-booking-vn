# Mở rộng ngành nghề ĐKKD cho nền tảng đặt vé trực tuyến (VN)

> Hướng dẫn **mở rộng giấy phép kinh doanh** (bổ sung ngành nghề) + **đăng ký TMĐT** để vận
> hành nền tảng đặt vé xe khách. Soạn 2026-06.
>
> ⚠️ **Thông tin tham khảo, KHÔNG phải tư vấn pháp lý ràng buộc.** VSIC 2025 (QĐ 36/2025) vừa
> hiệu lực 15/11/2025 → mã ngành tra lại trực tiếp trên cổng + xác nhận với **luật sư/kế toán
> VN** trước khi nộp. Liên quan: phần "Pháp lý" trong chat + `docs/payment-go-live-guide.md`.

---

## 1. Tóm tắt — cần 2 thủ tục

1. **Bổ sung ngành nghề ĐKKD** (Sở KH&ĐT, qua cổng quốc gia) — để giấy phép phủ hoạt động
   "nền tảng/đại lý đặt vé trực tuyến" (hiện chỉ có vận tải + xe công trình).
2. **Đăng ký sàn TMĐT** với Bộ Công Thương (online.gov.vn) — bắt buộc với website cho nhiều
   nhà xe đăng bán.

⚠️ **Ranh giới quan trọng**: hai thủ tục trên **KHÔNG** cấp quyền **trung gian thanh toán**
(thu/giữ tiền hộ nhà xe rồi chi lại). Cái đó cần **giấy phép Ngân hàng Nhà nước (NHNN)** theo
**Nghị định 52/2024/NĐ-CP** — xem §5.

> ⚠️ **VSIC 2025**: Quyết định **36/2025/QĐ-TTg** (hiệu lực **15/11/2025**) thay QĐ 27/2018.
> DN lập trước ngày này dùng mã cũ **phải cập nhật** sang mã mới khi thay đổi ĐKDN.

---

## 2. Ngành nghề (mã VSIC 2025) cần đăng ký

| Mã | Tên ngành | Vai trò cho nền tảng |
|---|---|---|
| **52320** | **Hoạt động dịch vụ trung gian cho vận tải hành khách** | ⭐ **CỐT LÕI** — đúng mô hình đặt/bán vé trung gian |
| **47900** | **Hoạt động dịch vụ trung gian bán lẻ** | ⭐ sàn/trung gian bán lẻ trực tuyến (TMĐT) |
| 79110 | Đại lý lữ hành | bán vé / đại lý du lịch |
| 79900 | Hoạt động liên quan đến du lịch khác | dịch vụ đặt chỗ |
| 63100 | Hạ tầng CNTT, xử lý dữ liệu, lưu trữ và hoạt động liên quan | vận hành nền tảng/hosting |
| 63901 | Hoạt động cổng tìm kiếm web | cổng thông tin/portal |
| 62190 | Lập trình máy tính khác | phát triển phần mềm |
| 62200 | Tư vấn máy tính và quản lý cơ sở hạ tầng máy tính | (tùy chọn) |
| 62900 | Hoạt động dịch vụ máy tính và CNTT khác | (tùy chọn) |
| 82900 | Hoạt động dịch vụ hỗ trợ kinh doanh khác chưa phân vào đâu | (tùy chọn, gom dịch vụ phụ) |
| *(giữ)* 49xx | Vận tải hành khách đường bộ (đã có) | nếu vẫn tự chạy xe |

**Tối thiểu nên có**: `52320` + `47900` + `63100` + (`79110`/`79900`). Hai mã ⭐ là quan
trọng nhất cho mô hình "đặt vé hộ nhiều nhà xe".

> ⭐ Đăng ký `52320` (trung gian vận tải hành khách) cho phép **làm nền tảng đặt vé** — nhưng
> **KHÔNG** cho phép **giữ tiền hộ** (trung gian thanh toán). Xem §5.

> Mã VSIC 2025 dạng 5 chữ số. Khi nhập trên cổng, hệ thống tra mã + mô tả trực tiếp — chọn
> đúng tên, không tự gõ số.

---

## 3. Thủ tục 1 — Bổ sung ngành nghề (online)

### 3.1. Cổng + điều kiện
- Cổng: **https://dangkykinhdoanh.gov.vn** (có bản tiếng Anh).
- Cần: tài khoản ĐKKD trên cổng + **chữ ký số** (USB Token hoặc ký từ xa); MST không bị khóa;
  ngành bổ sung không thuộc danh mục cấm (ngành có điều kiện phải đáp ứng điều kiện riêng).

### 3.2. Các bước
1. Đăng nhập cổng (tài khoản + chữ ký số).
2. Chọn **Đăng ký thay đổi nội dung ĐKDN → Bổ sung/thay đổi ngành nghề kinh doanh**.
3. Nhập mã ngành VSIC (tra ngay trên cổng — §2), chọn ngành chính nếu đổi.
4. Upload hồ sơ PDF (§3.3), **ký số**, nộp.
5. Theo dõi trạng thái; nhận GCN ĐKDN cập nhật.

### 3.3. Hồ sơ
- **Thông báo thay đổi nội dung ĐKDN** — **Phụ lục II-1, Thông tư 01/2021/TT-BKHĐT**.
- **Quyết định** bổ sung ngành nghề:
  - TNHH 1 TV → quyết định của **chủ sở hữu**.
  - TNHH 2 TV+ → quyết định + **Biên bản họp Hội đồng thành viên**.
  - Công ty CP → quyết định + **Biên bản họp Đại hội đồng cổ đông / HĐQT**.
- (Nếu nộp hộ) **Văn bản ủy quyền** + bản sao **CCCD** người nộp.

### 3.4. Thời gian + lệ phí
- **~3 ngày làm việc** kể từ khi hồ sơ hợp lệ.
- **Hạn thông báo: trong 10 ngày** kể từ ngày ra quyết định thay đổi.
- Có **lệ phí công bố nội dung ĐKDN** (nộp khi đăng công bố).

---

## 4. Thủ tục 2 — Đăng ký TMĐT với Bộ Công Thương

### 4.1. Cổng + căn cứ
- Cổng: **https://online.gov.vn** (Hệ thống quản lý hoạt động TMĐT).
- Căn cứ: **Nghị định 52/2013/NĐ-CP** + **Nghị định 85/2021/NĐ-CP**.

### 4.2. THÔNG BÁO vs ĐĂNG KÝ (chọn đúng loại)
- **Thông báo** website bán hàng: khi chỉ **bán dịch vụ của chính mình**.
- **Đăng ký** sàn giao dịch TMĐT: khi cho **bên thứ ba** (các **nhà xe**) mở gian/đăng bán/
  giao dịch trên website.
- → Mô hình marketplace nhiều nhà xe ⇒ thiên về **ĐĂNG KÝ sàn TMĐT** (thủ tục nặng hơn).

### 4.3. Hồ sơ đăng ký sàn
- GCN ĐKDN (đã có ngành nghề TMĐT — làm Thủ tục 1 trước).
- Đơn đăng ký (trên cổng).
- **Quy chế hoạt động sàn**.
- Điều khoản dịch vụ.
- **Chính sách bảo vệ thông tin cá nhân**.
- Mô tả mô hình/tính năng nền tảng.

### 4.4. Quy trình
Tạo tài khoản trên online.gov.vn → chờ BCT duyệt tài khoản → đăng nhập nộp hồ sơ → upload tài
liệu → BCT thẩm định (vài ngày làm việc) → cấp xác nhận.

---

## 5. ⚠️ Ranh giới: ngành nghề ≠ giấy phép trung gian thanh toán

Mô hình code hiện tại **thu hộ vào 1 tài khoản nền tảng rồi chi cho nhà xe**
(`lib/ledger/settlePayout.ts`, central-collection `rebuild-plan.md [S12]`) = **trung gian
thanh toán** theo **Nghị định 52/2024/NĐ-CP** → cần **giấy phép NHNN** (riêng, khó xin).
Đăng ký ngành `52320`/`47900` **không** thay thế giấy phép này.

**3 phương án tránh giấy phép NHNN (tái cấu trúc, không cần xin phép):**
1. **Nhà xe là merchant**: mỗi nhà xe tự mở tài khoản PSP; tiền vào thẳng nhà xe, mình chỉ thu
   **phí dịch vụ** → không bao giờ giữ tiền hộ.
2. **PSP split-settlement / escrow**: dùng tính năng tách tiền tại nguồn (phí về mình, cước về
   nhà xe) → không custody tiền nhà xe.
3. **Đại lý (có hợp đồng)**: hoạt động như đại lý bán vé — vẫn rủi ro nếu giữ tiền; cần luật sư
   xác nhận.

→ Quyết định then chốt **trước mọi onboarding PSP**: *tiền khách có nằm ở tài khoản của mình
trước khi tới nhà xe không?* Có → tái cấu trúc hoặc xin phép NHNN. Không → chỉ cần Thủ tục 1+2.

---

## 6. Checklist + thứ tự

- [ ] Xác định loại hình DN (TNHH 1TV / 2TV / CP) → đúng bộ hồ sơ §3.3.
- [ ] Có chữ ký số còn hạn.
- [ ] **Thủ tục 1**: bổ sung ngành nghề `52320, 47900, 63100, 79110/79900` (+ tùy chọn) →
      nhận GCN ĐKDN mới. *(làm TRƯỚC — PSP onboarding cần ngành nghề khớp)*
- [ ] (Nếu DN cũ) cập nhật mã ngành sang **VSIC 2025**.
- [ ] **Thủ tục 2**: đăng ký sàn TMĐT tại online.gov.vn (quy chế sàn + chính sách PII). *(song
      song được)*
- [ ] **Quyết định mô hình tiền** (§5) → tránh/xin giấy phép trung gian thanh toán NHNN.
- [ ] Sau khi GCN ĐKDN có ngành nghề → tiến hành onboarding MoMo/ZaloPay/VNPAY
      (`docs/payment-go-live-guide.md`, `docs/momo-go-live.md`).
- [ ] Luật sư/kế toán VN rà soát toàn bộ trước khi nộp.

---

## 7. Link chính thức + tài liệu

- **Cổng ĐKKD quốc gia**: https://dangkykinhdoanh.gov.vn (EN: `/en/Pages/default.aspx`)
  - Hướng dẫn dịch vụ công qua mạng: https://dangkykinhdoanh.gov.vn/vn/Pages/Huongdansudungdvc.aspx
  - Hướng dẫn cập nhật ngành theo VSIC: trang tin trên cổng (mục Quyết định 36/2025/QĐ-TTg).
- **Cổng TMĐT (BCT)**: https://online.gov.vn — Nghị định 52/2013 + 85/2021/NĐ-CP.
- **VSIC 2025**: Quyết định **36/2025/QĐ-TTg** (hiệu lực 15/11/2025) — tra mã trực tiếp trên
  cổng ĐKKD.
- **Mẫu hồ sơ**: Thông tư **01/2021/TT-BKHĐT** (Phụ lục II-1 — Thông báo thay đổi nội dung ĐKDN).
- **Trung gian thanh toán**: Nghị định **52/2024/NĐ-CP** (thanh toán không dùng tiền mặt) — NHNN.

> Mọi mã ngành + biểu mẫu: xác nhận lại trên cổng tại thời điểm nộp (VSIC 2025 mới áp dụng,
> nội dung có thể cập nhật).
