import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { resolveDatabasePoolMax, CONNECTION_TIMEOUT_MS, TX_MAX_WAIT_MS, TX_TIMEOUT_MS } from './poolConfig';

// Prisma client singleton -- reuse across hot reloads (dev) AND warm invocations (prod serverless)

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  // Default max is 2 (see poolConfig.ts): the outbox-pattern crons (notify-dispatch,
  // ticket-pdf) open an inner prisma.$transaction while withAdvisoryLock holds one
  // pooled connection, so a 1-connection pool deadlocks them; 2 also relieves the
  // `Promise.all([...])` query fan-out that would otherwise serialize on one connection
  // (sum, not max, of latencies). Total connections = instances × pool_max stays low,
  // and prod's Neon PgBouncer pooler makes these cheap client connections.
  // connectionTimeoutMillis is 10s to absorb Neon autoscale/cold-start latency before a
  // queued acquire fails.
  // #363: one resolver shared with the Zod schema, so client.ts and the config can no
  // longer disagree about the default (they used to: 5 here vs 1 there). Deliberately
  // NOT getEnv() — that would validate the whole environment just to build the DB
  // client, breaking every unit test that transitively imports this module.
  const max = resolveDatabasePoolMax();
  const pool = new Pool({
    connectionString,
    max,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    // Client-level maxWait + timeout so EVERY interactive $transaction (crons + request
    // paths) survives a Neon cold-start: maxWait covers the ACQUIRE, timeout covers the
    // cold-start-inflated RUN (see poolConfig.ts). Per-call opts override (e.g.
    // generate-ticket-pdfs passes timeout:120_000 via runJob, which takes precedence).
    transactionOptions: { maxWait: TX_MAX_WAIT_MS, timeout: TX_TIMEOUT_MS },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;