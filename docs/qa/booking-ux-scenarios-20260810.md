# Bộ kịch bản test trải nghiệm người dùng — Lến Xe VN (2026-08-10)

Tổng hợp Opus từ 3 Sonnet agent (booking funnel · resilience/edge · auth/account/notify/mobile).
Nguồn scenario: **BF-01→37** (funnel), **ED-01→45** (edge/resilience), **AC-01→64** (auth/notify/mobile/a11y/VN).
Gộp lại còn 12 hành trình (J1–J12) + 1 sổ rủi ro (R1–R12) + kế hoạch thực thi.

Bối cảnh: 1 nhà xe "Toàn Khuyên – Minh Tuyến", 1 tuyến 2 chiều Sài Gòn ⇄ Thanh Hóa, 1 xe 40 chỗ/ngày, ~10 card điểm đón cùng 1 `tripId`/1 quỹ ghế/1 payment. VietQR (SePay) + tiền mặt (op tạo hộ). Cửa sổ 30 ngày. Khách = người quen của nhà xe.

Hằng số thật: `HOLD_TTL=10m` · `PSP_WINDOW=20m` · `bb_hold cookie=12m` · `SESSION_SEAT_CAP=10` · `CONCURRENT_HOLD_CAP=5/phone` · rate-limit `8/min/session`, `3/min/IP` · bank-transfer UI `PAYMENT_WINDOW=15m` · reconcile `RECONCILE_THRESHOLD=15m` · `HORIZON_DAYS=30`.

---

## ★ PHÁT HIỆN HỘI TỤ — ưu tiên cao nhất (nhiều agent cùng chỉ)

