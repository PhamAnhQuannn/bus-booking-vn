/**
 * Dev seed: provision a platform SUPER_ADMIN with a random password AND an
 * already-enabled TOTP secret, so you can sign in at /admin/login immediately.
 *
 * The real flow is sealed (CLI bootstrap -> API enroll/confirm, no enroll UI).
 * This dev helper does both in one shot and PRINTS the authenticator secret so
 * you can add it to Google Authenticator / Authy (or any TOTP app) and generate
 * the 6-digit codes every admin login requires.
 *
 * Self-contained prisma bootstrap + deep imports (not the @/lib/auth barrel,
 * which pulls server-only). Idempotent: re-running RESETS the password + TOTP
 * secret on the existing SUPER_ADMIN so you always get working creds.
 *
 * Run:  pnpm tsx --env-file=.env.local scripts/seed/seed-admin.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hash } from '@/lib/auth/password';
import { generateTotpSecret, totpAuthUri, generateTotp } from '@/lib/auth/totp';
import { encryptTotpSecret } from '@/lib/auth/totpCrypto';
import { genTempPassword } from '@/lib/staff/genTempPassword';

const EMAIL = 'admin@busbookvn.local';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const password = genTempPassword();
  const passwordHash = await hash(password);
  const secret = generateTotpSecret();

  const existing = await prisma.adminUser.findFirst({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true, email: true },
  });

  let email: string;
  if (existing) {
    await prisma.adminUser.update({
      where: { id: existing.id },
      data: { passwordHash, totpSecret: encryptTotpSecret(secret), totpEnabledAt: new Date(), status: 'ACTIVE' },
    });
    email = existing.email;
    console.log('Reset existing SUPER_ADMIN (new password + new TOTP secret):');
  } else {
    const admin = await prisma.adminUser.create({
      data: {
        email: EMAIL,
        passwordHash,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        totpSecret: encryptTotpSecret(secret),
        totpEnabledAt: new Date(),
      },
      select: { email: true },
    });
    email = admin.email;
    console.log('Created SUPER_ADMIN (password + TOTP enabled):');
  }

  const code = generateTotp(secret, Math.floor(Date.now() / 1000 / 30));

  console.log(`  email:       ${email}`);
  console.log(`  password:    ${password}`);
  console.log(`  TOTP secret: ${secret}   (add to your authenticator app)`);
  console.log(`  otpauth URI: ${totpAuthUri(secret, email)}`);
  console.log(`  current code (≈30s): ${code}`);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';
  console.log(`  login:       ${baseUrl}/admin/login`);
}

main()
  .catch((e) => {
    console.error('\nFailed:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
