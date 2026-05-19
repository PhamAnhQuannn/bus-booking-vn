/**
 * Password hashing utilities.
 *
 * Primary: argon2id via lazy `await import('argon2')`.
 * Fallback: Node.js built-in scrypt when argon2 is unavailable (CI without
 *   native addon, edge runtimes, etc.).
 *
 * dummyVerify() runs an equivalent-cost verification on a constant hash
 * so callers can call it on unknown-phone paths to prevent timing attacks.
 *
 * Note: `/* @vite-ignore *\/` suppresses Vite's static import resolution for
 * the optional argon2 dependency — it is intentionally not in package.json.
 */

import crypto from 'crypto';
import { promisify } from 'util';

// promisify types don't expose the overload with options; cast to bypass
const scryptAsync = promisify(crypto.scrypt) as (
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
  options: crypto.ScryptOptions
) => Promise<Buffer>;

// Hide dynamic import from bundler static analysis (Vite/Webpack).
// argon2 is an optional peer dep not in package.json — we don't want
// transform-time resolution failures when it's absent.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dynImport = new Function('m', 'return import(m)') as (m: string) => Promise<any>;

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
  try {
    const argon2 = await dynImport('argon2');
    return await argon2.hash(plain, { type: argon2.argon2id });
  } catch {
    return null;
  }
}

async function tryArgon2Verify(storedHash: string, plain: string): Promise<boolean | null> {
  try {
    const argon2 = await dynImport('argon2');
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

// Dummy hash for timing parity — computed once, never changes.
// Uses scrypt so it's always available without argon2.
let _dummyHash: string | null = null;
async function getDummyHash(): Promise<string> {
  if (_dummyHash) return _dummyHash;
  _dummyHash = await hashScrypt('DummyPassword1');
  return _dummyHash;
}

/**
 * Run a verification against a dummy hash.
 * Call this on unknown-phone login paths so the response time is indistinguishable
 * from a valid-phone wrong-password path.
 */
export async function dummyVerify(): Promise<void> {
  const dummyHash = await getDummyHash();
  await verifyScrypt(dummyHash, 'WrongPassword1');
}