| # | Phát hiện | Mức | Nguồn | Hành động |
|---|-----------|-----|-------|-----------|
| **R1** | **Oversold ghế: thanh toán trễ vs giải phóng ghế phút-20.** `PSP_WINDOW=20m` mở lại ghế của booking `awaiting_payment` bị bỏ, nhưng row chỉ chuyển `payment_failed_expired` khi cron reconcile chạy. Chuyển khoản THẬT về phút 15–23 (bank chậm, không phải bỏ) có thể đua với khách B đã đặt lại ghế "vừa trống". `applyPaidStatusTransition` là status-flip trên row đã có → **gần như chắc KHÔNG re-check capacity** → 2 vé paid cho 1 ghế. | **P0** | ED-15, ED-16 | Đọc backend `applyPaidStatusTransition` xác minh có re-check capacity không. Nếu không → guard. |
| **R2** | **Điểm đón KHÔNG có trong thông báo "đã thanh toán" đầu tiên** (`customerBookingPaid`) LẪN nhắc 24h (`bookingReminder24h`). `customerPayload` chỉ có `ticketCount/route/departureAt/bookingRef/confirmationUrl`. Khách chỉ biết điểm đón qua email `ticketReady` (sau cron gen PDF) hoặc mở trang "Vé của tôi". | **P0 (sản phẩm)** | AC-30, AC-37 | Thêm `boardingPoint` vào 2 payload này. Đây là mục đích của cả tính năng vừa build. |
| **R3** | **Diacritics tiếng Việt CÓ THỂ không render trên vé PDF.** `ticketPdf.tsx` dùng `fontFamily:'Helvetica'` (core PDF font, KHÔNG `Font.register`) cho tên khách/tuyến/điểm đón/tên nhà xe — mọi field đầy dấu. → hộp trống/glyph thiếu trên đúng tài liệu khách trình khi lên xe. | **P0** | AC-60 | Render thật + xem bằng mắt với data "Nguyễn Thị Bích Ngọc", "Ngã ba Dầu Giây". Nếu vỡ → `Font.register` Noto Sans / Be Vietnam Pro. |
| **R4** | **Điểm đón bị drop im lặng, không tín hiệu cho khách.** URL/schedule lệch → `POST /api/holds` set `boardingPoint=null` + log warn, không 422. Trang xác nhận ẩn luôn dòng "Điểm đón" → khách tưởng được đón ở điểm cũ, đứng chờ, xe không tới. | **P0** | ED-07, BF-20 | Thêm thông báo "vui lòng xác nhận điểm đón với nhà xe" khi drop, hoặc chặn mềm ở UI. |
| **R5** | **XUNG ĐỘT giữa 2 agent — cần xác minh:** guest đặt vé → sau đăng ký cùng email/phone → booking có tự gắn vào tài khoản? Agent funnel nói `backfillGuestBookingsForCustomer`/`ByEmail` CÓ. Agent account nói CHƯA xác minh, có thể mồ côi → "Vé của tôi" rỗng dù đã đi. | **P1 (xác minh)** | BF-17 vs AC-21 | Đọc flow register + `listCustomerBookings` để chốt. |
| **R6** | **Bank-transfer KHÔNG có UI terminal "thất bại".** `BankTransferClient` chỉ phân biệt paid vs timeout-đợi-tiếp. Booking bị sweep `payment_failed_expired` → vòng lặp "chưa nhận được thanh toán, đợi thêm 1-2 phút" vô hạn, không có thông báo thất bại thật + CTA. (Trang `/booking/result` VNPay CÓ nhánh `isFailed`.) | **P1** | ED-41 | Thêm nhánh `payment_failed_expired` vào `BankTransferClient`. |
| **R7** | **Vé PDF toàn TIẾNG ANH** ("Booking ref/Departure/Passenger…", date `en-GB`) trong khi mọi touchpoint khác tiếng Việt. | **P1** | AC-59 | Chốt với product: cố ý (song ngữ) hay gap. |
| **R8** | **Double-initiate khi Back-rồi-submit-lại từ Review.** `submitting` chỉ là client state, reset khi Back remount `ReviewClient`. Server có guard 2× `POST /api/bookings/initiate` cùng `holdId` không? Chưa xác minh. | **P0 nếu unguarded** | ED-33 | Test API gọi initiate 2× cùng holdId. |
| **R9** | **Consent server-side chưa xác minh.** Nút gated client (`disabled={!consented}`) nhưng chưa rõ `/api/bookings/initiate` có tự chối khi thiếu/`version` cũ. | **P1** | BF gap#2 | Forge request `consents:{noRefund:false}` / version cũ → phải bị chối. |
| **R10** | **Timestamp op dashboard THIẾU `timeZone:'Asia/Ho_Chi_Minh'`** (`DashboardClient`/`BookingDetailClient` dùng `.toLocaleString('vi-VN')` trần) trong khi mọi mặt khách-facing pin VN. Vercel chạy UTC → op thấy giờ sai. | **P1** | AC-62 | Thêm `timeZone` tường minh. |
| **R11** | **SMS mixed-encoding.** Template ASCII cố ý (GSM-7, 1 segment), nhưng data nội suy (`route`, `boardingPoint`) mang dấu → 1 ký tự dấu ép cả tin thành UCS-2, gãy giả định độ dài/chi phí. | **P2** | AC-61 | Grep có strip-diacritics trước nội suy không. |
| **R12** | **Drift hằng số 15/15/20 phút** — 3 file, 3 nghĩa khác nhau (UI countdown / reconcile eligibility / capacity window). Khoảng cách 5' của R1 là load-bearing; refactor "gộp cho gọn" sai hướng mở lại oversell. | **P2** | ED risk#6, BF gap#4 | Comment liên kết + test drift. |

---

## Bộ kịch bản thống nhất (12 hành trình)

### J1 — Toàn vẹn điểm đón end-to-end ★ (định nghĩa sản phẩm)
- **J1.1 (P0)** — chuỗi bất biến: chọn card "Ngã tư 550" → hold → review → VietQR(webhook paid) → confirmation → email ticketReady → PDF. Chuỗi `boardingPoint+HH:MM` phải xuất hiện Y NGUYÊN ở: `Hold`/`Booking` DB, review, confirmation, email row "Điểm lên xe", PDF. `[BF-37, BF-04, BF-26, AC-24, AC-31]`
- **J1.2 (P0)** — điểm đón tới MỌI mặt op: SMS `operatorNewBooking` "Đón tại…", op queue (`DashboardClient`), op detail (`BookingDetailClient` "Điểm lên xe"), **manifest tài xế** (`ManifestRefresh`), staff dashboard. `[AC-39,41,42,43,45, J1.2]`
- **J1.3 (P1)** — booking không có schedule (card thường) → không hiện dòng điểm đón, fieldset đón bến/tận-nơi hiện bình thường. `[BF-05, BF-26B]`
- **J1.4 (P0)** — điểm đón stale/tamper → drop null, không 422, không oversell — NHƯNG khách không được báo (R4). `[ED-07, BF-20]`

