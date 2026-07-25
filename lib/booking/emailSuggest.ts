/**
 * Email typo suggestion ("did you mean gmail.com?") — client-safe, pure, no I/O.
 *
 * Zod `.email()` only checks SYNTAX, so `123@gmail.co` passes (`.co` is a real
 * TLD) yet the customer never gets their ticket. This catches the common case:
 * a domain that is a near-miss of a popular provider. It NEVER touches the
 * network and keeps no personal data — just a hardcoded list + edit distance.
 *
 * suggestEmail(input) returns a corrected address (e.g. "x@gmail.com") when the
 * domain looks like a typo of a known provider, or null when the address is
 * already fine OR the domain is simply unknown (we do NOT guess at
 * "mycompany.xyz" — only typos of the popular list, to avoid false positives).
 * The local part is never altered.
 */

/** Correct, popular domains. A domain that exactly matches one of these is left
 *  alone (returns null). Also the candidate set the fuzzy match aims at. */
const POPULAR_DOMAINS: readonly string[] = [
  'gmail.com',
  'yahoo.com',
  'yahoo.com.vn',
  'outlook.com',
  'outlook.com.vn',
  'hotmail.com',
  'icloud.com',
  'live.com',
  'proton.me',
  'protonmail.com',
  'fpt.com.vn',
  'fpt.edu.vn',
  'vnn.vn',
  'zoho.com',
  'aol.com',
  'msn.com',
];

/** Exact bad-domain → good-domain overrides for typos edit distance would miss
 *  or rank ambiguously (transpositions, doubled letters). */
const DOMAIN_TYPO_MAP: Readonly<Record<string, string>> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gnail.com': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'iclod.com': 'icloud.com',
};

/** Wrong final label → right final label (the TLD typos we see most). Applied
 *  when the domain isn't otherwise recognised. */
const TLD_TYPO_MAP: Readonly<Record<string, string>> = {
  co: 'com',
  con: 'com',
  cmo: 'com',
  cm: 'com',
  om: 'com',
  comm: 'com',
  coom: 'com',
  vm: 'vn',
};

/** Levenshtein edit distance between two short strings. */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Fix a wrong final label (…gmail.co → …gmail.com) if the rest is a known SLD. */
function fixTld(domain: string): string | null {
  const lastDot = domain.lastIndexOf('.');
  if (lastDot <= 0) return null;
  const tld = domain.slice(lastDot + 1);
  const fixedTld = TLD_TYPO_MAP[tld];
  if (!fixedTld) return null;
  const candidate = `${domain.slice(0, lastDot)}.${fixedTld}`;
  return POPULAR_DOMAINS.includes(candidate) ? candidate : null;
}

/**
 * Suggest a corrected email, or null if the address is already fine / the domain
 * is unknown-but-plausible (no false positive).
 */
export function suggestEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) return null; // no domain to check

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!domain.includes('.')) return null; // not a resolvable domain shape

  // Already a known-good domain → nothing to suggest.
  if (POPULAR_DOMAINS.includes(domain)) return null;

  // 1. Exact typo override.
  const exact = DOMAIN_TYPO_MAP[domain];
  if (exact) return `${local}@${exact}`;

  // 2. Wrong TLD on an otherwise-correct domain (gmail.co → gmail.com).
  const tldFixed = fixTld(domain);
  if (tldFixed) return `${local}@${tldFixed}`;

  // 3. Fuzzy: closest popular domain within a conservative edit-distance budget.
  let best: string | null = null;
  let bestDist = Infinity;
  for (const candidate of POPULAR_DOMAINS) {
    const d = editDistance(domain, candidate);
    if (d < bestDist) {
      bestDist = d;
      best = candidate;
    }
  }
  // Budget: 1 edit for short domains, 2 for longer ones — tight enough that an
  // unrelated domain (mycompany.xyz) never matches.
  const budget = best && best.length >= 10 ? 2 : 1;
  if (best && bestDist > 0 && bestDist <= budget) return `${local}@${best}`;

  return null;
}
