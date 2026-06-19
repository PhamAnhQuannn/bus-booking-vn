# Bus Booking Platform — System Design

> Full consolidated document: [`../system-design-complete.md`](../system-design-complete.md)

## How to Read

### Prerequisites

- Basic programming concepts (variables, functions, HTTP requests)
- Familiarity with databases (what a table and a row are)
- Helpful but not required: SQL, TypeScript, React

### Suggested Reading Order

Don't read front-to-back. Follow this path:

| Phase | Sections | What You Learn |
|-------|----------|---------------|
| 1. The problem | 0, 1, 2 | What we're building, for whom, and what quality bar we need |
| 2. The skeleton | 3, 23 | Architecture (monolith vs microservices) and deployment (serverless) |
| 3. The data | 6 | What we store, how entities relate, why PostgreSQL |
| 4. The core flows | 12, 13 | Search → Hold → Book — the customer's journey through the system |
| 5. The money | 9, 10 | Payment → Ledger — the critical path where correctness is non-negotiable |
| 6. The hard problems | 11 | Concurrency, race conditions, failure modes — what makes systems engineering hard |
| 7. Everything else | 7, 8, 14–22, 24–26 | API design, auth, notifications, security, ops, scaling |
| 8. Reference | 27 | Glossary — look up any term you forgot |

### Conventions

- **Bold terms** are defined inline on first use (e.g., **ACID** in Section 6.1)
- `Code blocks` show real schema, query, or configuration examples from the codebase
- Tables compare alternatives (technology choices, race condition solutions, cost projections)
- Each section is self-contained — forward references link to the relevant subfolder
- > Blockquotes like this mark **trade-off callouts** — decisions where we gained something but gave up something else

---

## Table of Contents

- [0. Problem Statement](00-problem-statement/)
- [1. Functional Requirements](01-requirements-functional/)
- [2. Non-Functional Requirements](02-requirements-nonfunctional/)
- [3. System Architecture](03-architecture/) (§3.1–3.5)
  - [3.6 Frontend Architecture & Design System](03a-frontend-design-system/)
  - [3.7 Accessibility Architecture](03b-accessibility/)
- [4. Networking & Traffic Flow](04-networking/)
- [5. Capacity Estimation](05-capacity/)
- [6. Data Model & Storage](06-data-model/)
- [7. API Design](07-api-design/) (§7.1–7.6)
  - [7.7 Form Validation & Multi-Step Flows](07a-form-validation/)
- [8. Identity & Access Control](08-auth/)
- [9. Payment System](09-payment/)
- [10. Money Correctness & Ledger](10-money-ledger/)
- [11. Concurrency & Race Conditions](11-concurrency/)
- [12. Search & Discovery](12-search/)
- [13. Booking & Hold Flow](13-booking/)
- [14. Ticketing (QR / PDF)](14-ticketing/)
- [15. Notification System](15-notifications/)
- [16. Background Jobs & Scheduling](16-background-jobs/)
- [17. File & Document Storage](17-file-storage/)
- [18. Security](18-security/)
- [19. Compliance & Data Privacy](19-compliance/)
- [20. Observability & Monitoring](20-observability/)
- [21. Configuration & Feature Flags](21-feature-flags/)
- [22. Charter / Contract Rental Subsystem](22-charter/)
- [23. Deployment & Infrastructure](23-deployment/)
- [24. Disaster Recovery & Rollback](24-disaster-recovery/)
- [25. Testing Strategy](25-testing/)
- [26. Evolution & Scale Path](26-evolution/)
- [27. Glossary](27-glossary/)
