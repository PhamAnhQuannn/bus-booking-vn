import { describe, it, expect } from 'vitest';
import { CONNECTION_TIMEOUT_MS, TX_MAX_WAIT_MS, TX_TIMEOUT_MS } from '../poolConfig';

describe('transaction / pool timeout budgets', () => {
  // Regression guard for the cold-start fix: Prisma's tx-acquire maxWait is the OUTER
  // budget and must fully contain the pool's connection-acquire, or a Neon cold-start
  // that consumes the pool's whole window can still trip maxWait as the connection
  // arrives. A future revert to the 2000ms default (or maxWait <= pool timeout)
  // reintroduces the prod "Unable to start a transaction in the given time" outage —
  // this test fails first.
  it('TX_MAX_WAIT_MS strictly exceeds CONNECTION_TIMEOUT_MS (nested budgets)', () => {
    expect(TX_MAX_WAIT_MS).toBeGreaterThan(CONNECTION_TIMEOUT_MS);
  });

  // Run-duration budget: the tx must be allowed to RUN longer than a cold-start-inflated
  // commit (observed 5023ms in prod), i.e. well above Prisma's 5000ms default. A revert
  // to the default reintroduces "A commit cannot be executed on an expired transaction".
  it('TX_TIMEOUT_MS comfortably exceeds the 5000ms Prisma default', () => {
    expect(TX_TIMEOUT_MS).toBeGreaterThan(5_000);
  });

  it('holds the chosen values', () => {
    expect(CONNECTION_TIMEOUT_MS).toBe(10_000);
    expect(TX_MAX_WAIT_MS).toBe(15_000);
    expect(TX_TIMEOUT_MS).toBe(15_000);
  });
});