### J2 — Funnel happy path 2 chiều
- **J2.1 (P0)** trang chủ = 2 CTA, không ô search `[BF-01]` · **J2.2 (P0)** CTA → deep-link results `[BF-02]` · **J2.3 (P0)** results = 1 card/điểm đón, badge "chung cả xe" `[BF-03]` · **J2.4 (P0)** đặt từ card mang point+time vào store+URL `[BF-04]` · **J2.5 (P0)** chiều ngược Thanh Hóa→SG y hệt `[BF-06]`.

### J3 — Số vé (biến thể)
- **J3.1 (P0)** 1 vé · **J3.2 (P1)** 10 vé (max hold, đúng saturate SESSION_SEAT_CAP) · **J3.3 (P2)** nhiều booking/session cộng dồn dưới cap. `[BF-11,12,13]`

### J4 — Customer form → hold → review (guest + logged-in)
- **J4.1 (P0)** guest điền form → hold live → review (`bb_hold` cookie + verify) `[BF-14]` · **J4.2 (P0)** logged-in: tên prefill, `customerId` stamp lúc tạo, hiện ngay "Vé của tôi" `[BF-16]` · **J4.3 (P2)** phone prefill từ sessionStorage `[BF-15]` · **J4.4 (P1)** email typo soft-gate: nudge 1 lần, submit lần 2 qua `[BF-18, ED-36]` · **J4.5 (P1)** "Đón tận nơi" custom pickup khi không từ card `[BF-19, ED-37]` · **J4.6 (P2)** có boardingPoint → fieldset pickup ẩn hoàn toàn (bất biến 1 chỉ dẫn đón) `[ED-38]`.

### J5 — Reload / mất state
- **J5.1 (P0)** reload `/booking/customer` → URL re-seed (point+time còn), không flash interstitial `[ED-01]` · **J5.2 (P0)** reload không query string → interstitial "Phiên đã hết hạn" `[ED-02]` · **J5.3 (P0)** reload `/booking/review` → cookie bypass, timer resume từ server `expiresAt` `[ED-03]` · **J5.4 (P0)** reload review khi hold ĐÃ hết (11m) nhưng cookie chưa (12m) → `HoldExpiryModal` ngay `[ED-04]` · **J5.5 (P1)** reload bank-transfer → re-derive từ bookingRef, countdown đúng, nhưng poll budget reset `[ED-05]` · **J5.6 (P1)** reload confirmation idempotent `[ED-06]`.

### J6 — Hold expiry & timer
- **J6.1 (P1)** cảnh báo T-2:00 đổi màu destructive `[ED-08]` · **J6.2 (P0)** hết hạn idle → modal non-dismissible + clearBooking + `router.replace('/')` `[ED-09]` · **J6.3 (P1)** hết hạn lúc sắp submit → server chối `HOLD_EXPIRED` nếu race lọt `[ED-10]` · **J6.4 (P2)** 2 tab cùng hold, 1 hết hạn khi tab kia đã pay → dead click vô hại `[ED-11]`.

### J7 — Concurrency & oversell (quỹ ghế chung ~10 card)
- **J7.1 (P0)** ghế cuối: 2 card KHÁC điểm đón cùng trip đua → advisory lock serialize, 1 thắng 1 `SOLD_OUT` `[ED-12]` · **J7.2 (P1)** đông-nhưng-còn-ghế → `SEAT_MAP_BUSY` copy riêng `[ED-13]` · **J7.3 (P2)** stale RSC cache → SQL re-check lúc write `[ED-14]` · **J7.4 (P0)** ghost seat PSP window 20m (R1) `[ED-15]` · **J7.5 (P0)** webhook paid trễ sau khi B đã re-book (R1) `[ED-16]` · **J7.6 (P1)** SESSION_SEAT_CAP qua nhiều card `[ED-17]` · **J7.7 (P2)** CONCURRENT_HOLD_CAP theo phone `[ED-18]` · **J7.8 (P1)** double-click → `REQUEST_IN_FLIGHT` (không phải "nhiều người đặt") `[ED-19]` · **J7.9 (P2)** anon no-cookie → limiter IP chặt hơn `[ED-20]`.

### J8 — Payment (VietQR + VNPay flag)
- **J8.1 (P0)** VietQR: initiate → QR → SePay webhook (memo tolerant hyphen/case) → poll paid → redirect confirmation `[BF-21]` · **J8.2 (P1)** countdown 15m + timeout copy + "Thử lại" `[BF-22, ED-41]` (thiếu nhánh failed — R6) · **J8.3 (P0)** consent gate 2 checkbox mới enable nút `[BF-25]` · **J8.4 (P1, flag)** VNPay redirect khác bank-transfer `[BF-24]` · **J8.5 (P2)** link "Liên hệ hỗ trợ" → `/lien-he-dat-xe` `[BF-23]` · **J8.6 (P1)** direct-link bank-transfer forged amount = cosmetic, underpay chặn server; open-redirect `//evil` chặn `[ED-43]`.

