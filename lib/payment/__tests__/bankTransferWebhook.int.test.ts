/**
 * Integration test — bank_transfer webhook end-to-end round trip (Bug A regression).
 *
 * The whole point: drive a REAL generateBookingRef() through the REAL adapter's memo
 * extraction and the REAL processPaymentWebhook → prisma.booking.findUnique lookup, and
 * assert the booking actually flips to `paid`. This is the exact call chain the
 * case-mismatch bug (lowercase `bb-` rebuilt vs uppercase-stored `BB-`) silently broke
 * for a year, invisible to every existing unit test because they asserted a hand-typed
 * expected string on both sides.
 *
 * Against the pre-#322 adapter this test FAILS (booking stays awaiting_payment, 0
 * PaymentEvents). Against the fixed adapter it passes.
 *
 * Requires a real PostgreSQL DB. DB-gated — runs in CI / `pnpm vitest:int`, not locally.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/core/db/client';
import {
  processPaymentWebhook,
  getBankTransferAdapter,
  recordUnmatchedPaymentEvent,
} from '@/lib/payment';
import { generateBookingRef } from '@/lib/booking/bookingRef';

const GROSS = 100_000; // VND — 6% platform fee = 6_000
const EXPECTED_FEE = BigInt(6_000);

let operatorId: string;
let routeId: string;
let busId: string;
let tripId: string;
let bookingId: string;
let bookingRef: string; // a REAL generateBookingRef() value: BB-YYYY-xxxx-yyyy
let providerTxnId: string;
let feeConfigId: string | null = null;

/** providerTxnIds of orphan rows this file creates — cleaned up by key, not relation. */
const orphanTxnIds: string[] = [];
/** Bookings created inside tests (beyond the beforeAll one), for cleanup. */
const extraBookingIds: string[] = [];
const allBookingIds = () => [bookingId, ...extraBookingIds];

/**
 * Build the SePay webhook body the way a Vietnamese bank actually delivers it: the
 * VietQR addInfo (the hyphenated ref) arrives in `content` with the hyphens stripped,
 * surrounded by bank noise.
 */
function sepayRawBody(): string {
  const strippedMemo = bookingRef.replace(/-/g, ''); // BB2026xxxxyyyy
  return JSON.stringify({
    id: Number(providerTxnId),
    gateway: 'Sacombank',
    transactionDate: '2026-07-23 14:01:13',
    accountNumber: '030976167267',
    subAccount: null,
    transferType: 'in',
    transferAmount: GROSS,
    accumulated: 0,
    code: null,
    content: `${strippedMemo} CKN 458949 D2K5349G - NGUYEN TUAN KIET`,
    referenceCode: 'VN0011911FT26204HJH15',
    description: `BankAPINotify ${strippedMemo} CKN 458949`,
  });
}

