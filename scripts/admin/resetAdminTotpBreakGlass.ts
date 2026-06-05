/**
 * CLI: BREAK-GLASS lost-TOTP recovery (Issue 057). SEALED / CLI-ONLY.
 *
 *   tsx --env-file=.env.production scripts/admin/resetAdminTotpBreakGlass.ts \
 *     --email=admin@example.com --confirm
 *
 * For the dead-end case the web route cannot serve: the ONLY super-admin lost
 * their TOTP, so there is no other super-admin to reset it via the web route
 * (which enforces actor-is-super-admin + no-self-reset). This sealed CLI resets a
 * target admin's TOTP by EMAIL, authorized NOT by an authenticated super-admin
 * session but by access to the sealed prod env itself (whoever can run
 * `--env-file=.env.production` is the break-glass authority — see
 * docs/ops/admin-break-glass.md for who may run it).
 *
 * It reuses the resetAdminTotp core with bypassActorCheck:true, so the
 * actor-is-super-admin web guard is skipped; the no-self-reset guard still holds
 * (a CLI sentinel actor id is used, distinct from any real admin). The reset is
 * audit-logged with actor='cli:break-glass'.
 *
 * Dry-run by default: without --confirm it prints the target and exits NON-ZERO
 * with no DB mutation.
 */

import { resetAdminTotp } from '../../lib/admin/resetAdminTotp';
import { AdminServiceError } from '../../lib/admin/errors';
import { makePrisma, hasConfirm, readOpt } from './_client';

// Sentinel actor id — distinct from every real AdminUser.id so the no-self-reset
// guard can never collide with the break-glass target.
const BREAK_GLASS_ACTOR_ID = 'cli:break-glass';

async function main() {
  const argv = process.argv.slice(2);
  const email = readOpt(argv, 'email');

  if (!email) {
    console.error('usage: resetAdminTotpBreakGlass --email=admin@example.com --confirm');
    process.exit(2);
  }

  const { prisma, close } = makePrisma();
  try {
    const target = await prisma.adminUser.findUnique({
      where: { email },
      select: { id: true, email: true, role: true },
    });

    if (!target) {
      console.error(`\nNo admin found for email ${email}.`);
      process.exit(1);
    }

    console.log('Proposed: BREAK-GLASS reset admin TOTP');
    console.log(`  targetAdminId: ${target.id}`);
    console.log(`  email:         ${target.email}`);
    console.log(`  role:          ${target.role}`);
    console.log('  effect:        TOTP secret cleared — target re-enrolls on next login');

    if (!hasConfirm(argv)) {
      console.error('\nDry run — re-run with --confirm to apply. No changes made.');
      process.exit(1);
    }

    await resetAdminTotp(prisma, {
      actorAdminId: BREAK_GLASS_ACTOR_ID,
      targetAdminId: target.id,
      actor: 'cli:break-glass',
      bypassActorCheck: true,
    });
    console.log('\nReset. TOTP cleared — target re-enrolls on next login (audit-logged).');
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
