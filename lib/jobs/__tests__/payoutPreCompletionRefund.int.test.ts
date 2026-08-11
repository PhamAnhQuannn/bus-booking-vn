/**
 * Integration test — #516: a PRE-completion refund must NOT reduce the frozen payout net.
 *
 * BUG (money-flow audit review): processPayouts' clawback `delta` query summed
 * refund_debit/chargeback/adjustment for ALL of a trip's bookings with no time filter.
 * A booking refunded BEFORE trip completion is already excluded from the frozen
 * `Payout.net`, so summing its refund_debit here subtracted the same fare a second time —
 * underpaying the operator, or (if it exceeds net) withholding the whole legitimate payout.
 *
 * FIX: the delta only counts clawbacks created AFTER the net was frozen (payout.createdAt).
 * This test freezes net for the KEPT booking only, records the refunded booking's
 * refund_debit BEFORE the payout row, and asserts the sweep disburses the FULL frozen net.
 *
 * DB-gated — run with: pnpm vitest:int
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/core/db/client';
import { appendLedgerEntry, getOperatorBalance } from '@/lib/ledger';
import { refundOut } from '@/lib/payment';
import { processPayouts } from '@/lib/jobs';

let operatorId: string;
let routeId: string;
let busId: string;
let tripId: string;
let keptBookingId: string;
let refundedBookingId: string;
let payoutId: string;

const GROSS = 500_000;
const FEE = 30_000;
const NET = GROSS - FEE; // 470_000 — frozen for the KEPT booking only

async function dropStrayRequestedPayouts() {
  const strays = await prisma.payout.findMany({ where: { status: 'requested' }, select: { id: true } });
  const ids = strays.map((p) => p.id);
  if (!ids.length) return;
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "ledger_entry_no_update" ON "LedgerEntry"');
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "ledger_entry_no_delete" ON "LedgerEntry"');
  await prisma.ledgerEntry.deleteMany({ where: { payoutId: { in: ids } } });
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER "ledger_entry_no_update" BEFORE UPDATE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"()'
  );
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER "ledger_entry_no_delete" BEFORE DELETE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"()'
  );
  await prisma.payout.deleteMany({ where: { id: { in: ids } } });
}

beforeAll(async () => {
  await dropStrayRequestedPayouts();

  const op = await prisma.operator.create({
    data: { legalName: 'PreRefund Op', contactPhone: '+8490xxxxxx3', contactEmail: 'prerefund@test.invalid' },
  });
  operatorId = op.id;
  await prisma.payoutAccount.create({
    data: { operatorId, bankName: 'Test Bank', accountNumber: '0123456789', accountHolderName: 'PreRefund Op', verifiedAt: new Date(), verifyMethod: 'name_match' },
  });
  const bus = await prisma.bus.create({ data: { operatorId, capacity: 20, licensePlate: 'TEST-PRE-001', busType: 'coach' } });
  busId = bus.id;
  const route = await prisma.route.create({ data: { origin: 'PRE Origin', destination: 'PRE Destination', operatorId, durationMinutes: 300 } });
  routeId = route.id;
  const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const trip = await prisma.trip.create({
    data: { routeId, busId, operatorId, departureAt: past, price: GROSS, status: 'completed', salesClosed: true, completedAt: past },
  });
  tripId = trip.id;

  // KEPT booking — its net IS the frozen payout net.
  keptBookingId = randomUUID();
  await prisma.booking.create({
    data: {
      id: keptBookingId, bookingRef: `BB-2016-${randomUUID().slice(0, 4)}-kp1`, confirmationToken: randomUUID().replace(/-/g, '') + 'kp',
      tripId, buyerName: 'Kept Buyer', buyerEmail: 'kept@test.invalid', buyerPhone: '+8490xxxxxx2',
      ticketCount: 1, totalVnd: GROSS, paymentMethod: 'bank_transfer', paymentExternalRef: 'stub_inbound_kept', status: 'completed',
    },
  });
  await appendLedgerEntry({ operatorId, bookingId: keptBookingId, type: 'booking_credit', amountMinor: BigInt(GROSS), sourceEventId: `booking_credit:${keptBookingId}` });
  await appendLedgerEntry({ operatorId, bookingId: keptBookingId, type: 'platform_fee', amountMinor: BigInt(-FEE), sourceEventId: `platform_fee:${keptBookingId}` });

  // REFUNDED-PRE-COMPLETION booking — credited then refunded BEFORE the payout row exists.
  refundedBookingId = randomUUID();
  await prisma.booking.create({
    data: {
      id: refundedBookingId, bookingRef: `BB-2016-${randomUUID().slice(0, 4)}-rf1`, confirmationToken: randomUUID().replace(/-/g, '') + 'rf',
      tripId, buyerName: 'Refunded Buyer', buyerEmail: 'refunded@test.invalid', buyerPhone: '+8490xxxxxx4',
      ticketCount: 1, totalVnd: GROSS, paymentMethod: 'bank_transfer', paymentExternalRef: 'stub_inbound_refunded', status: 'paid', paidAt: past,
    },
  });
  await appendLedgerEntry({ operatorId, bookingId: refundedBookingId, type: 'booking_credit', amountMinor: BigInt(GROSS), sourceEventId: `booking_credit:${refundedBookingId}` });
  await appendLedgerEntry({ operatorId, bookingId: refundedBookingId, type: 'platform_fee', amountMinor: BigInt(-FEE), sourceEventId: `platform_fee:${refundedBookingId}` });
  // Refund it NOW — its refund_debit is created BEFORE the payout row below.
  await refundOut({ bookingId: refundedBookingId, amountMinor: GROSS, reason: 'operator_cancel', idempotencyKey: `cancel:${tripId}:${refundedBookingId}` });

  // The auto per-trip Payout — net frozen to the KEPT booking only (refunded one excluded
  // at completion). createdAt = now() is AFTER the pre-completion refund above.
  const payout = await prisma.payout.create({
    data: { tripId, operatorId, gross: BigInt(GROSS), platformFee: BigInt(FEE), net: BigInt(NET), status: 'requested', scheduledAt: past },
    select: { id: true },
  });
  payoutId = payout.id;
});

afterAll(async () => {
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "ledger_entry_no_update" ON "LedgerEntry"');
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "ledger_entry_no_delete" ON "LedgerEntry"');
  await prisma.ledgerEntry.deleteMany({ where: { operatorId } });
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER "ledger_entry_no_update" BEFORE UPDATE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"()'
  );
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER "ledger_entry_no_delete" BEFORE DELETE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"()'
  );
  await prisma.payout.deleteMany({ where: { operatorId } });
  await prisma.payoutAccount.deleteMany({ where: { operatorId } });
  await prisma.notificationLog.deleteMany({ where: { bookingId: { in: [keptBookingId, refundedBookingId] } } });
  await prisma.booking.deleteMany({ where: { tripId } });
  await prisma.trip.deleteMany({ where: { routeId } });
  await prisma.route.delete({ where: { id: routeId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  await prisma.operator.delete({ where: { id: operatorId } });
  await prisma.$disconnect();
});

describe('#516 — pre-completion refund must not double-subtract from the frozen net', () => {
  it('disburses the full frozen net (the pre-completion refund is already excluded)', async () => {
    await prisma.$transaction((tx) => processPayouts(tx));

    const payout = await prisma.payout.findUniqueOrThrow({ where: { id: payoutId } });
    // FIX: the pre-completion refund_debit is NOT re-subtracted → full net disbursed.
    expect(payout.status).toBe('paid');
    expect(payout.net).toBe(BigInt(NET));

    const bal = await getOperatorBalance(operatorId);
    expect(bal.paidOut).toBe(BigInt(NET));
  });
});
