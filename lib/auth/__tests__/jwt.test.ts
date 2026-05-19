/**
 * Unit tests for lib/auth/jwt.ts
 * No mocks needed — jose works in Node without a real DB.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Ensure JWT_SECRET is not set so tests use the 'a'.repeat(32) test fallback
beforeEach(() => {
  delete process.env.JWT_SECRET;
  // NODE_ENV is already 'test' in vitest — no assignment needed
});

afterEach(() => {
  delete process.env.JWT_SECRET;
});

describe('jwt', () => {
  it('sign + verify roundtrip returns correct sub and role', async () => {
    const { signAccess, verifyAccess } = await import('../jwt');
    const token = await signAccess({ sub: 'cust-123', role: 'customer' });
    const payload = await verifyAccess(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe('cust-123');
    expect(payload!.role).toBe('customer');
  });

  it('exp - iat === 900 seconds', async () => {
    const { signAccess, verifyAccess } = await import('../jwt');
    const token = await signAccess({ sub: 'cust-456', role: 'customer' });
    const payload = await verifyAccess(token);
    expect(payload).not.toBeNull();
    // exp and iat are unix timestamps (seconds)
    const { decodeJwt } = await import('jose');
    const decoded = decodeJwt(token);
    expect(decoded.exp).toBeDefined();
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp! - decoded.iat!).toBe(900);
  });

  it('tampered token (mutate one char in payload section) returns null', async () => {
    const { signAccess, verifyAccess } = await import('../jwt');
    const token = await signAccess({ sub: 'cust-789', role: 'customer' });
    // JWT format: header.payload.signature
    const parts = token.split('.');
    // Mutate one character in the payload section
    const payloadChars = parts[1].split('');
    // Flip a char (replace first char with something different)
    payloadChars[0] = payloadChars[0] === 'A' ? 'B' : 'A';
    parts[1] = payloadChars.join('');
    const tampered = parts.join('.');
    const result = await verifyAccess(tampered);
    expect(result).toBeNull();
  });

  it('expired token returns null', async () => {
    const { signAccess } = await import('../jwt');
    const { SignJWT } = await import('jose');

    // Sign with exp already in the past
    const secret = new TextEncoder().encode('a'.repeat(32));
    const expiredToken = await new SignJWT({ sub: 'cust-999', role: 'customer' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('-1s')
      .sign(secret);

    const { verifyAccess } = await import('../jwt');
    const result = await verifyAccess(expiredToken);
    expect(result).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Cross-scope rejection (AC5 — Gap 1)
  // ---------------------------------------------------------------------------

  describe('cross-scope rejection', () => {
    it('verifyAccess returns null for operator-scoped JWT (INVALID_SCOPE guard)', async () => {
      const { signOperatorAccess, verifyAccess } = await import('../jwt');
      const opToken = await signOperatorAccess({ sub: 'op-99', scope: 'operator', role: 'admin', requiresPasswordChange: false, operatorId: 'op-org-1' });
      const result = await verifyAccess(opToken);
      // Must reject — operator scope must not pass the customer guard
      expect(result).toBeNull();
    });

    it('verifyOperatorAccess returns null for customer-scoped JWT (INVALID_SCOPE guard)', async () => {
      const { signAccess, verifyOperatorAccess } = await import('../jwt');
      const custToken = await signAccess({ sub: 'cust-99', role: 'customer' });
      const result = await verifyOperatorAccess(custToken);
      // Must reject — customer scope must not pass the operator guard
      expect(result).toBeNull();
    });
  });
});
