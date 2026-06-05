/**
 * Issue 076: unit tests for the self-serve operator registration service.
 * prisma client, password hash, and the notificationLog repo are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

// ---- hoisted mocks ----
const { mockTx, mockPrisma, mockHash, mockCreateNotificationLog } = vi.hoisted(() => {
  const mockTx = {
    operator: { create: vi.fn() },
    operatorUser: { create: vi.fn() },
  };
  const mockPrisma = {
    $transaction: vi.fn(async (cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
  };
  const mockHash = vi.fn();
  const mockCreateNotificationLog = vi.fn();
  return { mockTx, mockPrisma, mockHash, mockCreateNotificationLog };
});

vi.mock('@/lib/auth/password', () => ({ hash: mockHash }));
vi.mock('@/lib/core/db/notificationLogRepo', () => ({
  createNotificationLog: mockCreateNotificationLog,
}));

import { registerOperator, REGISTER_SLA_RANGE } from '../registerOperator';
import { RegisterError } from '../errors';
import { APPLICATION_REF_REGEX } from '../applicationRef';
import type { PrismaClient } from '@prisma/client';

const prisma = mockPrisma as unknown as PrismaClient;

const INPUT = {
  legalName: 'Cong ty Van tai ABC',
  contactEmail: 'lienhe@abc.vn',
  contactPhone: '0901234567',
  password: 'super-secret-pw',
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
  mockHash.mockResolvedValue('hashed-pw');
  mockTx.operator.create.mockResolvedValue({ id: 'op_1' });
  mockTx.operatorUser.create.mockResolvedValue({ id: 'opu_1' });
  mockCreateNotificationLog.mockResolvedValue({ id: 'notif_1' });
});

describe('registerOperator', () => {
  it('creates a PENDING_REVIEW operator + bootstrap OperatorUser with both phones + applicationRef', async () => {
    const result = await registerOperator(prisma, INPUT);

    expect(result.operatorId).toBe('op_1');
    expect(result.operatorUserId).toBe('opu_1');
    expect(result.applicationRef).toMatch(APPLICATION_REF_REGEX);

    // Operator: PENDING_REVIEW, normalized phone in BOTH contact + notification.
    const opData = mockTx.operator.create.mock.calls[0][0].data;
    expect(opData.status).toBe('PENDING_REVIEW');
    expect(opData.legalName).toBe(INPUT.legalName);
    expect(opData.contactEmail).toBe(INPUT.contactEmail);
    expect(opData.contactPhone).toBe('+84901234567');
    expect(opData.notificationPhone).toBe('+84901234567');
    expect(opData.applicationRef).toMatch(APPLICATION_REF_REGEX);

    // OperatorUser: Issue 012 NOT-NULL columns all set, role admin, no forced change.
    const opuData = mockTx.operatorUser.create.mock.calls[0][0].data;
    expect(opuData.operatorId).toBe('op_1');
    expect(opuData.phone).toBe('+84901234567');
    expect(opuData.contactPhone).toBe('+84901234567');
    expect(opuData.notificationPhone).toBe('+84901234567');
    expect(opuData.passwordHash).toBe('hashed-pw');
    expect(opuData.displayName).toBe(INPUT.legalName);
    expect(opuData.role).toBe('admin');
    expect(opuData.requiresPasswordChange).toBe(false);
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
    // AC3: a RANGE string ("within 2 business days"), not an exact second/minute
    // countdown — no time-unit countdown tokens (e.g. "in 47 seconds").
    expect(payload.slaRange).toBe(REGISTER_SLA_RANGE);
    expect(REGISTER_SLA_RANGE).toBe('within 2 business days');
    expect(payload.slaRange).not.toMatch(/\b\d+\s*(second|minute|hour)/i);
  });

  it('throws RegisterError(phone_in_use) on a non-applicationRef unique collision', async () => {
    mockTx.operator.create.mockRejectedValueOnce(p2002(['contactPhone']));

    await expect(registerOperator(prisma, INPUT)).rejects.toMatchObject({
      name: 'RegisterError',
      code: 'phone_in_use',
    });
    expect(mockCreateNotificationLog).not.toHaveBeenCalled();
  });

  it('retries with a fresh applicationRef on an applicationRef collision then succeeds', async () => {
    // First attempt collides on applicationRef; second succeeds.
    mockTx.operator.create
      .mockRejectedValueOnce(p2002(['applicationRef']))
      .mockResolvedValueOnce({ id: 'op_2' });

    const result = await registerOperator(prisma, INPUT);

    expect(result.operatorId).toBe('op_2');
    expect(mockTx.operator.create).toHaveBeenCalledTimes(2);
    // The two attempts used different refs.
    const ref1 = mockTx.operator.create.mock.calls[0][0].data.applicationRef;
    const ref2 = mockTx.operator.create.mock.calls[1][0].data.applicationRef;
    expect(ref1).not.toBe(ref2);
    expect(result.applicationRef).toBe(ref2);
    expect(mockCreateNotificationLog).toHaveBeenCalledTimes(1);
  });
});

it('throws RegisterError(phone_in_use) raised from the OperatorUser insert', async () => {
  mockTx.operatorUser.create.mockRejectedValueOnce(p2002('OperatorUser_phone_key'));

  await expect(registerOperator(prisma, INPUT)).rejects.toBeInstanceOf(RegisterError);
});
