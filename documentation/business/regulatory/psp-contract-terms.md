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

## VietQR / NAPAS

| Dimension | Detail |
|-----------|--------|
| Type | Not a PSP -- merchants integrate via partner bank or licensed PSP |
| Network | NAPAS 247 real-time interbank; 9.56 billion transactions in 2024 |
| Settlement | Near-instant (<10s finality); T+0 to T+1 |
| MDR P2M | <0.5-1% (set by acquiring bank) |
| Merchant setup | Via partner bank (Vietcombank, Techcombank, MBBank recommended) |
| Customer reach | All Vietnamese bank app users with VietQR support |
| International cards | Not supported |
| Chargeback mechanism | None (bank transfer model; no card-network dispute process) |
| Refund | Manual reverse transfer via bank; no programmatic refund API |

---

## Comparison

| Dimension | VNPay | MoMo | VietQR |
|-----------|-------|------|--------|
| Transaction fee (domestic) | 0.5-2% | 1.5-2.5% | <0.5-1% |
| International cards | Yes (2.5-4.5%) | No | No |
| Settlement speed | T+1 | T+1 to T+2 | T+0 to T+1 |
| Customer reach | Broad (cards + QR + wallets) | 40M+ wallet users | All VN bank app users |
| Integration effort | Medium | Low-Medium | Low (via bank SDK) |
| BNPL support | Available on select plans | MoMo TraLater (pilot) | No |
| Chargeback process | NAPAS 45-day timeline | MoMo-mediated | None |
| Refund API | Yes (programmatic reversal) | Yes (AIO refund endpoint) | No (manual bank transfer) |

---

## Recommendation

Integrate all three. VNPay + MoMo as primary payment gateways covering cards, wallets, and QR. VietQR via bank partner as the lowest-cost domestic transfer option.

This matches the project's existing adapter architecture: `VNPayAdapter` and `MoMoAdapter` are already implemented; VietQR can follow the same `PaymentAdapter` interface.

**Priority order for production onboarding**:
1. VNPay -- broadest payment method coverage (domestic + international cards + QR)
2. MoMo -- largest wallet user base; highest mobile conversion
3. VietQR -- lowest fees; add after launch for cost optimization

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
