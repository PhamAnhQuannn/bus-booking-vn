---
name: data-export
description: GDPR/DSAR-compliant user data export endpoint + procedure. User downloads their data as JSON; admin runs delete-on-request. Use when user says "GDPR", "DSAR", "data export", "user data download", "right to access", "right to erasure", "/data-export", or before EU launch / privacy review. Writes docs/compliance/data-export.md + endpoint files for your stack.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 8h
---

# Data Export

## Why you'd care

The first DSAR request after EU launch lands on a Friday afternoon and triggers a two-week scramble to manually export user data across 14 tables — and the 30-day GDPR deadline runs out before the engineering team finishes auditing what's actually personal. Shipping the export + erasure endpoints before the first request lands is what compresses that incident from a regulatory exposure into a 200-millisecond API call, and it doubles as the diligence answer when an enterprise prospect asks "show me your DSAR runbook."

GDPR Article 15 (right of access) + Article 17 (right to erasure) endpoints. Authenticated user can download all data we hold about them as JSON. Admin can hard-delete on user request.

Stack worked here: Next.js + Prisma + NextAuth. Adapt the code blocks for your stack (FastAPI + SQLAlchemy, Rails, Express + Drizzle, etc.). The entity list is project-specific — enumerate every user-linkable table in your schema.

## When This Skill Applies

Activate when:
- User says "GDPR", "DSAR", "data export", "user data download", "right to access", "right to erasure", "delete account", "/data-export"
- Before EU launch / accepting EU customers
- Privacy review milestone
- Customer request received (manual handling fallback)
- Audit / compliance check

Pairs with `/threat-model` (PII inventory), `/data-model-design` (table inventory), `/privacy-impact` (DPIA cross-ref).

## Prerequisites

- Auth working — user identifies themselves.
- Full PII inventory — every table that stores user-linkable data must be enumerated.
- Decision on retention policy: how long after delete request before tombstone purge?
- Decision on legally-required retention: payment records often must be retained N years for tax — anonymize instead of delete.
- Email pipeline — to send "your data is ready" link if export is async.

## Entity Inventory (generic shape)

Every project exports the same shape, varying only in the owned-resource tables. The canonical inventory:

1. **User profile** — id, email, name, phone (or whatever PII is on the user row); exclude `passwordHash` and internal flags.
2. **Every user-owned-resource table** — rows where `userId` (or session-user FK) appears. Examples:
   - Restaurant booking: `Booking` (+ joined `Restaurant.name`, `Table.number`)
   - SaaS workspace: `Workspace`, `Membership`, `Document`
   - Marketplace: `Listing`, `Order`, `Message`
   - Fintech: `Account`, `Transfer`, `Card` (last-4 only)
   - Content: `Post`, `Comment`, `Reaction`
3. **Payment records** — id, amount, currency, status, createdAt. Exclude processor-internal IDs and card details (those live with Stripe/Adyen, never with you).
4. **Audit log** — every `DataRequestLog` row for this user (request history).

## Steps

