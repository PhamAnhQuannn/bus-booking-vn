import { execSync } from 'child_process';

import { loadEnvLocal } from '../../test/loadEnvLocal';
import { assertDevDatabaseUrl } from '../../test/helpers/assertDevDatabaseUrl';

const env = { ...loadEnvLocal(), ...process.env };
Object.assign(process.env, env);

if (process.env.NODE_ENV === 'production') {
  throw new Error('prepare-int-db must never run in production');
}

const databaseUrl = process.env.DATABASE_URL;
const directUrl = process.env.DIRECT_URL ?? databaseUrl;
const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;

if (!databaseUrl) throw new Error('DATABASE_URL is required');
if (!shadowDatabaseUrl) throw new Error('SHADOW_DATABASE_URL is required');

assertDevDatabaseUrl(databaseUrl, 'DATABASE_URL');
assertDevDatabaseUrl(shadowDatabaseUrl, 'SHADOW_DATABASE_URL');
if (directUrl) assertDevDatabaseUrl(directUrl, 'DIRECT_URL');

execSync('pnpm prisma migrate deploy', {
  stdio: 'inherit',
  env: process.env,
});

execSync('pnpm prisma db seed', {
  stdio: 'inherit',
  env: process.env,
});
