# Telecom / SMS / OTP Regulations — Vietnam

> Domain 6 of [regulatory scan](README.md). See [consolidated checklist](README.md#consolidated-pre-launch-compliance-checklist) for cross-domain view.
> Last researched: June 2026.

## Regulatory Stack

| Law/Decree | Status | Effective |
|------------|--------|-----------|
| Law on Telecommunications 2009 | Enforced | 2009 |
| Decree 91/2020/ND-CP (Anti-spam) | Enforced | 1 Oct 2020 |
| Carrier-specific brandname SMS regulations | Enforced | Ongoing |
| Decree 147/2024/ND-CP (Internet services) | Enforced | 25 Dec 2024 |

## 1. SMS Types and Consent

| SMS Type | Consent needed? | Restrictions |
|----------|----------------|--------------|
| **OTP codes** | No (transactional exempt) | Must NOT contain promotional content |
| **Booking confirmations** | No (transactional exempt) | Purely informational |
| **Departure reminders** | No (transactional exempt) | No ads mixed in |
| **Marketing/promotions** | **Yes** (opt-in required) | No sending 10PM-8AM, check DNC registry |

Violations: fines **60-80 million VND** for organizations.

## 2. Brandname SMS Registration

### Process
1. Choose brand name (3-11 chars, alphanumeric)
2. Prepare: Business Registration Certificate, tax code, sample message templates
3. Submit to each carrier or use aggregator
4. Templates reviewed and pre-approved by carrier
5. Wait **2-4 weeks** for activation

### Carriers (must register with each, or use aggregator)
| Carrier | Coverage |
|---------|----------|
| Viettel | ~50% market share |
| VNPT (VinaPhone) | ~20% |
| Mobifone | ~15% |
| Others (Vietnamobile, etc.) | ~15% |

### Cost
- Registration fee: 1-5 million VND per carrier
- Per-message: **300-800 VND** depending on volume and carrier

### Using an aggregator (recommended)
eSMS, Stringee handle multi-carrier registration and routing. Simpler than direct registration with each carrier.

## 3. Foreign SMS APIs

| Provider | VN capability | Delivery rate |
|----------|---------------|---------------|
| Twilio | Limited/no VN sender numbers | 60-80% |
| AWS SNS | Limited VN routing | 60-80% |
| **eSMS.vn** | Full VN support | 95-99% |
| **Stringee** | Full VN support | 95-99% |
| VNPT-IT | Full VN support | 95-99% |
| FPT SMS | Full VN support | 95-99% |

**Rule**: Must use Vietnamese SMS providers for reliable OTP delivery. Foreign APIs have poor deliverability and may be filtered by carriers.

## 4. Zalo ZNS (Zalo Notification Service)

### Why use ZNS
- **Cheaper**: ~200-500 VND/msg (vs. 300-800 VND SMS)
- **Higher delivery**: >95% for Zalo users
- **Zalo reach**: ~75M monthly active users in Vietnam (very high penetration)
- **Richer content**: supports structured templates, buttons, links

### Requirements
- Zalo Official Account (OA) verification with business registration documents
- Message templates must be pre-approved
- Template types: OTP, transaction notification, customer care

### Limitation
- Only reaches users with Zalo installed (~75M MAU but not universal)
- Not a substitute for SMS — fallback needed

### Industry pattern: ZNS primary, SMS fallback
Most Vietnamese platforms (Grab, Be, Tiki, Shopee VN) use this dual-channel approach:
1. Try Zalo ZNS first (cheaper, higher delivery)
2. Fall back to SMS for users without Zalo
3. Cost savings: **50-70%** vs. SMS-only

## 5. Do-Not-Call Registry

- Vietnam maintains a DNC registry managed by VNPT under MOIT
- Must check before sending **marketing** SMS or calls
- **Transactional messages exempt** from DNC checks
- API available for registered businesses

## Compliance Actions

| Action | Urgency | Detail |
|--------|---------|--------|
| **Start brandname SMS registration** | **NOW** | 2-4 week hard blocker for production OTP |
| Choose aggregator (eSMS recommended) | NOW | Already stubbed in codebase |
| Zalo Official Account verification | Before launch | Business docs needed |
| Dual-channel OTP implementation | Before launch | ZNS primary → SMS fallback |
| Separate transactional vs. marketing SMS | Before launch | No promo content in booking/OTP messages |
| DNC registry check for marketing | Before marketing campaigns | Only for promotional SMS |

## Open Risks

1. Brandname registration timeline (2-4 weeks) is a **hard blocker** — cannot be compressed
2. Brand name conflicts with existing registrations → rename and re-register
3. Rural area SMS delivery rates may be lower
4. Zalo could change pricing/terms — don't over-depend
5. Future regulations may require VN-based SMS infrastructure for all OTP delivery

## Cost Comparison (per 10,000 messages)

| Channel | Cost (VND) | Cost (USD) |
|---------|-----------|------------|
| SMS via eSMS | 3-8 million | ~120-320 |
| Zalo ZNS | 2-5 million | ~80-200 |
| Dual (70% ZNS / 30% SMS) | 2.3-5.9 million | ~92-236 |

## Cross-References

- Marketing promotion registration rules → [consumer-protection.md](consumer-protection.md#5-promotions--discounts)
- Data consent for phone numbers → [data-privacy.md](data-privacy.md#2-personal-data-protection-law-pdpl-2025)

## Sources

- [Decree 91/2020 on Anti-Spam](https://thuvienphapluat.vn/van-ban/Cong-nghe-thong-tin/Nghi-dinh-91-2020-ND-CP-chong-thu-rac-cuoc-goi-rac-tin-nhan-rac-450303.aspx)