### J9 — Confirmation, giao vé, xem lại
- **J9.1 (P0)** confirmation hiện điểm đón khi có, ẩn dòng khi không `[BF-26]` · **J9.2 (P0)** email ticketReady có "Điểm lên xe" + "Xem vé" URL tuyệt đối `[BF-29, AC-31]` · **J9.3 (P0)** logged-in tải PDF qua Bearer blob (không `<a href>`) `[BF-30, AC-25]` · **J9.4 (P1)** nút PDF ẩn khi chưa paid `[BF-31, AC-26]` · **J9.5 (P1)** "Vé của tôi" tab Sắp tới/Đã qua + cursor pagination + phím mũi tên `[BF-32, AC-28]` · **J9.6 (P2)** empty state + CTA `[BF-33, AC-29]` · **J9.7 (P2)** .ics "Thêm vào lịch" `[BF-27]` · **J9.8 (P2)** "Cần đổi điểm đón? Gọi nhà xe" tel: thật `[BF-28, AC-27]`.

### J10 — Auth & account
- **J10.1 (P0)** đăng ký email 3 bước (OTP→proof) `[AC-01]` · **J10.2 (P1)** OTP sai→đúng, cap 5 mở resend `[AC-02]`, email đã tồn tại không lộ ở OTP `[AC-03]` · **J10.3 (P0)** login + returnTo deep-link `[AC-05]` · **J10.4 (P0 security)** returnTo open-redirect: `//evil`, `/\evil`, `\t`, `\r\n` → về on-site `[AC-06]` · **J10.5 (P0)** sai cred không enumerate `[AC-07]`, lockout 15m khác rate-limit `[AC-08]` · **J10.6 (P0)** Google Sign-In happy + mọi lỗi → 1 copy đồng nhất `[AC-10,11]`, ẩn khi flag off + parity 2 flag `[AC-12]` · **J10.7 (P0)** forgot-password no-enum + OTP→reset, reuse chối, lockout `[AC-13,15,16]` · **J10.8 (P0)** access token mất khi reload → silent refresh cookie `bb_rt` → không bắt login lại `[AC-23]`, proactive refresh không surprise-logout `[AC-22]` · **J10.9 (P1)** guest xem "Vé của tôi" → redirect login returnTo `[AC-20, BF-34]` · **J10.10 (P1)** guest→register backfill (R5 — XÁC MINH) `[BF-17, AC-21]` · **J10.11 (P0)** delete-account dialog trap focus, không đóng khi loading `[AC-54]`.

### J11 — Notifications (khách nhận)
- **J11.1 (P0)** `customerBookingPaid` qua EMAIL, nội dung đúng — NHƯNG thiếu điểm đón (R2) `[AC-30]` · **J11.2 (P0)** unmatched transfer → `customerPaymentReview` trấn an "đã nhận CK, đang đối chiếu", KHÔNG "thất bại" `[AC-33]`; lapse 24h → `customerPaymentUnverified` vẫn không "bạn chưa trả" `[AC-34]` · **J11.3 (P0 ops)** `SUPPORT_EMAIL=hotro@lenxevn.com` phải là inbox thật/được theo dõi `[AC-35]` · **J11.4 (P2)** expired vs unmatched dùng copy KHÁC nhau `[AC-36]` · **J11.5 (P2)** nhắc 24h — thiếu điểm đón (R2) `[AC-37]` · **J11.6 (P2)** email HTML table render đa client `[AC-38]`.

