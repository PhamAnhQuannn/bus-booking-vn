/**
 * Integration tests for Issue 017 operator staff management.
 *
 * Run with: pnpm vitest:int
 *
 * Covers:
 * - createStaff: phone collision → StaffServiceError('phone_in_use') (route maps 409)
 * - disableStaff: sets disabledAt AND revokes every live OperatorSession (atomic)
 * - assignService: assigns, replaces a prior assignment, rejects non-scheduled
 *   trips (trip_not_assignable), cross-operator staff (not_found), cross-operator
 *   trip (trip_not_found)
 *
 * Phone fixtures: createStaff inputs use VN local format (09xxxxxxxx) which
 * normalizePhone accepts but which does NOT match the gitleaks +84[35789]\d{8}
 * rule. Normalized cleanup keys are derived at runtime via normalizePhone so no
 * +84 literal ever appears in this source file. Direct prisma seeds (operators)
 * use the literal-x mask +8490xxxxxx<n>.
 *
 * Admin-only (403) enforcement lives at the route/middleware layer, not in the
 * service functions — it is exercised by e2e/op-staff.spec.ts, not here.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/client';
import { normalizePhone } from '@/lib/auth/phoneNormalize';
import { createStaff } from '../createStaff';
import { disableStaff } from '../disableStaff';
import { assignService } from '../assignService';

const BASE_URL = 'http://localhost:3000';

// VN local-format inputs (gitleaks-safe — no +84 prefix). Each unique.
const PHONE_COLLISION = '0901230001';
const PHONE_DISABLE = '0901230002';
const PHONE_ASSIGN = '0901230003';
const PHONE_CROSS_OP = '0901230004';

const ALL_LOCAL_PHONES = [PHONE_COLLISION, PHONE_DISABLE, PHONE_ASSIGN, PHONE_CROSS_OP];
const NORMALIZED_PHONES = ALL_LOCAL_PHONES.map(normalizePhone);

let operatorId: string;
let otherOperatorId: string;
let routeId: string;
let busId: string;
let scheduledTripId: string;
let secondScheduledTripId: string;
let cancelledTripId: string;
let otherOperatorTripId: string;

beforeAll(async () => {
  // Idempotent pre-clean: phone is globally unique, so a prior aborted run that
  // skipped afterAll leaves an OperatorUser row that collides with the first
  // createStaff here. Remove any leftover rows (and their sessions) up front.
  const stale = await prisma.operatorUser.findMany({
    where: { phone: { in: NORMALIZED_PHONES } },
    select: { id: true },
  });
  if (stale.length > 0) {
    const staleIds = stale.map((s) => s.id);
    await prisma.operatorSession.deleteMany({ where: { operatorUserId: { in: staleIds } } });
    await prisma.operatorUser.deleteMany({ where: { id: { in: staleIds } } });
  }

  const opA = await prisma.operator.create({
    data: {
      legalName: 'Staff Test Op A',
      contactPhone: '+8490xxxxxx1',
      contactEmail: 'staff-a@test.dev',
    },
  });
  operatorId = opA.id;

  const opB = await prisma.operator.create({
    data: {
      legalName: 'Staff Test Op B',
      contactPhone: '+8490xxxxxx2',
      contactEmail: 'staff-b@test.dev',
    },
  });
  otherOperatorId = opB.id;

  const bus = await prisma.bus.create({
    data: { operatorId, capacity: 20, licensePlate: 'STAFF-001', busType: 'coach' },
  });
  busId = bus.id;

  const route = await prisma.route.create({
    data: {
      origin: 'Staff Origin',
      destination: 'Staff Destination',
      operatorId,
      durationMinutes: 120,
    },
  });
  routeId = route.id;

  const scheduled = await prisma.trip.create({
    data: {
      routeId,
      busId,
      operatorId,
      departureAt: new Date(Date.now() + 86_400_000),
      price: 100_000,
      status: 'scheduled',
      salesClosed: false,
    },
  });
  scheduledTripId = scheduled.id;

  const second = await prisma.trip.create({
    data: {
      routeId,
      busId,
      operatorId,
      departureAt: new Date(Date.now() + 2 * 86_400_000),
      price: 100_000,
      status: 'scheduled',
      salesClosed: false,
    },
  });
  secondScheduledTripId = second.id;

  const cancelled = await prisma.trip.create({
    data: {
      routeId,
      busId,
      operatorId,
      departureAt: new Date(Date.now() + 86_400_000),
      price: 100_000,
      status: 'cancelled',
      salesClosed: true,
    },
  });
  cancelledTripId = cancelled.id;

  // Op B's own trip (tenant isolation) — needs Op B route + bus.
  const busB = await prisma.bus.create({
    data: { operatorId: otherOperatorId, capacity: 15, licensePlate: 'STAFF-B01', busType: 'coach' },
  });
  const routeB = await prisma.route.create({
    data: {
      origin: 'B Origin',
      destination: 'B Destination',
      operatorId: otherOperatorId,
      durationMinutes: 60,
    },
  });
  const tripB = await prisma.trip.create({
    data: {
      routeId: routeB.id,
      busId: busB.id,
      operatorId: otherOperatorId,
      departureAt: new Date(Date.now() + 86_400_000),
      price: 80_000,
      status: 'scheduled',
      salesClosed: false,
    },
  });
  otherOperatorTripId = tripB.id;
});

afterAll(async () => {
  const opIds = [operatorId, otherOperatorId];
  // OperatorSession rows cascade on OperatorUser delete, but delete explicitly
  // so cleanup is order-independent.
  await prisma.operatorSession.deleteMany({
    where: { operator: { operatorId: { in: opIds } } },
  });
  await prisma.notificationLog.deleteMany({
    where: { template: 'staffTempPassword', recipient: { in: NORMALIZED_PHONES } },
  });
  // OperatorUser.assignedTripId FKs Trip — delete staff before trips.
  await prisma.operatorUser.deleteMany({ where: { operatorId: { in: opIds } } });
  await prisma.trip.deleteMany({ where: { operatorId: { in: opIds } } });
  await prisma.route.deleteMany({ where: { operatorId: { in: opIds } } });
  await prisma.bus.deleteMany({ where: { operatorId: { in: opIds } } });
  await prisma.operator.deleteMany({ where: { id: { in: opIds } } });
  await prisma.$disconnect();
});

// ────────────────────────────────────────────────────────────────────────────
// createStaff
// ────────────────────────────────────────────────────────────────────────────

describe('createStaff', () => {
  it('provisions a staff member (role=staff, requiresPasswordChange=true)', async () => {
    const dto = await createStaff({
      operatorId,
      name: 'Nguyen Van A',
      phone: PHONE_DISABLE,
      baseUrl: BASE_URL,
    });

    expect(dto.role).toBe('staff');
    expect(dto.requiresPasswordChange).toBe(true);
    expect(dto.disabled).toBe(false);
    expect(dto.assignedTripId).toBeNull();
    expect(dto.phone).toBe(normalizePhone(PHONE_DISABLE));
    // Temp password must never leak into the DTO.
    expect(dto).not.toHaveProperty('passwordHash');
  });

  it('rejects a duplicate phone with phone_in_use (route → 409)', async () => {
    await createStaff({
      operatorId,
      name: 'First Owner',
      phone: PHONE_COLLISION,
      baseUrl: BASE_URL,
    });

    await expect(
      createStaff({
        operatorId,
        name: 'Second Owner',
        phone: PHONE_COLLISION,
        baseUrl: BASE_URL,
      })
    ).rejects.toMatchObject({ code: 'phone_in_use' });
  });

  it('treats a phone already used by another operator as phone_in_use (phone is globally unique)', async () => {
    // PHONE_COLLISION already taken by operatorId above.
    await expect(
      createStaff({
        operatorId: otherOperatorId,
        name: 'Cross Op Claimant',
        phone: PHONE_COLLISION,
        baseUrl: BASE_URL,
      })
    ).rejects.toMatchObject({ code: 'phone_in_use' });
  });

  it('records a staffTempPassword NotificationLog without the temp password in the payload', async () => {
    const dto = await createStaff({
      operatorId,
      name: 'Logged Staff',
      phone: PHONE_CROSS_OP,
      baseUrl: BASE_URL,
    });

    const log = await prisma.notificationLog.findFirst({
      where: { template: 'staffTempPassword', recipient: dto.phone },
      select: { payload: true, status: true },
    });
    expect(log).not.toBeNull();
    const payload = JSON.parse(log!.payload);
    expect(payload.phone).toBe(dto.phone);
    expect(payload.loginUrl).toContain('/op/first-login');
    expect(payload.tempPassword).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// disableStaff
// ────────────────────────────────────────────────────────────────────────────

describe('disableStaff', () => {
  it('sets disabledAt and revokes every live session atomically', async () => {
    const staff = await prisma.operatorUser.findFirstOrThrow({
      where: { operatorId, phone: normalizePhone(PHONE_DISABLE) },
      select: { id: true },
    });

    // Two live sessions + one already-revoked session.
    await prisma.operatorSession.createMany({
      data: [
        {
          operatorUserId: staff.id,
          refreshTokenHash: 'a'.repeat(64),
          tokenFamily: 'fam-1',
          expiresAt: new Date(Date.now() + 86_400_000),
        },
        {
          operatorUserId: staff.id,
          refreshTokenHash: 'b'.repeat(64),
          tokenFamily: 'fam-2',
          expiresAt: new Date(Date.now() + 86_400_000),
        },
        {
          operatorUserId: staff.id,
          refreshTokenHash: 'c'.repeat(64),
          tokenFamily: 'fam-3',
          expiresAt: new Date(Date.now() + 86_400_000),
          revokedAt: new Date(),
        },
      ],
    });

    const dto = await disableStaff({ operatorId, staffId: staff.id });
    expect(dto.disabled).toBe(true);

    const live = await prisma.operatorSession.count({
      where: { operatorUserId: staff.id, revokedAt: null },
    });
    expect(live).toBe(0);
  });

  it('is idempotent — re-disabling is a no-op success', async () => {
    const staff = await prisma.operatorUser.findFirstOrThrow({
      where: { operatorId, phone: normalizePhone(PHONE_DISABLE) },
      select: { id: true },
    });
    const dto = await disableStaff({ operatorId, staffId: staff.id });
    expect(dto.disabled).toBe(true);
  });

  it('throws not_found for a cross-operator staff id', async () => {
    const staff = await prisma.operatorUser.findFirstOrThrow({
      where: { operatorId, phone: normalizePhone(PHONE_DISABLE) },
      select: { id: true },
    });
    await expect(
      disableStaff({ operatorId: otherOperatorId, staffId: staff.id })
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// assignService
// ────────────────────────────────────────────────────────────────────────────

describe('assignService', () => {
  let assignStaffId: string;

  beforeAll(async () => {
    const dto = await createStaff({
      operatorId,
      name: 'Assignable Staff',
      phone: PHONE_ASSIGN,
      baseUrl: BASE_URL,
    });
    assignStaffId = dto.id;
  });

  it('assigns a staff member to a scheduled trip', async () => {
    const dto = await assignService({ operatorId, staffId: assignStaffId, tripId: scheduledTripId });
    expect(dto.assignedTripId).toBe(scheduledTripId);
  });

  it('replaces the prior assignment on re-assign', async () => {
    const dto = await assignService({
      operatorId,
      staffId: assignStaffId,
      tripId: secondScheduledTripId,
    });
    expect(dto.assignedTripId).toBe(secondScheduledTripId);
  });

  it('rejects a non-scheduled (cancelled) trip with trip_not_assignable', async () => {
    await expect(
      assignService({ operatorId, staffId: assignStaffId, tripId: cancelledTripId })
    ).rejects.toMatchObject({ code: 'trip_not_assignable' });
  });

  it('throws trip_not_found for a trip owned by another operator', async () => {
    await expect(
      assignService({ operatorId, staffId: assignStaffId, tripId: otherOperatorTripId })
    ).rejects.toMatchObject({ code: 'trip_not_found' });
  });

  it('throws not_found when the staff id belongs to another operator', async () => {
    await expect(
      assignService({ operatorId: otherOperatorId, staffId: assignStaffId, tripId: otherOperatorTripId })
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});
