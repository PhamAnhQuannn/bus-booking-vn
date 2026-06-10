# Hướng dẫn đưa thanh toán lên Production (Việt Nam) — MoMo · ZaloPay · Thẻ

> Tài liệu thực chiến, từng bước: **vào website nào, làm gì, sandbox ra sao, cấu hình code
> chỗ nào, lên production thế nào**. Soạn 2026-06, dựa trên tài liệu chính thức của nhà cung
> cấp + mã nguồn thực tế của repo này.
>
> Tài liệu phân tích trạng thái sẵn sàng (tiếng Anh): `docs/qa/payment-go-live-readiness-2026-06-07.md`.
> Checklist công việc gốc: `issues/094-go-live-real-payment-keys.md`, cổng bảo mật:
> `issues/101-pre-go-live-security-fraud-gate.md`.
>
> ⚠️ **Pháp lý trước khi onboarding PSP**: PSP kiểm tra **ngành nghề ĐKKD** phải khớp hoạt
> động bán vé + mô hình "thu hộ→chi nhà xe" có thể cần giấy phép **trung gian thanh toán
> (NHNN)**. Xem **`docs/business-license-expansion-vn.md`** (bổ sung ngành nghề + đăng ký TMĐT
> + ranh giới NHNN) TRƯỚC khi làm các bước dưới.

---

## 0. TL;DR — đọc cái này trước

- **Phần lõi tiền (ledger, idempotency, đối soát, chống thiếu/thừa tiền) đã xong** và đã
  được smoke-test (19/19 PASS trên stub). Việc còn lại là **cắm nhà cung cấp thật**.
- **3 việc bắt buộc trước khi bật tiền thật:**
  1. **Quyết định nghiệp vụ**: cổng thẻ = **VNPAY (ĐÃ CHỌN)**; còn lại: có giữ ZaloPay riêng
     không, cơ chế chi trả cho nhà xe, tên miền production.
  2. **Code còn thiếu**: refund thật cho MoMo; **adapter** đầy đủ cho ZaloPay và thẻ (chưa có).
  3. **Hợp đồng + tài khoản merchant** với từng nhà cung cấp (cần giấy phép kinh doanh +
     tài khoản ngân hàng nhận tiền). eSMS Brandname duyệt ~5–10 ngày làm việc → làm sớm.
- **Cơ chế bật/tắt** = đổi biến môi trường:
  - `PAYMENTS_STUB=false` → dùng cổng thật (hiện chỉ MoMo có adapter thật).
  - `NOTIFY_STUB=false` → gửi SMS/email thật (giao vé).
- **Thứ tự khuyến nghị**: MoMo → bật eSMS → **Thẻ qua VNPAY** + Apple Pay → ZaloPay (hoặc
  bỏ) → kênh chi trả nhà xe. Mỗi rail: chạy ma trận webhook (094) **sau khi** qua cổng bảo
  mật (101); **sandbox trước, production sau**.

---

## 1. Hệ thống thanh toán của repo hoạt động thế nào

Hiểu phần này thì các bước cấu hình bên dưới mới rõ.

- **Bộ chọn cổng** — `lib/payment/select.ts` (`getGatewayFor`):
  - `momo` + `PAYMENTS_STUB=false` → **adapter MoMo thật** (`lib/payment/adapters/momo.ts`).
  - `zalopay`, `card` → **luôn dùng stub** cho tới khi có adapter thật (Phase 2).
- **Webhook là nguồn sự thật** — không bao giờ tin redirect của trình duyệt. Mỗi rail có
  route webhook riêng: `app/api/payments/{momo,zalopay,card}/webhook/route.ts`. Tất cả đổ về
  lõi chung `lib/payment/processWebhook.ts` (xác thực chữ ký → so khớp `orderRef` → kiểm tra
  số tiền/đơn vị tiền → dedup theo `providerTxnId` → chuyển trạng thái → ghi ledger → xếp
  hàng thông báo).
- **Sự kiện chuẩn hoá** — mọi adapter trả về `{orderRef, providerTxnId, amount, currency,
  status}` (`lib/payment/gateway.ts`). Viết adapter mới = hiện thực đúng interface này.
- **URL webhook + redirect tự suy ra từ host** của request
  (`app/api/bookings/initiate/route.ts:93-97`) → tự đi theo tên miền đang phục vụ. Khi test
  sandbox ở máy local phải mở **tunnel công khai** (xem §7).
