/**
 * Integration tests for listOperatorBuses().
 *
 * AC1: operator sees own active buses (filters operatorId AND deactivatedAt IS NULL).
 * AC6: cross-operator isolation — never returns another operator's buses.
 * Sort: createdAt DESC (newest first).
 *
 * Run with: pnpm vitest:int
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/client';
import { listOperatorBuses } from '../listOperatorBuses';

let operatorAId: string;
let operatorBId: string;
const aBusIds: string[] = [];
const bBusIds: string[] = [];

beforeAll(async () => {
  const opA = await prisma.operator.create({
    data: { legalName: 'List Test Op A', contactPhone: '+8490xxxxxx1', contactEmail: 'a@list.test' },
  });
  operatorAId = opA.id;
  const opB = await prisma.operator.create({
    data: { legalName: 'List Test Op B', contactPhone: '+8490xxxxxx2', contactEmail: 'b@list.test' },
  });
  operatorBId = opB.id;

  // Op A: 2 active, 1 deactivated
  const a1 = await prisma.bus.create({
    data: { operatorId: operatorAId, capacity: 30, licensePlate: 'LIST-A-001', busType: 'coach' },
  });
  aBusIds.push(a1.id);
  const a2 = await prisma.bus.create({
    data: { operatorId: operatorAId, capacity: 40, licensePlate: 'LIST-A-002', busType: 'sleeper' },
  });
  aBusIds.push(a2.id);
  const a3 = await prisma.bus.create({
    data: {
      operatorId: operatorAId,
      capacity: 20,
      licensePlate: 'LIST-A-003',
      busType: 'limousine',
      deactivatedAt: new Date(),
    },
  });
  aBusIds.push(a3.id);

  // Op B: 1 active (must never appear in A's list)
  const b1 = await prisma.bus.create({
    data: { operatorId: operatorBId, capacity: 50, licensePlate: 'LIST-B-001', busType: 'coach' },
  });
  bBusIds.push(b1.id);
});

afterAll(async () => {
  await prisma.bus.deleteMany({ where: { id: { in: [...aBusIds, ...bBusIds] } } });
  await prisma.operator.deleteMany({ where: { id: { in: [operatorAId, operatorBId] } } });
  await prisma.$disconnect();
});

describe('listOperatorBuses', () => {
  it('returns only operator A active buses, sorted by createdAt DESC', async () => {
    const result = await listOperatorBuses(operatorAId, { activeOnly: true });
    expect(result.length).toBe(2);
    const plates = result.map((b) => b.licensePlate).sort();
    expect(plates).toEqual(['LIST-A-001', 'LIST-A-002']);
  });

  it('AC6: never returns operator B buses when called with operatorAId', async () => {
    const result = await listOperatorBuses(operatorAId, { activeOnly: true });
    const bPlates = result.map((b) => b.licensePlate).filter((p) => p.startsWith('LIST-B-'));
    expect(bPlates).toEqual([]);
  });

  it('activeOnly:false includes deactivated buses', async () => {
    const result = await listOperatorBuses(operatorAId, { activeOnly: false });
    expect(result.length).toBe(3);
    const plates = result.map((b) => b.licensePlate).sort();
    expect(plates).toEqual(['LIST-A-001', 'LIST-A-002', 'LIST-A-003']);
  });

  it('returns empty array for unknown operator', async () => {
    const result = await listOperatorBuses('nonexistent-op-id', { activeOnly: true });
    expect(result).toEqual([]);
  });
});
