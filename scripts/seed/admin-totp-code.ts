/**
 * Dev helper: print the CURRENT 6-digit TOTP code for the SUPER_ADMIN, so you can
 * sign in at /admin/login without an authenticator app. Reads the plaintext
 * totpSecret straight from the dev DB. DEV ONLY — never ship a way to read live
 * TOTP secrets in production.
 *
 * Run:  pnpm admin:code
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { generateTotp } from '@/lib/auth/totp';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const admin = await prisma.adminUser.findFirst({
    where: { role: 'SUPER_ADMIN' },
    select: { email: true, totpSecret: true, totpEnabledAt: true },
  });
  if (!admin || !admin.totpSecret) {
    console.log('No SUPER_ADMIN with a TOTP secret. Run `pnpm seed:admin` first.');
    return;
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const code = generateTotp(admin.totpSecret, Math.floor(nowSec / 30));
  const secondsLeft = 30 - (nowSec % 30);
  console.log(`email: ${admin.email}`);
  console.log(`TOTP code: ${code}   (valid ~${secondsLeft}s)`);
  console.log(`enabled: ${admin.totpEnabledAt ? 'yes' : 'NO (run seed:admin)'}`);
}

main()
  .catch((e) => {
    console.error('Failed:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
