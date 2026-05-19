/**
 * Integration tests for getOperatorBus().
 *
 * AC6: cross-operator GET returns null (route handler converts to 404).
 * Includes maintenance windows ordered by startAt ASC.
 *
 * Run with: pnpm vitest:int
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/client';
import { getOperatorBus } from '../getOperatorBus';

let operatorAId: string;
let operatorBId: string;
let busAId: string;
let busBId: string;

beforeAll(async () => {
  const opA = await prisma.operator.create({
    data: { legalName: 'Get Test Op A', contactPhone: '+8490xxxxxx3', contactEmail: 'a@get.test' },
  });
  operatorAId = opA.id;
  const opB = await prisma.operator.create({
    data: { legalName: 'Get Test Op B', contactPhone: '+8490xxxxxx4', contactEmail: 'b@get.test' },
  });
  operatorBId = opB.id;

  const a = await prisma.bus.create({
    data: { operatorId: operatorAId, capacity: 30, licensePlate: 'GET-A-001', busType: 'coach' },
  });
  busAId = a.id;

  const b = await prisma.bus.create({
    data: { operatorId: operatorBId, capacity: 30, licensePlate: 'GET-B-001', busType: 'coach' },
  });
  busBId = b.id;

  // Two maintenance windows on bus A — verify ASC ordering
  const now = Date.now();
  await prisma.busMaintenance.create({
    data: {
      busId: busAId,
      startAt: new Date(now + 5 * 86_400_000),
      endAt: new Date(now + 6 * 86_400_000),
      reason: 'second window',
    },
  });
  await prisma.busMaintenance.create({
    data: {
      busId: busAId,
      startAt: new Date(now + 1 * 86_400_000),
      endAt: new Date(now + 2 * 86_400_000),
      reason: 'first window',
    },
  });
});

afterAll(async () => {
  await prisma.busMaintenance.deleteMany({ where: { busId: { in: [busAId, busBId] } } });
  await prisma.bus.deleteMany({ where: { id: { in: [busAId, busBId] } } });
  await prisma.operator.deleteMany({ where: { id: { in: [operatorAId, operatorBId] } } });
  await prisma.$disconnect();
});

describe('getOperatorBus', () => {
  it('returns bus + maintenance windows sorted ASC when caller owns bus', async () => {
    const result = await getOperatorBus(operatorAId, busAId);
    expect(result).not.toBeNull();
    expect(result!.licensePlate).toBe('GET-A-001');
    expect(result!.maintenances.length).toBe(2);
    expect(result!.maintenances[0].reason).toBe('first window');
    expect(result!.maintenances[1].reason).toBe('second window');
  });

  it('AC6: returns null when bus belongs to a different operator', async () => {
    const result = await getOperatorBus(operatorAId, busBId);
    expect(result).toBeNull();
  });

  it('returns null when bus does not exist', async () => {
    const result = await getOperatorBus(operatorAId, 'nonexistent-bus-id');
    expect(result).toBeNull();
  });
});
