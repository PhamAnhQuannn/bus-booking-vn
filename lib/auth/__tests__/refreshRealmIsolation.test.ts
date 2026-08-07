/**
 * P17 (#438): per-realm refresh-token secret isolation.
 *
 * Each realm signs + verifies its refresh tokens with its OWN secret (test fallbacks:
 * customer 'c'*32 / operator 'o'*32 / admin 'd'*32). So a token minted under one realm's
 * secret is CRYPTOGRAPHICALLY rejected by the other two realms' verifiers — not merely
 * mismatched on the Session-table lookup. A leaked refresh secret is therefore
 * blast-contained to a single realm.
 *
 * A local sign() replicates the produce() HMAC so tokens can be minted under any realm
 * secret without exporting each module's internal producer.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { verify as verifyCustomer } from '../refreshToken';
import { verifyOpRefreshToken } from '../operatorSession';
import { verifyAdminRefreshToken } from '../adminSession';

const SECRET = { customer: 'c'.repeat(32), operator: 'o'.repeat(32), admin: 'd'.repeat(32) };

function sign(secret: string, payload: Record<string, unknown>): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', Buffer.from(secret, 'utf8')).update(payloadB64).digest('hex');
  return `${payloadB64}.${hmac}`;
}

const base = { tokenId: 't', family: 'f', iat: 0, rotation: 0 };
const customerToken = sign(SECRET.customer, { ...base, customerId: 'c1' });
const operatorToken = sign(SECRET.operator, { ...base, operatorUserId: 'o1' });
const adminToken = sign(SECRET.admin, { ...base, adminUserId: 'a1' });

// Force the test fallbacks (unset any real env so each verifier uses its realm fallback).
beforeEach(() => {
  delete process.env.REFRESH_TOKEN_SECRET_CUSTOMER;
  delete process.env.REFRESH_TOKEN_SECRET_OPERATOR;
  delete process.env.REFRESH_TOKEN_SECRET_ADMIN;
});

describe('P17 refresh-token realm isolation (3×3 matrix)', () => {
  it('a customer token verifies ONLY under the customer verifier', () => {
    expect(verifyCustomer(customerToken)).not.toBeNull();
    expect(verifyOpRefreshToken(customerToken)).toBeNull();
    expect(verifyAdminRefreshToken(customerToken)).toBeNull();
  });

  it('an operator token verifies ONLY under the operator verifier', () => {
    expect(verifyOpRefreshToken(operatorToken)).not.toBeNull();
    expect(verifyCustomer(operatorToken)).toBeNull();
    expect(verifyAdminRefreshToken(operatorToken)).toBeNull();
  });

  it('an admin token verifies ONLY under the admin verifier', () => {
    expect(verifyAdminRefreshToken(adminToken)).not.toBeNull();
    expect(verifyCustomer(adminToken)).toBeNull();
    expect(verifyOpRefreshToken(adminToken)).toBeNull();
  });
});
