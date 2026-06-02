---
depends-on: [007-customer-otp-auth, 002-hold-buyer-info-countdown]
type: AFK
---

## Parent PRD

`issues/prd.md`

## What to build

A signed-in customer should not re-type their identity at checkout. The buyer-info
step pre-fills name and phone from the authenticated account; the booking is then
stamped with the customer's id at creation (see `issues/031-attach-hardening-authed-booking.md`,
which shares the auth-aware seam).

Today `CustomerForm` only seeds the buyer-name from an in-memory `displayName` store
and the phone from `localStorage` (last-typed). The account's authoritative phone —
returned in the login/register response as `customer.phone` — is dropped on the client.

- Extend the in-memory auth store in `app/auth/register/page.tsx` with
  `getCustomerPhone()` / `setCustomerPhone()` beside the existing `displayName` store.
- Set both `displayName` and `customerPhone` from `json.customer` at **login**
  (`app/auth/login/page.tsx`) and **register** success.
- In `app/booking/customer/CustomerForm.tsx`, pre-fill the phone field from
  `getCustomerPhone()` when present, falling back to the `localStorage` last-typed
  phone for guests. Both fields stay editable.

## Acceptance criteria

- [ ] A logged-in customer who starts a booking sees the buyer-name and phone fields
      pre-filled from their account.
- [ ] A guest (no session) still sees the last-typed phone from `localStorage`; the
      name field is empty.
- [ ] Both pre-filled fields remain editable — the customer can override before submit.
- [ ] The account phone takes precedence over the `localStorage` phone when both exist.
- [ ] Known limitation documented inline: the in-memory store is lost on hard reload
      (identical to the existing `displayName`/access-token behavior). No new endpoint.

## Blocked by

- Blocked by `issues/007-customer-otp-auth.md`
- Blocked by `issues/002-hold-buyer-info-countdown.md`

## User stories addressed

- Reduces checkout friction for returning authenticated customers.
