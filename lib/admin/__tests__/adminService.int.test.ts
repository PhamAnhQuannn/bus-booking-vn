/**
 * Integration tests for Issue 020 platform-admin CLI service cores.
 *
 * Run with: pnpm vitest:int
 *
 * Exercises the lib/admin/* cores directly against the test DB using the same
 * reuse-by-param signature the CLI wrappers use (each core takes the Prisma
 * client as its first argument). The CLI scripts themselves are thin arg-parse
 * + dry-run-gate shells over these cores; AC4 (no --confirm → print + exit
 * non-zero + no mutation) lives in scripts/admin/* and is verified by the
 * dry-run code path there, not here.
 *
 * Covers:
 *  - AC1 createOperator: bootstrap admin OperatorUser (role=admin,
 *    requiresPasswordChange=true), phone normalized, working login (the SMS'd
 *    temp password verifies against the stored hash), NotificationLog written
 *    WITHOUT the temp password, duplicate phone → phone_in_use.
 *  - AC2 disableOperator: Operator + every OperatorUser disabledAt set, live
 *    sessions revoked, scheduled trips sales-closed, in-flight paid booking
 *    untouched, second call → already_disabled, unknown id → operator_not_found.
 *  - AC3 resetOperatorAdminPassword: fresh hash (new temp pw verifies),
 *    requiresPasswordChange=true, sessions revoked, unknown id →
 *    operator_user_not_found.
 *  - AC5 audit: exactly one AdminAuditLog row per write action (phone redacted
 *    in argsRedacted); ZERO rows for the read-only listOperators.
 *  - AC6 container: the cores import nothing from 'next' (node-only CLI safe).
 *
 * Phone fixtures: createOperator inputs use VN local format (09xxxxxxxx) which
 * normalizePhone accepts but which does NOT match the gitleaks +84[35789]\d{8}
 * rule. Normalized cleanup keys are derived at runtime via normalizePhone so no
 * +84 literal ever appears. Direct prisma seeds (booking buyerPhone) use the
 * literal-x mask +8490xxxxxx<n>.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/db/client';
import { normalizePhone } from '@/lib/auth/phoneNormalize';
import { verify } from '@/lib/auth/password';
import * as esms from '@/lib/notifications/esms';
import { createOperator } from '../createOperator';
import { disableOperator } from '../disableOperator';
import { resetOperatorAdminPassword } from '../resetOperatorAdminPassword';
import { listOperators } from '../listOperators';

const BASE_URL = 'http://localhost:3000';
const ACTOR = 'int-test-admin';

// VN local-format inputs (gitleaks-safe — no +84 prefix). Each unique.
const PHONE_CREATE = '0902340001';
const PHONE_DISABLE = '0902340002';
const PHONE_RESET = '0902340003';
const PHONE_LIST = '0902340004';

const ALL_LOCAL = [PHONE_CREATE, PHONE_DISABLE, PHONE_RESET, PHONE_LIST];
const NORMALIZED = ALL_LOCAL.map(normalizePhone);

// Track every row we create so afterAll can clean up by id without touching
// other operators' data.
const operatorIds: string[] = [];
const userIds: string[] = [];

afterAll(async () => {
  await prisma.operatorSession.deleteMany({
    where: { operator: { operatorId: { in: operatorIds } } },
  });
  await prisma.booking.deleteMany({ where: { trip: { operatorId: { in: operatorIds } } } });
  await prisma.notificationLog.deleteMany({
    where: { template: 'operatorAdminTempPassword', recipient: { in: NORMALIZED } },
  });
  await prisma.operatorUser.deleteMany({ where: { operatorId: { in: operatorIds } } });
  await prisma.trip.deleteMany({ where: { operatorId: { in: operatorIds } } });
  await prisma.route.deleteMany({ where: { operatorId: { in: operatorIds } } });
  await prisma.bus.deleteMany({ where: { operatorId: { in: operatorIds } } });
  await prisma.adminAuditLog.deleteMany({
    where: { target: { in: [...operatorIds, ...userIds] } },
  });
  await prisma.operator.deleteMany({ where: { id: { in: operatorIds } } });
  await prisma.$disconnect();
});

// ────────────────────────────────────────────────────────────────────────────
// createOperator — AC1 + AC5
// ────────────────────────────────────────────────────────────────────────────

describe('createOperator', () => {
  it('provisions an admin OperatorUser with a working login and an audit row', async () => {
    // Capture the temp password from the SMS dispatch to prove the login works.
    let smsTempPassword = '';
    const spy = vi.spyOn(esms, 'sendSms').mockImplementation(async (input) => {
      smsTempPassword = String((input.payload as Record<string, unknown>).tempPassword ?? '');
      return { ok: true, externalRef: 'spy-create' };
    });

    try {
      const result = await createOperator(prisma, {
        legalName: 'Admin CLI Op Create',
        contactEmail: 'create@admin-cli.test',
        contactPhone: PHONE_CREATE,
        baseUrl: BASE_URL,
        actor: ACTOR,
      });
      operatorIds.push(result.operatorId);
      userIds.push(result.operatorUserId);

      expect(result.loginPhone).toBe(normalizePhone(PHONE_CREATE));

      const user = await prisma.operatorUser.findUniqueOrThrow({
        where: { id: result.operatorUserId },
        select: { role: true, requiresPasswordChange: true, passwordHash: true, phone: true },
      });
      expect(user.role).toBe('admin');
      expect(user.requiresPasswordChange).toBe(true);
      expect(user.phone).toBe(normalizePhone(PHONE_CREATE));

      // Working login: the SMS'd temp password verifies against the stored hash.
      expect(smsTempPassword.length).toBeGreaterThan(0);
      expect(await verify(user.passwordHash, smsTempPassword)).toBe(true);

      // NotificationLog written, but the temp password must never be persisted.
      const log = await prisma.notificationLog.findFirst({
        where: { template: 'operatorAdminTempPassword', recipient: result.loginPhone },
        select: { payload: true },
      });
      expect(log).not.toBeNull();
      const payload = JSON.parse(log!.payload);
      expect(payload.phone).toBe(result.loginPhone);
      expect(payload.loginUrl).toContain('/op/first-login');
      expect(payload.tempPassword).toBeUndefined();

      // AC5: exactly one audit row for this write, phone redacted.
      const audit = await prisma.adminAuditLog.findMany({
        where: { action: 'create-operator', target: result.operatorId },
        select: { actor: true, argsRedacted: true },
      });
      expect(audit).toHaveLength(1);
      expect(audit[0].actor).toBe(ACTOR);
      const args = JSON.parse(audit[0].argsRedacted!);
      expect(args.contactPhone).not.toContain(normalizePhone(PHONE_CREATE).slice(0, 6));
      expect(args.contactPhone).toContain('x');
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects a duplicate phone with phone_in_use', async () => {
    await expect(
      createOperator(prisma, {
        legalName: 'Admin CLI Op Dup',
        contactEmail: 'dup@admin-cli.test',
        contactPhone: PHONE_CREATE,
        baseUrl: BASE_URL,
        actor: ACTOR,
      })
    ).rejects.toMatchObject({ code: 'phone_in_use' });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// disableOperator — AC2 + AC5
// ────────────────────────────────────────────────────────────────────────────

describe('disableOperator', () => {
  let opId: string;
  let adminUserId: string;
  let scheduledTripId: string;
  let paidBookingId: string;

  beforeAll(async () => {
    const spy = vi.spyOn(esms, 'sendSms').mockResolvedValue({ ok: true, externalRef: 'spy-disable' });
    try {
      const created = await createOperator(prisma, {
        legalName: 'Admin CLI Op Disable',
        contactEmail: 'disable@admin-cli.test',
        contactPhone: PHONE_DISABLE,
        baseUrl: BASE_URL,
        actor: ACTOR,
      });
      opId = created.operatorId;
      adminUserId = created.operatorUserId;
      operatorIds.push(opId);
      userIds.push(adminUserId);
    } finally {
      spy.mockRestore();
    }

    const bus = await prisma.bus.create({
      data: { operatorId: opId, capacity: 20, licensePlate: 'ADMIN-D01', busType: 'coach' },
    });
    const route = await prisma.route.create({
      data: { origin: 'D Origin', destination: 'D Destination', operatorId: opId, durationMinutes: 90 },
    });
    const trip = await prisma.trip.create({
      data: {
        routeId: route.id,
        busId: bus.id,
        operatorId: opId,
        departureAt: new Date(Date.now() + 86_400_000),
        price: 100_000,
        status: 'scheduled',
        salesClosed: false,
      },
    });
    scheduledTripId = trip.id;

    const booking = await prisma.booking.create({
      data: {
        id: crypto.randomUUID(),
        bookingRef: `BB-ADMIN-DIS-${Date.now()}`,
        confirmationToken: crypto.randomUUID(),
        tripId: trip.id,
        buyerName: 'Paid Buyer',
        buyerPhone: '+8490xxxxxx5',
        ticketCount: 1,
        totalVnd: 100_000,
        paymentMethod: 'cash',
        status: 'paid',
      },
    });
    paidBookingId = booking.id;

    // Two live sessions + one already-revoked, on the admin user.
    await prisma.operatorSession.createMany({
      data: [
        {
          operatorUserId: adminUserId,
          refreshTokenHash: 'a'.repeat(64),
          tokenFamily: 'dis-fam-1',
          expiresAt: new Date(Date.now() + 86_400_000),
        },
        {
          operatorUserId: adminUserId,
          refreshTokenHash: 'b'.repeat(64),
          tokenFamily: 'dis-fam-2',
          expiresAt: new Date(Date.now() + 86_400_000),
        },
        {
          operatorUserId: adminUserId,
          refreshTokenHash: 'c'.repeat(64),
          tokenFamily: 'dis-fam-3',
          expiresAt: new Date(Date.now() + 86_400_000),
          revokedAt: new Date(),
        },
      ],
    });
  });

  it('disables the operator + all users, revokes sessions, closes scheduled trips, honors paid bookings', async () => {
    const result = await disableOperator(prisma, { operatorId: opId, actor: ACTOR });

    expect(result.usersDisabled).toBe(1);
    expect(result.sessionsRevoked).toBe(2);
    expect(result.tripsClosed).toBe(1);

    const op = await prisma.operator.findUniqueOrThrow({
      where: { id: opId },
      select: { disabledAt: true },
    });
    expect(op.disabledAt).not.toBeNull();

    const liveUsers = await prisma.operatorUser.count({
      where: { operatorId: opId, disabledAt: null },
    });
    expect(liveUsers).toBe(0);

    const liveSessions = await prisma.operatorSession.count({
      where: { operatorUserId: adminUserId, revokedAt: null },
    });
    expect(liveSessions).toBe(0);

    const trip = await prisma.trip.findUniqueOrThrow({
      where: { id: scheduledTripId },
      select: { salesClosed: true },
    });
    expect(trip.salesClosed).toBe(true);

    // In-flight paid booking is untouched.
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: paidBookingId },
      select: { status: true },
    });
    expect(booking.status).toBe('paid');

    // AC5: exactly one disable audit row.
    const audit = await prisma.adminAuditLog.findMany({
      where: { action: 'disable-operator', target: opId },
    });
    expect(audit).toHaveLength(1);
  });

  it('is not re-runnable — second disable throws already_disabled', async () => {
    await expect(
      disableOperator(prisma, { operatorId: opId, actor: ACTOR })
    ).rejects.toMatchObject({ code: 'already_disabled' });
  });

  it('throws operator_not_found for an unknown operator id', async () => {
    await expect(
      disableOperator(prisma, { operatorId: crypto.randomUUID(), actor: ACTOR })
    ).rejects.toMatchObject({ code: 'operator_not_found' });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// resetOperatorAdminPassword — AC3 + AC5
// ────────────────────────────────────────────────────────────────────────────

describe('resetOperatorAdminPassword', () => {
  let userId: string;

  beforeAll(async () => {
    const spy = vi.spyOn(esms, 'sendSms').mockResolvedValue({ ok: true, externalRef: 'spy-reset-seed' });
    try {
      const created = await createOperator(prisma, {
        legalName: 'Admin CLI Op Reset',
        contactEmail: 'reset@admin-cli.test',
        contactPhone: PHONE_RESET,
        baseUrl: BASE_URL,
        actor: ACTOR,
      });
      userId = created.operatorUserId;
      operatorIds.push(created.operatorId);
      userIds.push(created.operatorUserId);
    } finally {
      spy.mockRestore();
    }

    await prisma.operatorSession.create({
      data: {
        operatorUserId: userId,
        refreshTokenHash: 'd'.repeat(64),
        tokenFamily: 'reset-fam-1',
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
  });

  it('sets a fresh working temp password, forces rotation, and revokes live sessions', async () => {
    let newTempPassword = '';
    const spy = vi.spyOn(esms, 'sendSms').mockImplementation(async (input) => {
      newTempPassword = String((input.payload as Record<string, unknown>).tempPassword ?? '');
      return { ok: true, externalRef: 'spy-reset' };
    });

    try {
      const result = await resetOperatorAdminPassword(prisma, {
        operatorUserId: userId,
        baseUrl: BASE_URL,
        actor: ACTOR,
      });
      expect(result.sessionsRevoked).toBe(1);

      const user = await prisma.operatorUser.findUniqueOrThrow({
        where: { id: userId },
        select: { passwordHash: true, requiresPasswordChange: true },
      });
      expect(user.requiresPasswordChange).toBe(true);
      expect(newTempPassword.length).toBeGreaterThan(0);
      expect(await verify(user.passwordHash, newTempPassword)).toBe(true);

      const liveSessions = await prisma.operatorSession.count({
        where: { operatorUserId: userId, revokedAt: null },
      });
      expect(liveSessions).toBe(0);

      const audit = await prisma.adminAuditLog.findMany({
        where: { action: 'reset-operator-admin-password', target: userId },
      });
      expect(audit).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('throws operator_user_not_found for an unknown user id', async () => {
    await expect(
      resetOperatorAdminPassword(prisma, {
        operatorUserId: crypto.randomUUID(),
        baseUrl: BASE_URL,
        actor: ACTOR,
      })
    ).rejects.toMatchObject({ code: 'operator_user_not_found' });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// listOperators — read-only, no audit row (AC5)
// ────────────────────────────────────────────────────────────────────────────

describe('listOperators', () => {
  it('returns the roster and writes ZERO audit rows', async () => {
    const spy = vi.spyOn(esms, 'sendSms').mockResolvedValue({ ok: true, externalRef: 'spy-list' });
    let opId: string;
    try {
      const created = await createOperator(prisma, {
        legalName: 'Admin CLI Op List',
        contactEmail: 'list@admin-cli.test',
        contactPhone: PHONE_LIST,
        baseUrl: BASE_URL,
        actor: ACTOR,
      });
      opId = created.operatorId;
      operatorIds.push(created.operatorId);
      userIds.push(created.operatorUserId);
    } finally {
      spy.mockRestore();
    }

    const before = await prisma.adminAuditLog.count();
    const rows = await listOperators(prisma);
    await listOperators(prisma);
    const after = await prisma.adminAuditLog.count();

    expect(after).toBe(before);
    expect(rows.some((r) => r.id === opId)).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// AC6 — node-only CLI container: cores import nothing from 'next'
// ────────────────────────────────────────────────────────────────────────────

describe('CLI container safety (AC6)', () => {
  it('lib/admin cores import nothing from next', () => {
    const dir = path.resolve(__dirname, '..');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
    for (const f of files) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      expect(src, `${f} must not import next`).not.toMatch(/from\s+['"]next(\/|['"])/);
    }
  });
});
