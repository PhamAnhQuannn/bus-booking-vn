/**
 * CLI: bootstrap the FIRST platform SUPER_ADMIN (Issue 057). SEALED / CLI-ONLY.
 *
 *   ADMIN_BOOTSTRAP_EMAIL=… ADMIN_BOOTSTRAP_PASSWORD=… \
 *     tsx --env-file=.env.production scripts/admin/bootstrapSuperAdmin.ts
 *
 * There is NO public/web route for this — the genesis admin credential can only
 * be minted from this sealed CLI reading out-of-band env. The credentials are
 * read from ADMIN_BOOTSTRAP_EMAIL + ADMIN_BOOTSTRAP_PASSWORD (set out-of-band,
 * rotated after first login — see docs/ops/admin-break-glass.md).
 *
 * IDEMPOTENT: re-running when a SUPER_ADMIN already exists prints "already exists"
 * and exits 0 WITHOUT minting a duplicate.
 */

import { bootstrapSuperAdmin } from '../../lib/admin/bootstrapSuperAdmin';
import { AdminServiceError } from '../../lib/admin/errors';
import { makePrisma } from './_client';

async function main() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!email || !password) {
    console.error(
      'bootstrap credentials missing — set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD (out-of-band, sealed env).'
    );
    process.exit(2);
  }

  const { prisma, close } = makePrisma();
  try {
    const result = await bootstrapSuperAdmin(prisma, {
      email,
      password,
      actor: 'cli:bootstrap',
    });
    if (result.created) {
      console.log('Super-admin created.');
      console.log(`  adminUserId: ${result.adminUserId}`);
      console.log('  Rotate ADMIN_BOOTSTRAP_PASSWORD after first login.');
    } else {
      console.log('Super-admin already exists — no change.');
      console.log(`  adminUserId: ${result.adminUserId}`);
    }
  } finally {
    await close();
  }
}

main().catch((e) => {
  if (e instanceof AdminServiceError) {
    console.error(`\nFailed: ${e.code}`);
  } else {
    console.error('\nFailed:', e instanceof Error ? e.message : e);
  }
  process.exit(1);
});
