import { describe, expect, it } from 'vitest';

import { assertDevDatabaseUrl } from '../assertDevDatabaseUrl';

describe('assertDevDatabaseUrl', () => {
  it('passes for a localhost dev-database URL', () => {
    expect(() =>
      assertDevDatabaseUrl('postgresql://user:pass@localhost:5432/bbvn_dev', 'DATABASE_URL'),
    ).not.toThrow();
  });

  it('passes for a 127.0.0.1 shadow-database URL', () => {
    expect(() =>
      assertDevDatabaseUrl('postgresql://user:pass@127.0.0.1:5434/bbvn_shadow', 'SHADOW_DATABASE_URL'),
    ).not.toThrow();
  });

  it('throws for a prod-looking (non-localhost) host', () => {
    expect(() =>
      assertDevDatabaseUrl(
        'postgresql://user:pass@ep-prod-host.neon.tech:5432/bbvn_dev',
        'DATABASE_URL',
      ),
    ).toThrow(/must point at localhost/);
  });

  it('throws when the database name is not the dev or shadow database', () => {
    expect(() =>
      assertDevDatabaseUrl('postgresql://user:pass@localhost:5432/production', 'DATABASE_URL'),
    ).toThrow(/must target the dev or shadow database/);
  });
});
