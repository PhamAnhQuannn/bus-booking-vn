/**
 * Unit tests for lib/auth/googleIdToken.ts — Google ID-token verification.
 *
 * Uses a locally-generated RSA keypair + createLocalJWKSet as the JWKS double, so a
 * valid token is verified with NO network call. Covers: valid accept, wrong-aud,
 * wrong-iss, expired, alg:none, malformed, and email_verified coercion.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  SignJWT,
  exportJWK,
  generateKeyPair,
  createLocalJWKSet,
  type JWTVerifyGetKey,
  type JWK,
} from 'jose';
import { verifyGoogleIdToken } from '../googleIdToken';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const KID = 'test-key-1';
const ISS = 'https://accounts.google.com';

let privateKey: CryptoKey;
let jwks: JWTVerifyGetKey;

async function sign(
  claims: Record<string, unknown>,
  opts: { iss?: string; aud?: string; exp?: string } = {}
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setIssuedAt()
    .setIssuer(opts.iss ?? ISS)
    .setAudience(opts.aud ?? CLIENT_ID)
    .setExpirationTime(opts.exp ?? '5m')
    .sign(privateKey);
}

beforeAll(async () => {
  const kp = await generateKeyPair('RS256', { extractable: true });
  privateKey = kp.privateKey as CryptoKey;
  const publicJwk = (await exportJWK(kp.publicKey)) as JWK;
  jwks = createLocalJWKSet({ keys: [{ ...publicJwk, kid: KID, alg: 'RS256', use: 'sig' }] });
});

describe('verifyGoogleIdToken', () => {
  it('accepts a valid token and returns the identity', async () => {
    const token = await sign({
      sub: 'google-sub-123',
      email: 'traveler@gmail.com',
      email_verified: true,
      name: 'Trip Traveler',
      picture: 'https://example.com/p.png',
    });
    const identity = await verifyGoogleIdToken(token, { jwks, clientId: CLIENT_ID });
    expect(identity).toEqual({
      sub: 'google-sub-123',
      email: 'traveler@gmail.com',
      emailVerified: true,
      name: 'Trip Traveler',
      picture: 'https://example.com/p.png',
    });
  });

  it('coerces email_verified from the string "true"', async () => {
    const token = await sign({ sub: 's', email: 'e@gmail.com', email_verified: 'true' });
    const identity = await verifyGoogleIdToken(token, { jwks, clientId: CLIENT_ID });
    expect(identity?.emailVerified).toBe(true);
  });

  it('treats a missing/false email_verified as false', async () => {
    const t1 = await sign({ sub: 's', email: 'e@gmail.com' });
    const t2 = await sign({ sub: 's', email: 'e@gmail.com', email_verified: 'false' });
    expect((await verifyGoogleIdToken(t1, { jwks, clientId: CLIENT_ID }))?.emailVerified).toBe(false);
    expect((await verifyGoogleIdToken(t2, { jwks, clientId: CLIENT_ID }))?.emailVerified).toBe(false);
  });

  it('rejects a wrong audience', async () => {
    const token = await sign({ sub: 's', email: 'e@gmail.com' }, { aud: 'someone-else' });
    expect(await verifyGoogleIdToken(token, { jwks, clientId: CLIENT_ID })).toBeNull();
  });

  it('rejects a wrong issuer', async () => {
    const token = await sign({ sub: 's', email: 'e@gmail.com' }, { iss: 'https://evil.example.com' });
    expect(await verifyGoogleIdToken(token, { jwks, clientId: CLIENT_ID })).toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await sign({ sub: 's', email: 'e@gmail.com' }, { exp: '-1m' });
    expect(await verifyGoogleIdToken(token, { jwks, clientId: CLIENT_ID })).toBeNull();
  });

  it('rejects an alg:none (unsigned) token', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ sub: 's', email: 'e@gmail.com', iss: ISS, aud: CLIENT_ID })
    ).toString('base64url');
    const unsigned = `${header}.${payload}.`;
    expect(await verifyGoogleIdToken(unsigned, { jwks, clientId: CLIENT_ID })).toBeNull();
  });

  it('rejects a malformed token', async () => {
    expect(await verifyGoogleIdToken('not-a-jwt', { jwks, clientId: CLIENT_ID })).toBeNull();
  });

  it('returns null when sub or email is absent', async () => {
    const noSub = await sign({ email: 'e@gmail.com' });
    const noEmail = await sign({ sub: 's' });
    expect(await verifyGoogleIdToken(noSub, { jwks, clientId: CLIENT_ID })).toBeNull();
    expect(await verifyGoogleIdToken(noEmail, { jwks, clientId: CLIENT_ID })).toBeNull();
  });

  it('throws when no client id is configured', async () => {
    const token = await sign({ sub: 's', email: 'e@gmail.com' });
    const prev = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;
    try {
      await expect(verifyGoogleIdToken(token, { jwks })).rejects.toThrow(/GOOGLE_CLIENT_ID/);
    } finally {
      if (prev !== undefined) process.env.GOOGLE_CLIENT_ID = prev;
    }
  });
});
