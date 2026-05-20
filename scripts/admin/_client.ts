/**
 * Standalone PrismaClient for the platform-admin CLI (Issue 020, AC6).
 *
 * Node-only: builds its own Pool + PrismaPg adapter from DATABASE_URL (mirrors
 * prisma/seed.ts) instead of importing lib/db/client — keeps the CLI free of the
 * Next.js singleton + its env-loading assumptions. Run via
 *   tsx --env-file=.env.production scripts/admin/<name>.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as os from 'node:os';

export function makePrisma(): { prisma: PrismaClient; close: () => Promise<void> } {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  return { prisma, close: () => prisma.$disconnect() };
}

/** Who ran the CLI — OS user, overridable with --actor=<name>. Recorded in AdminAuditLog.actor. */
export function resolveActor(argv: string[]): string {
  const flag = argv.find((a) => a.startsWith('--actor='));
  if (flag) return flag.slice('--actor='.length);
  try {
    return `cli:${os.userInfo().username}`;
  } catch {
    return 'cli';
  }
}

/** True when --confirm is present. Write-CLIs must no-op + exit non-zero without it. */
export function hasConfirm(argv: string[]): boolean {
  return argv.includes('--confirm');
}

/** Read --key=value; returns undefined when absent. */
export function readOpt(argv: string[], key: string): string | undefined {
  const flag = argv.find((a) => a.startsWith(`--${key}=`));
  return flag ? flag.slice(`--${key}=`.length) : undefined;
}

/** First non-flag positional arg (the id), or undefined. */
export function readPositional(argv: string[]): string | undefined {
  return argv.find((a) => !a.startsWith('--'));
}