- **Refund** — `lib/payment/refund.ts`: khi `PAYMENTS_STUB=false` hiện **ném lỗi
  `PspRefundNotImplementedError`**. Phải code gọi API refund thật cho từng cổng.
- **Cờ bật từng rail** — `lib/flags/keys.ts`: `RAIL_MOMO_ENABLED`, `RAIL_ZALOPAY_ENABLED`,
  `RAIL_CARD_ENABLED` (toggle trong DB, cho phép bật/tắt từng rail mà không cần deploy).

### Bảng biến môi trường (xem `lib/config/env.ts`, `.env.example`)

| Biến | Ý nghĩa | Giá trị go-live |
|------|---------|------------------|
| `PAYMENTS_STUB` | `true` = cổng giả nội bộ; `false` = cổng thật | `false` (có thể bật từng rail qua toggle) |
| `NOTIFY_STUB` | `true` = log SMS/email; `false` = gửi thật | `false` |
| `MOMO_PARTNER_CODE` / `MOMO_ACCESS_KEY` / `MOMO_SECRET_KEY` | Khoá MoMo | Khoá **production** từ M4B |
| `MOMO_ENDPOINT` | Endpoint tạo đơn MoMo | `https://payment.momo.vn/v2/gateway/api/create` |
| `ESMS_API_KEY` / `ESMS_SECRET_KEY` / `ESMS_BRANDNAME` | Khoá eSMS.vn | Bắt buộc khi `NOTIFY_STUB=false` |
| `ZALOPAY_*` | *(chưa có — phải thêm khi viết adapter)* | app_id / key1 / key2 / endpoint |
| `VNPAY_TMN_CODE` / `VNPAY_HASH_SECRET` / `VNPAY_PAY_URL` / `VNPAY_API_URL` | Khoá cổng thẻ **VNPAY** *(chưa có — phải thêm khi viết adapter)* | TmnCode + HashSecret từ VNPAY + URL prod |

> **Bảo mật**: KHÔNG commit khoá thật. Dùng secret store (biến môi trường của hạ tầng /
> vault). Logger đã redact khoá thanh toán. Khoá sandbox trong `.env.example` là khoá public
> của nhà cung cấp, an toàn để test.

---

## 2. MoMo (chi tiết) — gần sẵn sàng nhất

Adapter thật đã có. Còn thiếu: khoá production + tài khoản merchant + **code refund**.

### 2.1. Đăng ký merchant
1. Vào **https://business.momo.vn** → **Đăng ký (Sign up)**.
2. Khai 3 nhóm thông tin: **Account information**, **Legal & Business information**,
   **Other documents** (giấy phép kinh doanh, thông tin tài khoản ngân hàng nhận tiền…).
3. Hỗ trợ: `merchant.care@momo.vn` · Hotline `1900 636 652`.

### 2.2. Lấy thông tin Test (sandbox)
- Tài liệu kỹ thuật: **https://developers.momo.vn/v3** (mục *Payment Gateway / AIO*).
- Sau khi đăng ký, vào khu **M4B (MoMo for Business)** để lấy **Test credentials**:
  `partnerCode`, `accessKey`, `secretKey`.
- Repo đã có sẵn khoá sandbox public của MoMo trong `.env.example` để chạy thử ngay.

### 2.3. Test trên sandbox
Trang hướng dẫn: **https://developers.momo.vn/v3/docs/payment/onboarding/test-instructions/**

- **App test MoMo**: gỡ app MoMo thật trên máy → cài app test do MoMo cấp.
- **Ví test**: mật khẩu `000000`, OTP `0000`/`000000`. Liên kết ngân hàng: số thẻ dạng
  `9704 05XX XXXX XXXX`, tên/ngày phát hành tuỳ ý.
- **Thẻ ATM test**: `9704 0000 0000 0018` (thành công), `...0026` (khoá thẻ), `...0034`
  (không đủ tiền), `...0042` (quá hạn mức) — HSD `03/07`.
- **Thẻ quốc tế test**: `5200 0000 0000 1096` (OK, cần OTP), `5200 0000 0000 1104` (fail),
  `4111 1111 1111 1111` (OK, không OTP) — HSD `05/26`, CVC `111`.

