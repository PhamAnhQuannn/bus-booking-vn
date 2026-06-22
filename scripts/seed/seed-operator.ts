/**
 * Dev seed: create an APPROVED operator + admin login with a FINAL password.
 *
 * Unlike the provisioning paths (lib/admin/createOperator.ts CLI core,
 * lib/admin/createOperatorAccount.ts admin-console) this sets a KNOWN password,
 * requiresPasswordChange=false, and Operator.status=APPROVED so you can log in
 * immediately — no temp password, no SMS/email dispatch, no forced first-login
 * change. The generated password is printed to the console ONCE (it is only ever
 * stored as a hash, exactly like every other login).
 *
 * Self-contained prisma bootstrap (own Pool + PrismaPg from DATABASE_URL),
 * mirroring scripts/seed/seed-trips-range.ts + scripts/admin/_client.ts — keeps
 * this node-only and free of the Next.js client singleton.
 *
 * Idempotent: re-running prints the existing username and exits without a second
 * insert (the password can't be recovered — delete the OperatorUser row to reset).
 *
 * Run:  pnpm tsx --env-file=.env.local scripts/seed/seed-operator.ts
 *       (requires the dev docker Postgres up — see memory dev-db-bringup)
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
// Deep imports (not the @/lib/auth barrel) — the barrel re-exports server-only
// modules (lib/payment/processWebhook.ts → `import 'server-only'`) that a node
// script can't resolve. Scripts are boundary-exempt; these leaf modules are
// node-safe (crypto / pure builders only).
import { buildUsername, ensureUniqueUsername } from '@/lib/auth/operatorUsername';
import { hash } from '@/lib/auth/password';
import { genTempPassword } from '@/lib/staff/genTempPassword';
import { normalizePhone } from '@/lib/core/validation/phone';

// ---- Demo defaults (drive the generated username ACRONYM-last4phone) ----
const LEGAL_NAME = 'Test Bus Express';
const CONTACT_EMAIL = 'ops@testbus.example.com';
const RAW_PHONE = '0901234567';
const LOGIN_URL = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001'}/op/login`;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const loginPhone = normalizePhone(RAW_PHONE);

  // Idempotent guard — phone is @unique on OperatorUser.
  const existing = await prisma.operatorUser.findUnique({
    where: { phone: loginPhone },
    select: { username: true },
  });
  if (existing) {
    console.log('Operator login already exists for this phone — not re-seeding.');
    console.log(`  username: ${existing.username}`);
    console.log('  (password is only stored hashed; delete the OperatorUser row to reset.)');
    return;
  }

  const password = genTempPassword();
  const passwordHash = await hash(password);

  const { username } = await prisma.$transaction(async (tx) => {
    const operator = await tx.operator.create({
      data: {
        legalName: LEGAL_NAME,
        brandName: LEGAL_NAME,
        contactEmail: CONTACT_EMAIL,
        contactPhone: loginPhone,
        notificationPhone: loginPhone,
        status: 'APPROVED',
      },
      select: { id: true },
    });

    const username = await ensureUniqueUsername(tx, buildUsername(LEGAL_NAME, loginPhone));

    await tx.operatorUser.create({
      data: {
        operatorId: operator.id,
        username,
        phone: loginPhone,
        contactPhone: loginPhone,
        notificationPhone: loginPhone,
        passwordHash,
        displayName: LEGAL_NAME,
        role: 'admin',
        requiresPasswordChange: false,
      },
      select: { id: true },
    });

    return { username };
  });

  console.log('Seeded operator (APPROVED, final password, no forced change):');
  console.log(`  username: ${username}`);
  console.log(`  password: ${password}`);
  console.log(`  login:    ${LOGIN_URL}`);
}

main()
  .catch((e) => {
    console.error('\nFailed:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
