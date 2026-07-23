# SePay — Bank Transfer Payment Gateway Setup Guide

Configure SePay for VietQR bank transfer payments. Customers scan QR → transfer to the Sacombank collection account → SePay webhook notifies app → booking confirmed. Code integration: `lib/payment/adapters/bankTransfer.ts`, `app/api/payments/bank_transfer/webhook/route.ts`. Env vars: `SEPAY_API_KEY`, `VIETQR_ACCOUNT_NUMBER`, `VIETQR_BANK_BIN`.

---

## Prerequisites

- Vietnamese business license (Giấy phép kinh doanh) — required for SePay merchant account
- Sacombank business bank account (or another Vietnamese bank supported by SePay)
- Domain with HTTPS for webhook URL

---

## Step 1: Create SePay Account

1. Go to **https://my.sepay.vn/register**
2. Fill registration form:

| Field | Required | Detail |
|-------|----------|--------|
| Email | Yes | Business email |
| Mật khẩu (Password) | Yes | Min 8 characters |
| Số điện thoại | Yes | Vietnamese phone number |
| Loại tài khoản | Yes | Select **"Doanh nghiệp"** (Business) |

3. Click **"Đăng ký"** (Register)
4. Verify email + phone OTP

---

## Step 2: Complete KYC Verification

1. Login to **https://my.sepay.vn/**
2. Go to **"Xác minh tài khoản"** (Account Verification)
3. Upload required documents:

| Document | Format | Notes |
|----------|--------|-------|
| Giấy phép kinh doanh | PDF/JPG | Business registration certificate |
| CMND/CCCD người đại diện | JPG | Front + back of representative's ID card |
| Ủy quyền (nếu có) | PDF | Power of attorney (if applicant ≠ owner) |

4. KYC review takes **1-3 business days**
5. SePay emails approval notification

---

## Step 3: Link Bank Account

1. Go to **"Tài khoản ngân hàng"** (Bank Accounts) in SePay dashboard
2. Click **"Thêm tài khoản"** (Add Account)
3. Configure:

| Field | Value |
|-------|-------|
| Ngân hàng (Bank) | **Sacombank** (Ngân hàng TMCP Sài Gòn Thương Tín) |
| Số tài khoản | Your Sacombank business account number |
| Tên chủ tài khoản | Must match business registration exactly |

4. SePay verifies account ownership via micro-deposit (1,000-5,000 VND)
5. Confirm the micro-deposit amount in SePay dashboard

**Bank BIN reference:**

| Bank | BIN Code | Notes |
|------|----------|-------|
| Sacombank | `970403` | **Default for Bus-Booking** (`VIETQR_BANK_BIN`) |
| Agribank | `970405` | Alternative |
| Vietcombank | `970436` | Alternative |
| BIDV | `970418` | Alternative |
| VietinBank | `970415` | Alternative |

---

## Step 4: Choose the webhook API Key

`SEPAY_API_KEY` is **not** the SePay API-Access token (that one is for *pulling* transactions, which this app never does). SePay's webhook form lets you type an **arbitrary** API Key of your choosing — that is the value the app checks.

1. Generate a random secret locally, 32+ chars:
   ```bash
   openssl rand -hex 32
   ```
2. Store it as `SEPAY_API_KEY` in Vercel (Step 6)
3. Paste the identical value into the webhook form (Step 5)
4. Never commit it to version control

This key is the **entire** auth boundary for `/api/payments/bank_transfer/webhook` — the route has no HMAC body signing and no IP allowlist.

---

## Step 5: Configure Webhook