### 2.4. Cấu hình trong code
Đặt env (local: `.env.local`; production: secret store):
```bash
PAYMENTS_STUB=false                 # hoặc bật riêng MoMo qua RAIL_MOMO_ENABLED
MOMO_PARTNER_CODE="<từ M4B>"
MOMO_ACCESS_KEY="<từ M4B>"
MOMO_SECRET_KEY="<từ M4B — KHÔNG commit>"
# Sandbox:
MOMO_ENDPOINT="https://test-payment.momo.vn/v2/gateway/api/create"
# Production (đổi khi lên thật):
# MOMO_ENDPOINT="https://payment.momo.vn/v2/gateway/api/create"
```
Không phải sửa code adapter — `lib/payment/adapters/momo.ts` đã đọc các biến này.

### 2.5. URL Webhook (IPN) + Redirect
- IPN: `https://<tên-miền>/api/payments/momo/webhook`
- Redirect: `https://<tên-miền>/booking/result/<token>`
- URL tự suy ra từ host của request → chỉ cần khai báo **đúng tên miền** với MoMo.
- Test sandbox ở local: mở tunnel (xem §7), khai URL tunnel cho MoMo.

### 2.6. ⚠️ Refund — PHẢI CODE
`lib/payment/refund.ts:55-58` đang ném `PspRefundNotImplementedError`. Cần:
- Gọi API refund MoMo `https://payment.momo.vn/v2/gateway/api/refund` (sandbox: đổi
  `payment` → `test-payment`).
- Ký bằng **đúng sơ đồ HMAC-SHA256 canonical-string** mà adapter MoMo đã dùng (tái sử dụng
  hàm dựng chuỗi canonical trong `lib/payment/adapters/momo.ts`).
- Trả về `providerTxnId` của refund cho lớp ledger.
- Nếu chưa code refund mà bật `PAYMENTS_STUB=false` → mọi refund/hoàn-thừa-tiền sẽ **crash
  có chủ đích** (an toàn, không âm thầm bỏ tiền). Đây là lý do refund nằm trong điều kiện
  go-live.

### 2.7. Lên Production
1. Hoàn tất **Technical Integration Process** + xác minh **tài khoản M4B** của công ty.
2. MoMo cấp **khoá production** → cập nhật `MOMO_*` vào secret store.
3. Đổi `MOMO_ENDPOINT` sang `https://payment.momo.vn/...`.
4. Khai **tên miền production** (IPN + redirect) với MoMo.
5. Chạy ma trận webhook (§7) trên production.

---

## 3. ZaloPay (chi tiết) — CHƯA có adapter

Route webhook đã có (`app/api/payments/zalopay/webhook`) nhưng **chưa có adapter thật** →
phải viết code.

### 3.1. Đăng ký + Sandbox
- Tài liệu: **https://docs.zalopay.vn/en/v1/start/** (tiếng Anh) ·
  **https://developers.zalopay.vn/v1/start/** (tiếng Việt).
- **Sandbox**: cung cấp **số điện thoại + email** cho BD ZaloPay để tạo tài khoản sandbox,
  sau đó đăng nhập **https://sbmc.zalopay.vn/** → mục quản lý App tích hợp để lấy
  `app_id`, `key1`, `key2` và khai **Callback URL** + **Redirect URL**.
- Hỗ trợ: Hotline `1900 54 54 36` · `hotro@zalopay.vn`.

### 3.2. Khoá & sơ đồ chữ ký
- `app_id`: định danh ứng dụng (số nguyên dương).
- `key1`: ký dữ liệu khi **tạo đơn** (MAC HMAC).
- `key2`: xác thực dữ liệu **callback** từ ZaloPay Server.
- Lưu ý: ZaloPay dùng trường **`mac`** với `key1`/`key2`, **khác** trường `signature` của
  MoMo → adapter phải xử lý riêng.

### 3.3. Endpoint
| Mục đích | Sandbox | Production |
|---|---|---|
| Tạo đơn | `https://sb-openapi.zalopay.vn/v2/create` | `https://openapi.zalopay.vn/v2/create` |
| Truy vấn | `.../v2/query` | `.../v2/query` |
| Hoàn tiền | `.../v2/refund` | `.../v2/refund` |

### 3.4. ⚠️ Code phải viết
1. **`lib/payment/adapters/zalopay.ts`** hiện thực interface `PaymentGateway`
   (`lib/payment/gateway.ts`):
   - `createPayment()` → gọi `/v2/create`, ký bằng `key1`, trả `payUrl` + `externalRef`.
   - `verifyWebhook()` → xác thực **MAC bằng `key2`**, map sang sự kiện chuẩn.
2. **Thêm env** `ZALOPAY_APP_ID`, `ZALOPAY_KEY1`, `ZALOPAY_KEY2`, `ZALOPAY_ENDPOINT` vào
   `lib/config/env.ts` + `.env.example`.
