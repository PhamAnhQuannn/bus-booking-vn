/**
 * operatorUsername — generate the operator login username (2026-06-06, S05).
 *
 * Operators (and their staff) log in by a system-generated username, NOT phone.
 * Format: `${BRAND_ACRONYM}-${last4(phone)}` — uppercase, Vietnamese diacritics
 * stripped, non-alphanumerics removed. Collisions resolved with a `-N` suffix.
 *
 *   buildUsername('Phương Bắc',     '+84901230001') -> 'PB-0001'
 *   buildUsername('Mai Linh Express','0987654321')   -> 'MLE-4321'
 *   buildUsername('Futa',           '0901112222')    -> 'FUT-2222'
 *
 * Lives in lib/auth (the login-identity domain, importable by both the admin and
 * staff provisioning paths). Diacritic stripping is inlined so this helper has no
 * cross-domain imports. Pure builders here; `ensureUniqueUsername` does the
 * collision query and must run inside the transaction that inserts the OperatorUser.
 */

/** Vietnamese diacritic-insensitive normalize (inlined from lib/text/normalizeVi). */
function stripDiacritics(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/** Brand acronym: first letter of each word (multi-word) or first 3 letters (single word). */
export function buildAcronym(brandName: string): string {
  const normalized = stripDiacritics(brandName).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'OP';
  let acronym: string;
  if (words.length === 1) {
    acronym = words[0].slice(0, 3);
  } else {
    acronym = words.map((w) => w[0]).join('').slice(0, 5);
  }
  acronym = acronym.toUpperCase();
  // Guarantee at least 2 chars so usernames never collapse to a single letter.
  if (acronym.length < 2) acronym = (acronym + words[0].toUpperCase()).slice(0, 3);
  return acronym;
}

/** Last 4 digits of a phone number (digits only). Pads short numbers with leading zeros. */
export function last4(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-4).padStart(4, '0');
}

/** Deterministic base username (pre-collision-resolution). */
export function buildUsername(brandName: string, phone: string): string {
  return `${buildAcronym(brandName)}-${last4(phone)}`;
}

/** Minimal shape needed for the collision query — satisfied by prisma + tx clients. */
interface UsernameLookup {
  operatorUser: {
    findMany(args: {
      where: { username: { startsWith: string } };
      select: { username: true };
    }): Promise<Array<{ username: string }>>;
  };
}

/**
 * Resolve `base` to a free username, appending `-2`, `-3`, … on collision.
 * Call inside the insert transaction so the check-then-insert is serialized.
 */
export async function ensureUniqueUsername(
  client: UsernameLookup,
  base: string,
): Promise<string> {
  const existing = await client.operatorUser.findMany({
    where: { username: { startsWith: base } },
    select: { username: true },
  });
  const taken = new Set(existing.map((r) => r.username));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
