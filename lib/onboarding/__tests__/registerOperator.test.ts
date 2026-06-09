/**
 * Unit tests for the operator APPLICATION service (Issue 076; reworked 2026-06-06).
 * Application-only: creates the Operator row + enqueues the pending email. It does
 * NOT create an OperatorUser and accepts NO password — the admin provisions the
 * login account later (see lib/admin/createOperatorAccount). prisma + the
 * notificationLog repo are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

// ---- hoisted mocks ----
const { mockPrisma, mockCreateNotificationLog } = vi.hoisted(() => {
  const mockPrisma = {
    operator: { create: vi.fn() },
  };
  const mockCreateNotificationLog = vi.fn();
  return { mockPrisma, mockCreateNotificationLog };
});

vi.mock('@/lib/core/db/notificationLogRepo', () => ({
  createNotificationLog: mockCreateNotificationLog,
}));

import { registerOperator, REGISTER_SLA_RANGE } from '../registerOperator';
import { APPLICATION_REF_REGEX } from '../applicationRef';
import type { PrismaClient } from '@prisma/client';

const prisma = mockPrisma as unknown as PrismaClient;

const INPUT = {
  brandName: 'Nha Xe ABC',
  legalName: 'Cong ty Van tai ABC',
  contactName: 'Nguyen Van A',
  contactPhone: '0901234567',
  contactEmail: 'lienhe@abc.vn',
  address: 'Ha Noi',
  routesSummary: 'Ha Noi - Sai Gon',
  baseUrl: 'http://localhost:3001',
};

function p2002(target?: string | string[]): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('unique violation', {
    code: 'P2002',
    clientVersion: 'x',
    meta: target === undefined ? undefined : { target },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.operator.create.mockResolvedValue({ id: 'op_1' });
  mockCreateNotificationLog.mockResolvedValue({ id: 'notif_1' });
});

describe('registerOperator (application-only)', () => {
  it('creates a PENDING_REVIEW operator with the application fields + applicationRef, NO OperatorUser', async () => {
    const result = await registerOperator(prisma, INPUT);

    expect(result.operatorId).toBe('op_1');
    expect(result.applicationRef).toMatch(APPLICATION_REF_REGEX);
    // No password account is created by the application path.
    expect(result).not.toHaveProperty('operatorUserId');

    const opData = mockPrisma.operator.create.mock.calls[0][0].data;
    expect(opData.status).toBe('PENDING_REVIEW');
    expect(opData.brandName).toBe(INPUT.brandName);
    expect(opData.legalName).toBe(INPUT.legalName);
    expect(opData.contactName).toBe(INPUT.contactName);
    expect(opData.address).toBe(INPUT.address);
    expect(opData.routesSummary).toBe(INPUT.routesSummary);
    expect(opData.contactEmail).toBe(INPUT.contactEmail);
    expect(opData.contactPhone).toBe('+84901234567');
    expect(opData.notificationPhone).toBe('+84901234567');
    expect(opData.applicationRef).toMatch(APPLICATION_REF_REGEX);
    // No password field is ever set on the operator.
    expect(opData).not.toHaveProperty('passwordHash');
  });

  it('enqueues a pending operatorPending email with the SLA range + applicationRef', async () => {
    const result = await registerOperator(prisma, INPUT);

    expect(mockCreateNotificationLog).toHaveBeenCalledTimes(1);
    const log = mockCreateNotificationLog.mock.calls[0][0];
    expect(log.channel).toBe('email');
    expect(log.template).toBe('operatorPending');
    expect(log.recipient).toBe(INPUT.contactEmail);
    expect(log.status).toBe('pending');

    const payload = JSON.parse(log.payload);
    expect(payload.applicationRef).toBe(result.applicationRef);
    expect(payload.legalName).toBe(INPUT.legalName);
    // AC3: a RANGE string ("within 2 business days"), not an exact countdown.
    expect(payload.slaRange).toBe(REGISTER_SLA_RANGE);
    expect(REGISTER_SLA_RANGE).toBe('within 2 business days');
    expect(payload.slaRange).not.toMatch(/\b\d+\s*(second|minute|hour)/i);
  });

  it('retries with a fresh applicationRef on an applicationRef collision then succeeds', async () => {
    mockPrisma.operator.create
      .mockRejectedValueOnce(p2002(['applicationRef']))
      .mockResolvedValueOnce({ id: 'op_2' });

    const result = await registerOperator(prisma, INPUT);

    expect(result.operatorId).toBe('op_2');
    expect(mockPrisma.operator.create).toHaveBeenCalledTimes(2);
    const ref1 = mockPrisma.operator.create.mock.calls[0][0].data.applicationRef;
    const ref2 = mockPrisma.operator.create.mock.calls[1][0].data.applicationRef;
    expect(ref1).not.toBe(ref2);
    expect(result.applicationRef).toBe(ref2);
    expect(mockCreateNotificationLog).toHaveBeenCalledTimes(1);
  });

  it('rethrows a non-applicationRef error (no phone uniqueness on the application path)', async () => {
    mockPrisma.operator.create.mockRejectedValueOnce(new Error('db down'));
    await expect(registerOperator(prisma, INPUT)).rejects.toThrow('db down');
    expect(mockCreateNotificationLog).not.toHaveBeenCalled();
  });
});