3. **Nối vào bộ chọn** `lib/payment/select.ts`: thêm nhánh
   `if (method === 'zalopay' && !env.PAYMENTS_STUB) return getZaloPayAdapter();`.
4. **Refund** ZaloPay trong `lib/payment/refund.ts` (gọi `/v2/refund`).

### 3.5. Lên Production
1. Tích hợp xong → gửi app cho **QC của ZaloPay** kiểm tra.
2. Đăng ký tài khoản thật tại **https://mc.zalopay.vn/user-register**.
3. ZaloPay duyệt → cấp `app_id`/`key1`/`key2` **production**.
4. ZaloPay **re-check vài giao dịch** trên production → **ký biên bản test** → **go live**.

---

## 4. Thẻ (ATM/Visa/Master) + QR — qua VNPAY ✅ (ĐÃ CHỌN)

> **Quyết định**: cổng thẻ = **VNPAY**. Lý do: phổ biến nhất VN, **sandbox tự đăng ký ngay**,
> một tích hợp phủ **thẻ ATM/nội địa + Visa/Master + QR + ví**, có code mẫu NodeJS chính thức.
> Các phương án khác (OnePay, 2C2P/Adyen) đã cân nhắc, **không chọn** — xem §4.5.

`card` hiện là placeholder dùng stub → phải **viết adapter VNPAY**.

### 4.1. Đăng ký + lấy thông tin sandbox
1. **Đăng ký sandbox**: **https://sandbox.vnpayment.vn/devreg/** → nhận email chứa
   **`vnp_TmnCode`** (mã website) + **`vnp_HashSecret`** (chuỗi bí mật checksum).
2. **Quản trị merchant sandbox**: **https://sandbox.vnpayment.vn/merchantv2/** → khai
   **Return URL** (redirect trình duyệt) + **IPN URL** (server-to-server).
3. **Thẻ test**: NH `NCB`, số `9704198526191432198`, tên `NGUYEN VAN A`, HSD `07/15`,
   OTP `123456`.
