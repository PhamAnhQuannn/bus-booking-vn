---
depends-on: [071-qr-signed-token, 059-storage-s3-client, 058-notification-dispatcher-stub, 042-add-booking-buyer-email]
type: FEATURE
wave: 4
spec: [SYS08, S03, SYS10]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS08] / [S03]

## What to build

Move PDF generation **out of the request path** to an async job → S3 → signed URL. Today
`ticketPdf.tsx` + `app/api/bookings/[id]/ticket/route.ts:46-55` render the PDF **synchronously
inside the GET** (`renderToBuffer`, byte-proxied) — violates "PDF must not be in the request
path / no byte-proxying".

- On webhook-paid, enqueue a **PDF render job** (SYS10 job table/cron, run-locked): worker
  renders **once** (now including the QR from issue 071), uploads to S3 **once** (issue 059),
  stores the key on the booking, then enqueues an email (issue 058) linking the **signed URL**.
- The ticket GET route serves the **signed S3/CDN URL** (redirect/mint), not a server-rendered
  byte stream. Re-download mints a fresh signed URL for the stored key (generate-once).
- Email delivery uses `buyerEmail` (issue 042) + the notification dispatcher (issue 058),
  gated by `NOTIFY_STUB`.
- Keep ownership-scope + status-gate on the route (existing behavior).

## Acceptance criteria

- [ ] PDF rendered once by a job (not in the request); QR embedded.
- [ ] PDF uploaded to S3 once; key stored on booking; ticket route serves a signed URL (no
      byte-proxy).
- [ ] Re-download mints a fresh signed URL for the existing key (no re-render).
- [ ] Paid booking → email enqueued with the ticket link (NOTIFY_STUB-gated).
- [ ] Ownership + status gating preserved.

## Blocked by

- Blocked by `issues/071-qr-signed-token.md`, `issues/059-storage-s3-client.md`,
  `issues/058-notification-dispatcher-stub.md`, `issues/042-add-booking-buyer-email.md`

## User stories addressed

- [S03]/[SYS08] after payment, ticket QR + PDF by SMS + email; generate-once-store-once.
