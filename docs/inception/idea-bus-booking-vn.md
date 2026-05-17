# Idea — Bus Booking VN
**Date:** 2026-05-17 | **Status:** RAW

## Pitch
Online booking platform for Vietnam intercity buses where customers reserve seats by route+date and operators confirm pickup + seat assignment by phone, so guests book in 30 seconds without picking from a seat map they cannot trust.

## Problem
Vietnam intercity bus booking is fragmented across phone-only operators, opaque aggregators, and seat maps that don't reflect reality — customers re-call to confirm pickup anyway. Operators lose revenue to no-shows and missed calls because every booking still depends on a manual phone confirmation that the platform refuses to acknowledge.

## Customer
**Two-sided:**
- **Guest passenger** — VN intercity traveler (18-45), books 1-3 trips/month, has phone number, often skips account creation, expects MoMo/ZaloPay, treats SMS as source of truth over app state.
- **Bus operator** — small/mid VN coach operator (5-50 buses), admin runs day-to-day, staff handles boarding, currently uses phone + paper manifest or rival aggregator that doesn't fit their seat-by-call workflow.

## Why now
MoMo + ZaloPay penetration crossed mainstream in VN (2024-2025) and PDPD 2023 forces operators to formalize customer data handling — small operators now want a compliant SaaS instead of spreadsheets. Existing aggregators force seat-pick UX that mismatches operator reality, opening a workflow-first wedge.

## Unfair advantage
Local market insight — lived experience of VN intercity bus pain (operator opacity, phone-only booking, seat-map theater) means the core design choice (no customer seat-pick, operator confirms by call) is informed by reality, not imported from foreign aggregators that already failed this segment.

## Smallest version
Search + manual booking, no payment, no auth: static seeded trips for 1 pilot operator, customer fills phone+name → row written to DB → SMS to operator's notification phone → operator calls back to confirm seats/pickup. Skip MoMo, skip operator admin UI, skip account flows. ~1 week build.

## 30-day kill switch
Fewer than 3 VN bus operators sign a non-binding pilot LOI within 30 days from kickoff (2026-06-16) → kill. No supply side = no marketplace.

## Next
- Run `/project-classify` to size
- Then `/problem-validation` to evidence