4. Tài liệu + code mẫu (PHP/C#/Python/Java/NodeJS): **https://sandbox.vnpayment.vn/apis/**.

### 4.2. Endpoint + chữ ký
| Mục đích | Sandbox | Production |
|---|---|---|
| Thanh toán (redirect) | `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html` | `https://pay.vnpay.vn/vpcpay.html` |
| Truy vấn / Hoàn tiền | `https://sandbox.vnpayment.vn/merchant_webapi/api/transaction` | `https://merchant.vnpay.vn/merchant_webapi/api/transaction` |

- **Chữ ký = HMAC-SHA512** (`vnp_SecureHash`) trên querystring đã **sort theo alphabet** +
  `vnp_HashSecret`. ⚠️ **Khác MoMo (SHA256)** — adapter phải dùng SHA512.
- **Truy vấn**: `vnp_Command=querydr` · **Hoàn tiền**: `vnp_Command=refund`.
- **Mã kết quả**: `vnp_ResponseCode=00` + `vnp_TransactionStatus=00` → thành công.

### 4.3. ⚠️ Code phải viết
1. **`lib/payment/adapters/vnpay.ts`** hiện thực interface `PaymentGateway`
   (`lib/payment/gateway.ts`):
   - `createPayment()` → dựng URL `vpcpay.html` với các tham số `vnp_*`
     (`vnp_TmnCode`, `vnp_Amount` = VND×100, `vnp_TxnRef` = bookingRef, `vnp_OrderInfo`,
     `vnp_ReturnUrl`, `vnp_IpAddr`, `vnp_CreateDate`…) + `vnp_SecureHash` (SHA512). Trả
     `payUrl` (chính URL này) + `externalRef`.
   - `verifyWebhook()` → xác thực `vnp_SecureHash` (SHA512), map sang sự kiện chuẩn
     `{orderRef=vnp_TxnRef, providerTxnId=vnp_TransactionNo, amount=vnp_Amount/100, currency:'VND', status}`.
2. **Thêm env** `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAY_URL`, `VNPAY_API_URL` vào
   `lib/config/env.ts` + `.env.example`.
3. **Nối vào bộ chọn** `lib/payment/select.ts`: thêm nhánh
   `if (method === 'card' && !env.PAYMENTS_STUB) return getVnpayAdapter();`.
4. **Refund** trong `lib/payment/refund.ts` → gọi `vnp_Command=refund` tới `VNPAY_API_URL`.
5. ⚠️ **Lưu ý route IPN**: VNPAY gửi IPN bằng **GET (query params)** và **chờ phản hồi JSON
   `{ "RspCode": "00", "Message": "Confirm Success" }`**. Route hiện tại
   `app/api/payments/card/webhook/route.ts` đang nhận **POST** + trả `{message:'ok'}` →
   phải bổ sung **GET handler** cho VNPAY và trả đúng định dạng `RspCode/Message`
   (nếu không VNPAY sẽ retry IPN liên tục). Đây là điểm khác biệt lớn so với MoMo/ZaloPay.

### 4.4. PCI-DSS
- Dùng **hosted checkout** của VNPAY (redirect sang `vpcpay.html`) → số thẻ (PAN) **không bao
  giờ** chạm server của ta → giữ phạm vi **SAQ-A** (nhẹ nhất). Tuyệt đối không tự nhận/lưu số thẻ.

### 4.5. Phương án đã cân nhắc — KHÔNG chọn
| Cổng | Vì sao không chọn (hiện tại) |
|------|------|
| **OnePay** (`onepay.vn`) | Không self-serve sandbox, hợp đồng trước, hướng doanh nghiệp. Giữ làm dự phòng nếu cần 3-DS mạnh cho thẻ quốc tế. |
| **2C2P / Adyen** | PSP quốc tế, KYC nặng. Cân nhắc lại **chỉ khi cần Apple Pay native** (xem §4.6). |

### 4.6. Apple Pay (lưu ý với VNPAY)
- **Không phải rail độc lập** — chạy *qua* cổng thẻ.
- ⚠️ VNPAY **chưa hỗ trợ Apple Pay native** rõ ràng. Nếu Apple Pay là yêu cầu bắt buộc → cần
  một PSP hỗ trợ (2C2P/Adyen/Stripe) cho riêng nhánh đó, hoặc tạm bỏ Apple Pay ở v1.
- Nếu/ khi có PSP hỗ trợ: đặt file xác minh domain tại
  `/.well-known/apple-developer-merchantid-domain-association` (HTTPS, tên miền production) +
  thêm nút Apple Pay qua SDK/PaymentRequest. Settlement + webhook đi theo adapter thẻ tương ứng.

---

## 5. eSMS — bật SMS thật để GIAO VÉ

Thanh toán xong mà không gửi vé thì coi như chưa xong. Vé qua SMS (+ email) do eSMS.vn gửi.

1. Đăng ký Brandname tại **eSMS.vn** (cần giấy phép kinh doanh + duyệt mẫu OTP/template của
   nhà mạng — **~5–10 ngày làm việc**, làm sớm).
2. Đặt env:
   ```bash
   NOTIFY_STUB=false
   ESMS_API_KEY="..."
   ESMS_SECRET_KEY="..."   # KHÔNG commit
   ESMS_BRANDNAME="..."
   ESMS_SANDBOX="true"     # giữ true tới khi go-live
   ```
3. Khi `NOTIFY_STUB=false` mà thiếu `ESMS_*` → app **fail-fast lúc khởi động** (cố ý).
4. Email: nhà cung cấp email thật chưa chọn — nếu cần email vé phải tích hợp thêm.

---

## 6. Checklist cutover + thứ tự + cổng bắt buộc

### 6.1. Thứ tự khuyến nghị
1. **MoMo**: khoá production + **code refund** → bật `RAIL_MOMO_ENABLED`.
2. **eSMS**: `NOTIFY_STUB=false` + khoá thật → vé giao được.
3. **Thẻ qua VNPAY** (đã chọn): viết adapter `vnpay.ts` + GET-IPN handler → đăng ký merchant
   VNPAY → bật `RAIL_CARD_ENABLED`.
4. **ZaloPay**: viết adapter — *hoặc bỏ* nếu VNPAY (ví + QR) đã đủ.
5. *(Apple Pay: chỉ khi có PSP hỗ trợ — VNPAY chưa, xem §4.6.)*
6. **Kênh chi trả nhà xe**: thay stub `lib/ledger/settlePayout.ts` bằng API ngân hàng/aggregator
   (hoặc quy trình chi tay có tài liệu) **trước khi** nhà xe rút tiền thật.

### 6.2. Cổng BẮT BUỘC (đúng thứ tự)
- ✅ **`issues/101`** — sign-off bảo mật/gian lận chạy trên bản full-stub, **0 lỗi P1**,
  toàn bộ test xanh → **chỉ khi đó** mới cắm khoá thật.
- ✅ **`issues/094`** — ma trận webhook **từng rail**: success / fail / pending / **thiếu tiền
  → từ chối** / **thừa tiền → hoàn chênh lệch** / **replay → idempotent no-op** / **sai thứ
  tự → từ chối lùi trạng thái**; refund-out + chargeback round-trip; chống double-submit;
  recon sweeper dọn đơn treo. **Sandbox trước, production sau.**

### 6.3. Checklist nhanh per rail
- [ ] Tài khoản merchant + hợp đồng + tài khoản ngân hàng nhận tiền
- [ ] Adapter thật (MoMo có sẵn; ZaloPay + thẻ-VNPAY phải viết; VNPAY cần GET-IPN handler)
- [ ] Refund thật (`lib/payment/refund.ts`)
- [ ] Env khoá production trong secret store (không commit)
- [ ] Khai IPN + redirect URL (tên miền production)
- [ ] Ma trận webhook xanh trên sandbox → production
- [ ] Bật cờ rail (`lib/flags/keys.ts`) + `PAYMENTS_STUB=false`

---

## 7. Test webhook sandbox ở máy local (tunnel)

URL webhook tự suy ra từ host. Ở local server chạy `:3001`, nhà cung cấp không gọi vào
`localhost` được → mở tunnel công khai:

```bash
# ví dụ cloudflared
cloudflared tunnel --url http://localhost:3001
# hoặc ngrok
ngrok http 3001
```
- Lấy URL HTTPS công khai → khai vào portal nhà cung cấp:
  IPN `https://<tunnel>/api/payments/<rail>/webhook`, redirect `https://<tunnel>/booking/result/<token>`.
- Cách nhanh để kiểm tra plumbing **không cần** nhà cung cấp thật: gửi IPN có chữ ký hợp lệ
  trực tiếp vào route webhook (xem script smoke đã dùng — tham khảo `e2e/stub-payment.spec.ts`
  và `e2e/momo-booking.spec.ts`).

---

## 8. Phụ lục

### 8.1. Bản đồ file code
| Việc | File |
|------|------|
| Bộ chọn cổng | `lib/payment/select.ts` |
| Interface adapter | `lib/payment/gateway.ts` |
| Adapter MoMo (thật) | `lib/payment/adapters/momo.ts` |
| Adapter stub (zalopay/card/momo-stub) | `lib/payment/adapters/stub.ts` |
| Lõi xử lý webhook | `lib/payment/processWebhook.ts` |
| Chuyển trạng thái paid | `lib/payment/applyPaidTransition.ts` |
| Refund (PHẢI CODE) | `lib/payment/refund.ts` |
| Route webhook | `app/api/payments/{momo,zalopay,card}/webhook/route.ts` |
| Khởi tạo thanh toán | `app/api/bookings/initiate/route.ts`, `lib/booking/initiateOnlineBooking.ts` |
| Cấu hình env | `lib/config/env.ts`, `.env.example` |
| Cờ bật rail | `lib/flags/keys.ts` |
| Chi trả nhà xe (stub) | `lib/ledger/settlePayout.ts` |
| eSMS | `lib/notification/esms.ts` |

### 8.2. Liên hệ hỗ trợ
- **MoMo**: `merchant.care@momo.vn` · `1900 636 652`
- **ZaloPay**: `hotro@zalopay.vn` · `1900 54 54 36`
- **VNPAY**: qua portal `doitac.vnpay.vn` / tài liệu `sandbox.vnpayment.vn/apis`

### 8.3. Link tài liệu chính thức
- MoMo Dev: https://developers.momo.vn/v3 · Onboarding:
  https://developers.momo.vn/v3/docs/payment/onboarding/merchant-profile/ · Test:
  https://developers.momo.vn/v3/docs/payment/onboarding/test-instructions/ · Merchant:
  https://business.momo.vn
- ZaloPay Dev: https://docs.zalopay.vn/en/v1/start/ · Sandbox MC: https://sbmc.zalopay.vn ·
  Đăng ký thật: https://mc.zalopay.vn/user-register
- VNPAY: Đăng ký sandbox https://sandbox.vnpayment.vn/devreg/ · Tài liệu
  https://sandbox.vnpayment.vn/apis/ · Đối tác https://doitac.vnpay.vn/

> Endpoint/giá trị test có thể thay đổi theo phiên bản — luôn đối chiếu tài liệu chính thức
> mới nhất của nhà cung cấp trước khi go-live.
