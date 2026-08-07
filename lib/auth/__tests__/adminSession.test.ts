/**
 * Unit tests for admin refresh-token verification (lib/auth/adminSession.ts).
 *
 * P17 (#438): admin refresh tokens verify ONLY under REFRESH_TOKEN_SECRET_ADMIN
 * ('d'*32 test fallback). A token minted under the customer ('c'*32) or operator
 * ('o'*32) secret is rejected — cross-realm blast containment.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { verifyAdminRefreshToken } from '../adminSession';

beforeEach(() => {
  delete process.env.REFRESH_TOKEN_SECRET_ADMIN;
  delete process.env.REFRESH_TOKEN_SECRET_CUSTOMER;
  delete process.env.REFRESH_TOKEN_SECRET_OPERATOR;
});

function sign(secret: string, payload: Record<string, unknown>): string {
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', Buffer.from(secret, 'utf8')).update(b64).digest('hex');
  return `${b64}.${hmac}`;
}

const payload = { tokenId: 't', family: 'f', adminUserId: 'a1', iat: 0, rotation: 0 };

describe('verifyAdminRefreshToken (P17)', () => {
  it('accepts a token signed with the admin secret', () => {
    const result = verifyAdminRefreshToken(sign('d'.repeat(32), payload));
    expect(result).not.toBeNull();
    expect(result!.payload.adminUserId).toBe('a1');
  });

  it('rejects a token signed with the customer secret', () => {
    expect(verifyAdminRefreshToken(sign('c'.repeat(32), payload))).toBeNull();
  });

  it('rejects a token signed with the operator secret', () => {
    expect(verifyAdminRefreshToken(sign('o'.repeat(32), payload))).toBeNull();
  });

  it('rejects a malformed token', () => {
    expect(verifyAdminRefreshToken('not-a-token')).toBeNull();
  });
});