beforeAll(async () => {
  providerTxnId = String(Date.now());

  const op = await prisma.operator.create({
    data: {
      legalName: 'BankTransfer IntTest Op',
      contactPhone: '+8490xxxxxx6',
      contactEmail: 'bt-int@test.invalid',
      status: 'APPROVED',
    },
  });
  operatorId = op.id;

  const bus = await prisma.bus.create({
    data: { operatorId, capacity: 10, licensePlate: 'TEST-BT-001', busType: 'coach' },
  });
  busId = bus.id;

  const route = await prisma.route.create({
    data: { origin: 'BT Origin', destination: 'BT Destination', operatorId, durationMinutes: 120 },
  });
  routeId = route.id;

  const trip = await prisma.trip.create({
    data: {
      routeId,
      busId,
      operatorId,
      departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      price: GROSS,
      status: 'scheduled',
      salesClosed: false,
    },
  });
  tripId = trip.id;

  bookingId = randomUUID();
  bookingRef = generateBookingRef(); // REAL generator — uppercase BB-, lowercase segments
  await prisma.booking.create({
    data: {
      id: bookingId,
      bookingRef,
      confirmationToken: randomUUID().replace(/-/g, '') + 'bt',
      tripId,
      buyerName: 'BankTransfer Buyer',
      buyerPhone: '+8490xxxxxx5',
      ticketCount: 1,
      totalVnd: GROSS,
      paymentMethod: 'bank_transfer',
      status: 'awaiting_payment',
    },
  });

  // Self-contained FeeConfig so the paid-ledger step resolves (the seed normally
  // provides a covering global row; create one only if absent).
  const existing = await prisma.feeConfig.findFirst({ where: { operatorId: null, effectiveTo: null } });
  if (!existing) {
    const fc = await prisma.feeConfig.create({
      data: { operatorId: null, ratePpm: 60000, effectiveFrom: new Date('2020-01-01T00:00:00Z') },
    });
    feeConfigId = fc.id;
  }
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

  // Orphan rows (bookingId NULL) are unreachable through a `booking` relation
  // filter — delete them by their own key.
  await prisma.paymentEvent.deleteMany({ where: { providerTxnId: { in: orphanTxnIds } } });
  await prisma.paymentEvent.deleteMany({ where: { bookingId: { in: allBookingIds() } } });
  await prisma.notificationLog.deleteMany({ where: { bookingId: { in: allBookingIds() } } });
  await prisma.booking.deleteMany({ where: { id: { in: allBookingIds() } } });
  await prisma.trip.deleteMany({ where: { routeId } });
  await prisma.route.delete({ where: { id: routeId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  if (feeConfigId) await prisma.feeConfig.delete({ where: { id: feeConfigId } });
  await prisma.operator.delete({ where: { id: operatorId } });
  await prisma.$disconnect();
});

describe('bank_transfer webhook round trip (Bug A regression)', () => {
  it('confirms a booking whose memo arrived hyphen-stripped — real ref → real findUnique → paid', async () => {
    const res = await processPaymentWebhook({
      rawBody: sepayRawBody(),
      gateway: getBankTransferAdapter(),
      adapter: 'bank_transfer',
      proto: 'https',
      host: 'test.invalid',
    });
    expect(res.status).toBe(200);

    // The load-bearing assertion: the booking actually flipped to paid. Pre-#322 this
    // was `awaiting_payment` (findUnique missed on case).
    const row = await prisma.booking.findUnique({ where: { id: bookingId }, select: { status: true } });
    expect(row?.status).toBe('paid');

    // Exactly one PaymentEvent recorded for this real SePay txn.
    const events = await prisma.paymentEvent.findMany({ where: { bookingId } });
    expect(events.length).toBe(1);
    expect(events[0].adapter).toBe('bank_transfer');
    expect(events[0].providerTxnId).toBe(providerTxnId);

    // Two double-entry ledger rows at booking-paid.
    const entries = await prisma.ledgerEntry.findMany({ where: { bookingId }, orderBy: { type: 'asc' } });
    expect(entries.length).toBe(2);
    const credit = entries.find((e) => e.type === 'booking_credit');
    const fee = entries.find((e) => e.type === 'platform_fee');
    expect(credit?.amount).toBe(BigInt(GROSS));
    expect(fee?.amount).toBe(-EXPECTED_FEE);
  });

  it('control: the stored ref is case-sensitive — a lowercased ref does NOT match (the bug)', async () => {
    // Proves the environment that made Bug A possible: Postgres text equality is
    // case-sensitive, so the old lowercase `bb-...` rebuild genuinely could not match.
    const byLower = await prisma.booking.findUnique({ where: { bookingRef: bookingRef.toLowerCase() } });
    const byExact = await prisma.booking.findUnique({ where: { bookingRef } });
    expect(byLower).toBeNull();
    expect(byExact?.id).toBe(bookingId);
  });
});

/**
 * Bug B: an unmatchable transfer must leave an ORPHAN PaymentEvent (bookingId NULL)
 * rather than zero DB trace. These run against real Postgres because the migration
 * making the column nullable is the thing under test — no mock can prove the column
 * accepts NULL, and the redelivery case turns on a real unique-constraint violation.
 */
describe('bank_transfer webhook — orphan persistence (Bug B)', () => {
  it('records an orphan when the memo carries no bookingRef at all', async () => {
    const txnId = String(Date.now() + 1);
    orphanTxnIds.push(txnId);
    const rawBody = JSON.stringify({
      id: Number(txnId),
      gateway: 'Sacombank',
      transactionDate: '2026-07-23 14:05:00',
      accountNumber: '030976167267',
      subAccount: null,
      transferType: 'in',
      transferAmount: GROSS,
      accumulated: 0,
      code: null,
      content: 'CK tu NGUYEN VAN A', // customer never typed the memo
      referenceCode: 'VN0011911FT26204HJH16',
      description: 'BankAPINotify',
    });

    // The REAL adapter decides this is unmatched-but-recordable; the route hands
    // exactly that providerTxnId to the helper. One producer, two consumers.
    const verified = getBankTransferAdapter().verifyWebhook(rawBody);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.unmatched).toEqual({ providerTxnId: txnId });

    await recordUnmatchedPaymentEvent({
      adapter: 'bank_transfer',
      providerTxnId: verified.unmatched!.providerTxnId,
      rawBody,
    });

    const orphan = await prisma.paymentEvent.findFirst({
      where: { adapter: 'bank_transfer', providerTxnId: txnId },
    });
    expect(orphan).not.toBeNull();
    expect(orphan!.bookingId).toBeNull();
    expect(orphan!.rawBody).toBe(rawBody);
  });

  it('records an orphan when the ref parses but no such booking exists', async () => {
    // A REAL generated ref that was never inserted — processPaymentWebhook's
    // booking_not_found branch. Pre-fix this returned 200 and wrote nothing.
    const strayRef = generateBookingRef();
    const txnId = String(Date.now() + 2);
    orphanTxnIds.push(txnId);
    const rawBody = JSON.stringify({
      id: Number(txnId),
      gateway: 'Sacombank',
      transactionDate: '2026-07-23 14:06:00',
      accountNumber: '030976167267',
      subAccount: null,
      transferType: 'in',
      transferAmount: GROSS,
      accumulated: 0,
      code: null,
      content: `${strayRef.replace(/-/g, '')} CKN 999999`,
      referenceCode: 'VN0011911FT26204HJH17',
      description: 'BankAPINotify',
    });

    const res = await processPaymentWebhook({
      rawBody,
      gateway: getBankTransferAdapter(),
      adapter: 'bank_transfer',
      proto: 'https',
      host: 'test.invalid',
    });
    expect(res.status).toBe(200); // unchanged — no enumeration signal

    const orphan = await prisma.paymentEvent.findFirst({
      where: { adapter: 'bank_transfer', providerTxnId: txnId },
    });
    expect(orphan).not.toBeNull();
    expect(orphan!.bookingId).toBeNull();
  });

  it('a redelivery whose ref now resolves CLAIMS the orphan and pays the booking', async () => {
    // SePay redelivers, or an admin fixes the booking after the fact. Pre-fix the
    // insert hit @@unique([adapter, providerTxnId]) → P2002 → "already handled" 200
    // no-op, and the payment could never be applied.
    const txnId = String(Date.now() + 3);
    orphanTxnIds.push(txnId);
    const ref = generateBookingRef();
    const rawBody = JSON.stringify({
      id: Number(txnId),
      gateway: 'Sacombank',
      transactionDate: '2026-07-23 14:07:00',
      accountNumber: '030976167267',
      subAccount: null,
      transferType: 'in',
      transferAmount: GROSS,
      accumulated: 0,
      code: null,
      content: `${ref.replace(/-/g, '')} CKN 888888`,
      referenceCode: 'VN0011911FT26204HJH18',
      description: 'BankAPINotify',
    });

    // 1st delivery: booking does not exist yet → orphan.
    await recordUnmatchedPaymentEvent({ adapter: 'bank_transfer', providerTxnId: txnId, rawBody });
    const before = await prisma.paymentEvent.findFirst({
      where: { adapter: 'bank_transfer', providerTxnId: txnId },
    });
    expect(before!.bookingId).toBeNull();

    // The booking now exists under that ref.
    const lateBookingId = randomUUID();
    extraBookingIds.push(lateBookingId);
    await prisma.booking.create({
      data: {
        id: lateBookingId,
        bookingRef: ref,
        confirmationToken: randomUUID().replace(/-/g, '') + 'bx',
        tripId,
        buyerName: 'Redelivery Buyer',
        buyerPhone: '+8490xxxxxx7',
        ticketCount: 1,
        totalVnd: GROSS,
        paymentMethod: 'bank_transfer',
        status: 'awaiting_payment',
      },
    });

    // 2nd delivery of the IDENTICAL body.
    const res = await processPaymentWebhook({
      rawBody,
      gateway: getBankTransferAdapter(),
      adapter: 'bank_transfer',
      proto: 'https',
      host: 'test.invalid',
    });
    expect(res.status).toBe(200);

    const row = await prisma.booking.findUnique({
      where: { id: lateBookingId },
      select: { status: true },
    });
    expect(row?.status).toBe('paid');

    // The orphan was CLAIMED, not duplicated.
    const events = await prisma.paymentEvent.findMany({
      where: { adapter: 'bank_transfer', providerTxnId: txnId },
    });
    expect(events.length).toBe(1);
    expect(events[0].bookingId).toBe(lateBookingId);
  });
});
