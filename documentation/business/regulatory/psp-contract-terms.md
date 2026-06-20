# PSP Contract Terms — VNPay, MoMo, VietQR

> Supplement to [payment regulations](payment.md). Fee ranges are market estimates -- rates are negotiated per contract.
> Last researched: June 2026.

> **Important**: VNPay and MoMo do not publicly publish MDR rate schedules. All fee figures below are market intelligence from aggregators, industry sources, and merchant community reports. Actual contracted rates will vary based on volume, category, and negotiation.

---

## VNPay

| Dimension | Detail |
|-----------|--------|
| License | Licensed SBV payment intermediary (gateway + switching) |
| Merchant reach | 150,000+ acceptance points; ~40% domestic QR market share |
| MDR domestic cards (NAPAS) | ~0.5-1.5% |
| MDR domestic e-wallet/QR | ~1-2% |
| MDR international cards (Visa/MC) | 2.5-3.5% (up to 4.5% cross-border) |
| Settlement | T+1 standard; same-day premium tier available |
| Chargeback fee | VND 200,000-500,000 per dispute |
| Refund fee | Typically 0 (reversal within settlement window is free) |
| Sandbox | Available before ERC; production requires ERC + tax code + bank account |
| Required docs | ERC, tax code certificate, bank account, website with T&Cs/refund policy, UBO ID |
| Integration effort | Medium -- structured testing gates before production approval |
| Dispute resolution | Follows NAPAS dispute timeline (up to 45 days) |

---

## MoMo

| Dimension | Detail |
|-----------|--------|
| License | Licensed SBV e-wallet and payment intermediary |
| User base | 40+ million active users (largest domestic e-wallet) |
| MDR wallet | ~1.5-2.5% |
| MDR linked bank card | ~2-3% |
| Annual merchant fee | ~USD 50/year per website (reported) |
| Settlement | T+1 to T+2 standard |
| API | REST with AIO endpoint (developers.momo.vn/v3) |
| Sandbox | Available at signup; no ERC required for sandbox |
| Required docs | ERC, tax code certificate, bank account, website with compliance policies |
| Integration effort | Low-Medium (AIO endpoint simplifies flow) |
| Dispute resolution | MoMo-mediated; follows internal SLA |

---

## VietQR / NAPAS (Bank Transfer)

> **Updated 2026-06-20**: Added SePay as the confirmation mechanism. Bank: Agribank (BIN 970405).

| Dimension | Detail |
|-----------|--------|
| Type | Not a PSP -- direct bank transfer via VietQR standard (NAPAS EMVCo) |
| Network | NAPAS 247 real-time interbank; 9.56 billion transactions in 2024 |
| Settlement | Instant -- money arrives directly in bank account (T+0) |
| Transaction fee | **0đ** (domestic transfers are free) + ~100-500k VND/month SePay fee |
| Confirmation | **SePay webhook** (sepay.vn) -- push-based, 5-30s latency. See DS-013 |
| Bank | Agribank (BIN 970405, account 3516205005863) -- configurable via env |
| Customer reach | All Vietnamese bank app users with VietQR support |
| International cards | Not supported |
| Chargeback mechanism | None (bank transfer model; no card-network dispute process) |
| Refund | Manual reverse transfer via bank; no programmatic refund API |
| Merchant setup | No merchant account needed -- personal/business bank account + SePay subscription |

---

## SePay (Bank Account Monitoring)

| Dimension | Detail |
|-----------|--------|
| Type | Bank account monitoring service -- not a PSP |
| Website | sepay.vn |
| Supported banks | 30+ Vietnamese banks including Agribank, Vietcombank, MBBank, Techcombank, BIDV |
| Webhook auth | Bearer token (`Authorization: Bearer <API_KEY>`) |
| Confirmation latency | 5-30 seconds after bank confirms transfer |
| Cost | ~100-500k VND/month depending on plan |
| Data residency | Vietnam |
| Alternative | Casso (casso.vn) -- similar service, HMAC webhook auth |

---

## Comparison

| Dimension | VNPay | MoMo | Bank Transfer (VietQR + SePay) |
|-----------|-------|------|-------------------------------|
| Transaction fee (domestic) | 0.5-2% | 1.5-2.5% | 0đ (+ ~100-500k/month SePay) |
| International cards | Yes (2.5-4.5%) | No | No |
| Settlement speed | T+1 | T+1 to T+2 | T+0 (instant) |
| Confirmation latency | Sub-second (webhook) | Sub-second (webhook) | 5-30 seconds (SePay webhook) |
| Customer reach | Broad (cards + QR + wallets) | 40M+ wallet users | All VN bank app users |
| Integration effort | Medium | Low-Medium | Low (adapter + SePay signup) |
| BNPL support | Available on select plans | MoMo TraLater (pilot) | No |
| Chargeback process | NAPAS 45-day timeline | MoMo-mediated | None |
| Refund API | Yes (programmatic reversal) | Yes (AIO refund endpoint) | No (manual bank transfer) |
| Merchant account required | Yes (ERC + tax code) | Yes (ERC + tax code) | No (personal bank account works) |

---

## Recommendation

Integrate all three. Bank transfer (VietQR + SePay) launches first as the zero-fee domestic option -- ships before entity formation (no merchant account required, personal Agribank account sufficient). MoMo + VNPay added when business registration is complete.

This matches the project's existing adapter architecture: `BankTransferAdapter`, `MoMoAdapter`, and `VNPayAdapter` all implement the same `PaymentGateway` interface.

**Priority order for production onboarding**:
1. Bank transfer + cash -- zero fees, zero registration, ships with personal bank account. Cash covers older/rural travelers
2. MoMo + VNPay -- MoMo covers e-wallet users (40M+); VNPay covers cards/international. Both require ERC + merchant approval
3. ZaloPay -- additional wallet coverage

---

## SLA Expectations

> Industry-standard benchmarks. Actual SLAs are contract-specific and not publicly published by VNPay or MoMo.

| Dimension | Benchmark |
|-----------|-----------|
| Transaction API uptime | 99.9% |
| Settlement dispute resolution | 30-45 business days |
| Merchant support response | 1-3 business days |
| Chargeback window | 45-90 days (card-network dependent) |
| Refund processing | 1-3 business days |
| Sandbox provisioning | Same day (MoMo); 1-3 days (VNPay) |
| Production merchant approval | 5-15 business days after document submission |

---

## Chargeback Operational Response (GAP)

PSP chargeback fees are documented above. **No operational workflow exists for handling chargebacks.** Missing:

- Admin chargeback queue/notification
- Booking state transition for chargebacks (`paid → chargeback` not in state machine)
- Ledger chargeback entry automation
- Operator notification on chargeback
- T+1 settlement creates exposure: funds disbursed before chargeback window (45-90 days) closes

**ACTION:** Design chargeback workflow before launch or extend settlement delay to cover chargeback window. At minimum, implement a chargeback reserve (holdback percentage per settlement) to cover dispute exposure.
