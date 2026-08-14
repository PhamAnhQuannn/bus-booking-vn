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
 * needsRehash() flags a hash below the current work factor so callers upgrade it on a
 * successful login (rehash-on-verify).
 *
 * Scrypt cost (#441): N = 2^17 (OWASP-recommended), up from the pre-#441 2^14. N is encoded
 * in the hash (`scrypt$<N>$<salt>$<hash>`); the legacy 2-part form decodes to N = 16384 and
 * still verifies, then upgrades on next login. Even with argon2 OFF, the scrypt baseline now
 * meets OWASP.
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
 *
 * #591 — this flag is effectively ONE-WAY. Once enabled, users who log in get `$argon2id$…`
 * hashes (rehash-on-verify). If it is later turned OFF, verify() gates the native import out
 * for `$argon2`-prefixed hashes → `verifyScrypt('$argon2…') → false` = a lockout for every
 * argon2-hashed user, and needsRehash() returns false for `$argon2` so it never self-heals.
 * The gate is deliberately NOT relaxed to attempt argon2 when off — its whole purpose is to
 * never load an addon that can segfault (uncatchably) on the running host. Operational rule:
 * do not disable AUTH_ARGON2_ENABLED once any account has been hashed with argon2. To retire
 * argon2, roll users back to scrypt via a verify-time re-hash BEFORE flipping the flag.
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
const SCRYPT_R = 8;
const SCRYPT_P = 1;
// #441: current cost factor N = 2^17 (OWASP-recommended for scrypt r=8,p=1), up from the
// pre-#441 default of 2^14 (16384, ~8x below OWASP). N is now ENCODED in the hash so old
// hashes keep verifying at their own N and needsRehash() can upgrade them on next login.
// #585: overridable via the SCRYPT_N env var for ops tuning without a code change. Raising N
// makes needsRehash() upgrade lower-N hashes on the next login; lowering it just stops upgrades
// (existing higher-N hashes keep verifying at their own encoded N). The override is validated:
// a positive power of two in [2^14, 2^20] — anything else (typo, junk) falls back to the default,
// so a fat-fingered env var can never silently weaken hashing to an absurd N.
function resolveScryptN(): number {
  const DEFAULT_N = 131072; // 2^17
  const raw = process.env.SCRYPT_N;
  if (!raw) return DEFAULT_N;
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 16384 && n <= 1048576 && (n & (n - 1)) === 0) return n;
  return DEFAULT_N;
}
const SCRYPT_N = resolveScryptN();
// Legacy 3-part hashes (`scrypt$salt$hash`, no encoded N) were all produced at this N.
const LEGACY_SCRYPT_N = 16384;
export const SCRYPT_PREFIX = 'scrypt$';

// scrypt needs maxmem > 128 * N * r; Node's 32 MB default is exceeded at N = 2^17
// (128 * 131072 * 8 ≈ 128 MB), so set an explicit ceiling with headroom.
function scryptMaxmem(n: number): number {
  return 128 * n * SCRYPT_R * 2;
}

interface ParsedScrypt {
  n: number;
  salt: string;
  hashHex: string;
}

/**
 * Parse a stored scrypt hash. Supports both the new `scrypt$<N>$<salt>$<hash>` form and
 * the legacy `scrypt$<salt>$<hash>` form (no encoded N → LEGACY_SCRYPT_N). Returns null
 * for any malformed value.
 */
function parseScrypt(storedHash: string): ParsedScrypt | null {
  const parts = storedHash.slice(SCRYPT_PREFIX.length).split('$');
  if (parts.length === 3) {
    const n = Number(parts[0]);
    if (!Number.isInteger(n) || n <= 0) return null;
    return { n, salt: parts[1], hashHex: parts[2] };
  }
  if (parts.length === 2) {
    return { n: LEGACY_SCRYPT_N, salt: parts[0], hashHex: parts[1] };
  }
  return null;
}

async function hashScrypt(plain: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scryptAsync(plain, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: scryptMaxmem(SCRYPT_N),
  });
  return `${SCRYPT_PREFIX}${SCRYPT_N}$${salt}$${derived.toString('hex')}`;
}

async function verifyScrypt(storedHash: string, plain: string): Promise<boolean> {
  const parsed = parseScrypt(storedHash);
  if (!parsed) return false;
  const expected = Buffer.from(parsed.hashHex, 'hex');
  try {
    const derived = await scryptAsync(plain, parsed.salt, SCRYPT_KEYLEN, {
      N: parsed.n,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: scryptMaxmem(parsed.n),
    });
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
 * True when a stored hash should be upgraded on a successful login (rehash-on-verify); the
 * caller then re-hashes the plaintext and persists the result. Cases:
 *   - `$argon2…`             → false (already the strongest available).
 *   - argon2 ENABLED         → true for any scrypt hash (upgrade scrypt → argon2id).
 *   - argon2 OFF, scrypt     → true only when the hash's encoded N is below the current
 *                              SCRYPT_N (legacy/lower-cost); false for a current-N hash, so
 *                              the rehash-on-verify loop settles instead of re-writing forever.
 *   - unknown shape          → true (re-hash to the current scrypt).
 */
export function needsRehash(storedHash: string): boolean {
  if (storedHash.startsWith('$argon2')) return false; // already the strongest available
  if (argon2Enabled()) return true; // upgrade any scrypt hash → argon2id when available
  // argon2 off: upgrade only when this scrypt hash is below the current cost factor (#441),
  // so a legacy N=16384 hash is re-hashed to N=131072 on the next successful login, while a
  // current-strength hash is left alone (else the rehash-on-verify loop would never settle).
  const parsed = storedHash.startsWith(SCRYPT_PREFIX) ? parseScrypt(storedHash) : null;
  if (!parsed) return true; // unknown shape → rehash to the current scrypt
  return parsed.n < SCRYPT_N;
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
