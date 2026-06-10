# MoMo — Hướng dẫn lên Production (runbook thao tác tay)

> Tài liệu **thao tác từng bước** cho MoMo: vào web nào, lấy khoá gì, điền vào đâu, test ra
> sao, lên thật thế nào. Soạn 2026-06.
>
> Tài liệu tổng (cả 3 rail): `docs/payment-go-live-guide.md`.

---

## 0. Trạng thái hiện tại (đọc trước)

| Hạng mục | Trạng thái |
|---|---|
| **Adapter MoMo** (tạo đơn + verify IPN HMAC-SHA256) | ✅ **ĐÃ CÓ** — `lib/payment/adapters/momo.ts` |
| Route webhook | ✅ `app/api/payments/momo/webhook/route.ts` |
| Verify chữ ký, idempotency, chuyển trạng thái, ghi ledger | ✅ đã có + đã test |
| **Refund (hoàn tiền) thật** | ❌ **PHẢI CODE** — `lib/payment/refund.ts` đang ném lỗi |
| Khoá production + tài khoản merchant | ❌ thao tác tay (phần này) |

→ Việc còn lại = **(1)** lấy khoá MoMo + cấu hình, **(2)** code refund, **(3)** đổi cờ sang
production. Code adapter KHÔNG phải đụng nữa.

### Luồng tóm tắt
Khách chọn MoMo → `initiate` gọi `createPayment` (adapter ký HMAC-SHA256, gửi tới
`MOMO_ENDPOINT`) → MoMo trả `payUrl` → khách thanh toán → **MoMo gọi IPN về**
`https://<tên-miền>/api/payments/momo/webhook` → adapter verify chữ ký → booking `paid`.
URL IPN + redirect **tự suy ra từ host** của request (không khai ở portal MoMo) → khi test
local phải mở **tunnel** (§A.5).

---

## PHẦN A — Test trên SANDBOX (làm trước, không cần khoá thật)

> Repo đã nhúng sẵn **khoá sandbox public của MoMo** → có thể test ngay mà chưa cần đăng ký.
> Đăng ký merchant (A.1) chỉ cần khi muốn khoá riêng / lên production.

### A.1. (Tùy chọn lúc test) Đăng ký merchant
1. Vào **https://business.momo.vn** → bấm **Đăng ký (Sign up)**.
2. Khai 3 nhóm: **Account information** · **Legal & Business information** · **Other
   documents** (giấy phép kinh doanh, tài khoản ngân hàng nhận tiền…).
3. Hỗ trợ: `merchant.care@momo.vn` · Hotline `1900 636 652`.
4. Tài liệu kỹ thuật: **https://developers.momo.vn/v3** (mục *Payment Gateway / AIO*).

### A.2. Lấy khoá TEST
- Vào khu **M4B (MoMo for Business)** sau khi đăng ký → mục tích hợp/Developer → lấy
  **`partnerCode`**, **`accessKey`**, **`secretKey`** môi trường test.
- *Hoặc* dùng luôn khoá sandbox public có sẵn trong repo (xem A.3).

### A.3. Điền khoá vào code — `điền cái nào vào đâu`
Mở file **`.env.local`** (tạo nếu chưa có, copy từ `.env.example`). Điền:

```bash
# ----- MoMo SANDBOX -----
MOMO_PARTNER_CODE="MOMOBKUN20180529"                 # ← partnerCode (test)
MOMO_ACCESS_KEY="klm05TvNBzhg7h7j"                   # ← accessKey (test)
MOMO_SECRET_KEY="at67qH6mk8w5Y1nAyMoYKMWACiEi2bsa"   # ← secretKey (test) — KHÔNG commit khoá thật
MOMO_ENDPOINT="https://test-payment.momo.vn/v2/gateway/api/create"   # endpoint SANDBOX

# Bật cổng thật cho MoMo (zalopay/card vẫn tự về stub vì chưa có adapter)
PAYMENTS_STUB=false
```

**Bảng ánh xạ khoá → biến → nơi đọc:**

| Khoá MoMo | Biến môi trường | Nơi code đọc |
|---|---|---|
| Partner Code | `MOMO_PARTNER_CODE` | `lib/config/env.ts` → `lib/payment/adapters/momo.ts` |
| Access Key | `MOMO_ACCESS_KEY` | nt |
| Secret Key | `MOMO_SECRET_KEY` | nt (dùng ký + verify HMAC) |
| Endpoint tạo đơn | `MOMO_ENDPOINT` | nt |

> ⚠️ **Phải khởi động lại server** sau khi đổi env — adapter MoMo là **singleton cache**
> (`getMomoAdapter()` đọc env 1 lần). Đổi `.env.local` mà không restart → vẫn dùng khoá cũ.

