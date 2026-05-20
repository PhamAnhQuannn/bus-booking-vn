/**
 * CLI: read-only operator roster (Issue 020). No --confirm, no audit row.
 *
 *   tsx --env-file=.env.production scripts/admin/listOperators.ts
 *
 * Contact phones are redacted in output.
 */

import { listOperators } from '../../lib/admin/listOperators';
import { redactPhone } from '../../lib/audit/redactPhone';
import { makePrisma } from './_client';

async function main() {
  const { prisma, close } = makePrisma();
  try {
    const rows = await listOperators(prisma);
    if (rows.length === 0) {
      console.log('No operators.');
      return;
    }
    console.log(`Operators (${rows.length}):`);
    for (const r of rows) {
      const state = r.disabledAt ? `disabled ${r.disabledAt.toISOString()}` : 'active';
      console.log(`  ${r.id}  ${r.legalName}  ${redactPhone(r.contactPhone)}  [${state}]`);
    }
  } finally {
    await close();
  }
}

main().catch((e) => {
  console.error('Failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