1. **Inventory user-linked tables.** Walk the schema file — every `userId` FK or denormalized PII (email, phone, name).
2. **Decide sync vs async export.** Sync (immediate JSON download) works if data is small. Async (queue + email link) needed for users with thousands of rows.
3. **Build export endpoint.** `GET /api/account/export` (or your stack's equivalent) — auth required, returns JSON of all user data.
4. **Build delete endpoint.** `POST /api/account/delete` — auth + double confirm. Defines what's hard-deleted vs anonymized.
5. **Anonymization strategy** for legally-retained records (payments). Keep row, scrub PII fields.
6. **Audit trail.** Log every export + delete to `DataRequestLog` table with timestamp, user ID, type, IP.
7. **Document procedure.** `docs/compliance/data-export.md` — request flow + admin manual handling for edge cases.
8. **UI surface.** Account settings page → "Export my data" + "Delete account" buttons.
9. **Test with real user fixture.** Verify export captures all expected tables; delete leaves no orphan rows.

## Output Format — `app/api/account/export/route.ts`

```typescript
// Next.js + Prisma + NextAuth example.
// Substitute the owned-resource tables (Booking/Workspace/Listing/Account/Post) for your project.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Audit log first (so request is logged even if export later fails)
  await prisma.dataRequestLog.create({
    data: { userId, type: "export", requestedAt: new Date() },
  });

  // Generic shape: user profile + every owned-resource table + payment records.
  // The `ownedResource` block below is project-specific — repeat per table.
  const [user, ownedResources, payments] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        createdAt: true,
        // Exclude: passwordHash, internal flags
      },
    }),
    // EXAMPLE — restaurant vertical (Booking + joined Restaurant + Table).
    // SaaS would query Workspace + Membership + Document.
    // Marketplace would query Listing + Order + Message.
    // Fintech would query Account + Transfer + Card (last-4 only).
    prisma.booking.findMany({
      where: { userId },
      include: {
        restaurant: { select: { name: true, slug: true } },
        table: { select: { number: true } },
      },
    }),
    prisma.payment.findMany({
      where: { userId },
      select: {
        id: true,
        amountCents: true,
        currency: true,
        status: true,
        createdAt: true,
        // Exclude: processor IDs (internal), card details (never stored)
      },
    }),
  ]);

  const data = {
    exportedAt: new Date().toISOString(),
    schema: "1.0",
    user,
    ownedResources,
    payments,
    notice:
      "This is the full record of personal data we hold about you. Payment card details are never stored — they are held by your card processor under separate Terms.",
  };

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="export-${userId}-${Date.now()}.json"`,
    },
  });
}
```

## Output Format — `app/api/account/delete/route.ts`

```typescript
// Next.js + Prisma + NextAuth example.
// Substitute the owned-resource tables for your project (Workspace/Listing/Account/Post).
import { NextResponse } from "next/server";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const deleteSchema = z.object({
  confirmEmail: z.string().email(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = deleteSchema.parse(await req.json());
  if (body.confirmEmail.toLowerCase() !== session.user.email.toLowerCase()) {
    return NextResponse.json({ error: "Email confirmation mismatch" }, { status: 400 });
  }

  const userId = session.user.id;

  await prisma.$transaction(async (tx) => {
    await tx.dataRequestLog.create({
      data: { userId, type: "delete", requestedAt: new Date() },
    });

    // Anonymize payments (legally retained for tax / chargeback period)
    await tx.payment.updateMany({
      where: { userId },
      data: { userId: null, anonymizedAt: new Date() },
    });

    // Cancel future commitments (example: future bookings; SaaS = active subscriptions; marketplace = open orders)
    await tx.booking.updateMany({
      where: { userId, at: { gte: new Date() }, status: "confirmed" },
      data: { status: "canceled", canceledReason: "user-deleted-account" },
    });

    // Anonymize past owned-resource rows we want to retain for aggregate analytics
    await tx.booking.updateMany({
      where: { userId, at: { lt: new Date() } },
      data: { userId: null, anonymizedAt: new Date() },
    });

    // Hard-delete user
    await tx.user.delete({ where: { id: userId } });
  });

  await signOut({ redirect: false });

  return NextResponse.json({ ok: true });
}
```

## Output Format — `docs/compliance/data-export.md`

```markdown
---
last-updated: YYYY-MM-DD
last-tested: YYYY-MM-DD
status: implemented | tested | stale (test > 6 months)
gdpr-articles: 15, 17
---

# Data Export & Deletion Procedure

## Right of Access (GDPR Art. 15)

User-facing path: Account → Privacy → "Export my data" → instant JSON download.
- Endpoint: `GET /api/account/export`
- Format: JSON
- Latency: < 5s for typical user (< 100 owned-resource rows)

## Right of Erasure (GDPR Art. 17)

User-facing path: Account → Privacy → "Delete account" → confirm email → submit.
- Endpoint: `POST /api/account/delete`
- Effect:
  - User row hard-deleted
  - Payments anonymized (`userId` → null), retained 7 years (tax compliance)
  - Past owned-resource rows anonymized
  - Future commitments canceled (counterparties notified separately where applicable)

## What we export

| Table | Fields | Notes |
|-------|--------|-------|
| User | id, email, name, phone, createdAt | passwordHash excluded |
| <Owned-resource> (e.g. Booking / Workspace / Listing / Account) | all, joined with referenced names | full history |
| Payment | id, amountCents, currency, status, createdAt | Processor IDs excluded; card details never stored |

## What we don't store

- Card numbers (held by payment processor; refer user to processor ToS for that data)
- IP addresses (not logged at app level; CDN logs separate)
- Server logs (rolling 30 days, not user-keyed)

## Manual / edge-case handling

| Scenario | Procedure |
|----------|-----------|
| User can't log in (e.g. lost email access) | Verify identity via payment-receipt match → admin runs export query → email link |
| User wants partial export | Self-serve includes all; partial = manual SQL |
| Legal hold on account (chargeback dispute open) | Block delete until dispute resolved; document in `DataRequestLog.notes` |
| User deleted, then asks for export | After hard-delete, no export possible — informed up front in delete confirm dialog |

## Audit

Every export / delete logs to `DataRequestLog`:
- userId (or formerly-was, for delete)
- type: export | delete
- requestedAt
- IP (if available)
- adminOverride (true if admin ran on behalf of user)

Retain `DataRequestLog` 7 years per GDPR audit trail expectations.

## Test cadence

Quarterly: log in as test user, run export, run delete. Verify:
- Export JSON has expected shape + completeness
- Delete leaves no orphan rows (FK violations would fail at delete time anyway, but verify analytics)
- `DataRequestLog` row written

## Out of Scope

- Right to rectification (Art. 16) — covered by normal account-edit flows
- Right to portability (Art. 20) — JSON export satisfies; structured format
- Data Subject Access Requests via email (DSAR-by-email) — direct user to self-serve; manual fallback documented above

## Auto-chain

- New PII column added to schema → must update export query in same PR
- New table linked to user → add to export
- Privacy impact change → `/privacy-impact` revisit
- Customer DSAR via email → log in `DataRequestLog`, run admin export
```

## Boundaries

- **Self-serve first.** Email-based DSAR handling doesn't scale — endpoints first, manual fallback documented.
- **Hard-delete user; anonymize regulated data.** Don't lose tax records by hard-deleting payments.
- **Confirm before delete.** Email re-entry confirmation. Irreversible action.
- **Never expose other users' data.** Auth scoping applies — only return rows where `userId = session.user.id`.
- **Audit log every request.** Required for GDPR compliance proof.
- **Don't store more than declared.** If export shape adds a new field, that field needed disclosure in privacy policy first.

## Re-run Behavior

- If endpoints exist, audit the schema file for new user-linked columns since last update.
- Stale if `last-tested` > 6 months ago — prompt drill.
- Cross-check fields against `/threat-model` PII inventory.

## Auto-chain

- New PII column → update export same PR
- New user-linked table → update export same PR
- Schema change touching User → re-test deletion (FK cascade behavior)
- DSAR received via email → log + run admin export
- Pre-EU-launch checklist → must have implemented + tested status

## Example Trigger

User: "we need GDPR export and delete endpoints before going live in EU"
→ Inventory user-linked tables, build `/api/account/export` + `/api/account/delete`, anonymization for payments, audit log, write `docs/compliance/data-export.md`, add UI buttons in account settings.
