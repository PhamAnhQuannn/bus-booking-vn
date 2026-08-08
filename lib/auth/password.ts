/**
 * Password hashing utilities.
 *
 * Primary: argon2id via the native `argon2` dependency (P19) — but OPT-IN behind
 *   `AUTH_ARGON2_ENABLED` (default OFF → scrypt, the pre-P19 baseline). The native
 *   `argon2` addon can segfault on some Linux/Node runners (e.g. the CI image, and the
 *   seed under tsx); a segfault is uncatchable, so a `try/catch → scrypt` fallback can't
 *   save it. The gate therefore skips the `import('argon2')` ENTIRELY when off, so those
 *   environments never load the addon. Flip `AUTH_ARGON2_ENABLED=true` only in an env that
 *   has verified argon2 loads (a Vercel Linux preview); rehash-on-verify then upgrades
 *   scrypt hashes to argon2id on the next login. The dynamic import keeps Next.js
 *   file-tracing shipping the native binary; `argon2` is in next.config `serverExternalPackages`.
 *
 * verify() auto-detects the stored algorithm; legacy `scrypt$` hashes still verify.
 * needsRehash() flags a non-argon2id hash so callers upgrade it on a successful login.
 *
 * dummyVerify() runs an equivalent-cost verification on a constant hash via the SAME
 *   primary path, so unknown-user login paths are timing-indistinguishable from a
 *   wrong-password path.
 */

import crypto from 'crypto';
import { promisify } from 'util';

/**
 * argon2id is opt-in (see the module header). When off, hash()/verify() never touch the
 * native addon — pure scrypt. Read `process.env` directly (not the env module) so this
 * low-level util stays dependency-free for tsx/seed and client-safe callers.
 */
function argon2Enabled(): boolean {
  return process.env.AUTH_ARGON2_ENABLED === 'true';
}

// promisify types don't expose the overload with options; cast to bypass
const scryptAsync = promisify(crypto.scrypt) as (
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
  options: crypto.ScryptOptions
) => Promise<Buffer>;

// ---------------------------------------------------------------------------
// Scrypt helpers
// ---------------------------------------------------------------------------

const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
export const SCRYPT_PREFIX = 'scrypt$';

async function hashScrypt(plain: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scryptAsync(plain, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
  return `${SCRYPT_PREFIX}${salt}$${derived.toString('hex')}`;
}

async function verifyScrypt(storedHash: string, plain: string): Promise<boolean> {
  const body = storedHash.slice(SCRYPT_PREFIX.length);
  const dollarIdx = body.indexOf('$');
  if (dollarIdx === -1) return false;
  const salt = body.slice(0, dollarIdx);
  const hashHex = body.slice(dollarIdx + 1);
  const expected = Buffer.from(hashHex, 'hex');
  try {
    const derived = await scryptAsync(plain, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Argon2id helpers (lazy import — falls back on ImportError)
// ---------------------------------------------------------------------------

async function tryArgon2Hash(plain: string): Promise<string | null> {
  if (!argon2Enabled()) return null; // gate the native import out entirely (segfault-safe)
  try {
    const argon2 = await import('argon2');
    return await argon2.hash(plain, { type: argon2.argon2id });
  } catch {
    return null;
  }
}

async function tryArgon2Verify(storedHash: string, plain: string): Promise<boolean | null> {
  if (!argon2Enabled()) return null; // gate the native import out entirely (segfault-safe)
  try {
    const argon2 = await import('argon2');
    return await argon2.verify(storedHash, plain);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Hash a plaintext password.
 * Tries argon2id first; falls back to scrypt if argon2 is unavailable.
 */
export async function hash(plain: string): Promise<string> {
  const argon2Hash = await tryArgon2Hash(plain);
  if (argon2Hash !== null) return argon2Hash;
  return hashScrypt(plain);
}

/**
 * Verify a plaintext password against a stored hash.
 * Auto-detects hash algorithm from the stored value prefix.
 */
export async function verify(storedHash: string, plain: string): Promise<boolean> {
  if (storedHash.startsWith(SCRYPT_PREFIX)) {
    return verifyScrypt(storedHash, plain);
  }
  // Try argon2 (handles $argon2id$ prefix)
  const argon2Result = await tryArgon2Verify(storedHash, plain);
  if (argon2Result !== null) return argon2Result;
  // Fall back to scrypt in case of unexpected hash
  return verifyScrypt(storedHash, plain);
}

/**
 * True when a stored hash should be upgraded (it is not argon2id — i.e. a legacy scrypt
 * hash). Callers re-hash the plaintext on a successful login and persist the argon2id
 * result (rehash-on-verify). Returns false once argon2 is unavailable and the new hash
 * would also be scrypt — the caller checks that before writing.
 */
export function needsRehash(storedHash: string): boolean {
  return !storedHash.startsWith('$argon2');
}

// Dummy hash for timing parity — computed once, never changes. Uses hash() so it runs the
// SAME primary algorithm as a real verify (argon2 when available), keeping the unknown-user
// path timing-indistinguishable from a wrong-password path (QA-LOW, P19).
let _dummyHash: string | null = null;
async function getDummyHash(): Promise<string> {
  if (_dummyHash) return _dummyHash;
  _dummyHash = await hash('DummyPassword1');
  return _dummyHash;
}

/**
 * Run a verification against a dummy hash.
 * Call this on unknown-user login paths so the response time is indistinguishable
 * from a valid-user wrong-password path.
 */
export async function dummyVerify(): Promise<void> {
  const dummyHash = await getDummyHash();
  await verify(dummyHash, 'WrongPassword1');
}
