# eSMS.vn — Registration & Activation Guide

Operational guide for setting up eSMS.vn as the SMS notification provider (operator OTP + booking confirmations) for Bus-Booking. The codebase integration is already complete (`lib/notification/esmsClient.ts` + `lib/notification/esms.ts`). This document covers account registration, credential setup, sandbox testing, brandname registration, and go-live.

> **Phase 1 role:** Operator OTP via SMS + booking confirmation SMS to passengers.
> Customer OTP uses email (Resend) since commit `686ec85`. Customer auth is 410-gated in Phase 1 — eSMS is not used for customer OTP.

---

## Step 1: Create eSMS Account

1. Open browser, go to **https://account.esms.vn/Account/SignUp**
2. Fill in the registration form:

| Field | Required | Detail |
|-------|----------|--------|
| So dien thoai | Yes | Your Vietnamese phone number (e.g. `0901234567`) |
| Ho va ten | No | Your full name |
| Email | Yes | Your email address |
| Mat khau | Yes | Password (min 8 chars, must include 1 letter + 1 digit + 1 special character) |
| Chon khu vuc | Yes | Select your region from dropdown |
| Terms checkbox | Yes | Agree to privacy policy (https://esms.vn/policy/privacy-policy) |

3. Click **"Dang ky"** (Register) button
4. Account is created with **5,000 VND free trial credits** (~10 SMS at 520 VND each)

---

## Step 2: Login & Find API Keys

1. Go to **https://account.esms.vn/** and login with your email + password
2. In the left sidebar, click **"Quan ly API"** (API Management)
3. Your **ApiKey** and **SecretKey** are displayed on this page — copy both
4. Keep SecretKey safe — never share it or commit it to version control

---

## Step 3: Test with Sandbox (No Real SMS, No Charge)

No brandname registration needed for sandbox mode.

1. Open your project's `.env.local` file
2. Set these values (paste your keys from Step 2):
   ```env
   NOTIFY_STUB="false"
   ESMS_API_KEY="paste-your-api-key"
   ESMS_SECRET_KEY="paste-your-secret-key"
   ESMS_BRANDNAME="Baotrixemay"
   ESMS_OTP_SMSTYPE="2"
   ESMS_SANDBOX="true"
   ESMS_BASE_URL="https://rest.esms.vn"
   ```
3. Restart dev server (`pnpm dev`)
4. Open the app and trigger an OTP (enter a phone number on the login page)
5. Check terminal logs for `sms.esms.sent` with `codeResult: "100"`
6. If you see `codeResult: "100"`, your credentials work and sandbox is active
7. No real SMS is sent and no money is charged — sandbox only validates the API call

**Common errors at this step:**
- `codeResult: "101"` — wrong ApiKey or SecretKey; re-copy from dashboard
- App crashes on startup — one of the 3 required env vars (`ESMS_API_KEY`, `ESMS_SECRET_KEY`, `ESMS_BRANDNAME`) is missing; boot-time validation in `lib/config/env.ts` enforces all three when `NOTIFY_STUB="false"`

---

## Step 4: Send Real SMS WITHOUT Brandname (Quick Test)

To test with actual SMS arriving on your phone before brandname approval:

1. Change in `.env.local`:
   ```env
   ESMS_OTP_SMSTYPE="7"
   ESMS_SANDBOX="false"
   ```
2. Restart dev server
3. Trigger OTP — real SMS arrives from a random `09xxx` number
4. Costs ~450-520 VND per SMS, deducted from your trial balance
5. Check balance: login to https://account.esms.vn/ — dashboard shows remaining credits

SmsType `"7"` uses a random sender number (no brandname needed). Less professional but works immediately for development testing.

---

## Step 5: Register Brandname (Required for Production)

Without a brandname, SMS arrives from a random phone number. With a brandname, it displays your company name (e.g. `BusBookVN`). Brandname is required for SmsType `"2"` (OTP/CSKH).

### 5.1: Contact eSMS Sales

Pick any channel:
- **Phone:** 0901 888 484
- **Phone:** 020 3710 6868
- **Email:** cs@vihatgroup.com
- **HCMC office:** ViHAT Building, 140-142 Duong so 2, Van Phuc City
- **Hanoi office:** An Hung Building, 85-87 Hoang Quoc Viet

### 5.2: Tell Them What You Need

- SMS Brandname registration for OTP/CSKH (SmsType 2)
- Your desired brandname, e.g. `BusBookVN`

### 5.3: Provide Required Documents

- **Giay phep kinh doanh** (Business Registration Certificate) or **Giay chung nhan DKKD** (Enterprise Registration Certificate)
- eSMS handles all carrier paperwork with Viettel, MobiFone, and VinaPhone on your behalf

### 5.4: Wait for Carrier Approval

- Timeline: approximately **5-10 business days**
- Once approved, your brandname appears in the dashboard under **"Quan ly Brandname"**

---

## Step 6: Register SMS Templates

SmsType `"2"` (brandname CSKH/OTP) requires pre-approved message templates with each carrier.

1. While contacting sales for brandname (Step 5), also request template registration
2. Provide your OTP template text (used for **operator** password reset OTP only — customer OTP now uses email, see `10-setup-resend.md`):
   ```
   BusBookVN: Ma xac thuc cua ban la {OTP}. Het han sau {X} phut. Khong chia se ma nay.
   ```
3. Also register these templates for full notification support:
   - **Booking confirmation (cash):**
     `BusBookVN: dat cho {X} ve, chuyen {route} {time}. Tra tien mat khi len xe. Ma: {ref}.`
   - **Booking confirmation (paid):**
     `BusBookVN: Thanh toan MoMo thanh cong. {X} ve, chuyen {route} {time}. Ma: {ref}.`
   - **Staff temp password:**
     `BusBookVN: Tai khoan nhan vien da tao. SDT dang nhap: {phone}. Mat khau tam thoi: {password}.`
   - **Booking reminder (24h):**
     `BusBookVN: Nhac nho chuyen {route} khoi hanh {time} (con ~24h). {X} ve. Ma: {ref}.`
   - **Booking expired:**
     `BusBookVN: Dat cho {ref} (chuyen {route} {time}) da het han do chua thanh toan. Vui long dat lai neu can.`
4. The sales team handles template approval with carriers
5. If you send a message before its template is approved, eSMS returns error code `146` ("Sai template Brandname CSKH")

---

## Step 7: Top Up Balance

1. Login to **https://account.esms.vn/**
2. Go to **"Nap tien"** (Top up / Add funds) in sidebar or dashboard
3. Payment methods — contact sales for options (bank transfer is typical for Vietnamese businesses)
4. Pricing: **520 VND per SMS** for brandname OTP (~$0.021 USD)
5. For volume above 5,000 SMS, contact sales for discounted rates

---

## Step 8: Go Live

1. Set production environment variables:
   ```env
   NOTIFY_STUB="false"
   ESMS_API_KEY="your-production-api-key"
   ESMS_SECRET_KEY="your-production-secret-key"
   ESMS_BRANDNAME="BusBookVN"
   ESMS_OTP_SMSTYPE="2"
   ESMS_SANDBOX="false"
   ESMS_BASE_URL="https://rest.esms.vn"
   ```
2. Deploy or restart server
3. The following SMS flows route through real eSMS:
   - Operator password reset OTP (`POST /api/op/auth/forgot-password`) — SMS via eSMS
   - Booking notification SMS: confirmation, reminder (24h), expiry — SMS via eSMS
   - Staff/operator temp password SMS (`staffTempPassword`, `operatorAdminTempPassword`)
4. Customer OTP flows (`POST /api/auth/otp/send`, password reset, account management) now use **email** (Resend/stub), not SMS — see `10-setup-resend.md`
5. Monitor logs:
   - `sms.esms.sent` — successful dispatch (CodeResult 100)
   - `sms.esms.rejected` — eSMS rejected the request (check CodeResult)
   - `sms.esms.error` — network/timeout error

---

## Step 9: Optional — IP Whitelist

1. In the eSMS dashboard, look for IP whitelist / security settings
2. Add your production server's public IP address
3. If IP whitelist is enabled and your server IP is not listed, eSMS returns error code `140`
4. Skippable for testing; recommended for production security

---

## Step 10: Optional — Check Balance via API

No dashboard login needed. Use browser or curl:

```
GET https://rest.esms.vn/MainService.svc/json/GetBalance/{ApiKey}/{SecretKey}
```

Returns your remaining balance. Useful for automated monitoring and low-balance alerts.

---

## API Reference

### Endpoint Used by Bus-Booking

```
POST https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/
```

### Request Body

```json
{
  "ApiKey": "your-api-key",
  "SecretKey": "your-secret-key",
  "Brandname": "BusBookVN",
  "Phone": "84901234567",
  "Content": "BusBookVN: Ma xac thuc cua ban la 123456. Het han sau 5 phut. Khong chia se ma nay.",
  "SmsType": "2",
  "IsUnicode": "0",
  "RequestId": "c82cd356-bf49-4113-9466-65a7f635",
  "Sandbox": "1"
}
```

### Request Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| ApiKey | Yes | eSMS API key from dashboard |
| SecretKey | Yes | eSMS secret key from dashboard |
| Content | Yes | Message text (must match registered template for SmsType 2) |
| Phone | Yes | Recipient phone in `84xxxxxxxxx` format (no `+` prefix) |
| Brandname | Yes | Registered sender brand name |
| SmsType | Yes | `"2"` = CSKH/OTP brandname, `"7"` = random number |
| IsUnicode | No | `"1"` = Vietnamese diacritics, `"0"` = ASCII only |
| Sandbox | No | `"1"` = test mode (no delivery, no charge), `"0"` = production |
| RequestId | No | Idempotency key, max 50 chars, valid 24h |
| SendDate | No | Scheduled send: `yyyy-mm-dd hh:MM:ss` |
| CallbackUrl | No | Webhook URL for delivery status notifications |

### Response

**Success:**
```json
{
  "CodeResult": "100",
  "CountRegenerate": 0,
  "SMSID": "d533459ee42b2b9525ba9eabf6a8156"
}
```

**Note:** CodeResult `"100"` means eSMS accepted the request, not that the SMS was delivered. Use CallbackUrl for delivery confirmation.

### Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 100 | Request accepted | Success path |
| 99 | Invalid request | Check request format |
| 101 | Authentication failed | Check ApiKey / SecretKey |
| 103 | Insufficient balance | Top up eSMS account |
| 104 | Brandname not found / inactive | Register brandname with sales |
| 108 | Invalid phone number format | Check E.164 to eSMS format conversion |
| 124 | Duplicate RequestId | Already sent within 24h (idempotent) |
| 140 | IP not whitelisted | Add server IP to dashboard whitelist |
| 146 | Template not registered | Register SMS template with sales |

---

## eSMS Auto-OTP (NOT Used by Bus-Booking)

eSMS also offers a built-in auto-generate OTP service where eSMS generates, sends, and verifies the code:

- **Send:** `GET https://rest.esms.vn/MainService.svc/json/SendMessageAutoGenCode_V4_get?Phone=...&message={OTP} la ma xac minh...&TimeAlive=5&NumCharOfCode=6&IsNumber=1`
- **Verify:** `GET https://rest.esms.vn/MainService.svc/json/CheckCodeGen_V4_get?Phone=...&Code=123456`

Bus-Booking does NOT use this because the codebase has its own OTP generation, hashing, rate-limiting, and lockout logic in `lib/auth/otp.ts`. We use eSMS purely as an SMS delivery pipe (raw SMS, Approach A).

---

## Key Links

| What | URL |
|------|-----|
| Register account | https://account.esms.vn/Account/SignUp |
| Login / Dashboard | https://account.esms.vn/ |
| Main website | https://esms.vn/ |
| API documentation | https://developers.esms.vn/ |
| OTP API docs | https://developers.esms.vn/esms-api/ham-gui-tin/tin-nhan-sms-otp-cskh |
| Brandname service info | https://esms.vn/dich-vu/dich-vu-sms-brandname |
| Pricing page | https://esms.vn/chinh-sach-gia |
| Privacy policy | https://esms.vn/policy/privacy-policy |
| Sales contact | 0901 888 484 / cs@vihatgroup.com |

---

## Pricing

| Item | Cost |
|------|------|
| SMS Brandname (SmsType 2) | 520 VND/SMS (~$0.021 USD) |
| SMS Fixed number (SmsType 6/8) | 450 VND/SMS |
| SMS Random number (SmsType 7) | ~450 VND/SMS |
| Trial credits on signup | 5,000 VND free |
| Volume >5,000 SMS | Contact sales for discount |
| Twilio comparison | $0.1552/SMS to Vietnam (7x more expensive) |

---

## Codebase Reference

| File | Role |
|------|------|
| `lib/notification/esmsClient.ts` | eSMS HTTP client (POST to SendMultipleMessage_V4) |
| `lib/notification/esms.ts` | Stub/real router, SMS template renderer, test OTP sink |
| `lib/auth/otp.ts` | OTP generation, hashing, timing-safe verification, consumption |
| `lib/auth/sendOtp.ts` | Customer OTP send via **email** (migrated from SMS — commit `686ec85`) |
| `lib/auth/operatorOtp.ts` | Operator password-reset OTP with lockout sentinel |
| `lib/account/customerOtp.ts` | Customer account OTP via **email** (password reset) — no longer SMS |
| `lib/config/env.ts` | Environment validation (superRefine enforces ESMS_* creds when NOTIFY_STUB=false) |
| `.env.example` | All eSMS environment variables documented (lines 87-100) |
