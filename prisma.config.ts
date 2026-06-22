import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    // DIRECT_URL bypasses the connection pooler (Neon built-in or PgBouncer) for migrations/introspect;
    // falls back to DATABASE_URL when no pooler is in use.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
