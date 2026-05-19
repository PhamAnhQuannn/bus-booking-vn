/**
 * Unit tests for lib/auth/refreshToken.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  delete process.env.REFRESH_TOKEN_SECRET;
  // NODE_ENV is already 'test' in vitest — no assignment needed
});

afterEach(() => {
  delete process.env.REFRESH_TOKEN_SECRET;
});

describe('refreshToken', () => {
  it('produce + verify roundtrip returns matching payload', async () => {
    const { produce, verify, generateFamily } = await import('../refreshToken');
    const family = generateFamily();
    const input = {
      tokenId: 'tok-id-001',
      family,
      customerId: 'cust-001',
      iat: Math.floor(Date.now() / 1000),
      rotation: 0,
    };
    const { token, hash } = produce(input);
    const result = verify(token);
    expect(result).not.toBeNull();
    expect(result!.payload.tokenId).toBe(input.tokenId);
    expect(result!.payload.family).toBe(family);
    expect(result!.payload.customerId).toBe(input.customerId);
    expect(result!.payload.rotation).toBe(0);
    expect(result!.hash).toBe(hash);
  });

  it('hash matches SHA-256 hex of the token string', async () => {
    const { produce } = await import('../refreshToken');
    const crypto = await import('crypto');
    const { token, hash } = produce({
      tokenId: 'tok-id-002',
      family: crypto.randomUUID(),
      customerId: 'cust-002',
      iat: Math.floor(Date.now() / 1000),
      rotation: 1,
    });
    const expectedHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    expect(hash).toBe(expectedHash);
  });

  it('tampered HMAC returns null', async () => {
    const { produce, verify } = await import('../refreshToken');
    const { token } = produce({
      tokenId: 'tok-id-003',
      family: 'fam-003',
      customerId: 'cust-003',
      iat: Math.floor(Date.now() / 1000),
      rotation: 0,
    });
    // token format: <base64url>.<hex-hmac>
    const dotIdx = token.lastIndexOf('.');
    const badHmac = 'a'.repeat(64);
    const tampered = token.slice(0, dotIdx + 1) + badHmac;
    expect(verify(tampered)).toBeNull();
  });

  it('tampered payload returns null', async () => {
    const { produce, verify } = await import('../refreshToken');
    const { token } = produce({
      tokenId: 'tok-id-004',
      family: 'fam-004',
      customerId: 'cust-004',
      iat: Math.floor(Date.now() / 1000),
      rotation: 0,
    });
    // Replace the base64url payload section with a different one
    const dotIdx = token.lastIndexOf('.');
    const hmac = token.slice(dotIdx + 1);
    // Mangle the payload
    const parts = token.slice(0, dotIdx).split('');
    parts[0] = parts[0] === 'e' ? 'f' : 'e';
    const tampered = parts.join('') + '.' + hmac;
    expect(verify(tampered)).toBeNull();
  });

  it('verify(null as unknown as string) returns null without throwing', async () => {
    const { verify } = await import('../refreshToken');
    expect(verify(null as unknown as string)).toBeNull();
  });

  it('verify("") returns null without throwing', async () => {
    const { verify } = await import('../refreshToken');
    expect(verify('')).toBeNull();
  });

  it('verify("one-segment") returns null without throwing', async () => {
    const { verify } = await import('../refreshToken');
    expect(verify('one-segment')).toBeNull();
  });

  it('generateFamily returns a UUID string', async () => {
    const { generateFamily } = await import('../refreshToken');
    const fam = generateFamily();
    expect(fam).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});
