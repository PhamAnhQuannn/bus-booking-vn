/**
 * CLI: kill switch for an operator (Issue 020, AC2).
 *
 *   tsx --env-file=.env.production scripts/admin/disableOperator.ts \
 *     <operatorId> [--actor=alice] --confirm
 *
 * Dry-run by default: without --confirm it prints the target and exits NON-ZERO
 * with no DB mutation (AC4). Sets Operator.disabledAt + every OperatorUser.disabledAt,
 * revokes live sessions, force-closes sales on scheduled trips. In-flight paid
 * bookings are honored (untouched).
 */

import { disableOperator } from '../../lib/admin/disableOperator';
import { AdminServiceError } from '../../lib/admin/errors';
import { makePrisma, resolveActor, hasConfirm, readPositional } from './_client';

async function main() {
  const argv = process.argv.slice(2);
  const operatorId = readPositional(argv);

  if (!operatorId) {
    console.error('usage: disableOperator <operatorId> [--actor=…] --confirm');
    process.exit(2);
  }

  const actor = resolveActor(argv);

  console.log('Proposed: disable operator');
  console.log(`  operatorId: ${operatorId}`);
  console.log(`  actor:      ${actor}`);
  console.log('  effect:     operator + all users disabled, sessions revoked, scheduled trips sales-closed');
  console.log('  preserved:  in-flight paid bookings are honored');

  if (!hasConfirm(argv)) {
    console.error('\nDry run — re-run with --confirm to apply. No changes made.');
    process.exit(1);
  }

  const { prisma, close } = makePrisma();
  try {
    const result = await disableOperator(prisma, { operatorId, actor });
    console.log('\nDisabled.');
    console.log(`  disabledAt:      ${result.disabledAt.toISOString()}`);
    console.log(`  usersDisabled:   ${result.usersDisabled}`);
    console.log(`  sessionsRevoked: ${result.sessionsRevoked}`);
    console.log(`  tripsClosed:     ${result.tripsClosed}`);
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
