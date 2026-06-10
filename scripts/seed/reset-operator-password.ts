/**
 * Dev helper: reset an existing OperatorUser's password to a fresh KNOWN value
 * (printed once) so it can be shared for testing. seed-operator.ts refuses to
 * touch an existing login; this script targets one by phone and rotates only the
 * password hash (+ clears requiresPasswordChange).
 *
 * Self-contained prisma bootstrap (own Pool + PrismaPg from DATABASE_URL),
 * mirroring seed-operator.ts. Deep leaf imports (node-safe), boundary-exempt.
 *
 * Run:  pnpm tsx --env-file=.env.local scripts/seed/reset-operator-password.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hash } from '@/lib/auth/password';
import { genTempPassword } from '@/lib/staff/genTempPassword';
import { normalizePhone } from '@/lib/core/validation/phone';

// Operator seeded by scripts/seed/seed-operator.ts (Phương Trang Express).
const RAW_PHONE = '0901234567';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const phone = normalizePhone(RAW_PHONE);
  const existing = await prisma.operatorUser.findFirst({
    where: { phone },
    select: { id: true, username: true },
  });
  if (!existing) {
    console.log(`No OperatorUser for ${phone} — run seed-operator.ts first.`);
    return;
  }

  const password = genTempPassword();
  const passwordHash = await hash(password);
  await prisma.operatorUser.update({
    where: { id: existing.id },
    data: { passwordHash, requiresPasswordChange: false },
  });

  console.log('Reset operator password (final, no forced change):');
  console.log(`  username: ${existing.username}`);
  console.log(`  password: ${password}`);
  console.log(`  login:    ${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001'}/op/login`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