### A.4. Tạo ví / thẻ test để thanh toán
Trang: **https://developers.momo.vn/v3/docs/payment/onboarding/test-instructions/**
- **App test MoMo**: gỡ app MoMo thật trên điện thoại → cài **app test** MoMo cấp.
- **Ví test**: mật khẩu `000000`, OTP `0000` / `000000`. Liên kết NH: số thẻ `9704 05XX XXXX
  XXXX`, tên + ngày phát hành tuỳ ý.
- **Thẻ ATM test**: `9704 0000 0000 0018` (thành công) · `...0026` (khoá thẻ) · `...0034`
  (không đủ tiền) · `...0042` (quá hạn mức) — HSD `03/07`.
- **Thẻ quốc tế test**: `5200 0000 0000 1096` (OK, cần OTP) · `5200 0000 0000 1104` (fail) ·
  `4111 1111 1111 1111` (OK, không OTP) — HSD `05/26`, CVC `111`.

### A.5. Mở tunnel để MoMo gọi IPN về máy local
MoMo không gọi được `localhost`. Mở tunnel công khai trỏ vào app (`:3001`):
```bash
cloudflared tunnel --url http://localhost:3001
# hoặc: ngrok http 3001
```
- Lấy URL HTTPS (vd `https://abc-123.trycloudflare.com`).
- **Truy cập trang web QUA URL tunnel** (không dùng localhost) khi đặt vé test → `host`
  header = tunnel → `ipnUrl`/`redirectUrl` tự thành URL tunnel → MoMo gọi về được.

### A.6. Chạy thử 1 đơn trên sandbox
1. Mở `https://<tunnel>` → tìm chuyến → giữ ghế → trang review → chọn **MoMo** → đặt.
2. App test MoMo thanh toán (ví/thẻ test ở A.4).
3. Kỳ vọng: MoMo gọi IPN → `/api/payments/momo/webhook` trả `200 {message:'ok'}` → trang
   kết quả hiện **"Thanh toán thành công"**, booking `paid`.

### A.7. Ma trận webhook (bắt buộc — `issues/094`)
Kiểm đủ: success (`resultCode=0`) · failed (`1001/1002/1003/1004/1005/4100`) · pending
(`9000/1000`) · **thiếu tiền → từ chối** · **thừa tiền → hoàn chênh lệch** · **replay →
idempotent no-op** · **sai thứ tự → từ chối lùi trạng thái** · sai chữ ký → `400`.

---

## PHẦN B — Code CÒN THIẾU: Refund (hoàn tiền)

Đây là phần code duy nhất còn lại cho MoMo. Hiện `lib/payment/refund.ts:55-58` ném
`PspRefundNotImplementedError` khi `PAYMENTS_STUB=false`.

**Phải hiện thực:**
1. Gọi API refund MoMo:
   - Sandbox: `https://test-payment.momo.vn/v2/gateway/api/refund`
   - Production: `https://payment.momo.vn/v2/gateway/api/refund`
2. **Ký HMAC-SHA256** đúng sơ đồ canonical-string của adapter (tái dùng `buildCanonicalString`
   + `hmacSha256` trong `lib/payment/adapters/momo.ts`). Body refund gồm `partnerCode`,
   `accessKey`, `requestId`, `amount`, `orderId`, `transId` (= `providerTxnId` đơn gốc),
   `lang`, `description`, `signature`.
3. Trả `providerTxnId` của refund về lớp ledger.
4. Idempotency: `refundTxnId` suy từ `idempotencyKey` (ledger đã chống replay).

> ⚠️ Nếu **chưa code refund** mà bật `PAYMENTS_STUB=false` → mọi refund / hoàn-thừa-tiền /
> chargeback sẽ **crash có chủ đích** (không âm thầm mất tiền). Vì vậy refund nằm trong điều
> kiện go-live.

---

## PHẦN C — Lên PRODUCTION

### C.1. Hoàn tất điều kiện phía MoMo (thao tác tay)
1. Hoàn tất **Technical Integration Process** với MoMo.
2. Xác minh **tài khoản M4B** của công ty (giấy phép KD + tài khoản NH nhận tiền).
3. MoMo duyệt → cấp **khoá production**: `partnerCode`, `accessKey`, `secretKey` (mới, khác
   sandbox).

### C.2. Điền khoá PRODUCTION vào secret store
> ❗ KHÔNG để khoá thật trong `.env` commit lên git. Dùng secret store của hạ tầng (biến môi
> trường deploy / vault).

