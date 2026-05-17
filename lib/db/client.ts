import { PrismaClient } from '@prisma/client';

// Prisma client singleton pattern for Next.js
// - In development: reuse global instance across hot reloads (avoids "too many connections")
// - In production: create a new instance per invocation (serverless-safe)

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
