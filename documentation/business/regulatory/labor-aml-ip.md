# Labor, AML, IP, Insurance & Accessibility — Vietnam

> Domains 12-16 of [regulatory scan](README.md). See [consolidated checklist](README.md#consolidated-pre-launch-compliance-checklist) for cross-domain view.
> Last researched: June 2026.

---

## 1. LABOR & EMPLOYMENT

### Laws
- Labor Code 2019 (No. 45/2019/QH14)
- Social Insurance Law 2014 (amended 2024, effective Jul 2025)
- Decree 152/2020/ND-CP on foreign workers (amended by Decree 70/2023)

### Mandatory Contributions (2025-2026 rates)

| Type | Employer | Employee | Total |
|------|----------|----------|-------|
| Social Insurance (SI) | 17.5% | 8% | 25.5% |
| Health Insurance (HI) | 3% | 1.5% | 4.5% |
| Unemployment Insurance (UI) | 1% | 1% | 2% |
| Occupational Accident | 0.5% | — | 0.5% |
| **Total** | **22%** | **10.5%** | **32.5%** |

Total employment cost: **~32.5% above gross salary**.

Base salary (luong co so) for 2025: VND 2,340,000/month.

### Foreign Workers
- Work permit required BEFORE starting work
- **Exemptions**: foreign capital-contributing members/owners (need exemption confirmation from DOLISA)
- Foreign founders who contribute capital: **exempt from work permit** but need formal exemption document
- If also appointed as employee/manager: may still need work permit for employment role
- Processing: 5-7 working days
- Validity: up to 2 years, renewable

### Contractor vs. Employee Classification

| Indicator | Employee | Contractor |
|-----------|----------|------------|
| Working hours | Fixed, set by employer | Flexible, self-determined |
| Direction/supervision | Employer controls how | Independent methods |
| Payment | Regular salary schedule | Deliverable-based |
| Integration | Part of employer org | Independent business |
| Tools | Employer-provided | Own tools |

**Risk for bus booking platform**: Labor Code 2019 expanded "labor relationship" definition beyond formal contracts. If the platform exerts significant control over operator pricing, scheduling, and operations → reclassification risk.

**Mitigation**: maintain clear marketplace model — operators set own prices, schedules, routes. Platform provides technology, not operational direction.

**Grab Vietnam precedent**: employment classification dispute (2020-2023) is a cautionary tale, though Grab drivers are different from bus operators with their own fleets.

### Social Insurance Law 2024 (effective July 2025)
- Reduced minimum contribution period for pension (20 → 15 years)
- **May expand coverage to gig workers and household business employees**
- Could affect operator classification in the future — monitor

---

## 2. ANTI-MONEY LAUNDERING

### Laws
- AML Law 2022 (No. 14/2022/QH15, effective 1 Mar 2023)
- Decree 19/2023/ND-CP (implementation)

### Is a bus booking platform a reporting entity?

**No** — unless it holds a payment intermediary license.

AML reporting entities include: banks, financial institutions, payment intermediaries, real estate, designated non-financial businesses. A marketplace bus booking platform using licensed gateways (VNPay, MoMo) is not directly a reporting entity.

### What the platform should do anyway

| Action | Detail |
|--------|--------|
| Basic KYC for operators | Business registration, tax code, bank account verification |
| Monitor for unusual patterns | Bulk ticket purchases, rapid refund cycling |
| Report suspicious patterns to payment gateway | VNPay/MoMo handle STR filing |

### Thresholds
- Enhanced due diligence: **400 million VND/day** (unlikely for bus tickets)
- Cash transactions above threshold: reporting obligation falls on the bank, not the platform

### Vietnam FATF evaluation
Expected 2025-2026. Could tighten requirements for digital platforms.

---

## 3. INTELLECTUAL PROPERTY

### Laws
- IP Law 2005 (amended 2009, 2019, 2022)
- Decree 65/2023/ND-CP (implementation)

### Trademark Registration

| Item | Detail |
|------|--------|
| System | **First-to-file** (not first-to-use) |
| Authority | NOIP (National Office of IP / Cuc So huu tri tue) |
| Timeline | **12-18 months** from filing to registration |
| Cost | ~1-3M VND official fees + ~10-20M VND with attorney |
| Protection | 10 years from filing, renewable indefinitely |
| Search | ipvietnam.gov.vn database |

### Nice Classification for bus booking platform
- **Class 39**: Transport services
- **Class 35**: Advertising, business management
- **Class 42**: Technology, software services

**FILE EARLY** — squatting risk is real in first-to-file system. If someone registers your brand first, opposition proceedings are costly.

### .vn Domain Registration
- Through VNNIC-accredited registrars (MatBao, PAVIETNAM, VinaHost, Nhan Hoa)
- Requires: business registration documents
- Cost: **350-500k VND/year**
- Register both .vn and .com.vn defensively
- Also register common misspellings

---

## 4. INSURANCE

### Laws
- Insurance Business Law 2022 (No. 08/2022/QH15, effective 1 Jan 2023)

### Mandatory
| Type | Applies to |
|------|-----------|
| Social insurance | All employees |
| Fire/explosion insurance | Office premises |
| Vehicle insurance | Company vehicles (if any) |

### Recommended
| Type | Budget (VND/year) | Providers |
|------|-------------------|-----------|
| Professional Indemnity (E&O) | Part of package | Bao Viet, PVI |
| General Liability | Part of package | Bao Viet, PVI |
| Cyber Insurance | Part of package | AIG, Chubb (VN presence) |
| **Total SME package** | **~15-30M VND** | — |

### Cyber Insurance
- Not mandatory for tech companies (yet)
- Market developing in Vietnam
- Coverage: data breach response, notification costs, regulatory fines, business interruption
- Available from: international insurers with VN presence (AIG, Chubb, Zurich), Vietnamese insurers (Bao Viet, PVI)

---

## 5. ACCESSIBILITY

### Laws
- Law on Persons with Disabilities 2010 (No. 51/2010/QH12)
- Circular 26/2020/TT-BTTTT (ICT accessibility)

### Current requirements
- Circular 26/2020: applies to **government** websites/apps
- **Recommends** (but does not mandate) WCAG 2.0 Level AA for private sector
- No strict WCAG mandate for private sector currently
- Transport services: bus operators should accommodate passengers with disabilities (law requires, enforcement limited)

### Platform opportunities
- Highlight accessible buses (wheelchair ramps, priority seating)
- Basic web accessibility (contrast, screen reader, keyboard navigation)
- Competitive advantage and future-proofing
- Emerging regulation trend — likely to become mandatory

---

## Compliance Actions

| Action | Urgency | Detail |
|--------|---------|--------|
| Trademark filing | Within 3 months | File early, 12-18 month process |
| .vn domain registration | Within 3 months | Defensive registration |
| Operator KYC process | Before launch | Business registration, tax code, bank details |
| Work permit exemption (if foreign founders) | Before starting work | DOLISA confirmation |
| Social insurance registration | Within 30 days of first hire | Monthly contributions |
| Insurance package | Within 6 months | Bao Viet/PVI SME package |
| Accessibility audit | Within 6 months | Basic WCAG 2.0 AA improvements |

## Open Risks

1. Social Insurance Law 2024 (Jul 2025) may expand mandatory coverage to gig/platform workers
2. Trademark squatting — file before announcement
3. Contractor vs. employee classification could surface if operators complain
4. Vietnam FATF evaluation could tighten AML requirements
5. Digital accessibility regulations may become mandatory for private platforms
