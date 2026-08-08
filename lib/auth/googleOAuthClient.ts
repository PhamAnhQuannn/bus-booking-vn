/**
 * Google OAuth2 client (arctic), built from env at call time.
 *
 * The redirect_uri is derived from NEXT_PUBLIC_BASE_URL and MUST match the URI
 * registered in the Google Cloud console. Throws if creds are missing — callers
 * flag-guard on GOOGLE_OAUTH_ENABLED first, so this only runs when the flow is on.
 */

import { Google } from 'arctic';

/** OIDC scopes: openid → id_token, email + profile → the claims we read once. */
export const GOOGLE_OAUTH_SCOPES = ['openid', 'email', 'profile'];

export function getGoogleClient(): Google {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!clientId || !clientSecret || !baseUrl) {
    throw new Error(
      'Google OAuth env not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / NEXT_PUBLIC_BASE_URL)'
    );
  }
  return new Google(clientId, clientSecret, `${baseUrl.replace(/\/$/, '')}/api/auth/google/callback`);
}
