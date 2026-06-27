import { execSync } from 'child_process';
import { URL } from 'url';

import { loadEnvLocal } from '../../test/loadEnvLocal';

const env = { ...loadEnvLocal(), ...process.env };
Object.assign(process.env, env);

function assertDevDatabaseUrl(value: string, label: string): void {
  const url = new URL(value);
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error(`${label} must point at localhost for integration tests`);
  }

  if (!url.pathname.endsWith('/bbvn_dev') && !url.pathname.endsWith('/bbvn_shadow')) {
    throw new Error(`${label} must target the dev or shadow database`);
  }
}

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