1. In SePay dashboard → **"Tích hợp Webhook"** (or https://my.sepay.vn/webhooks)
2. Click **"+ Thêm webhook"** (Add Webhook)
3. Configure across the 4-step form:

| Step | Field | Value |
|------|-------|-------|
| 1 | Tên | e.g. `bus-booking-prod` |
| 1 | Sự kiện (Events) | **"Giao dịch đến"** (incoming only) |
| 1 | URL | `https://YOURDOMAIN.COM/api/payments/bank_transfer/webhook` |
| 2 | Tài khoản ngân hàng | The linked Sacombank account |
| 2 | VA / Tiền tố mã thanh toán | **Leave empty** — reconciliation reads the `content` memo, not `code` |
| 3 | Kiểu xác thực | **API Key**, value = `SEPAY_API_KEY` from Step 4 |
| 4 | Kênh cảnh báo | Optional |

4. Use **"Gửi thử"** (test send) — expect 200 in SePay's delivery log

### Authentication — exact header

With auth type **API Key**, SePay sends:

```
Authorization: Apikey <SEPAY_API_KEY>
```

Note the `Apikey` scheme, **not** `Bearer`. SePay does not HMAC-sign the webhook body for this auth type. The route (`route.ts`) accepts either `Apikey` or `Bearer`, compared with `crypto.timingSafeEqual`.

### Response contract — SePay expects `{"success": true}`

SePay counts a delivery as successful **only** on:

- HTTP **200 or 201**
- JSON body of exactly `{"success": true}`
- Response within **30 seconds**

Anything else triggers Fibonacci-spaced retries, **max 7 attempts over 5 hours**. The shared `processPaymentWebhook` returns `{"message":"ok"}` (MoMo/VNPay have different ack formats), so the bank_transfer route re-emits 2xx in SePay's shape and passes non-2xx through untouched — those *should* be retried.

### Webhook Payload Format

SePay sends POST with JSON body on each incoming bank transfer:

```json
{
  "id": 123456,
  "gateway": "Sacombank",
  "transactionDate": "2026-06-21 14:30:00",
  "accountNumber": "1234567890",
  "transferType": "in",
  "transferAmount": 250000,
  "accumulated": 5000000,
  "code": null,
  "content": "BB-2026-abc1-def2 Thanh toan ve xe",
  "referenceCode": "",
  "description": "BB-2026-abc1-def2 Thanh toan ve xe"
}
```

The `content` field contains the booking reference (e.g. `BB-2026-abc1-def2`) used for memo-based reconciliation. The app parses the bookingRef from this field to match the payment to a pending booking.

---

## Step 6: Configure Environment Variables

### In Vercel (Production)

```env
PAYMENTS_STUB="false"
SEPAY_API_KEY="your-secret-from-step-4"
VIETQR_BANK_BIN="970403"
VIETQR_ACCOUNT_NUMBER="your-sacombank-account-number"
VIETQR_ACCOUNT_NAME="ACCOUNT HOLDER NAME"
VIETQR_BANK_NAME="Sacombank"
VIETQR_TEMPLATE="compact2"
```

`lib/config/env.ts` hard-gates this at boot: `PAYMENTS_STUB=false` fails unless `SEPAY_API_KEY` is set **and** `VIETQR_ACCOUNT_NUMBER` differs from the checked-in placeholder.

`VIETQR_ACCOUNT_NAME` is display-only (shown on the payment page for manual transfers) — it is not part of the QR payload and does not affect matching.

### For Local Development

Keep payments stubbed locally:
```env
# .env.local
PAYMENTS_STUB="true"
# No SePay vars needed — stub gateway handles all payments
```

---

## Step 7: Test Payment Flow

### Sandbox Testing (Before Go-Live)

SePay provides a sandbox environment:

1. In SePay dashboard → **"Sandbox"**
2. Enable sandbox mode for your API key
3. Use sandbox webhook URL (same endpoint, SePay routes test transactions)
4. Simulate incoming transfers via SePay sandbox UI

### Production Testing

1. Make a small real bank transfer (e.g. 10,000 VND) to your Sacombank collection account
2. Include a test booking reference in the transfer memo (e.g. `BB-TEST-0001-0001`)
3. Verify:
   - SePay dashboard shows the incoming transaction
   - Webhook fires to your endpoint (check Vercel function logs)
   - App logs show payment received and matched

---

## VietQR Flow

How the customer experience works:

1. Customer selects "Bank Transfer" at checkout
2. App generates VietQR code containing:
   - Bank BIN (`970403` = Sacombank)
   - Account number (your collection account)
   - Amount (booking total in VND)
   - Memo: booking reference (`BB-2026-xxxx-yyyy`)
3. Customer scans QR with any Vietnamese banking app
4. Banking app pre-fills transfer details — customer confirms
5. Bank processes transfer → SePay detects incoming transaction
6. SePay fires webhook → app matches bookingRef → booking confirmed
7. Typical latency: 10-60 seconds end-to-end

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Webhook not firing | URL wrong or HTTPS not configured | Verify webhook URL in SePay dashboard; must be HTTPS |
| Webhook 401s on every delivery | `SEPAY_API_KEY` mismatch, or auth type not set to **API Key** in the webhook form | Confirm the webhook-form key matches Vercel's `SEPAY_API_KEY` byte-for-byte (no trailing whitespace) |
| SePay log shows delivery failed but booking IS paid | Endpoint returned 2xx without the `{"success": true}` body | Expected only if the ack wrapper regressed — retries are idempotent (`PaymentEvent` unique on `[adapter, providerTxnId]`), so no double-credit |
| Payment not matched | Customer modified transfer memo | Manual reconciliation needed; check `content` field in webhook payload |
| KYC rejected | Document mismatch | Ensure business name matches bank account name exactly |
| QR scan fails | Bank app doesn't support VietQR | All major VN banking apps support VietQR (MB, Vietcombank, BIDV, Techcombank, etc.) |

---

## Pricing

| Item | Cost | Notes |
|------|------|-------|
| SePay account | Free | No monthly fee |
| Per transaction | ~1,650 VND (~$0.07) | Per incoming webhook notification |
| Monthly minimum | None | Pay-per-transaction only |
| Bank transfer fee | 0 VND | Free for domestic VND transfers (standard) |

---

## Security Notes

- Store `SEPAY_API_KEY` only in Vercel env vars — never in code or git
- Webhook auth is a shared API key (`Authorization: Apikey <key>`), not an HMAC body signature — the key alone is the auth boundary, so treat it like a password and rotate it if leaked
- Collection account should be a dedicated business account, not personal
- Enable SePay IP whitelist if available (restrict webhook sources)
