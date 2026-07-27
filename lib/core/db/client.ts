import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Prisma client singleton -- reuse across hot reloads (dev) AND warm invocations (prod serverless)

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  // Default max:1 is intentional for Vercel's one-request-per-invocation model —
  // Neon's pooler handles cross-invocation concurrency, so each warm instance
  // needs only a single physical connection. Consequence: `Promise.all([...])`
  // query fan-out serializes on that one connection (sum, not max, of latencies).
  // Multi-connection contexts (local dev, CI integration/e2e where one process
  // serves concurrent requests, and the SKIP-LOCKED/advisory-lock tests) must
  // set DATABASE_POOL_MAX>1. connectionTimeoutMillis is 10s to absorb Neon
  // autoscale/cold-start latency before a queued acquire fails.
  const max = Number(process.env.DATABASE_POOL_MAX) || 1;
  const pool = new Pool({
    connectionString,
    max,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;