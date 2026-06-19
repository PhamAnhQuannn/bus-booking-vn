# Transportation Regulations — Vietnam

> Domain 7 of [regulatory scan](README.md). See [consolidated checklist](README.md#consolidated-pre-launch-compliance-checklist) for cross-domain view.
> Last researched: June 2026.

## Regulatory Stack

| Law/Decree | Status | Effective |
|------------|--------|-----------|
| Law on Road Traffic 2008 (No. 23/2008/QH12) | Amended 2024 | 2008 |
| Decree 10/2020/ND-CP (Road transport business conditions) | Enforced | 2020 |
| Decree 03/2021/ND-CP (Mandatory insurance) | Amended by Decree 67/2023 | 2021 |
| Decision 24/2018/QD-TTg (Ride-hailing classification) | Enforced | 2018 |
| **New Law on Road Traffic** (Luat Trat tu ATGT) | **Enforced** | **1 Jan 2025** |
| **Draft Road Transport Law** | **In draft** | **TBD (mid-2025)** |

## 1. Bus Operator Licensing

### Required licenses
- **Transport Business License** (Giay phep kinh doanh van tai) from provincial Department of Transport (So GTVT)
- Validity: typically 5-7 years, renewable
- Requirements: registered capital, fleet meeting safety standards, qualified drivers, maintenance facilities

### Route-specific authorization
- Fixed-route (tuyen co dinh) services need additional route-specific approval from provincial transport department
- Routes registered with departure terminal (ben xe di) and arrival terminal (ben xe den)
- Operators must maintain schedule commitments on registered routes

### Vehicle requirements
- Periodic inspection (dang kiem) mandatory
- Valid registration required
- Drivers need specific license classes (D, E for buses)

## 2. Platform Classification

### The key legal question
Is this platform a **"transport business" (kinh doanh van tai)** or a **"technology platform" (nen tang cong nghe)**?

| Classification | Requirements | Foreign ownership |
|---------------|-------------|-------------------|
| Transport business | Own transport license, fleet requirements, insurance | Capped 49-51% |
| Technology platform | E-commerce registration, no transport license | Up to 100% |

### No specific regulation for online bus booking platforms
- Decision 24/2018 classified ride-hailing apps (Grab) separately from transport businesses — but specifically for ride-hailing, not bus booking
- The new draft Road Transport Law may explicitly address digital platforms when enacted

### Vexere precedent
Operates as technology company, not transport business. No transport license. 10+ years without regulatory challenge. See [payment.md](payment.md#vexere-precedent) for full detail on the Vexere marketplace model including IPS/SBV analysis.

### Legal counsel recommendation
Get a formal legal opinion before registration documenting:
1. Platform does not own or operate buses
2. Platform is a technology marketplace connecting licensed operators with passengers
3. Operators remain independently licensed transport businesses
4. Platform is comparable to Vexere's established operating model

## 3. Pricing

- Bus ticket prices are **market-determined** (not government price caps)
- Law on Pricing 2023 (effective Jul 2024): bus tickets in "market-determined price" category
- **Tet exception**: government guidance to keep price increases reasonable during Lunar New Year (typically capped at 40-60% above normal)
- Total price must be displayed upfront including all fees

## 4. Pickup/Dropoff Points

| Point type | Status |
|------------|--------|
| Official bus stations (ben xe) | Regulated, authorized |
| Operator-designated pickup points | Gray area but widely accepted |
| "Door-to-door" pickup (limousine/VIP) | Gray area, common practice |
| Platform-created unofficial stops | **Risk** — avoid |

Industry practice (ThanhBuoi, PhuongTrang, Vexere): list both official bus stations and operator-designated pickup points. Platform should not create unauthorized stops — list what the operator already offers.

## 5. Passenger Insurance

- Mandatory per Decree 03/2021 (amended by Decree 67/2023)
- Covers: passenger injury and death during transport
- **Operator's responsibility** to maintain valid coverage
- Platform should **verify insurance status** during onboarding
- Providers: Bao Viet, PVI, Bao Minh

## 6. Passenger Manifests

- Some routes require passenger manifests submitted to authorities
- Platform may need to provide data on request
- Provincial transport departments maintain route registries

## Compliance Actions

| Action | Urgency | Detail |
|--------|---------|--------|
| Legal opinion on platform classification | Before launch | "Technology platform" not "transport business" |
| Operator license verification | Before launch | Collect transport license during onboarding |
| Route authorization check | Before launch | Verify operators serve authorized routes only |
| Passenger insurance verification | Before launch | Collect insurance certificate at onboarding |
| Monitor draft Road Transport Law | Ongoing | Could require new licensing when enacted |
| Tet pricing policy | Before first Tet season | Comply with government price guidance |

## Open Risks

1. **Draft Road Transport Law** could change platform classification when enacted — monitor closely
2. If platform adds features beyond ticket sales (fleet management, dynamic pricing, route optimization) → could be reclassified as transport business
3. Platform liability for accidents/incidents not clearly defined in current regulations
4. Tet holiday pricing government guidance could create compliance obligations
5. Passenger manifest requirements could create data-sharing obligations with authorities

## Cross-References

- Marketplace fund flow and IPS licensing → [payment.md](payment.md)
- Operator onboarding document checklist → [README.md](README.md#operator-onboarding--consolidated-document-requirements)
- Platform classification and VSIC codes → [legal-entity.md](legal-entity.md)

## Sources

- [Decree 10/2020 on Transport Business Conditions](https://thuvienphapluat.vn/van-ban/Giao-thong-Van-tai/Nghi-dinh-10-2020-ND-CP-kinh-doanh-dieu-kien-kinh-doanh-van-tai-bang-xe-o-to-436447.aspx)