### J12 — Date/horizon · fallback · mobile/a11y/VN
- **Date/horizon:** J12.1 (P0) past-date → redirect today VN TRƯỚC query `[ED-21, BF-09]` · J12.2 (P1) 0 trip hôm nay (xe đã chạy) → hop tới ngày gần nhất `[ED-23, BF-10]` · J12.3 (P1) biên nửa đêm VN — mỗi click date = RSC fresh `[ED-22]` · J12.4 (P1) đặt ngày +29 sạch `[BF-08]` · J12.5 (P1) vượt 30 ngày → EmptyState, "Sau →" KHÔNG có trần (R: gap điều hướng) `[ED-25,26, BF-07]` · J12.6 (P2) ticketCount>ghế-trống → hop seat-agnostic có thể vẫn rỗng `[ED-24]`.
- **Fallback:** J12.7 (P0) 0 route → fallback text + link `/routes`, không card CTA rỗng `[ED-27]` · J12.8 (P1) loader throw → per-section degrade, page vẫn 200 `[ED-28]` · J12.9 (P1) route không tồn tại → EmptyState `[ED-29]`.
- **Validation:** J12.10 (P1) VN phone regex biên `[35789]` `[ED-34]` · J12.11 (P2) tên có số/symbol chối, dấu VN qua `[ED-35]`.
- **Mobile/a11y:** J12.12 (P1) chọn điểm đón = card đầy (không dropdown), tap ≥44px `[AC-46,47]` · J12.13 (P0 a11y) form error `role=alert` assertive, success polite, node key flip re-announce `[AC-52]` · J12.14 (P1) tabs "Vé của tôi" WAI-ARIA roving `[AC-53]` · J12.15 (P1) icon-only có aria-label `[AC-55]`; nút hiện/ẩn mật khẩu 36px < 44px (gap) `[AC-09]`.
- **VN correctness:** J12.16 (P0) diacritics tên khách validate đúng (Đ/đ) `[AC-57]` · J12.17 (P0) PDF diacritics render (R3) `[AC-60]` · J12.18 (P1) PDF tiếng Anh (R7) `[AC-59]` · J12.19 (P1) SMS mixed-encoding (R11) `[AC-61]` · J12.20 (P0) timezone nhất quán, op dashboard thiếu tz (R10) `[AC-62]` · J12.21 (P2) 2 kiểu "đồng" ₫ vs "đ" `[AC-63]`.

### J-op — Operator tạo booking tiền mặt (nền cho "tiền mặt")
- **J-op.1 (P1)** op `POST /api/op/bookings/cash` → Booking `paid/cash/isManual`, không hold, có confirmationToken để gửi khách `[BF-35]` · **J-op.2 (P2)** cash vượt capacity → `insufficient_capacity`, không oversell quỹ chung `[BF-36]`.

---

## Sổ "phải xác minh trước khi tin" (code chưa chứng minh được)

1. `applyPaidStatusTransition` có re-check capacity khi flip stale `awaiting_payment`→`paid`? (R1, ED-16) — **P0 backend read.**
2. `/api/bookings/initiate` có guard double-initiate cùng holdId? (R8, ED-33) — **test API 2×.**
3. `/api/bookings/initiate` có tự chối consent thiếu/version cũ? (R9) — **forge request.**
4. Guest→register có backfill booking theo email/phone? (R5) — **đọc register + listCustomerBookings.**
5. `SUPPORT_EMAIL` có phải inbox được theo dõi? (R12/AC-35) — **ops check ngoài code.**
6. `nearestUpcomingTripDate` seat-agnostic — party lớn có thể hop tới ngày vẫn rỗng (ED-24).
7. `createHoldRequest`/`OtpCodeInput inputMode`/`StaffDashboardClient` render boarding — 3 điểm chưa đọc kỹ (ED-39, AC-50, AC-45).

---

## Kế hoạch thực thi (đề xuất)

**Đợt 1 — chặn oversell + toàn vẹn điểm đón (P0):** xác minh R1/R8/R9 (đọc backend + test API), tự động hóa J1.1/J1.2/J1.4, J7.1/J7.4/J7.5. E2E Playwright: J2, J4.1, J8.1, J9.1–3.
**Đợt 2 — honesty & VN correctness (P0/P1):** R2 (thêm boardingPoint vào paid+reminder), R3 (render PDF thật + xem mắt), R4 (báo khi drop), R6 (nhánh failed bank-transfer), R7 (chốt PDF ngôn ngữ), R10 (tz op). Manual: J11, J12.16–20.
**Đợt 3 — resilience/a11y (P1/P2):** J5, J6, J10 (auth), J12 (date/fallback/mobile/a11y). E2E + axe.

Ưu tiên biến thành e2e regression: J1.1 (chuỗi điểm đón), J7.1 (oversell 2 card), J5.1/J5.3 (reload survive), J8.1 (VietQR loop), J10.4 (open-redirect). Cần visual/manual: J12.17 (PDF diacritics), J11 (email/SMS nội dung).
