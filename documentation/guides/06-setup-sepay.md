# SePay — Bank Transfer Payment Gateway Setup Guide

Configure SePay for VietQR bank transfer payments. Customers scan QR → transfer to Agribank collection account → SePay webhook notifies app → booking confirmed. Code integration: `lib/payment/adapters/bankTransfer.ts`, `app/api/payments/bank_transfer/webhook/route.ts`. Env vars: `SEPAY_API_KEY`, `VIETQR_ACCOUNT_NUMBER`, `VIETQR_BANK_BIN`.

> **Known Issue (2026-07-08 audit):** The bank transfer page validates `redirectUrl` must be a relative path (`/...`). The stub payment adapter generates absolute URLs (`http://host/booking/result/...`), causing an HTTP 404 status on the bank transfer page. Fix needed in `app/(customer)/booking/bank-transfer/page.tsx:57` before SePay go-live.

---

## Prerequisites

- Vietnamese business license (Giấy phép kinh doanh) — required for SePay merchant account
- Agribank business bank account (or another Vietnamese bank supported by SePay)
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
| Ngân hàng (Bank) | **Agribank** (Ngân hàng Nông nghiệp và PTNT Việt Nam) |
| Số tài khoản | Your Agribank business account number |
| Tên chủ tài khoản | Must match business registration exactly |

4. SePay verifies account ownership via micro-deposit (1,000-5,000 VND)
5. Confirm the micro-deposit amount in SePay dashboard

**Bank BIN reference:**

| Bank | BIN Code | Notes |
|------|----------|-------|
| Agribank | `970405` | Default for Bus-Booking |
| Vietcombank | `970436` | Alternative |
| BIDV | `970418` | Alternative |
| VietinBank | `970415` | Alternative |

---

## Step 4: Get API Key

1. Go to **"Cài đặt"** (Settings) → **"API"**
2. Click **"Tạo API Key"** (Generate API Key)
3. Copy the API key — displayed once only
4. Keep it safe — never commit to version control

---

## Step 5: Configure Webhook

1. In SePay dashboard → **"Cài đặt"** → **"Webhook"**
2. Click **"Thêm webhook"** (Add Webhook)
3. Configure:

| Field | Value |
|-------|-------|
| URL | `https://YOURDOMAIN.COM/api/payments/bank_transfer/webhook` |
| Sự kiện (Events) | **"Giao dịch đến"** (Incoming transaction) |
| Trạng thái (Status) | Active |

4. SePay sends a test webhook — verify in your server logs
5. Note: webhook requests include a signature header for HMAC verification

### Webhook Payload Format

SePay sends POST with JSON body on each incoming bank transfer:

```json
{
  "id": 123456,
  "gateway": "Agribank",
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
SEPAY_API_KEY="your-api-key-from-step-4"
VIETQR_ACCOUNT_NUMBER="your-agribank-account-number"
VIETQR_BANK_BIN="970405"
```

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

1. Make a small real bank transfer (e.g. 10,000 VND) to your Agribank collection account
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
   - Bank BIN (`970405` = Agribank)
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
| 401 on API calls | Wrong API key | Re-generate key in SePay dashboard |
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
- Webhook endpoint must verify HMAC signature from SePay header
- Collection account should be a dedicated business account, not personal
- Enable SePay IP whitelist if available (restrict webhook sources)
