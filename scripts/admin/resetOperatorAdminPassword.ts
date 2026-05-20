/**
 * CLI: regenerate an operator admin's temp password (Issue 020, AC3).
 *
 *   tsx --env-file=.env.production scripts/admin/resetOperatorAdminPassword.ts \
 *     <operatorUserId> [--base-url=https://app.example.com] [--actor=alice] --confirm
 *
 * Dry-run by default: without --confirm it prints the target and exits NON-ZERO
 * with no DB mutation (AC4). Sets a fresh temp password, forces rotation on next
 * login, and revokes every live session (refresh token invalidated). The new temp
 * password is SMS'd — never printed.
 */

import { resetOperatorAdminPassword } from '../../lib/admin/resetOperatorAdminPassword';
import { AdminServiceError } from '../../lib/admin/errors';
import { redactPhone } from '../../lib/audit/redactPhone';
import { makePrisma, resolveActor, hasConfirm, readPositional, readOpt } from './_client';

function resolveBaseUrl(argv: string[]): string {
  const url = readOpt(argv, 'base-url') ?? process.env.APP_BASE_URL;
  if (!url) {
    throw new Error('base URL missing — pass --base-url=https://… or set APP_BASE_URL');
  }
  return url.replace(/\/+$/, '');
}

async function main() {
  const argv = process.argv.slice(2);
  const operatorUserId = readPositional(argv);

  if (!operatorUserId) {
    console.error('usage: resetOperatorAdminPassword <operatorUserId> [--base-url=…] [--actor=…] --confirm');
    process.exit(2);
  }

  const baseUrl = resolveBaseUrl(argv);
  const actor = resolveActor(argv);

  console.log('Proposed: reset operator-admin password');
  console.log(`  operatorUserId: ${operatorUserId}`);
  console.log(`  actor:          ${actor}`);
  console.log('  effect:         fresh temp password (SMS), force change on next login, all sessions revoked');

  if (!hasConfirm(argv)) {
    console.error('\nDry run — re-run with --confirm to apply. No changes made.');
    process.exit(1);
  }

  const { prisma, close } = makePrisma();
  try {
    const result = await resetOperatorAdminPassword(prisma, { operatorUserId, baseUrl, actor });
    console.log('\nReset.');
    console.log(`  phone:           ${redactPhone(result.phone)}`);
    console.log(`  sessionsRevoked: ${result.sessionsRevoked}`);
    console.log('  temp password SMS dispatched (see NotificationLog).');
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
