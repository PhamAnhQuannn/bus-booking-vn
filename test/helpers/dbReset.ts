import { Prisma } from '@prisma/client';

type DbClient = {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
  $executeRaw(query: Prisma.Sql): Promise<unknown>;
};

const IMMUTABLE_TABLES = new Set([
  '_prisma_migrations',
  'AdminAuditLog',
  'ConsentRecord',
  'LedgerEntry',
]);

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export async function resetIntegrationTables(prisma: DbClient): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>(Prisma.sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = current_schema()
  `);

  const tables = rows
    .map((row) => row.tablename)
    .filter((name) => !IMMUTABLE_TABLES.has(name));

  if (tables.length === 0) return;

  await prisma.$executeRaw(Prisma.sql`
    TRUNCATE TABLE ${Prisma.raw(tables.map(quoteIdent).join(', '))}
    RESTART IDENTITY CASCADE
  `);
}
