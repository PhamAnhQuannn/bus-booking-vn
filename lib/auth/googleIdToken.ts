/**
 * Google ID-token verification (OpenID Connect).
 *
 * verifyGoogleIdToken(idToken) — verify a Google-issued id_token and return the
 * identity ({ sub, email, emailVerified, name?, picture? }) or null on any failure.
 *
 * Signature is checked against Google's published JWKS (RS256 only — alg:none and
 * symmetric algs are rejected), issuer must be Google, audience must equal our
 * GOOGLE_CLIENT_ID, and expiry is enforced by jose. `email_verified` is coerced
 * from Google's boolean-or-string representation.
 *
 * Test seam: pass `{ jwks }` (a jose key resolver over a local JWKS) to verify
 * without any network call.
 */

import { jwtVerify, createRemoteJWKSet, type JWTPayload, type JWTVerifyGetKey } from 'jose';

const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
// Google issues tokens with both the bare host and the https:// form historically.
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

let _remoteJwks: JWTVerifyGetKey | null = null;
function getRemoteJwks(): JWTVerifyGetKey {
  if (!_remoteJwks) _remoteJwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URI));
  return _remoteJwks;
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

export interface VerifyGoogleIdTokenOptions {
  /** Test seam: inject a local JWKS resolver to verify without network. */
  jwks?: JWTVerifyGetKey;
  /** Override the expected audience (defaults to GOOGLE_CLIENT_ID env). */
  clientId?: string;
}

function coerceEmailVerified(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true';
  return false;
}

export async function verifyGoogleIdToken(
  idToken: string,
  opts: VerifyGoogleIdTokenOptions = {}
): Promise<GoogleIdentity | null> {
  const audience = opts.clientId ?? process.env.GOOGLE_CLIENT_ID;
  if (!audience) throw new Error('GOOGLE_CLIENT_ID not configured');
  const keys = opts.jwks ?? getRemoteJwks();

  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(idToken, keys, {
      issuer: GOOGLE_ISSUERS,
      audience,
      algorithms: ['RS256'],
    }));
  } catch {
    return null;
  }

  const sub = typeof payload.sub === 'string' ? payload.sub : undefined;
  const email = typeof payload['email'] === 'string' ? payload['email'] : undefined;
  if (!sub || !email) return null;

  const name = typeof payload['name'] === 'string' ? payload['name'] : undefined;
  const picture = typeof payload['picture'] === 'string' ? payload['picture'] : undefined;

  return {
    sub,
    email,
    emailVerified: coerceEmailVerified(payload['email_verified']),
    name,
    picture,
  };
}
