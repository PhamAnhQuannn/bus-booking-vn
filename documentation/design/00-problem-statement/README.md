> ← [Index](../README.md) | [Index](../README.md) | [Next →](../01-requirements-functional/)

## 0. Problem Statement

Every design decision in this document flows from a real problem. Before diving into solutions, understand what's broken.

### 0.1 Who Has This Problem?

- **Travelers in Vietnam**: 1,600+ bus operators, most are small companies running 5–20 buses. Booking a bus ticket today means calling a bus station, walking up at the depot, or using one of a few aggregator apps with limited route coverage.
- **Bus operators**: Run their business on phone calls, handwritten manifests, and walk-up customers. No visibility into how full a bus is until departure. No digital payment collection — cash only, often handed to drivers.
- **The market gap**: No single platform connects a large number of operators to travelers with real-time seat availability, online payment, and digital ticketing.

### 0.2 What's Broken Today?

| Pain Point | Who Feels It | Consequence |
|-----------|-------------|------------|
| Phone-only booking | Travelers | Can't compare prices, can't confirm seats, risk of oversell |
| No price transparency | Travelers | Same route, three operators, no way to compare |
| Paper manifests | Operators | No-shows invisible, boarding chaos, no real-time seat count |
| Cash-only payment | Operators | Revenue leakage, no audit trail, driver trust issues |
| Fragmented systems | Platform | No network effects, no data, no marketplace leverage |

### 0.3 What Does Success Look Like?

- **Customer**: Search-to-ticket in under 5 minutes, zero phone calls, digital ticket on phone
- **Operator**: Digital manifest, real-time seat counts, money deposited to bank account automatically
- **Platform**: ~200 bookings/day (current), scaling to ~2,000/day; 6% platform fee on each booking
- **Measurable goal**: A single integration gives any operator access to all customer traffic on the platform

### 0.4 Why This Matters for the Design

Every technical choice traces back to this problem:
- **Guest checkout** (no account required) → matches how Vietnamese travelers buy (one-off, not frequent flyer)
- **Central collection model** (Section 9.1) → solves "did money arrive?" for 100+ operator accounts
- **VND integer math** (Section 10.2) → not a localized global product; Vietnamese dong has no decimal places
- **Phone-first identity** → most Vietnamese users identify by phone number, not email
- **Modular monolith** (Section 3.1) → correctness (money, concurrency) matters more than throughput at this scale
