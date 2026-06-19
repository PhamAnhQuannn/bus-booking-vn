# Admin Personas & Role Breakdown

> Supplements [stakeholder map](../stakeholder-map.md). Research date: 2026-06-17.

## Role 1: Operations Manager

| Attribute | Detail |
|---|---|
| Primary responsibilities | Operator onboarding approval, route activation, overbooking/cancellation exception handling, trip status override, fleet deactivation for safety violations |
| Key admin console tools | Operator management panel (approve/suspend/flag), trip management dashboard, booking exception queue (force-cancel/refund/reassign), system health monitor |
| Metrics tracked | Active operators, pending onboarding applications, booking exception rate (<0.5% target), cancellation rate by operator, overbooking incidents/week |
| Daily workflow | **Morning** --- Review overnight exception queue and failed payment retries. **Midday** --- Process operator onboarding applications (verify business registration certificate, route operation licenses per Decree 10/2020/ND-CP). **Afternoon** --- Handle escalated disputes and operator compliance flags. |
| Pain points | No OCR for operator document verification (manual review of business licenses), no bulk-action capability on exception queues, no audit trail for manual booking overrides, operator onboarding bottlenecked on single approver |

---

## Role 2: Finance/Accounting Manager

| Attribute | Detail |
|---|---|
| Primary responsibilities | Weekly/monthly payout runs, commission reconciliation, MISA e-invoice issuance, tax withholding (TNCN/TNDN), VAT reporting, refund ledger balancing |
| Key admin console tools | Payout queue dashboard, ledger reconciliation view (booking revenue vs. operator payable vs. platform commission), MISA push status monitor, refund approval queue, tax summary export (CSV/Excel) |
| Metrics tracked | Gross payout volume (VND), commission collected, refund as % of GMV (<2% target), MISA e-invoice acceptance rate (>99%), outstanding operator balance age |
| Daily workflow | **Morning** --- Check overnight payment settlements (VNPay T+1, MoMo T+1 reconciliation files), push pending e-invoices via MISA API, process refund queue. **Afternoon** --- Review payout holds and operator balance disputes. **Monthly** --- Generate per-operator commission statements, VAT declaration prep, withholding tax summary. |
| Compliance obligations | E-invoice issuance per Decree 123/2020/ND-CP + Circular 78/2021/TT-BTC, VAT declaration and filing, withholding tax for individual operators (PIT 1.5% on revenue), PDPL data retention requirements per Art. 15 Decree 13/2023/ND-CP |
| Pain points | MISA API rejection for incorrect tax codes (manual correction cycle), multi-operator reconciliation across separate VNPay/MoMo settlement files, manual cross-referencing of booking IDs to payout batches, no automated withholding tax calculation per operator type |

---

## Role 3: Compliance Officer

| Attribute | Detail |
|---|---|
| Primary responsibilities | PDPL compliance program management, consumer complaint SLA tracking (MTIP portal), regulatory filing with Ministry of Transport (marketplace registration), DSAR handling, anti-fraud screening |
| Key admin console tools | DSAR queue with statutory countdown timers (Access 10d, Correction 10d, Deletion 20d, Consent withdrawal 15d per PDPL 2025), consent audit log viewer, PII access log, complaint log with escalation workflow, regulatory filing calendar with deadline alerts |
| Metrics tracked | DSAR count + % resolved within statutory deadline (100% target), open MTIP complaints, data incident count (target: 0), operator document compliance rate, Terms of Service acceptance rate |
| Daily workflow | **Morning** --- Review new DSARs (data subject access requests), check MTIP consumer complaint portal for new filings. **Ongoing** --- Audit PII data access alerts, review operator document expiry warnings. **Quarterly** --- Privacy policy review against PDPL amendments, coordinate with Finance on data retention schedule alignment. |
| Key regulations | PDPL / Decree 13/2023/ND-CP (personal data protection), Decree 52/2024/ND-CP (electronic payments), Decree 10/2020/ND-CP (road transport business conditions), Consumer Protection Law 2023 (No. 19/2023/QH15, effective 1 Jul 2024; replaces Law 59/2010/QH12), E-Commerce Decree 52/2013/ND-CP |
| Pain points | No single-source PII audit log across all services, manual DSAR deadline tracking (no automated countdown/escalation), regulatory ambiguity on platform classification (transport provider vs. marketplace intermediary), fragmented compliance tooling |

---

## Role 4: Customer Support Agent

| Attribute | Detail |
|---|---|
| Primary responsibilities | Booking modification and cancellation, refund processing, complaint escalation to operations/operator, customer identity verification (phone OTP), lost-and-found coordination with operators |
| Key admin console tools | Customer booking lookup (by phone number or booking reference), booking timeline view (hold - payment - confirmed - departed - completed), one-click refund initiation, operator contact directory, canned Vietnamese response templates, Zalo OA integration for chat |
| Metrics tracked | First response time <2hr (Zalo) / <24hr (email), resolution time <48hr, CSAT >4.2/5, refund processing <3 business days, escalation rate to operations (<10%) |
| Daily workflow | **Morning** --- Triage Zalo OA and email inbox, prioritize same-day trip issues (departure within 4hr). **Afternoon** --- Process pending refunds, follow up on operator confirmations for modification requests, update canned response library. |
| Pain points | No unified inbox (Zalo + email + phone handled in separate tools), manual booking lookup requires exact reference or phone, slow operator confirmation turnaround (no SLA enforcement), refund exceptions require multi-day escalation chain through operations and finance |
