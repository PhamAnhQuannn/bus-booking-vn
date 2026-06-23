# MISA meInvoice — E-Invoice Setup Guide

Configure MISA meInvoice for electronic invoicing (hóa đơn điện tử) per Circular 78/2021/TT-BTC. Required by Vietnamese law for all business transactions. Code integration: `lib/einvoice/misaClient.ts` (planned). Env vars: `EINVOICE_ENABLED`, `MISA_API_URL`, `MISA_API_KEY`, `MISA_COMPANY_CODE`, `MISA_TEMPLATE_CODE`.

> **Phase 1 status:** Deferred. `EINVOICE_ENABLED="stub"` — invoices logged only. Activate when tax compliance is required (Phase 2, HD-005 hardening gate).

---

## Prerequisites

- Vietnamese business license (Giấy phép kinh doanh)
- Tax registration certificate (Giấy chứng nhận đăng ký thuế)
- Digital signature certificate (Chữ ký số) from a licensed CA (VNPT-CA, Viettel-CA, FPT-CA, etc.)
- Registered with General Department of Taxation (Tổng cục Thuế)

---

## Step 1: Create MISA meInvoice Account

1. Go to **https://www.meinvoice.vn/** (MISA meInvoice portal)
2. Click **"Đăng ký dùng thử"** (Register for trial) or **"Mua ngay"** (Buy now)
3. Fill registration:

| Field | Required | Detail |
|-------|----------|--------|
| Tên công ty | Yes | Company name (must match tax registration) |
| Mã số thuế | Yes | Tax identification number |
| Địa chỉ | Yes | Registered business address |
| Email | Yes | Company email |
| Số điện thoại | Yes | Contact phone |
| Người liên hệ | Yes | Contact person name |

4. MISA sales team contacts you within 1-2 business days for onboarding
5. Free trial: 50 invoices for 30 days

---

## Step 2: Complete Onboarding

MISA onboarding includes:

1. **Business verification** — MISA verifies your tax registration with GDT
2. **Digital signature setup** — connect your digital certificate (USB token or HSM)
3. **Invoice template approval** — submit your template design to GDT
4. **Test environment access** — sandbox credentials for API testing

Typical onboarding timeline: **5-10 business days**

---

## Step 3: Configure Invoice Template

1. Login to MISA meInvoice dashboard
2. Go to **"Mẫu hóa đơn"** (Invoice Templates)
3. Create template for bus tickets:

| Field | Value |
|-------|-------|
| Loại hóa đơn | Hóa đơn giá trị gia tăng (VAT invoice) |
| Ký hiệu mẫu | `1` (standard e-invoice) |
| Ký hiệu | Auto-assigned by GDT |
| Template items | Service name, route, date, seat, amount, VAT |

4. Submit template to GDT for approval (MISA handles submission)
5. Note the **Template Code** after approval — needed for API

---

## Step 4: Get API Credentials

1. In MISA dashboard → **"Cài đặt"** (Settings) → **"API"**
2. Enable API access
3. Copy credentials:

| Credential | Env Var |
|------------|---------|
| API URL | `MISA_API_URL` (e.g. `https://api.meinvoice.vn/api/v1`) |
| API Key | `MISA_API_KEY` |
| Company Code | `MISA_COMPANY_CODE` (your tax ID or MISA company code) |
| Template Code | `MISA_TEMPLATE_CODE` (from Step 3 approval) |

4. For sandbox: use test API URL `https://api-sandbox.meinvoice.vn/api/v1`

---

## Step 5: Configure Environment Variables

### In Vercel (Production) — When Ready to Activate

```env
EINVOICE_ENABLED="misa"
MISA_API_URL="https://api.meinvoice.vn/api/v1"
MISA_API_KEY="your-api-key"
MISA_COMPANY_CODE="your-company-code"
MISA_TEMPLATE_CODE="your-template-code"
```

### For Local Development

Keep e-invoice stubbed:
```env
# .env.local
EINVOICE_ENABLED="stub"
# No MISA vars needed — stub logs invoice data only
```

---

## Step 6: Test with Sandbox

1. Set sandbox API URL:
   ```env
   MISA_API_URL="https://api-sandbox.meinvoice.vn/api/v1"
   ```
2. Create a test booking → complete payment → trigger invoice generation
3. Verify in MISA sandbox dashboard:
   - Invoice appears with correct customer info, route, amount
   - Digital signature applied
   - Invoice number auto-assigned

---

## Step 7: Go Live

1. Switch API URL to production: `https://api.meinvoice.vn/api/v1`
2. Set `EINVOICE_ENABLED="misa"` in Vercel production env
3. Verify first real invoice:
   - Customer receives invoice email from MISA
   - Invoice lookup works on GDT portal (https://hoadondientu.gdt.gov.vn/)
   - Invoice data matches booking details

---

## Invoice Data Mapping

| Invoice Field | Source | Notes |
|---------------|--------|-------|
| Tên người mua (Buyer name) | `Customer.fullName` | Required |
| Mã số thuế (Buyer tax ID) | Optional | For B2B transactions |
| Tên hàng hóa (Item) | Route name + date + seat | "Vé xe Thanh Hóa → TPHCM 21/06/2026 Ghế A1" |
| Đơn giá (Unit price) | `Booking.totalAmount` | VND minor units → VND |
| Thuế suất (VAT rate) | 10% | Standard transport VAT |
| Thành tiền (Total) | `Booking.totalAmount` | Same as unit price (qty=1) |

---

## Regulatory Requirements

| Requirement | Deadline | Notes |
|-------------|----------|-------|
| E-invoice mandatory | Since July 1, 2022 | Circular 78/2021/TT-BTC |
| Issue within 24h of payment | Per transaction | App must issue on payment confirmation |
| Store for 10 years | Archive policy | MISA handles storage |
| Digital signature | Each invoice | Auto-signed via connected certificate |
| GDT reporting | Real-time | MISA auto-reports to GDT |

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `MISA_API_KEY is required` | `EINVOICE_ENABLED="misa"` but key missing | Set all 4 MISA vars or keep `EINVOICE_ENABLED="stub"` |
| `Invalid company code` | Wrong company code | Use exact code from MISA dashboard |
| `Template not found` | Template not yet approved by GDT | Wait for GDT approval; use sandbox template for testing |
| `Digital signature failed` | Certificate expired or disconnected | Renew digital certificate; check USB token connection |
| Invoice not on GDT portal | Sync delay | Wait 1-2 hours; MISA batches uploads to GDT |

---

## Pricing

| Package | Cost | Invoices | Notes |
|---------|------|----------|-------|
| Trial | Free | 50 / 30 days | Full features, sandbox only |
| Basic | ~1,500,000 VND/year (~$60) | 200/year | For low-volume businesses |
| Standard | ~3,000,000 VND/year (~$120) | 1,000/year | Recommended for launch |
| Premium | ~6,000,000 VND/year (~$240) | Unlimited | For high-volume operators |

Additional cost: digital signature certificate ~1,500,000-3,000,000 VND/year from licensed CA.