Đặt (production):
```bash
MOMO_PARTNER_CODE="<partnerCode PRODUCTION>"
MOMO_ACCESS_KEY="<accessKey PRODUCTION>"
MOMO_SECRET_KEY="<secretKey PRODUCTION>"        # bí mật tuyệt đối
MOMO_ENDPOINT="https://payment.momo.vn/v2/gateway/api/create"   # endpoint PRODUCTION
PAYMENTS_STUB=false
```

### C.3. (Tùy chọn) Bật rail MoMo ở checkout
- Có cờ `RAIL_MOMO_ENABLED` (`rail.momo.enabled`) — quản trị tại **`/admin/console/system`**
  hoặc env override `FEATURE_RAIL_MOMO_ENABLED=true`.
- ⚠️ Lưu ý: hiện cờ này **chưa được gate ở luồng checkout** (chỉ định nghĩa + admin set
  được). Công tắc thực tế bật MoMo thật = **`PAYMENTS_STUB=false` + có khoá**. Nếu cần
  bật/tắt từng rail ở checkout thì phải nối cờ vào `initiate` (việc code riêng).

### C.4. Khai tên miền production
- URL IPN/redirect tự theo host → chỉ cần app chạy đúng **tên miền production** (HTTPS).
- Không cần khai URL cố định ở portal MoMo (gửi theo từng request), nhưng nếu MoMo yêu cầu
  whitelist domain/redirect thì khai tên miền production.

### C.5. Khởi động lại + kiểm tra thật
1. Deploy với env mới → **restart** (singleton cache).
2. Đặt **1 giao dịch thật giá trị nhỏ** → xác nhận `paid`.
3. **Refund** chính giao dịch đó → xác nhận tiền hoàn + ledger `refund_out` đúng.
4. Kiểm log: KHÔNG có `MOMO_SECRET_KEY` / PII lọt ra.

### C.6. Cổng bắt buộc trước khi bật tiền thật
- ✅ `issues/101` — sign-off bảo mật/gian lận trên bản full-stub, **0 lỗi P1**.
- ✅ `issues/094` — ma trận webhook (A.7) xanh **trên sandbox trước, production sau**.

---

## Checklist go-live MoMo
- [ ] (Sandbox) Test 1 đơn end-to-end qua tunnel → `paid`
- [ ] (Sandbox) Ma trận webhook A.7 xanh
- [ ] **Code refund** `lib/payment/refund.ts` (Phần B) + test
- [ ] Đăng ký merchant + xác minh M4B xong
- [ ] Khoá production trong secret store (không commit)
- [ ] `MOMO_ENDPOINT` = `https://payment.momo.vn/...`
- [ ] `PAYMENTS_STUB=false` + restart
- [ ] Giao dịch thật nhỏ → paid → refund OK
- [ ] `issues/101` pass → `issues/094` ma trận pass

---

## Phụ lục

### Mã kết quả MoMo (resultCode) → trạng thái nội bộ
(`lib/payment/adapters/momo.ts`)
- `0` → **paid**
- `1001,1002,1003,1004,1005,4100` → **failed**
- `9000,1000` → **pending**
- khác → **unknown** (bỏ qua, không đổi trạng thái)

### Lỗi thường gặp
| Triệu chứng | Nguyên nhân hay gặp |
|---|---|
| `initiate` trả lỗi `momo_error:<code>` | Sai partnerCode/accessKey/secretKey, hoặc amount/orderId sai định dạng |
| IPN không về | Chưa mở tunnel / truy cập bằng localhost thay vì URL tunnel |
| Webhook trả `400` | Chữ ký sai (secretKey lệch giữa lúc tạo đơn và verify), hoặc thân JSON hỏng |
| Đổi env nhưng vẫn khoá cũ | Chưa restart server (singleton cache) |

### Liên hệ + tài liệu
- Merchant: **https://business.momo.vn** · `merchant.care@momo.vn` · `1900 636 652`
- Dev: **https://developers.momo.vn/v3**
- Onboarding: https://developers.momo.vn/v3/docs/payment/onboarding/merchant-profile/
- Test: https://developers.momo.vn/v3/docs/payment/onboarding/test-instructions/

### File code liên quan
| Việc | File |
|---|---|
| Adapter MoMo (đã có) | `lib/payment/adapters/momo.ts` |
| Refund (phải code) | `lib/payment/refund.ts` |
| Route webhook | `app/api/payments/momo/webhook/route.ts` |
| Bộ chọn cổng | `lib/payment/select.ts` |
| Cấu hình env | `lib/config/env.ts`, `.env.example` |
| Cờ rail | `lib/flags/keys.ts`, admin `/admin/console/system` |
