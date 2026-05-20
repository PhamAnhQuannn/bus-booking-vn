/**
 * CLI: provision a new Operator + bootstrap admin OperatorUser (Issue 020).
 *
 *   tsx --env-file=.env.production scripts/admin/createOperator.ts \
 *     --legal-name="Acme Lines" --email=ops@acme.vn --phone=0901234567 \
 *     [--notification-phone=0907654321] [--base-url=https://app.example.com] \
 *     [--actor=alice] --confirm
 *
 * Dry-run by default: without --confirm it prints the proposed change and exits
 * NON-ZERO with no DB mutation (AC4). The bootstrap temp password is SMS'd to the
 * contact phone — never printed. Phones are redacted in all console output.
 *
 * SPEC NOTE: the issue mentions an optional operator "brand color"; the Operator
 * model has no such column, so it is intentionally not collected here.
 */

import { createOperator } from '../../lib/admin/createOperator';
import { AdminServiceError } from '../../lib/admin/errors';
import { redactPhone } from '../../lib/audit/redactPhone';
import { makePrisma, resolveActor, hasConfirm, readOpt } from './_client';

function resolveBaseUrl(argv: string[]): string {
  const url = readOpt(argv, 'base-url') ?? process.env.APP_BASE_URL;
  if (!url) {
    throw new Error('base URL missing — pass --base-url=https://… or set APP_BASE_URL');
  }
  return url.replace(/\/+$/, '');
}

async function main() {
  const argv = process.argv.slice(2);
  const legalName = readOpt(argv, 'legal-name');
  const contactEmail = readOpt(argv, 'email');
  const contactPhone = readOpt(argv, 'phone');
  const notificationPhone = readOpt(argv, 'notification-phone');

  if (!legalName || !contactEmail || !contactPhone) {
    console.error('usage: createOperator --legal-name=… --email=… --phone=… [--notification-phone=…] [--base-url=…] --confirm');
    process.exit(2);
  }

  const baseUrl = resolveBaseUrl(argv);
  const actor = resolveActor(argv);

  console.log('Proposed: create operator');
  console.log(`  legalName:         ${legalName}`);
  console.log(`  contactEmail:      ${contactEmail}`);
  console.log(`  contactPhone:      ${redactPhone(contactPhone)}`);
  console.log(`  notificationPhone: ${notificationPhone ? redactPhone(notificationPhone) : '(same as contact)'}`);
  console.log(`  actor:             ${actor}`);

  if (!hasConfirm(argv)) {
    console.error('\nDry run — re-run with --confirm to apply. No changes made.');
    process.exit(1);
  }

  const { prisma, close } = makePrisma();
  try {
    const result = await createOperator(prisma, {
      legalName,
      contactEmail,
      contactPhone,
      notificationPhone,
      baseUrl,
      actor,
    });
    console.log('\nCreated.');
    console.log(`  operatorId:     ${result.operatorId}`);
    console.log(`  operatorUserId: ${result.operatorUserId}`);
    console.log(`  loginPhone:     ${redactPhone(result.loginPhone)}`);
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
