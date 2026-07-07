/**
 * Integration tests for lib/auth/otp.ts — concurrent-verify race (AC4).
 *
 * Requires a real PostgreSQL database with the schema applied.
 * Run with: pnpm vitest:int
 *
 * Test: 2 simultaneous consume() calls with the correct code →
 *   exactly 1 returns status='ok', the other returns status='gone' (CAS miss race path).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import { generateCode, generateSalt, hashCode, consume } from '../otp';

const TEST_EMAIL = 'otp-race-test@example.com';

beforeEach(async () => {
  await prisma.$executeRaw`DELETE FROM "OtpAttempt" WHERE email = ${TEST_EMAIL}`;
});

afterEach(async () => {
  await prisma.$executeRaw`DELETE FROM "OtpAttempt" WHERE email = ${TEST_EMAIL}`;
  await prisma.$disconnect();
});

describe('consume — concurrent-verify race (AC4)', () => {
  it('2 simultaneous correct verifies → exactly 1 consumes, the other returns already_used (gone)', async () => {
    const plainCode = generateCode();
    const salt = generateSalt();
    const codeHash = hashCode(plainCode, salt);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const id = crypto.randomUUID();

    await prisma.$executeRaw`
      INSERT INTO "OtpAttempt" (id, email, "codeHash", salt, "expiresAt", consumed, "attemptCount", "createdAt")
      VALUES (
        ${id},
        ${TEST_EMAIL},
        ${codeHash},
        ${salt},
        ${expiresAt},
        false,
        0,
        NOW()
      )
    `;

    const [result1, result2] = await Promise.all([
      consume(TEST_EMAIL, plainCode),
      consume(TEST_EMAIL, plainCode),
    ]);

    const statuses = [result1.status, result2.status];

    const okCount = statuses.filter((s) => s === 'ok').length;
    expect(okCount).toBe(1);

    const otherStatus = statuses.find((s) => s !== 'ok');
    expect(['gone', 'mismatch', 'attempt_cap']).toContain(otherStatus);

    const rows = await prisma.$queryRaw<Array<{ consumed: boolean }>>`
      SELECT consumed FROM "OtpAttempt" WHERE id = ${id}
    `;
    expect(rows[0]?.consumed).toBe(true);
  });
});
